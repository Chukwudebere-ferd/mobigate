package storage

import (
	"context"
	"errors"
	"testing"

	byteship "github.com/byteshipcloud/byteship-go"
)

func TestRetryable(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"not configured", ErrNotConfigured, false},
		{"transport", &byteship.Error{Code: "transport", StatusCode: 0}, true},
		{"rate limited", &byteship.Error{Code: "rate_limited", StatusCode: 429}, true},
		{"server error", &byteship.Error{Code: "server_error", StatusCode: 503}, true},
		{"request timeout", &byteship.Error{Code: "timeout", StatusCode: 408}, true},
		{"bad request", &byteship.Error{Code: "invalid", StatusCode: 400}, false},
		{"context deadline", context.DeadlineExceeded, true},
		{"plain error", errors.New("boom"), false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := Retryable(test.err); got != test.want {
				t.Fatalf("Retryable(%v) = %v, want %v", test.err, got, test.want)
			}
		})
	}
}
