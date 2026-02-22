package main

import (
	"log"
	"net/http"
	"os"

	"github.com/NeptuneCipher42/Gitea-and-NextCloud-Docker-Compose/status-service/internal/collect"
	"github.com/NeptuneCipher42/Gitea-and-NextCloud-Docker-Compose/status-service/internal/config"
	"github.com/NeptuneCipher42/Gitea-and-NextCloud-Docker-Compose/status-service/internal/httpapi"
)

func main() {
	cfg := config.Load()
	if err := os.MkdirAll(cfg.DataDir, 0o755); err != nil {
		log.Fatalf("create data dir: %v", err)
	}
	svc := collect.NewService(cfg)
	h := httpapi.NewRouter(svc)
	log.Printf("statusd listening on %s", cfg.ListenAddr)
	if err := http.ListenAndServe(cfg.ListenAddr, h); err != nil {
		log.Fatal(err)
	}
}
