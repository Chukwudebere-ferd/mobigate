package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mobigate/mgm-portal/internal/models"
)

// UserByID loads the MGM domain profile for an authenticated Better Auth
// user. The domain row is authoritative for role, tenant and approval
// status; the session payload is never trusted for authorization.
func (s *Store) UserByID(ctx context.Context, id string) (models.User, error) {
	const q = `
		SELECT id, tenant_id, role, email, phone,
		       first_name, last_name, status,
		       email_verified_at, phone_verified_at, last_login_at,
		       created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var (
		user            models.User
		rawID           string
		rawTenantID     *string
		emailVerifiedAt *time.Time
		phoneVerifiedAt *time.Time
		lastLoginAt     *time.Time
	)

	err := s.pool.QueryRow(ctx, q, id).Scan(
		&rawID,
		&rawTenantID,
		&user.Role,
		&user.Email,
		&user.Phone,
		&user.FirstName,
		&user.LastName,
		&user.Status,
		&emailVerifiedAt,
		&phoneVerifiedAt,
		&lastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	if err != nil {
		return models.User{}, err
	}

	user.ID, err = uuid.Parse(rawID)
	if err != nil {
		return models.User{}, err
	}
	if rawTenantID != nil {
		tenantID, parseErr := uuid.Parse(*rawTenantID)
		if parseErr != nil {
			return models.User{}, parseErr
		}
		user.TenantID = &tenantID
	}
	user.EmailVerifiedAt = emailVerifiedAt
	user.PhoneVerifiedAt = phoneVerifiedAt
	user.LastLoginAt = lastLoginAt
	return user, nil
}

// ProvisionApplicant creates the domain users row for a freshly signed-up
// applicant. Better Auth owns the credential; the domain row is what the Go
// API authorises against, and it is always created with the lowest role —
// the client can never choose it.
func (s *Store) ProvisionApplicant(ctx context.Context, id string, email, firstName, lastName string) (models.User, error) {
	userID, err := uuid.Parse(id)
	if err != nil {
		return models.User{}, ErrNotFound
	}

	const q = `
		INSERT INTO users (id, tenant_id, role, email, first_name, last_name, status)
		VALUES ($1, NULL, 'applicant', $2, $3, $4, 'active')
		ON CONFLICT (id) DO NOTHING
	`
	if _, err := s.pool.Exec(ctx, q, userID, email, firstName, lastName); err != nil {
		// A different account already holds this email (CITEXT unique).
		return models.User{}, mapWriteError(err)
	}

	// Reload through the canonical path so the response matches UserByID.
	return s.UserByID(ctx, id)
}

// TenantByID loads a tenant for display (the state scope shown in the admin
// shell). It is not used for authorization decisions.
func (s *Store) TenantByID(ctx context.Context, id string) (models.Tenant, error) {
	const q = `
		SELECT id, name, state_location_id, status, created_at
		FROM tenants
		WHERE id = $1
	`

	var (
		tenant           models.Tenant
		rawID            string
		rawStateLocation *string
	)

	err := s.pool.QueryRow(ctx, q, id).Scan(
		&rawID,
		&tenant.Name,
		&rawStateLocation,
		&tenant.Status,
		&tenant.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Tenant{}, ErrNotFound
	}
	if err != nil {
		return models.Tenant{}, err
	}

	tenant.ID, err = uuid.Parse(rawID)
	if err != nil {
		return models.Tenant{}, err
	}
	if rawStateLocation != nil {
		stateLocationID, parseErr := uuid.Parse(*rawStateLocation)
		if parseErr != nil {
			return models.Tenant{}, parseErr
		}
		tenant.StateLocationID = &stateLocationID
	}
	return tenant, nil
}
