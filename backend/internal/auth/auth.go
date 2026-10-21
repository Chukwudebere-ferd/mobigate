// Package auth verifies Better Auth sessions inside the Go API.
//
// Better Auth issues an httpOnly session cookie. The Go service does not
// re-implement credential checking; it asks the auth service to resolve the
// session and then loads the MGM domain profile for that user. The domain
// row is authoritative for role, tenant and approval status (BR-15).
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/mobigate/mgm-portal/internal/models"
	"github.com/mobigate/mgm-portal/internal/store"
)

// ErrUnauthenticated is returned when no valid session is present.
var ErrUnauthenticated = errors.New("unauthenticated")

// User is the MGM-specific portion of a session.
type User struct {
	ID        string
	Email     string
	Role      models.UserRole
	Status    models.UserStatus
	TenantID  string
	StaffID   string
	FirstName string
	LastName  string
}

// Context is the resolved session for a request.
type Context struct {
	User User
}

// Identity is the Better Auth payload for a session that has not yet been
// matched to a domain users row. It carries no approval status and grants
// no authorisation on its own.
type Identity struct {
	ID        string
	Email     string
	Name      string
	Role      models.UserRole
	TenantID  string
	StaffID   string
}

// UserStore loads the domain profile behind an authenticated identity.
type UserStore interface {
	UserByID(ctx context.Context, id string) (models.User, error)
}

// Verifier resolves a session cookie into a user.
type Verifier struct {
	// BaseURL is the Better Auth server, e.g. http://localhost:3000
	BaseURL string
	// Client is the HTTP client used for session lookups.
	Client *http.Client
	// CacheTTL is how long a resolved session is cached by the caller.
	CacheTTL time.Duration
	// Users loads the authoritative MGM profile. When nil, the verifier
	// falls back to the session payload; only appropriate in development.
	Users UserStore
}

// sessionResponse mirrors the shape of Better Auth's get-session response.
type sessionResponse struct {
	User struct {
		ID        string  `json:"id"`
		Email     string  `json:"email"`
		Name      string  `json:"name"`
		FirstName string  `json:"firstName"`
		LastName  string  `json:"lastName"`
		Role      string  `json:"role"`
		TenantID  *string `json:"tenantId"`
		StaffID   *string `json:"staffId"`
	} `json:"user"`
	Session struct {
		ID        string    `json:"id"`
		ExpiresAt time.Time `json:"expiresAt"`
	} `json:"session"`
}

// VerifyIdentity resolves the session cookie to the Better Auth identity
// without loading the domain profile. It backs the applicant provisioning
// endpoint, which runs precisely when no domain users row exists yet.
func (v *Verifier) VerifyIdentity(r *http.Request) (Identity, error) {
	cookie, err := r.Cookie(v.cookieName(r))
	if err != nil {
		return Identity{}, ErrUnauthenticated
	}

	req, err := http.NewRequestWithContext(
		r.Context(),
		http.MethodGet,
		strings.TrimRight(v.BaseURL, "/")+"/api/auth/get-session",
		nil,
	)
	if err != nil {
		return Identity{}, fmt.Errorf("build session request: %w", err)
	}
	req.Header.Set("Cookie", cookie.Name+"="+cookie.Value)

	resp, err := v.client().Do(req)
	if err != nil {
		return Identity{}, fmt.Errorf("session lookup: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusNotFound {
		return Identity{}, ErrUnauthenticated
	}
	if resp.StatusCode != http.StatusOK {
		return Identity{}, fmt.Errorf("session lookup: unexpected status %d", resp.StatusCode)
	}

	var payload sessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return Identity{}, fmt.Errorf("decode session: %w", err)
	}
	if payload.User.ID == "" {
		return Identity{}, ErrUnauthenticated
	}

	identity := Identity{
		ID:        payload.User.ID,
		Email:     payload.User.Email,
		Name:      strings.TrimSpace(payload.User.Name),
		Role:      models.UserRole(payload.User.Role),
	}
	if payload.User.TenantID != nil {
		identity.TenantID = *payload.User.TenantID
	}
	if payload.User.StaffID != nil {
		identity.StaffID = *payload.User.StaffID
	}
	return identity, nil
}

// Verify resolves the session cookie on the request.
//
// It returns ErrUnauthenticated when the cookie is missing, expired, or
// points at a session that does not exist.
func (v *Verifier) Verify(r *http.Request) (Context, error) {
	identity, err := v.VerifyIdentity(r)
	if err != nil {
		return Context{}, err
	}

	if v.Users != nil {
		domainUser, err := v.Users.UserByID(r.Context(), identity.ID)
		if errors.Is(err, store.ErrNotFound) {
			return Context{}, ErrUnauthenticated
		}
		if err != nil {
			return Context{}, fmt.Errorf("load domain user: %w", err)
		}
		return Context{User: User{
			ID:        domainUser.ID.String(),
			Email:     domainUser.Email,
			Role:      domainUser.Role,
			Status:    domainUser.Status,
			TenantID:  uuidString(domainUser.TenantID),
			FirstName: domainUser.FirstName,
			LastName:  domainUser.LastName,
		}}, nil
	}

	// Development fallback without a users store: the payload supplies the
	// identity, and the split name fields keep older payloads working.
	firstName, lastName := identity.Name, ""
	if idx := strings.IndexAny(identity.Name, " \t"); idx > 0 {
		firstName, lastName = identity.Name[:idx], strings.TrimSpace(identity.Name[idx+1:])
	}
	ctx := Context{
		User: User{
			ID:        identity.ID,
			Email:     identity.Email,
			FirstName: firstName,
			LastName:  lastName,
			Role:      identity.Role,
		},
	}
	if identity.TenantID != "" {
		ctx.User.TenantID = identity.TenantID
	}
	if identity.StaffID != "" {
		ctx.User.StaffID = identity.StaffID
	}
	return ctx, nil
}

func uuidString(id *uuid.UUID) string {
	if id == nil {
		return ""
	}
	return id.String()
}

func (v *Verifier) client() *http.Client {
	if v.Client != nil {
		return v.Client
	}
	return &http.Client{Timeout: 10 * time.Second}
}

// cookieName resolves the session cookie name for the request host.
// Better Auth defaults to a host-prefixed name in production.
func (v *Verifier) cookieName(r *http.Request) string {
	for _, c := range r.Cookies() {
		if strings.HasPrefix(c.Name, "better-auth.session_token") {
			return c.Name
		}
	}
	return "better-auth.session_token"
}

// -- Context plumbing ------------------------------------------------------

type contextKey struct{}

// WithContext attaches a resolved session to the request context.
func WithContext(ctx context.Context, session Context) context.Context {
	return context.WithValue(ctx, contextKey{}, session)
}

// FromContext retrieves the resolved session, if any.
func FromContext(ctx context.Context) (Context, bool) {
	session, ok := ctx.Value(contextKey{}).(Context)
	return session, ok
}

// Middleware rejects unauthenticated requests, non-active accounts, and
// roles outside the allowed set.
func (v *Verifier) Middleware(allowed ...models.UserRole) func(http.Handler) http.Handler {
	return v.middleware(false, allowed...)
}

// MiddlewareAllowPending is used by the self-service endpoints (such as
// /me) so that an account awaiting approval can see its own status. It
// still rejects suspended and disabled accounts.
func (v *Verifier) MiddlewareAllowPending(allowed ...models.UserRole) func(http.Handler) http.Handler {
	return v.middleware(true, allowed...)
}

func (v *Verifier) middleware(allowPending bool, allowed ...models.UserRole) func(http.Handler) http.Handler {
	allowedSet := make(map[models.UserRole]bool, len(allowed))
	for _, role := range allowed {
		allowedSet[role] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session, err := v.Verify(r)
			if err != nil {
				writeAuthError(w, http.StatusUnauthorized, "authentication required", "unauthenticated")
				return
			}

			switch session.User.Status {
			case models.UserStatusActive:
				// allowed
			case models.UserStatusPending:
				if !allowPending {
					writeAuthError(w, http.StatusForbidden, "account pending approval", "account_pending")
					return
				}
			default:
				writeAuthError(w, http.StatusForbidden, "account is not active", "account_inactive")
				return
			}

			if len(allowedSet) > 0 && !allowedSet[session.User.Role] {
				writeAuthError(w, http.StatusForbidden, "insufficient permissions", "forbidden")
				return
			}
			next.ServeHTTP(w, r.WithContext(WithContext(r.Context(), session)))
		})
	}
}

func writeAuthError(w http.ResponseWriter, status int, message, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = fmt.Fprintf(w, `{"error":%q,"code":%q}`, message, code)
}
