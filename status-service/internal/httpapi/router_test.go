package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/NeptuneCipher42/Gitea-and-NextCloud-Docker-Compose/status-service/internal/model"
)

type fakeService struct{}

func (fakeService) Public() model.PublicSnapshot { return model.PublicSnapshot{Status: "ok"} }
func (fakeService) AdminHealth() model.AdminHealthSnapshot {
	return model.AdminHealthSnapshot{Status: "ok"}
}
func (fakeService) Security() model.SecuritySnapshot {
	return model.SecuritySnapshot{Status: "ok"}
}
func (fakeService) SecurityTasks() model.SecurityTasksPayload {
	return model.SecurityTasksPayload{Status: "ok"}
}

func TestRoutesReturnJSON(t *testing.T) {
	h := NewRouter(fakeService{})
	for _, path := range []string{"/public", "/admin/health", "/admin/security", "/admin/security/tasks"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("%s expected 200 got %d", path, rr.Code)
		}
		if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
			t.Fatalf("%s expected application/json got %s", path, ct)
		}
		var out map[string]any
		if err := json.Unmarshal(rr.Body.Bytes(), &out); err != nil {
			t.Fatalf("%s invalid json: %v", path, err)
		}
	}
}
