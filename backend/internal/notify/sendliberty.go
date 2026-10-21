// Package notify delivers queued notifications through SendLiberty.
//
// Delivery is asynchronous: request handlers only INSERT a pending row into
// notifications (never blocking the response on a provider, README §11.3),
// and the Worker here claims those rows, renders the stored template and
// sends the email. Every attempt is persisted with its outcome so failures
// are visible and retryable in the admin notification log (BR-16).
//
// SMS and WhatsApp are intentionally absent; the schema carries the channel
// column so they slot in later without a migration.
package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// SendLibertyBasePath is the SendLiberty send endpoint.
const SendLibertyBasePath = "/api/send"

// Sender sends one email through SendLiberty's REST API.
//
// Auth is a Bearer API key. The from address must carry the display name
// ("Mobigate Group" <you@gmail.com>) so recipients see the brand rather
// than the relay address.
type Sender struct {
	baseURL string
	apiKey  string
	from    string
	replyTo string
	client  *http.Client
}

// NewSender builds a Sender. An empty apiKey leaves it unconfigured.
func NewSender(baseURL, apiKey, from, replyTo string) *Sender {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		baseURL = "https://sendliberty.com"
	}
	return &Sender{
		baseURL: baseURL,
		apiKey:  strings.TrimSpace(apiKey),
		from:    strings.TrimSpace(from),
		replyTo: strings.TrimSpace(replyTo),
		client:  &http.Client{Timeout: 20 * time.Second},
	}
}

// Configured reports whether sending can succeed.
func (s *Sender) Configured() bool {
	return s != nil && s.apiKey != "" && s.from != ""
}

// HasDisplayFrom reports whether the from address uses the display-name
// format. Startup logs a warning when it does not, so a bare relay address
// cannot silently regress into candidate-facing email.
func (s *Sender) HasDisplayFrom() bool {
	return s != nil && strings.Contains(s.from, "<")
}

// Email is one message to deliver.
type Email struct {
	To      string
	Subject string
	HTML    string
	Text    string
}

// sendRequest is the SendLiberty /api/send body.
type sendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text,omitempty"`
	ReplyTo string   `json:"replyTo,omitempty"`
}

// sendResponse is the subset of the SendLiberty reply we persist.
type sendResponse struct {
	Success bool   `json:"success"`
	Status  int    `json:"status"`
	Error   string `json:"error"`
	Data    struct {
		ID string `json:"id"`
	} `json:"data"`
}

// Send delivers one email and returns the provider reference.
//
// A 429 carries a Retry-After hint which the worker honours; other failures
// return an error so the row retries with backoff.
func (s *Sender) Send(ctx context.Context, email Email) (string, time.Duration, error) {
	if !s.Configured() {
		return "", 0, errors.New("notification sender is not configured")
	}
	if strings.TrimSpace(email.To) == "" {
		return "", 0, errors.New("no recipient address")
	}

	body, err := json.Marshal(sendRequest{
		From:    s.from,
		To:      []string{email.To},
		Subject: email.Subject,
		HTML:    email.HTML,
		Text:    email.Text,
		ReplyTo: s.replyTo,
	})
	if err != nil {
		return "", 0, err
	}

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost, s.baseURL+SendLibertyBasePath, bytes.NewReader(body),
	)
	if err != nil {
		return "", 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("sendliberty request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", 0, fmt.Errorf("sendliberty reply: %w", err)
	}

	var parsed sendResponse
	_ = json.Unmarshal(raw, &parsed)

	switch {
	case resp.StatusCode == http.StatusTooManyRequests:
		retryAfter := parseRetryAfter(resp.Header.Get("Retry-After"))
		return "", retryAfter, fmt.Errorf("sendliberty throttled: %d", resp.StatusCode)
	case resp.StatusCode != http.StatusOK || !parsed.Success:
		message := parsed.Error
		if message == "" {
			message = fmt.Sprintf("status %d", resp.StatusCode)
		}
		return "", 0, fmt.Errorf("sendliberty rejected send: %s", message)
	}

	return parsed.Data.ID, 0, nil
}

// parseRetryAfter reads a Retry-After header, defaulting to one minute when
// the header is absent or unparseable.
func parseRetryAfter(raw string) time.Duration {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Minute
	}
	if seconds, err := time.ParseDuration(raw + "s"); err == nil && seconds > 0 {
		return seconds
	}
	if at, err := http.ParseTime(raw); err == nil {
		if wait := time.Until(at); wait > 0 {
			return wait
		}
	}
	return time.Minute
}
