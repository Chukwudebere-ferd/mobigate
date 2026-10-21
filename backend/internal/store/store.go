// Package store holds the database access layer.
//
// Queries live here rather than in the HTTP handlers so that business rules
// (tenant scoping, sequence allocation, status transitions) have one home.
package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// ErrNotFound is returned when a record does not exist, or exists in a
	// different tenant. Cross-tenant reads surface as not-found rather than
	// forbidden so that record existence is never leaked (BR-15).
	ErrNotFound = errors.New("record not found")

	// ErrConflict is returned on a unique constraint violation.
	ErrConflict = errors.New("record conflict")

	// ErrInvalidTransition is returned when a status change is not allowed.
	ErrInvalidTransition = errors.New("invalid status transition")

	// ErrValidation is returned when cross-field business rules fail.
	ErrValidation = errors.New("validation failed")

	// ErrLocked is returned when an access code has exhausted its failed
	// attempts (BR-06) and requires admin reissue.
	ErrLocked = errors.New("code locked")
)

// Store wraps the connection pool.
type Store struct {
	pool *pgxpool.Pool
}

// New creates a Store around an existing pool.
func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Pool exposes the underlying pool for health checks and migrations.
func (s *Store) Pool() *pgxpool.Pool {
	return s.pool
}

// Ping verifies connectivity.
func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}
