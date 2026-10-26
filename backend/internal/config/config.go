// Package config loads runtime configuration from the environment.
package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds the service configuration.
type Config struct {
	HTTPAddr       string
	DatabaseURL    string
	AuthBaseURL    string
	AuthSecret     string
	AllowedHosts   []string
	AllowedOrigins []string

	// ByteshipAPIKey authenticates file uploads (photos, staff documents).
	// ByteshipVisibility is normally "private", which delivers files through
	// short-lived signed URLs. Some Byteship plans reject private uploads
	// (private_uploads_not_available); those deployments can explicitly opt
	// into "public" for local testing.
	ByteshipAPIKey     string
	ByteshipBaseURL    string
	ByteshipVisibility string

	// SendLiberty delivers transactional email. SendLibertyFrom must use the
	// display-name format so candidates see the brand, not a relay address:
	//   "Mobigate Group" <you@gmail.com>
	SendLibertyAPIKey  string
	SendLibertyBaseURL string
	SendLibertyFrom    string
	SendLibertyReplyTo string
}

// Load reads configuration from the environment, applying safe defaults for
// local development.
//
// The process loads .env automatically so `go run ./cmd/mgm-api` works from
// either the repository root or the backend directory. Real environment
// variables always take precedence.
func Load() (*Config, error) {
	for _, file := range []string{".env", "backend/.env", "../backend/.env"} {
		_ = godotenv.Load(file)
	}

	cfg := &Config{
		HTTPAddr:     env("HTTP_ADDR", ":8080"),
		DatabaseURL:  env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/mgm?sslmode=disable"),
		AuthBaseURL:  env("AUTH_BASE_URL", "http://localhost:3000"),
		AuthSecret:   env("AUTH_SECRET", "dev-secret-change-me"),
		AllowedHosts: strings.Split(env("ALLOWED_HOSTS", "*"), ","),
		AllowedOrigins: strings.Split(
			env("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"),
			",",
		),

		ByteshipAPIKey:     env("BYTESHIP_API_KEY", ""),
		ByteshipBaseURL:    env("BYTESHIP_BASE_URL", ""), // empty = SDK default
		ByteshipVisibility: env("BYTESHIP_VISIBILITY", "private"),

		SendLibertyAPIKey:  env("SENDLIBERTY_API_KEY", ""),
		SendLibertyBaseURL: env("SENDLIBERTY_BASE_URL", "https://sendliberty.com"),
		SendLibertyFrom:    env("SENDLIBERTY_FROM", ""),
		SendLibertyReplyTo: env("SENDLIBERTY_REPLY_TO", ""),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("config: DATABASE_URL is required")
	}
	return cfg, nil
}

func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
