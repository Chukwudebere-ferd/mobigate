// Command mgm-api is the MGM-Portal MVP HTTP API.
//
// The Go service owns the recruitment and personnel domain. Authentication
// is handled by Better Auth, which issues a session cookie; this service
// verifies that cookie before serving any protected route.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mobigate/mgm-portal/internal/auth"
	"github.com/mobigate/mgm-portal/internal/config"
	"github.com/mobigate/mgm-portal/internal/httpapi"
	"github.com/mobigate/mgm-portal/internal/notify"
	"github.com/mobigate/mgm-portal/internal/storage"
	"github.com/mobigate/mgm-portal/internal/store"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		return err
	}

	st := store.New(pool)

	// File storage for application photos and staff documents. Private
	// bucket, delivered through signed URLs (README §11.3). A Byteship plan
	// without private uploads can opt into public mode for local testing.
	fileStore := storage.New(cfg.ByteshipAPIKey, cfg.ByteshipBaseURL, cfg.ByteshipVisibility)
	if !fileStore.Configured() {
		slog.Warn("BYTESHIP_API_KEY is not set: photo and document uploads will fail")
	} else if fileStore.Public() {
		slog.Warn("BYTESHIP_VISIBILITY=public: uploaded documents are publicly readable; use a private-capable Byteship key in production")
	}

	// Email delivery through SendLiberty. The worker drains the pending
	// notifications table; request handlers never block on the provider.
	sender := notify.NewSender(
		cfg.SendLibertyBaseURL, cfg.SendLibertyAPIKey,
		cfg.SendLibertyFrom, cfg.SendLibertyReplyTo,
	)
	if !sender.Configured() {
		slog.Warn("SENDLIBERTY_API_KEY or SENDLIBERTY_FROM is not set: notifications will stay queued")
	} else if !sender.HasDisplayFrom() {
		slog.Warn(`SENDLIBERTY_FROM has no display name; use the format "Mobigate Group" <you@gmail.com>`)
	}
	worker := notify.NewWorker(st, sender, slog.Default())
	go worker.Run(ctx)

	handler := &httpapi.Handler{
		Store:          st,
		AllowedOrigins: cfg.AllowedOrigins,
		AuthBaseURL:    cfg.AuthBaseURL,
		Verifier: &auth.Verifier{
			BaseURL:  cfg.AuthBaseURL,
			CacheTTL: 60 * time.Second,
			Users:    st,
		},
		ApplicationLimiter: httpapi.NewApplicationLimiter(20, time.Hour),
		Storage:            fileStore,
		// The ticket secret is derived from, but never equal to, the auth
		// secret so a leaked auth secret alone cannot mint tickets.
		TicketSecret: cfg.AuthSecret + ":onboarding-ticket",
	}
	// Per-IP throttle on code redemption; BR-06 locks the code itself.
	handler.InitRedeemLimiter(10, 15*time.Minute)
	// Per-IP throttle on the public kiosk routes. The pairing code is the
	// real secret here; the limiter is the backstop against guessing it, and
	// against brute-forcing staff numbers through the lookup route.
	handler.InitKioskLimiter(20, 15*time.Minute)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(middleware.Compress(5))
	r.Use(handler.OriginGuard)

	r.Get("/healthz", func(w http.ResponseWriter, req *http.Request) {
		if err := st.Ping(req.Context()); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// Domain routes live under /api so the frontend can proxy /api to Go and
	// /api/auth to Better Auth on the same origin.
	r.Route("/api", func(api chi.Router) {
		handler.Register(api)
	})

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		slog.Info("listening", "addr", cfg.HTTPAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server failed", "error", err)
			stop()
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
