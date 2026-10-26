package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestTicketRoundTrip(t *testing.T) {
	h := &Handler{TicketSecret: "test-ticket-secret"}
	userID := uuid.New()
	codeID := uuid.New()

	token, err := h.signTicket(userID, codeID)
	if err != nil {
		t.Fatalf("signTicket: %v", err)
	}

	gotUser, gotCode, err := h.verifyTicket(token)
	if err != nil {
		t.Fatalf("verifyTicket: %v", err)
	}
	if gotUser != userID {
		t.Errorf("user ID = %s, want %s", gotUser, userID)
	}
	if gotCode != codeID {
		t.Errorf("code ID = %s, want %s", gotCode, codeID)
	}
}

func TestVerifyTicketRejectsTamperedSignature(t *testing.T) {
	h := &Handler{TicketSecret: "test-ticket-secret"}
	token, err := h.signTicket(uuid.New(), uuid.New())
	if err != nil {
		t.Fatalf("signTicket: %v", err)
	}

	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		t.Fatalf("unexpected ticket shape: %q", token)
	}
	parts[1] = strings.Repeat("A", len(parts[1]))

	if _, _, err := h.verifyTicket(strings.Join(parts, ".")); err == nil {
		t.Fatal("verifyTicket accepted a tampered signature")
	}
}

func TestVerifyTicketRejectsMalformedBody(t *testing.T) {
	h := &Handler{TicketSecret: "test-ticket-secret"}

	for _, body := range []string{
		"not-a-uuid|also-not-a-uuid|123",
		"too|few",
		"too|many|fields|here",
	} {
		if _, _, err := h.verifyTicket(signedTestToken("test-ticket-secret", body)); err == nil {
			t.Errorf("verifyTicket accepted malformed body %q", body)
		}
	}
}

func signedTestToken(secret, body string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(body))
	return base64.RawURLEncoding.EncodeToString([]byte(body)) + "." +
		base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
