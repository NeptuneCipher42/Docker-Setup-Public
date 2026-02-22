package security

import (
	"encoding/json"
	"os"
	"time"

	"github.com/NeptuneCipher42/Gitea-and-NextCloud-Docker-Compose/status-service/internal/model"
)

func LoadSnapshot(path string) model.SecuritySnapshot {
	var out model.SecuritySnapshot
	b, err := os.ReadFile(path)
	if err != nil {
		return model.SecuritySnapshot{
			Status:    "degraded",
			RiskScore: 100,
			LastRun:   "never",
			Error:     "security snapshot not generated yet",
			UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		}
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return model.SecuritySnapshot{
			Status:    "degraded",
			RiskScore: 100,
			LastRun:   "unknown",
			Error:     "security snapshot is invalid JSON",
			UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		}
	}
	if out.Status == "" {
		out.Status = "degraded"
	}
	if out.UpdatedAt == "" {
		out.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	return out
}

func LoadTasks(path string) model.SecurityTasksPayload {
	var out model.SecurityTasksPayload
	b, err := os.ReadFile(path)
	if err != nil {
		return model.SecurityTasksPayload{
			Status:    "degraded",
			Generated: time.Now().UTC().Format(time.RFC3339),
			Tasks: []model.SecurityTask{{
				ID:       "bootstrap-security-scan",
				Priority: "high",
				Title:    "Run initial security scan",
				Impact:   "No security findings are available yet",
				Effort:   "low",
				Action:   "Run deploy/scripts/run-security-scan.sh manually once and verify timer",
				Status:   "open",
			}},
		}
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return model.SecurityTasksPayload{
			Status:    "degraded",
			Generated: time.Now().UTC().Format(time.RFC3339),
		}
	}
	if out.Status == "" {
		out.Status = "ok"
	}
	if out.Generated == "" {
		out.Generated = time.Now().UTC().Format(time.RFC3339)
	}
	return out
}
