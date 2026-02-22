package security

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadLatestOrDefault(t *testing.T) {
	dir := t.TempDir()
	s := LoadSnapshot(filepath.Join(dir, "missing.json"))
	if s.Status != "degraded" {
		t.Fatalf("expected degraded fallback")
	}
	p := filepath.Join(dir, "snap.json")
	if err := os.WriteFile(p, []byte(`{"status":"ok","risk_score":12}`), 0o644); err != nil {
		t.Fatal(err)
	}
	s = LoadSnapshot(p)
	if s.Status != "ok" || s.RiskScore != 12 {
		t.Fatalf("unexpected parsed snapshot: %+v", s)
	}
}
