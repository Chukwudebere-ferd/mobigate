// Package config loads runtime configuration from the environment.
package config

import (
	"fmt"
	"os"
	"strings"
)

// Config holds the service configuration.
type Config struct {
	HTTPAddr     string
	DatabaseURL  string
	AuthBaseURL  string
	AuthSecret   string
	AllowedHosts []string
}

// Load reads configuration from the environment, applying safe defaults for
// local development.
func Load() (*Config, error) {
	cfg := &Config{
		HTTPAddr:     env("HTTP_ADDR", ":8080"),
		DatabaseURL:  env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/mgm?sslmode=disable"),
		AuthBaseURL:  env("AUTH_BASE_URL", "http://localhost:3000"),
		AuthSecret:   env("AUTH_SECRET", "dev-secret-change-me"),
		AllowedHosts: strings.Split(env("ALLOWED_HOSTS", "*"), ","),
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
