// Package codes implements access code and Staff ID generation.
//
// Access codes are generated from a Crockford base32 alphabet and stored
// only as a hash (README BR-04, BR-17). The plaintext is returned to the
// caller exactly once, at issue time, and never persisted.
package codes

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"fmt"
	"strings"
)

// crockford is the Crockford base32 alphabet. It excludes I, L, O and U to
// avoid transcription errors when a code is read over the phone or copied
// from an SMS.
const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// DefaultCodeLength is the MVP access code length (README K1).
const DefaultCodeLength = 6

// DefaultTTL is the default access code lifetime in days (BR-05).
const DefaultTTL = 14 * 24

// GenerateAccessCode returns a random uppercase code of the given length.
func GenerateAccessCode(length int) (string, error) {
	if length <= 0 {
		length = DefaultCodeLength
	}

	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate access code: %w", err)
	}

	var b strings.Builder
	for _, b := range buf {
		b.WriteByte(crockford[int(b)%len(crockford)])
	}
	return b.String(), nil
}

// HashAccessCode returns the hex SHA-256 digest stored for a code.
//
// SHA-256 is appropriate here because the code has high entropy (30 bits for
// 6 characters) and is single-use; the concern with fast hashes applies to
// low-entropy passwords, not random tokens.
func HashAccessCode(code string) string {
	sum := sha256.Sum256([]byte(strings.ToUpper(strings.TrimSpace(code))))
	return hex.EncodeToString(sum[:])
}

// Hint returns the last four characters of a code, used to let an
// administrator identify a code in a list without exposing it.
func Hint(code string) string {
	normalised := strings.ToUpper(strings.TrimSpace(code))
	if len(normalised) <= 4 {
		return normalised
	}
	return normalised[len(normalised)-4:]
}

// Normalise trims whitespace and uppercases a user-entered code so that
// entry is forgiving (BR-04).
func Normalise(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

// FormatStaffID builds a Staff ID: STA/{STATE_CODE}/{YEAR}/{0001} (BR-02).
func FormatStaffID(stateCode string, year, sequence int) string {
	return fmt.Sprintf("STA/%s/%d/%04d", stateCode, year, sequence)
}

// FormatApplicationNumber builds an application reference:
// APP/{STATE_CODE}/{YEAR}/{0001} (BR-01).
func FormatApplicationNumber(stateCode string, year, sequence int) string {
	return fmt.Sprintf("APP/%s/%d/%04d", stateCode, year, sequence)
}

// base32 is used only if a future requirement calls for longer tokens.
var base32Enc = base32.StdEncoding.WithPadding(base32.NoPadding)

// GenerateAccessCodeMock returns a fixed-format placeholder code. It exists
// only so the HTTP contract can be exercised before the persistence layer
// lands; production code paths use GenerateAccessCode.
func GenerateAccessCodeMock() string {
	return "K7M2Q9"
}
