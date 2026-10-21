// Package storage persists uploaded files (application photos, staff
// documents) in Byteship, an S3-compatible object store.
//
// Every file is stored private. Nothing is served directly from the bucket;
// the API authorises the caller and then issues a short-lived signed URL
// (README §11.3 "served through an authorization gate").
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
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

// Store wraps the Byteship client.
type Store struct {
	client *byteship.Client
}

// New creates a Store. An empty apiKey leaves the store unconfigured, which
// only makes upload routes fail closed at call time.
func New(apiKey, baseURL string) *Store {
	options := []byteship.Option{byteship.WithAPIKey(apiKey)}
	if strings.TrimSpace(baseURL) != "" {
		options = append(options, byteship.WithBaseURL(baseURL))
	}
	return &Store{client: byteship.NewClient(options...)}
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
		Visibility:  byteship.VisibilityPrivate,
	})
	if err != nil {
		if berr, ok := byteship.AsError(err); ok {
			slog.Warn("byteship upload rejected", "code", berr.Code, "status", berr.StatusCode)
			return "", fmt.Errorf("upload rejected: %s", berr.Code)
		}
		return "", fmt.Errorf("upload: %w", err)
	}
	return uploaded.Path, nil
}

// SignedURL mints a temporary delivery URL for a private file.
func (s *Store) SignedURL(ctx context.Context, key string) (string, error) {
	if !s.Configured() {
		return "", ErrNotConfigured
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
