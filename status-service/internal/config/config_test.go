package config

import "testing"

func TestDefaults(t *testing.T) {
	cfg := Load()
	if cfg.ListenAddr != "127.0.0.1:9191" {
		t.Fatalf("unexpected listen addr: %s", cfg.ListenAddr)
	}
	if cfg.CacheTTLSeconds <= 0 {
		t.Fatalf("cache ttl must be positive")
	}
	if cfg.DataDir == "" {
		t.Fatalf("data dir must be set")
	}
}
