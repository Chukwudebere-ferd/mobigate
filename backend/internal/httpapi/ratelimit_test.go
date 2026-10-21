package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestApplicationLimiterBlocksAfterLimit(t *testing.T) {
	now := time.Date(2026, time.October, 21, 12, 0, 0, 0, time.UTC)
	limiter := NewApplicationLimiter(2, time.Hour)
	limiter.now = func() time.Time { return now }

	handler := limiter.Middleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	request := func(address string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/public/applications", nil)
		req.RemoteAddr = address
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder
	}

	if got := request("203.0.113.10:4100").Code; got != http.StatusNoContent {
		t.Fatalf("first request status = %d, want %d", got, http.StatusNoContent)
	}
	if got := request("203.0.113.10:4101").Code; got != http.StatusNoContent {
		t.Fatalf("second request status = %d, want %d", got, http.StatusNoContent)
	}

	blocked := request("203.0.113.10:4102")
	if blocked.Code != http.StatusTooManyRequests {
		t.Fatalf("third request status = %d, want %d", blocked.Code, http.StatusTooManyRequests)
	}
	if blocked.Header().Get("Retry-After") == "" {
		t.Fatal("blocked response is missing Retry-After")
	}

	if got := request("203.0.113.11:4200").Code; got != http.StatusNoContent {
		t.Fatalf("different address status = %d, want %d", got, http.StatusNoContent)
	}

	now = now.Add(time.Hour + time.Second)
	if got := request("203.0.113.10:4103").Code; got != http.StatusNoContent {
		t.Fatalf("request after window status = %d, want %d", got, http.StatusNoContent)
	}
}

func TestApplicationLimiterAllowsNil(t *testing.T) {
	var limiter *ApplicationLimiter
	handler := limiter.Middleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/public/applications", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
}
