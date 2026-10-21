// Package sequence allocates Application Numbers and Staff IDs.
//
// The allocation is atomic (README BR-03): concurrent applications must
// never collide on a sequence value. This is done with an upsert that
// increments and returns in a single statement, which takes a row lock for
// the duration of the transaction.
package sequence

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Scope identifies which kind of identifier is being allocated.
type Scope string

const (
	// ScopeApplications allocates application numbers (APP/...).
	ScopeApplications Scope = "applications"
	// ScopeStaff allocates Staff IDs (STA/...).
	ScopeStaff Scope = "staff"
)

// Allocator hands out sequential identifiers per tenant per year.
type Allocator struct {
	pool *pgxpool.Pool
}

// New returns an Allocator backed by the given pool.
func New(pool *pgxpool.Pool) *Allocator {
	return &Allocator{pool: pool}
}

// Next increments the sequence for (scope, tenant, year) and returns the
// new value. It must be called inside a transaction when the identifier is
// part of a larger atomic operation, such as staff profile creation.
//
// startAt is the first value to hand out when no counter row exists yet. It
// lets callers account for identifiers imported outside the API (for example
// fixture or migration data) so the first generated ID cannot collide.
func (a *Allocator) Next(ctx context.Context, tx pgx.Tx, scope Scope, tenantID string, year int, prefix, stateCode string, startAt int) (int, error) {
	const q = `
		INSERT INTO id_sequences (id, scope, tenant_id, year, prefix, state_code, last_value)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, GREATEST($6, 1))
		ON CONFLICT (scope, tenant_id, year)
		DO UPDATE SET last_value = GREATEST(id_sequences.last_value + 1, $6)
		RETURNING last_value
	`

	var value int
	err := tx.QueryRow(ctx, q, string(scope), tenantID, year, prefix, stateCode, startAt).Scan(&value)
	if err != nil {
		return 0, fmt.Errorf("allocate %s sequence: %w", scope, err)
	}
	return value, nil
}
