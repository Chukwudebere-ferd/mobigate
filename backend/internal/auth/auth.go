// Package auth verifies Better Auth sessions inside the Go API.
//
// Better Auth issues an httpOnly session cookie. The Go service does not
// re-implement credential checking; it asks the auth service to resolve the
// session and then reads the MGM role and tenant from the returned user.
//
// The resolved context is placed in the request context and used by every
// query to scope results to a tenant (BR-15).
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mobigate/mgm-portal/internal/models"
)

// ErrUnauthenticated is returned when no valid session is present.
var ErrUnauthenticated = errors.New("unauthenticated")

// User is the MGM-specific portion of a session.
type User struct {
	ID       string
	Email    string
	Role     models.UserRole
	TenatID  string
	StaffID  string
	FirstName string
	LastName  string
}

// Context is the resolved session for a request.
type Context struct {
	User User
}

// Verifier resolves a session cookie into a user.
type Verifier struct {
	// BaseURL is the Better Auth server, e.g. http://localhost:3000
	BaseURL string
	// Client is the HTTP client used for session lookups.
	Client *http.Client
	// CacheTTL is how long a resolved session is cached by the caller.
	CacheTTL time.Duration
}

// sessionResponse mirrors the shape of Better Auth's get-session response.
type sessionResponse struct {
	User struct {
		ID        string  `json:"id"`
		Email     string  `json:"email"`
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

// Verify resolves the session cookie on the request.
//
// It returns ErrUnauthenticated when the cookie is missing, expired, or
// points at a session that does not exist.
func (v *Verifier) Verify(r *http.Request) (Context, error) {
	cookie, err := r.Cookie(v.cookieName(r))
	if err != nil {
		return Context{}, ErrUnauthenticated
	}

	req, err := http.NewRequestWithContext(
		r.Context(),
		http.MethodGet,
		strings.TrimRight(v.BaseURL, "/")+"/api/auth/get-session",
		nil,
	)
	if err != nil {
		return Context{}, fmt.Errorf("build session request: %w", err)
	}
	req.Header.Set("Cookie", cookie.Name+"="+cookie.Value)

	resp, err := v.client().Do(req)
	if err != nil {
		return Context{}, fmt.Errorf("session lookup: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusNotFound {
		return Context{}, ErrUnauthenticated
	}
	if resp.StatusCode != http.StatusOK {
		return Context{}, fmt.Errorf("session lookup: unexpected status %d", resp.StatusCode)
	}

	var payload sessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return Context{}, fmt.Errorf("decode session: %w", err)
	}
	if payload.User.ID == "" {
		return Context{}, ErrUnauthenticated
	}

	ctx := Context{
		User: User{
			ID:        payload.User.ID,
			Email:     payload.User.Email,
			FirstName: payload.User.FirstName,
			LastName:  payload.User.LastName,
			Role:      models.UserRole(payload.User.Role),
		},
	}
	if payload.User.TenantID != nil {
		ctx.User.TenatID = *payload.User.TenantID
	}
	if payload.User.StaffID != nil {
		ctx.User.StaffID = *payload.User.StaffID
	}
	return ctx, nil
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

// Middleware rejects unauthenticated requests to the given path prefixes.
func (v *Verifier) Middleware(allowed ...models.UserRole) func(http.Handler) http.Handler {
	allowedSet := make(map[models.UserRole]bool, len(allowed))
	for _, role := range allowed {
		allowedSet[role] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session, err := v.Verify(r)
			if err != nil {
				writeUnauthorized(w)
				return
			}
			if len(allowedSet) > 0 && !allowedSet[session.User.Role] {
				writeForbidden(w)
				return
			}
			next.ServeHTTP(w, r.WithContext(WithContext(r.Context(), session)))
		})
	}
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`{"error":"authentication required"}`))
}

func writeForbidden(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_, _ = w.Write([]byte(`{"error":"insufficient permissions"}`))
}
