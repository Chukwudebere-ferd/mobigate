// Throwaway: reads one active staff ID to test the kiosk with. Deleted after.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mobigate/mgm-portal/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "config:", err)
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "connect:", err)
		os.Exit(1)
	}
	defer pool.Close()

	rows, err := pool.Query(ctx, `
		SELECT sp.staff_id,
		       trim(sp.first_name || ' ' || sp.last_name),
		       COALESCE(d.name, '(no department)'),
		       sp.status
		FROM staff_profiles sp
		LEFT JOIN departments d ON d.id = sp.department_id
		ORDER BY sp.created_at
		LIMIT 5`)
	if err != nil {
		fmt.Fprintln(os.Stderr, "query:", err)
		os.Exit(1)
	}
	defer rows.Close()

	fmt.Println("Available staff records:")
	n := 0
	for rows.Next() {
		var id, name, dept, status string
		if err := rows.Scan(&id, &name, &dept, &status); err != nil {
			fmt.Fprintln(os.Stderr, "scan:", err)
			os.Exit(1)
		}
		fmt.Printf("  %-24s  %-24s  %-18s  [%s]\n", id, name, dept, status)
		n++
	}
	if n == 0 {
		fmt.Println("  (none - staff must be created first)")
	}

	// An open record would block a clock-in, so surface it now rather than
	// letting the test fail with a confusing duplicate error later.
	var open int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM attendance_records WHERE status='open'`).Scan(&open); err == nil {
		fmt.Printf("\nOpen attendance records right now: %d\n", open)
	}
}
