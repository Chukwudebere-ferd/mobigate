package httpapi

import (
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ApplicationLimiter is a small fixed-window limiter for public application
// submissions. It is intentionally in-process: the MVP runs one API instance,
// and the goal is to stop accidental bursts and simple spam without adding a
// Redis dependency. Limits reset when the process restarts.
type ApplicationLimiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	now     func() time.Time
	entries map[string]applicationBucket
	calls   uint64
}

type applicationBucket struct {
	count int
	reset time.Time
}

// NewApplicationLimiter returns a limiter allowing limit requests per client
// address in each window.
func NewApplicationLimiter(limit int, window time.Duration) *ApplicationLimiter {
	return &ApplicationLimiter{
		limit:   limit,
		window:  window,
		now:     time.Now,
		entries: make(map[string]applicationBucket),
	}
}

// Middleware rejects requests over the per-address limit with 429 and a
// Retry-After header. Callers should install middleware.RealIP before this.
func (l *ApplicationLimiter) Middleware(next http.Handler) http.Handler {
	if l == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowed, retryAfter := l.allow(clientAddress(r))
		if !allowed {
			w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(retryAfter.Seconds()))))
			writeError(w, http.StatusTooManyRequests, "too many applications from this address; try again later")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (l *ApplicationLimiter) allow(address string) (bool, time.Duration) {
	now := l.now()

	l.mu.Lock()
	defer l.mu.Unlock()

	l.calls++
	if l.calls%256 == 0 {
		for key, bucket := range l.entries {
			if !now.Before(bucket.reset) {
				delete(l.entries, key)
			}
		}
	}

	bucket, exists := l.entries[address]
	if !exists || !now.Before(bucket.reset) {
		bucket = applicationBucket{count: 0, reset: now.Add(l.window)}
	}
	if bucket.count >= l.limit {
		return false, bucket.reset.Sub(now)
	}
	bucket.count++
	l.entries[address] = bucket
	return true, 0
}

func clientAddress(r *http.Request) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	if address := strings.TrimSpace(r.RemoteAddr); address != "" {
		return address
	}
	return "unknown"
}
