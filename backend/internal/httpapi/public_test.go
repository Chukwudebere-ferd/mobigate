package httpapi

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mobigate/mgm-portal/internal/store"
)

func TestSplitDisplayName(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		wantFirst string
		wantLast  string
	}{
		{"full name", "Jane Adeyemi", "Jane", "Adeyemi"},
		{"single word", "Jane", "Jane", "Jane"},
		{"empty", "", "New", "Applicant"},
		{"extra whitespace", "  Jane   Adeyemi  ", "Jane", "Adeyemi"},
		{"trailing space only", "Jane ", "Jane", "Jane"},
		{"three parts", "Jane Ngozi Adeyemi", "Jane", "Ngozi Adeyemi"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			first, last := splitDisplayName(test.input)
			if first != test.wantFirst || last != test.wantLast {
				t.Fatalf("splitDisplayName(%q) = (%q, %q), want (%q, %q)",
					test.input, first, last, test.wantFirst, test.wantLast)
			}
		})
	}
}

// applicationRequest builds the multipart request decodeApplicationForm
// expects: the handler parses the body before reading its text fields.
func applicationRequest(t *testing.T, fields map[string]string) *http.Request {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil {
			t.Fatalf("write field %s: %v", key, err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/public/applications", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	if err := request.ParseMultipartForm(2 << 20); err != nil {
		t.Fatalf("parse multipart: %v", err)
	}
	return request
}

func validApplicationFields() map[string]string {
	return map[string]string{
		"first_name":    "Jane",
		"last_name":     "Adeyemi",
		"phone":         "+2348030000000",
		"gender":        "Female",
		"date_of_birth": "1995-04-12",
		"consent":       "true",
	}
}

func TestDecodeApplicationFormConsent(t *testing.T) {
	tests := []struct {
		name    string
		consent string
		wantErr bool
	}{
		{"true", "true", false},
		{"one", "1", false},
		{"on", "on", false},
		{"yes", "yes", false},
		{"uppercase", "TRUE", false},
		{"false", "false", true},
		{"empty", "", true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fields := validApplicationFields()
			fields["consent"] = test.consent

			var in store.ApplicationInput
			err := decodeApplicationForm(applicationRequest(t, fields), &in)
			if test.wantErr {
				if err == nil {
					t.Fatal("expected an error for a submission without consent")
				}
				if in.ConsentAccepted {
					t.Fatal("ConsentAccepted must stay false when consent is absent")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !in.ConsentAccepted {
				t.Fatal("ConsentAccepted = false, want true")
			}
		})
	}
}

func TestDecodeApplicationFormValidation(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(map[string]string)
	}{
		{"missing first name", func(f map[string]string) { delete(f, "first_name") }},
		{"missing last name", func(f map[string]string) { delete(f, "last_name") }},
		{"short phone", func(f map[string]string) { f["phone"] = "123" }},
		{"invalid gender", func(f map[string]string) { f["gender"] = "unknown" }},
		{"future date of birth", func(f map[string]string) { f["date_of_birth"] = "2099-01-01" }},
		{"invalid date of birth", func(f map[string]string) { f["date_of_birth"] = "12/04/1995" }},
		{"invalid location", func(f map[string]string) { f["location_id"] = "not-a-uuid" }},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fields := validApplicationFields()
			test.mutate(fields)

			var in store.ApplicationInput
			if err := decodeApplicationForm(applicationRequest(t, fields), &in); err == nil {
				t.Fatal("expected a validation error")
			}
		})
	}
}

func TestDecodeApplicationFormAcceptsOptionalFields(t *testing.T) {
	// Address, qualification and location are optional: some candidates apply
	// without them and the recruitment team follows up.
	fields := validApplicationFields()
	delete(fields, "gender")
	delete(fields, "date_of_birth")

	var in store.ApplicationInput
	if err := decodeApplicationForm(applicationRequest(t, fields), &in); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if in.Gender != nil || in.DateOfBirth != nil {
		t.Fatal("optional fields must stay nil when absent")
	}
	if !in.ConsentAccepted {
		t.Fatal("ConsentAccepted = false, want true")
	}
}
