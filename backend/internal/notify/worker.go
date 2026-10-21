package notify

import (
	"context"
	"log/slog"
	"strings"
	"time"
)

// PendingNotification is one queued delivery claimed by the worker.
type PendingNotification struct {
	ID               string
	TemplateKey      string
	RecipientContact string
	Payload          map[string]any
	Attempts         int
}

// Queue is the delivery-side view of the notifications table. It is
// implemented by the store package; defined here so notify does not import
// store (store enqueues, notify delivers).
type Queue interface {
	// ClaimPendingNotifications atomically claims up to limit due rows,
	// marking each with the next attempt time so a crash cannot loop them.
	ClaimPendingNotifications(ctx context.Context, limit int, lease time.Duration) ([]PendingNotification, error)
	// MarkNotificationSent records a successful delivery.
	MarkNotificationSent(ctx context.Context, id, providerRef string) error
	// MarkNotificationRetry records a failed attempt and schedules the next.
	MarkNotificationRetry(ctx context.Context, id string, errMsg string, nextAttempt time.Time) error
	// MarkNotificationFailed records a permanent failure.
	MarkNotificationFailed(ctx context.Context, id, errMsg string) error
	// RenderTemplate resolves a stored template against a payload.
	RenderTemplate(ctx context.Context, key string, payload map[string]any) (subject, html, text string, ok bool)
}

// Worker delivers queued notifications. Sends are serialised because
// SendLiberty accepts one message per second per connected Gmail account;
// parallel sends would only earn 429s.
type Worker struct {
	queue  Queue
	sender *Sender
	logger *slog.Logger

	// interval is how often the worker polls for due rows.
	interval time.Duration
	// maxAttempts is when a delivery is marked permanently failed (BR-16).
	maxAttempts int
	// batch is the maximum rows claimed per poll.
	batch int
}

// NewWorker builds a worker. A nil or unconfigured sender disables delivery;
// rows stay pending rather than being marked failed.
func NewWorker(queue Queue, sender *Sender, logger *slog.Logger) *Worker {
	if logger == nil {
		logger = slog.Default()
	}
	return &Worker{
		queue:       queue,
		sender:      sender,
		logger:      logger,
		interval:    15 * time.Second,
		maxAttempts: 5,
		batch:       10,
	}
}

// Run polls until the context is cancelled. It is started as a goroutine from
// main and never blocks the request that enqueued a notification.
func (w *Worker) Run(ctx context.Context) {
	if w.queue == nil || w.sender == nil || !w.sender.Configured() {
		w.logger.Warn("notification worker idle: sender not configured; queued rows are kept for later")
		<-ctx.Done()
		return
	}
	if !w.sender.HasDisplayFrom() {
		w.logger.Warn("SENDLIBERTY_FROM has no display name; candidates will see a raw address. Use: \"Mobigate Group\" <you@gmail.com>")
	}

	w.logger.Info("notification worker started", "interval", w.interval.String())
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.logger.Info("notification worker stopped")
			return
		case <-ticker.C:
			w.drain(ctx)
		}
	}
}

// drain claims and delivers one batch, pacing sends at one per second.
func (w *Worker) drain(ctx context.Context) {
	claimed, err := w.queue.ClaimPendingNotifications(ctx, w.batch, 5*time.Minute)
	if err != nil {
		w.logger.Error("claim notifications", "error", err.Error())
		return
	}

	for _, item := range claimed {
		if ctx.Err() != nil {
			return
		}
		w.deliver(ctx, item)
		// One accepted send per second per connected account.
		select {
		case <-ctx.Done():
			return
		case <-time.After(1100 * time.Millisecond):
		}
	}
}

// deliver renders and sends one notification, recording the outcome.
func (w *Worker) deliver(ctx context.Context, item PendingNotification) {
	subject, html, text, ok := w.queue.RenderTemplate(ctx, item.TemplateKey, item.Payload)
	if !ok {
		w.logger.Warn("notification has no template", "id", item.ID, "template", item.TemplateKey)
		if err := w.queue.MarkNotificationFailed(ctx, item.ID, "template not found"); err != nil {
			w.logger.Error("mark notification failed", "id", item.ID, "error", err.Error())
		}
		return
	}

	providerRef, retryAfter, err := w.sender.Send(ctx, Email{
		To:      item.RecipientContact,
		Subject: subject,
		HTML:    html,
		Text:    text,
	})
	if err == nil {
		if markErr := w.queue.MarkNotificationSent(ctx, item.ID, providerRef); markErr != nil {
			w.logger.Error("mark notification sent", "id", item.ID, "error", markErr.Error())
		}
		return
	}

	attempts := item.Attempts + 1
	if attempts >= w.maxAttempts {
		w.logger.Error("notification permanently failed", "id", item.ID, "attempts", attempts, "error", err.Error())
		if markErr := w.queue.MarkNotificationFailed(ctx, item.ID, truncate(err.Error(), 500)); markErr != nil {
			w.logger.Error("mark notification failed", "id", item.ID, "error", markErr.Error())
		}
		return
	}

	next := time.Now().Add(backoff(attempts, retryAfter))
	w.logger.Warn("notification delivery failed; will retry", "id", item.ID, "attempts", attempts, "next", next.Format(time.RFC3339), "error", err.Error())
	if markErr := w.queue.MarkNotificationRetry(ctx, item.ID, truncate(err.Error(), 500), next); markErr != nil {
		w.logger.Error("mark notification retry", "id", item.ID, "error", markErr.Error())
	}
}

// backoff returns the wait before the next attempt: exponential, but never
// shorter than a provider throttle hint.
func backoff(attempts int, retryAfter time.Duration) time.Duration {
	wait := time.Duration(1<<uint(attempts)) * 30 * time.Second
	if retryAfter > wait {
		return retryAfter
	}
	return wait
}

func truncate(value string, max int) string {
	value = strings.TrimSpace(value)
	if len(value) <= max {
		return value
	}
	return value[:max]
}
