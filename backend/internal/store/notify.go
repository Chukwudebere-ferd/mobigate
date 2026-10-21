package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mobigate/mgm-portal/internal/notify"
)

// This file implements notify.Queue against the notifications and
// message_templates tables, and provides the enqueue helper used by every
// notification-producing action. The store imports notify for the interface
// and pending type only; notify does not import store, so there is no cycle.

// EnqueueNotification inserts a pending delivery. It runs inside the caller's
// transaction when one is given, so a notification never survives a rolled-back
// action; pass nil for a standalone enqueue.
//
// The payload must never contain an access code (BR-17); it carries names,
// titles and references for template rendering only.
func EnqueueNotification(
	ctx context.Context,
	exec queryer,
	tenantID uuid.UUID,
	recipientUserID *uuid.UUID,
	recipientContact string,
	templateKey string,
	payload map[string]any,
) error {
	if payload == nil {
		payload = map[string]any{}
	}
	_, err := exec.Exec(ctx, `
		INSERT INTO notifications (
			tenant_id, recipient_user_id, recipient_contact, channel,
			template_key, payload, status
		) VALUES ($1,$2,$3,'email',$4,$5,'pending')`,
		tenantID, recipientUserID, recipientContact, templateKey, payload,
	)
	return err
}

// ClaimPendingNotifications implements notify.Queue. Rows are claimed with a
// lease so a crashed worker cannot spin on the same row forever, and FOR
// UPDATE SKIP LOCKED so two API instances never double-send.
func (s *Store) ClaimPendingNotifications(ctx context.Context, limit int, lease time.Duration) ([]notify.PendingNotification, error) {
	if limit < 1 || limit > 100 {
		limit = 10
	}
	const q = `
		UPDATE notifications n
		SET next_attempt_at = now() + $2::interval
		WHERE n.id IN (
			SELECT id FROM notifications
			WHERE status = 'pending'
			  AND channel = 'email'
			  AND (next_attempt_at IS NULL OR next_attempt_at <= now())
			ORDER BY created_at
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING n.id, n.template_key, n.recipient_contact, n.payload, n.attempts`

	rows, err := s.pool.Query(ctx, q, limit, fmt.Sprintf("%f seconds", lease.Seconds()))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]notify.PendingNotification, 0)
	for rows.Next() {
		var (
			item    notify.PendingNotification
			rawID   string
			key     *string
			contact *string
		)
		if err := rows.Scan(&rawID, &key, &contact, &item.Payload, &item.Attempts); err != nil {
			return nil, err
		}
		item.ID = rawID
		if key != nil {
			item.TemplateKey = *key
		}
		if contact != nil {
			item.RecipientContact = *contact
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// MarkNotificationSent implements notify.Queue.
func (s *Store) MarkNotificationSent(ctx context.Context, id, providerRef string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE notifications
		SET status = 'sent', sent_at = now(), provider_ref = $2,
		    error = NULL, next_attempt_at = NULL
		WHERE id = $1`, id, nullIfEmpty(providerRef),
	)
	return err
}

// MarkNotificationRetry implements notify.Queue.
func (s *Store) MarkNotificationRetry(ctx context.Context, id, errMsg string, nextAttempt time.Time) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE notifications
		SET attempts = attempts + 1, error = $2, next_attempt_at = $3
		WHERE id = $1`, id, errMsg, nextAttempt,
	)
	return err
}

// MarkNotificationFailed implements notify.Queue. The row stays visible in
// the admin notification log with status failed (BR-16).
func (s *Store) MarkNotificationFailed(ctx context.Context, id, errMsg string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE notifications
		SET status = 'failed', attempts = attempts + 1, error = $2,
		    next_attempt_at = NULL
		WHERE id = $1`, id, errMsg,
	)
	return err
}

// RenderTemplate resolves a stored template against payload placeholders.
// A tenant-scoped template wins over the global one. The body is treated as
// plain text with {{placeholders}} and wrapped in minimal HTML — SendLiberty
// deliverability guidance prefers light HTML.
func (s *Store) RenderTemplate(ctx context.Context, key string, payload map[string]any) (string, string, string, bool) {
	if strings.TrimSpace(key) == "" {
		return "", "", "", false
	}
	var (
		subject *string
		body    string
	)
	err := s.pool.QueryRow(ctx, `
		SELECT subject, body FROM message_templates
		WHERE key = $1 AND channel = 'email'
		ORDER BY (tenant_id IS NULL) ASC
		LIMIT 1`, key,
	).Scan(&subject, &body)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", false
	}
	if err != nil {
		return "", "", "", false
	}

	renderedSubject := substitute(subjectValue(subject), payload)
	renderedBody := substitute(body, payload)

	html := "<p>" + strings.ReplaceAll(escapeHTML(renderedBody), "\n\n", "</p><p>") + "</p>"
	html = strings.ReplaceAll(html, "\n", "<br />")
	return renderedSubject, html, renderedBody, true
}

func subjectValue(subject *string) string {
	if subject == nil {
		return "Update from Mobigate Group"
	}
	return *subject
}

// substitute replaces {{key}} placeholders. Unknown keys are left verbatim
// so a template mistake is visible rather than silently blank.
func substitute(template string, payload map[string]any) string {
	result := template
	for key, value := range payload {
		placeholder := "{{" + key + "}}"
		replacement := toString(value)
		result = strings.ReplaceAll(result, placeholder, replacement)
	}
	return result
}

func toString(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case nil:
		return ""
	case fmt.Stringer:
		return v.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}

// escapeHTML escapes the characters that would otherwise let template
// payload values inject markup into the delivered email.
func escapeHTML(value string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
		"'", "&#39;",
	)
	return replacer.Replace(value)
}

func nullIfEmpty(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return &value
}
