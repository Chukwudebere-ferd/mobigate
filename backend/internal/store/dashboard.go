package store

import (
	"context"
	"math"

	"github.com/google/uuid"
)

// DashboardMetrics is the admin dashboard payload (README M11).
type DashboardMetrics struct {
	TotalApplications  int          `json:"total_applications"`
	Pending            int          `json:"pending"`
	Shortlisted        int          `json:"shortlisted"`
	Rejected           int          `json:"rejected"`
	Appointed          int          `json:"appointed"`
	TotalStaff         int          `json:"total_staff"`
	ActiveAccessCodes  int          `json:"active_access_codes"`
	ExpiringCodes      int          `json:"expiring_codes"`
	UpcomingInterviews int          `json:"upcoming_interviews"`
	ApplicationsDelta  int          `json:"applications_delta"`
	ApplicationsTrend  []TrendPoint `json:"applications_trend"`
}

// TrendPoint is one day in the 30-day application series.
type TrendPoint struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// Dashboard computes tenant-scoped recruitment metrics. A nil tenant means
// the caller is a Super Admin and sees every state (BR-15).
func (s *Store) Dashboard(ctx context.Context, tenantID *uuid.UUID) (DashboardMetrics, error) {
	const q = `
		WITH app_counts AS (
			SELECT
				count(*)::int AS total,
				count(*) FILTER (WHERE status = 'pending')::int AS pending,
				count(*) FILTER (WHERE status = 'shortlisted')::int AS shortlisted,
				count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
				count(*) FILTER (WHERE status = 'appointed')::int AS appointed,
				count(*) FILTER (
					WHERE submitted_at >= now() - interval '30 days'
				)::int AS recent,
				count(*) FILTER (
					WHERE submitted_at >= now() - interval '60 days'
					  AND submitted_at <  now() - interval '30 days'
				)::int AS prior
			FROM applications
			WHERE ($1::uuid IS NULL OR tenant_id = $1)
		)
		SELECT
			ac.total,
			ac.pending,
			ac.shortlisted,
			ac.rejected,
			ac.appointed,
			ac.recent,
			ac.prior,
			(
				SELECT count(*)::int FROM staff_profiles
				WHERE status = 'active'
				  AND ($1::uuid IS NULL OR tenant_id = $1)
			) AS total_staff,
			(
				SELECT count(*)::int FROM access_codes
				WHERE status = 'active'
				  AND expires_at > now()
				  AND failed_attempts < 5
				  AND ($1::uuid IS NULL OR tenant_id = $1)
			) AS active_access_codes,
			(
				SELECT count(*)::int FROM access_codes
				WHERE status = 'active'
				  AND expires_at > now()
				  AND expires_at <= now() + interval '7 days'
				  AND failed_attempts < 5
				  AND ($1::uuid IS NULL OR tenant_id = $1)
			) AS expiring_codes,
			(
				SELECT count(*)::int FROM interview_announcements
				WHERE status = 'published'
				  AND interview_at >= now()
				  AND interview_at < now() + interval '30 days'
				  AND ($1::uuid IS NULL OR tenant_id = $1)
			) AS upcoming_interviews
		FROM app_counts ac
	`

	var (
		metrics DashboardMetrics
		recent  int
		prior   int
	)
	err := s.pool.QueryRow(ctx, q, tenantID).Scan(
		&metrics.TotalApplications,
		&metrics.Pending,
		&metrics.Shortlisted,
		&metrics.Rejected,
		&metrics.Appointed,
		&recent,
		&prior,
		&metrics.TotalStaff,
		&metrics.ActiveAccessCodes,
		&metrics.ExpiringCodes,
		&metrics.UpcomingInterviews,
	)
	if err != nil {
		return DashboardMetrics{}, err
	}

	switch {
	case prior == 0 && recent > 0:
		metrics.ApplicationsDelta = 100
	case prior == 0:
		metrics.ApplicationsDelta = 0
	default:
		metrics.ApplicationsDelta = int(math.Round(
			float64(recent-prior) / float64(prior) * 100,
		))
	}

	const trendQuery = `
		SELECT
			to_char(d.day::date, 'YYYY-MM-DD') AS date,
			count(a.id)::int AS count
		FROM generate_series(
			current_date - 29,
			current_date,
			interval '1 day'
		) AS d(day)
		LEFT JOIN applications a
			ON a.submitted_at >= d.day
		   AND a.submitted_at <  d.day + interval '1 day'
		   AND ($1::uuid IS NULL OR a.tenant_id = $1)
		GROUP BY d.day
		ORDER BY d.day
	`

	rows, err := s.pool.Query(ctx, trendQuery, tenantID)
	if err != nil {
		return DashboardMetrics{}, err
	}
	defer rows.Close()

	metrics.ApplicationsTrend = make([]TrendPoint, 0, 30)
	for rows.Next() {
		var point TrendPoint
		if err := rows.Scan(&point.Date, &point.Count); err != nil {
			return DashboardMetrics{}, err
		}
		metrics.ApplicationsTrend = append(metrics.ApplicationsTrend, point)
	}
	if err := rows.Err(); err != nil {
		return DashboardMetrics{}, err
	}

	return metrics, nil
}
