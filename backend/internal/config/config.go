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
