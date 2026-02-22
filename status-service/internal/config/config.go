package config

import (
	"os"
	"strconv"
)

type Config struct {
	ListenAddr      string
	CacheTTLSeconds int
	DataDir         string
	WGSubnet        string
}

func Load() Config {
	cfg := Config{
		ListenAddr:      getenv("STATUSD_LISTEN", "127.0.0.1:9191"),
		CacheTTLSeconds: getenvInt("STATUSD_CACHE_TTL_SECONDS", 10),
		DataDir:         getenv("STATUSD_DATA_DIR", "/var/lib/statusd"),
		WGSubnet:        getenv("STATUSD_WG_SUBNET", "10.8.0.0/24"),
	}
	if cfg.CacheTTLSeconds <= 0 {
		cfg.CacheTTLSeconds = 10
	}
	return cfg
}

func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func getenvInt(k string, d int) int {
	if v := os.Getenv(k); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			return parsed
		}
	}
	return d
}
