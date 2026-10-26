// Package storage persists uploaded files (application photos, staff
// documents) in Byteship, an S3-compatible object store.
//
// The default is a private bucket: nothing is served directly, and the API
// authorises the caller before issuing a short-lived signed URL (README
// §11.3 "served through an authorization gate"). Byteship plans that do not
// include private uploads can explicitly set BYTESHIP_VISIBILITY=public for
// local testing; in that mode delivery uses the file's public URL instead.
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"strings"
	"time"

	byteship "github.com/byteshipcloud/byteship-go"
)

// ErrNotConfigured is returned when no API key is available. Callers surface
// it as 503 so an upload misconfiguration never silently drops a file.
var ErrNotConfigured = errors.New("storage is not configured")

// SignedURLTTL is how long a delivery URL stays valid. Short enough to limit
// leakage if a URL is forwarded, long enough for a browser to fetch an image.
const SignedURLTTL = 10 * time.Minute

// Retryable reports whether an upload error is likely to succeed on another
// attempt. Validation and configuration errors are permanent; transport
// failures, rate limits and upstream 5xx responses are transient.
func Retryable(err error) bool {
	if err == nil || errors.Is(err, ErrNotConfigured) {
		return false
	}
	var apiErr *byteship.Error
	if errors.As(err, &apiErr) {
		if apiErr.StatusCode == 0 {
			return true
		}
		switch apiErr.StatusCode {
		case 408, 425, 429, 500, 502, 503, 504:
			return true
		default:
			return false
		}
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr)
}

// Store wraps the Byteship client.
type Store struct {
	client     *byteship.Client
	visibility byteship.Visibility
}

// New creates a Store. An empty apiKey leaves the store unconfigured, which
// only makes upload routes fail closed at call time.
func New(apiKey, baseURL, visibility string) *Store {
	options := []byteship.Option{byteship.WithAPIKey(apiKey)}
	if strings.TrimSpace(baseURL) != "" {
		options = append(options, byteship.WithBaseURL(baseURL))
	}
	mode := byteship.VisibilityPrivate
	if strings.EqualFold(strings.TrimSpace(visibility), string(byteship.VisibilityPublic)) {
		mode = byteship.VisibilityPublic
	}
	return &Store{client: byteship.NewClient(options...), visibility: mode}
}

// Public reports whether uploads are delivered through public URLs. Callers
// use this to warn loudly; private delivery is the intended default.
func (s *Store) Public() bool {
	return s != nil && s.visibility == byteship.VisibilityPublic
}

// Configured reports whether uploads can succeed.
func (s *Store) Configured() bool {
	return s != nil && s.client != nil
}

// Upload stores one file under path and returns the storage key.
//
// The reader is consumed once. The caller owns validation of content type
// and size; this method only transports the bytes.
func (s *Store) Upload(ctx context.Context, path, filename, contentType string, reader io.Reader, size int64) (string, error) {
	if !s.Configured() {
		return "", ErrNotConfigured
	}

	uploaded, err := s.client.Upload(ctx, byteship.UploadInput{
		Reader:      reader,
		Filename:    filename,
		ContentType: contentType,
		Path:        path,
		ByteSize:    size,
		Visibility:  s.visibility,
	})
	if err != nil {
		if berr, ok := byteship.AsError(err); ok {
			slog.Warn("byteship upload rejected", "code", berr.Code, "status", berr.StatusCode)
			return "", fmt.Errorf("upload rejected: %w", berr)
		}
		return "", fmt.Errorf("upload: %w", err)
	}
	return uploaded.Path, nil
}

// SignedURL mints a temporary delivery URL for a private file. In public
// mode it resolves the file's public URL instead; the API still authorises
// the caller before handing that URL to the browser.
func (s *Store) SignedURL(ctx context.Context, key string) (string, error) {
	if !s.Configured() {
		return "", ErrNotConfigured
	}
	if s.visibility == byteship.VisibilityPublic {
		file, err := s.client.GetFile(ctx, key)
		if err != nil {
			return "", fmt.Errorf("public url: %w", err)
		}
		if file.File.URL == nil || strings.TrimSpace(*file.File.URL) == "" {
			return "", fmt.Errorf("public url: Byteship returned no URL")
		}
		return *file.File.URL, nil
	}
	signed, err := s.client.CreateSignedURL(ctx, key, byteship.CreateSignedURLInput{
		ExpiresInSeconds: int(SignedURLTTL.Seconds()),
	})
	if err != nil {
		return "", fmt.Errorf("signed url: %w", err)
	}
	return signed.SignedURL.URL, nil
}

// Delete removes a stored object. It is called on best-effort cleanup after
// a database failure; a miss is logged, never surfaced as an error.
func (s *Store) Delete(ctx context.Context, key string) {
	if !s.Configured() || key == "" {
		return
	}
	delCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if _, err := s.client.DeleteFile(delCtx, key); err != nil {
		slog.Warn("storage cleanup failed", "key", key, "error", err.Error())
	}
}

// Ping verifies the storage configuration. Byteship exposes no lightweight
// health endpoint through the SDK, so this confirms the client is
// configured; reachability is proven by the first upload.
func (s *Store) Ping(context.Context) error {
	if !s.Configured() {
		return ErrNotConfigured
	}
	return nil
}
