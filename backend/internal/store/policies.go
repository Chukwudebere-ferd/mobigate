package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mobigate/mgm-portal/internal/models"
)

// PolicyInput is the admin-editable subset of a policy.
type PolicyInput struct {
	Title    string
	Body     string
	Audience models.PolicyAudience
	Required bool
	Active   bool
}

const policyColumns = `
	id, title, body, audience, is_required, is_active, version,
	created_by, created_at, updated_at`

func scanPolicy(row pgx.Row) (models.Policy, error) {
	var (
		policy   models.Policy
		rawID    string
		rawBy    *string
		audience string
	)
	err := row.Scan(
		&rawID, &policy.Title, &policy.Body, &audience,
		&policy.Required, &policy.Active, &policy.Version,
		&rawBy, &policy.CreatedAt, &policy.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Policy{}, ErrNotFound
	}
	if err != nil {
		return models.Policy{}, err
	}
	policy.ID, err = uuid.Parse(rawID)
	if err != nil {
		return models.Policy{}, err
	}
	policy.Audience = models.PolicyAudience(audience)
	if rawBy != nil {
		id, err := uuid.Parse(*rawBy)
		if err != nil {
			return models.Policy{}, err
		}
		policy.CreatedBy = &id
	}
	return policy, nil
}

// ListPolicies returns policies in display order. When activeOnly is true,
// disabled policies are omitted; the admin screen passes false.
func (s *Store) ListPolicies(ctx context.Context, activeOnly bool) ([]models.Policy, error) {
	where := ""
	if activeOnly {
		where = " WHERE is_active"
	}
	rows, err := s.pool.Query(ctx, `SELECT `+policyColumns+` FROM policies`+where+`
		ORDER BY is_active DESC, created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Policy, 0)
	for rows.Next() {
		policy, err := scanPolicy(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, policy)
	}
	return items, rows.Err()
}

// ApplicablePolicies returns active policies that apply to one audience.
// "both" policies are included for applicants and staff.
func (s *Store) ApplicablePolicies(ctx context.Context, audience models.PolicyAudience) ([]models.Policy, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+policyColumns+` FROM policies
		WHERE is_active AND (audience = $1 OR audience = 'both')
		ORDER BY created_at ASC`, string(audience))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Policy, 0)
	for rows.Next() {
		policy, err := scanPolicy(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, policy)
	}
	return items, rows.Err()
}

// MissingRequiredPolicies returns the titles of required policies the user
// did not acknowledge. An unknown/stale policy id is ignored; only active
// required policies are enforced.
func (s *Store) MissingRequiredPolicies(ctx context.Context, audience models.PolicyAudience, accepted []uuid.UUID) ([]string, error) {
	policies, err := s.ApplicablePolicies(ctx, audience)
	if err != nil {
		return nil, err
	}
	seen := make(map[uuid.UUID]struct{}, len(accepted))
	for _, id := range accepted {
		seen[id] = struct{}{}
	}
	missing := make([]string, 0)
	for _, policy := range policies {
		if !policy.Required {
			continue
		}
		if _, ok := seen[policy.ID]; !ok {
			missing = append(missing, policy.Title)
		}
	}
	return missing, nil
}

// RecordPolicyAcceptances stores the accepted policy versions. Re-accepting
// the same version is idempotent.
func (s *Store) RecordPolicyAcceptances(ctx context.Context, userID uuid.UUID, accepted []uuid.UUID) error {
	if len(accepted) == 0 {
		return nil
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO policy_acceptances (policy_id, user_id, policy_version)
		SELECT id, $1, version FROM policies WHERE id = ANY($2)
		ON CONFLICT (policy_id, user_id, policy_version) DO NOTHING`,
		userID, accepted)
	return err
}

// CreatePolicy inserts an admin-authored policy.
func (s *Store) CreatePolicy(ctx context.Context, actorID uuid.UUID, in PolicyInput) (models.Policy, error) {
	title := strings.TrimSpace(in.Title)
	body := strings.TrimSpace(in.Body)
	if title == "" || body == "" {
		return models.Policy{}, fmt.Errorf("%w: a policy needs a title and body", ErrValidation)
	}
	if !validAudience(in.Audience) {
		return models.Policy{}, fmt.Errorf("%w: invalid policy audience", ErrValidation)
	}
	row := s.pool.QueryRow(ctx, `
		INSERT INTO policies (title, body, audience, is_required, is_active, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+policyColumns,
		title, body, string(in.Audience), in.Required, in.Active, actorID)
	return scanPolicy(row)
}

// UpdatePolicy edits an existing policy and increments its version, so a
// changed acknowledgement is distinguishable from the original acceptance.
func (s *Store) UpdatePolicy(ctx context.Context, id uuid.UUID, in PolicyInput) (models.Policy, error) {
	title := strings.TrimSpace(in.Title)
	body := strings.TrimSpace(in.Body)
	if title == "" || body == "" {
		return models.Policy{}, fmt.Errorf("%w: a policy needs a title and body", ErrValidation)
	}
	if !validAudience(in.Audience) {
		return models.Policy{}, fmt.Errorf("%w: invalid policy audience", ErrValidation)
	}
	row := s.pool.QueryRow(ctx, `
		UPDATE policies SET
			title = $2, body = $3, audience = $4,
			is_required = $5, is_active = $6,
			version = version + 1, updated_at = now()
		WHERE id = $1
		RETURNING `+policyColumns,
		id, title, body, string(in.Audience), in.Required, in.Active)
	return scanPolicy(row)
}

// DeletePolicy removes a policy. Historic acceptances are removed by the
// foreign-key cascade; the admin UI prefers deactivating when in doubt.
func (s *Store) DeletePolicy(ctx context.Context, id uuid.UUID) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM policies WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func validAudience(audience models.PolicyAudience) bool {
	switch audience {
	case models.PolicyApplicant, models.PolicyStaff, models.PolicyBoth:
		return true
	default:
		return false
	}
}
