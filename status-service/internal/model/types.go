package model

type PublicSnapshot struct {
	Status                  string                `json:"status"`
	UptimeSeconds           int64                 `json:"uptime_seconds"`
	ContainersUp            int                   `json:"containers_up"`
	ContainerRuntimeMinutes float64               `json:"container_runtime_minutes"`
	LoadAvg                 string                `json:"load_avg"`
	MemoryUsedMB            int64                 `json:"memory_used_mb"`
	MemoryTotalMB           int64                 `json:"memory_total_mb"`
	Security                PublicSecuritySummary `json:"security"`
	UpdatedAt               string                `json:"updated_at"`
	Note                    string                `json:"note,omitempty"`
}

type PublicSecuritySummary struct {
	Posture   string `json:"posture"`
	RiskBand  string `json:"risk_band"`
	LastScan  string `json:"last_scan"`
	OpenTasks int    `json:"open_tasks"`
}

type ServiceState struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

type AdminHealthSnapshot struct {
	Status        string         `json:"status"`
	LoadAvg       string         `json:"load_avg"`
	MemoryUsedMB  int64          `json:"memory_used_mb"`
	MemoryTotalMB int64          `json:"memory_total_mb"`
	DiskUsedPct   string         `json:"disk_used_pct"`
	ContainersUp  int            `json:"containers_up"`
	Services      []ServiceState `json:"services"`
	DNSStatus     string         `json:"dns_status"`
	DNSDetails    []string       `json:"dns_details"`
	UpdatedAt     string         `json:"updated_at"`
	Note          string         `json:"note,omitempty"`
}

type Finding struct {
	Tool      string `json:"tool"`
	Severity  string `json:"severity"`
	Target    string `json:"target"`
	CVE       string `json:"cve,omitempty"`
	CVEURL    string `json:"cve_url,omitempty"`
	Summary   string `json:"summary"`
	Timestamp string `json:"timestamp"`
}

type SecuritySnapshot struct {
	Status      string    `json:"status"`
	RiskScore   int       `json:"risk_score"`
	LastRun     string    `json:"last_run"`
	Targets     []string  `json:"targets,omitempty"`
	Findings    []Finding `json:"findings,omitempty"`
	Error       string    `json:"error,omitempty"`
	UpdatedAt   string    `json:"updated_at,omitempty"`
	ScanRuntime string    `json:"scan_runtime,omitempty"`
}

type SecurityTask struct {
	ID       string `json:"id"`
	Priority string `json:"priority"`
	Title    string `json:"title"`
	Impact   string `json:"impact"`
	Effort   string `json:"effort"`
	Action   string `json:"action"`
	Status   string `json:"status"`
}

type SecurityTasksPayload struct {
	Status    string         `json:"status"`
	Generated string         `json:"generated"`
	Tasks     []SecurityTask `json:"tasks"`
}
