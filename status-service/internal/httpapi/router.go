package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/NeptuneCipher42/Gitea-and-NextCloud-Docker-Compose/status-service/internal/model"
)

type Service interface {
	Public() model.PublicSnapshot
	AdminHealth() model.AdminHealthSnapshot
	Security() model.SecuritySnapshot
	SecurityTasks() model.SecurityTasksPayload
}

func NewRouter(svc Service) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/public", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, svc.Public())
	})
	mux.HandleFunc("/admin/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, svc.AdminHealth())
	})
	mux.HandleFunc("/admin/security", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, svc.Security())
	})
	mux.HandleFunc("/admin/security/tasks", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, svc.SecurityTasks())
	})
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	return mux
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
