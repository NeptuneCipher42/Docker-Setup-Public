package collect

import (
	"bufio"
	"context"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/NeptuneCipher42/Gitea-and-NextCloud-Docker-Compose/status-service/internal/config"
	"github.com/NeptuneCipher42/Gitea-and-NextCloud-Docker-Compose/status-service/internal/model"
	"github.com/NeptuneCipher42/Gitea-and-NextCloud-Docker-Compose/status-service/internal/security"
)

type Service struct {
	cfg             config.Config
	mu              sync.Mutex
	lastPublic      model.PublicSnapshot
	lastPublicAt    time.Time
	lastAdmin       model.AdminHealthSnapshot
	lastAdminAt     time.Time
	cacheExpiration time.Duration
}

func NewService(cfg config.Config) *Service {
	return &Service{cfg: cfg, cacheExpiration: time.Duration(cfg.CacheTTLSeconds) * time.Second}
}

func (s *Service) Public() model.PublicSnapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	if time.Since(s.lastPublicAt) < s.cacheExpiration && s.lastPublicAt.After(time.Time{}) {
		return s.lastPublic
	}
	out := model.PublicSnapshot{Status: "ok", UpdatedAt: now()}
	out.UptimeSeconds = readUptimeSeconds()
	out.LoadAvg = readLoadAvg()
	out.MemoryUsedMB, out.MemoryTotalMB = readMemInfoMB()
	out.Security = s.publicSecuritySummary()
	count, runtimeMin, err := dockerRuntimeMetrics()
	if err != nil {
		out.Status = "degraded"
		out.Note = "docker metric unavailable"
		out.ContainersUp = -1
		out.ContainerRuntimeMinutes = 0
	} else {
		out.ContainersUp = count
		out.ContainerRuntimeMinutes = runtimeMin
	}
	s.lastPublic = out
	s.lastPublicAt = time.Now()
	return out
}

func (s *Service) publicSecuritySummary() model.PublicSecuritySummary {
	snap := security.LoadSnapshot(filepath.Join(s.cfg.DataDir, "security-latest.json"))
	tasks := security.LoadTasks(filepath.Join(s.cfg.DataDir, "security-tasks.json"))

	riskBand := "low"
	if snap.RiskScore >= 60 {
		riskBand = "high"
	} else if snap.RiskScore >= 25 {
		riskBand = "medium"
	}

	posture := "good"
	if snap.Status != "ok" || riskBand != "low" {
		posture = "watch"
	}

	return model.PublicSecuritySummary{
		Posture:   posture,
		RiskBand:  riskBand,
		LastScan:  snap.LastRun,
		OpenTasks: len(tasks.Tasks),
	}
}

func (s *Service) AdminHealth() model.AdminHealthSnapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	if time.Since(s.lastAdminAt) < s.cacheExpiration && s.lastAdminAt.After(time.Time{}) {
		return s.lastAdmin
	}
	memUsed, memTotal := readMemInfoMB()
	diskUsed := readDiskUsedPct()
	load := readLoadAvg()
	containers, err := countDockerContainers()
	status := "ok"
	note := ""
	if err != nil {
		status = "degraded"
		note = "docker metric unavailable"
		containers = -1
	}
	services := []model.ServiceState{
		{Name: "caddy", Status: serviceState("docker")},
		{Name: "docker", Status: serviceState("docker")},
		{Name: "wg-quick@wg0", Status: serviceState("wg-quick@wg0")},
		{Name: "fail2ban", Status: serviceState("fail2ban")},
		{Name: "ufw", Status: serviceState("ufw")},
	}
	dns := dnsDetails()
	out := model.AdminHealthSnapshot{
		Status:        status,
		LoadAvg:       load,
		MemoryUsedMB:  memUsed,
		MemoryTotalMB: memTotal,
		DiskUsedPct:   diskUsed,
		ContainersUp:  containers,
		Services:      services,
		DNSStatus:     dnsStatusFromDetails(dns),
		DNSDetails:    dns,
		UpdatedAt:     now(),
		Note:          note,
	}
	s.lastAdmin = out
	s.lastAdminAt = time.Now()
	return out
}

func (s *Service) Security() model.SecuritySnapshot {
	return security.LoadSnapshot(filepath.Join(s.cfg.DataDir, "security-latest.json"))
}

func (s *Service) SecurityTasks() model.SecurityTasksPayload {
	return security.LoadTasks(filepath.Join(s.cfg.DataDir, "security-tasks.json"))
}

func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func readUptimeSeconds() int64 {
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(b))
	if len(fields) == 0 {
		return 0
	}
	f, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0
	}
	return int64(f)
}

func countDockerContainers() (int, error) {
	count, _, err := dockerRuntimeMetrics()
	return count, err
}

func dockerRuntimeMetrics() (int, float64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", "ps", "-q", "--no-trunc")
	out, err := cmd.Output()
	if err != nil {
		return 0, 0, err
	}
	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" {
		return 0, 0, nil
	}
	ids := strings.Split(trimmed, "\n")

	args := []string{"inspect", "--format", "{{.State.StartedAt}}"}
	args = append(args, ids...)
	inspectOut, inspectErr := exec.CommandContext(ctx, "docker", args...).Output()
	if inspectErr != nil {
		// Count is still useful even if runtime parsing fails.
		return len(ids), 0, nil
	}

	lines := strings.Split(strings.TrimSpace(string(inspectOut)), "\n")
	var sumMinutes float64
	var seen int
	for _, line := range lines {
		startedAt := strings.TrimSpace(line)
		if startedAt == "" {
			continue
		}
		t, parseErr := time.Parse(time.RFC3339Nano, startedAt)
		if parseErr != nil {
			continue
		}
		sumMinutes += time.Since(t).Minutes()
		seen++
	}
	if seen == 0 {
		return len(ids), 0, nil
	}
	return len(ids), sumMinutes / float64(seen), nil
}

func readMemInfoMB() (used, total int64) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0
	}
	defer f.Close()
	vals := map[string]int64{}
	s := bufio.NewScanner(f)
	for s.Scan() {
		parts := strings.Fields(s.Text())
		if len(parts) < 2 {
			continue
		}
		key := strings.TrimSuffix(parts[0], ":")
		v, _ := strconv.ParseInt(parts[1], 10, 64)
		vals[key] = v
	}
	totalKB := vals["MemTotal"]
	availKB := vals["MemAvailable"]
	usedKB := totalKB - availKB
	return usedKB / 1024, totalKB / 1024
}

func readDiskUsedPct() string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "df", "-h", "/")
	out, err := cmd.Output()
	if err != nil {
		return "unknown"
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) < 2 {
		return "unknown"
	}
	fields := strings.Fields(lines[1])
	if len(fields) < 5 {
		return "unknown"
	}
	return fields[4]
}

func readLoadAvg() string {
	b, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return "unknown"
	}
	parts := strings.Fields(string(b))
	if len(parts) < 3 {
		return "unknown"
	}
	return strings.Join(parts[:3], " ")
}

func serviceState(name string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "systemctl", "is-active", name)
	out, err := cmd.Output()
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(out))
}

func dnsDetails() []string {
	hosts := []string{
		"404n0tf0und.net",
		"admin.404n0tf0und.net",
		"security-admin.404n0tf0und.net",
	}
	details := make([]string, 0, len(hosts))
	for _, host := range hosts {
		ips, err := net.LookupIP(host)
		if err != nil || len(ips) == 0 {
			details = append(details, host+": unresolved")
			continue
		}
		ipStrs := make([]string, 0, len(ips))
		for _, ip := range ips {
			ipStrs = append(ipStrs, ip.String())
		}
		sort.Strings(ipStrs)
		if len(ipStrs) > 2 {
			ipStrs = ipStrs[:2]
		}
		details = append(details, host+": "+strings.Join(ipStrs, ", "))
	}
	return details
}

func dnsStatusFromDetails(details []string) string {
	for _, d := range details {
		if strings.Contains(d, "unresolved") {
			return "degraded"
		}
	}
	return "ok"
}
