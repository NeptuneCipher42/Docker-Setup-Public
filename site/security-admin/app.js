(function () {
  const POLL_MS = 30000;
  const HISTORY_LIMIT = Math.ceil((24 * 60 * 60 * 1000) / POLL_MS);

  const el = {
    risk: document.getElementById("risk"),
    status: document.getElementById("status"),
    lastRun: document.getElementById("last-run"),
    findingCount: document.getElementById("finding-count"),
    findings: document.getElementById("findings"),
    tasks: document.getElementById("tasks"),
    chartRisk: document.getElementById("chart-risk"),
    chartFindings: document.getElementById("chart-findings"),
    trendRisk: document.getElementById("trend-risk"),
    trendFindings: document.getElementById("trend-findings"),
    findingsTableWrap: document.querySelector(".table-scroll"),
    findingsTable: document.querySelector(".table-scroll table"),
  };

  const history = { risk: [], findingCount: [] };
  const metricConfig = {
    risk: { label: "Risk Score", color: "#fb7185", unit: "" },
    findingCount: { label: "Finding Count", color: "#f97316", unit: "" },
  };

  const chartModal = {
    root: null,
    title: null,
    canvas: null,
    current: null,
    min: null,
    max: null,
    delta: null,
    samples: null,
    window: null,
  };

  const findingsModal = {
    root: null,
    tableWrap: null,
  };

  let activeMetric = null;

  function severityClass(s) {
    const v = (s || "").toLowerCase();
    if (v === "high") return "sev-high";
    if (v === "medium") return "sev-medium";
    return "sev-low";
  }

  function statusClass(s) {
    if (s === "ok") return "value ok";
    if (s === "degraded") return "value warn";
    return "value bad";
  }

  function push(arr, value, max = HISTORY_LIMIT) {
    arr.push(value);
    if (arr.length > max) arr.shift();
  }

  function withAlpha(color, alpha) {
    const m = /^#?([a-fA-F0-9]{6})$/.exec(String(color));
    if (!m) return color;
    const hex = m[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function ensureCanvasSize(canvas) {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(2, Math.floor(rect.width || canvas.width || 2));
    const cssH = Math.max(2, Math.floor(rect.height || canvas.height || 2));
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const pxW = Math.max(2, Math.floor(cssW * dpr));
    const pxH = Math.max(2, Math.floor(cssH * dpr));

    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: cssW, h: cssH };
  }

  function drawSparkline(canvas, values, color) {
    if (!canvas) return;
    const { ctx, w, h } = ensureCanvasSize(canvas);
    ctx.clearRect(0, 0, w, h);
    if (values.length === 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      const y = h / 2;
      ctx.beginPath();
      ctx.moveTo(2, y);
      ctx.lineTo(w - 2, y);
      ctx.stroke();
      return;
    }
    if (values.length < 2) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) {
      const y = h / 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(2, y);
      ctx.lineTo(w - 2, y);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(w - 4, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const span = max - min;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * (w - 4) + 2;
      const y = h - (((v - min) / span) * (h - 6) + 3);
      return { x, y };
    });

    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, withAlpha(color, 0.26));
    fill.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0].x, h - 2);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, h - 2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    const tail = points[points.length - 1];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(tail.x, tail.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function fmtDelta(v) {
    const av = Math.abs(v);
    if (av >= 10) return v.toFixed(1);
    if (av >= 1) return v.toFixed(2);
    if (av >= 0.1) return v.toFixed(3);
    return v.toFixed(4);
  }

  function fmtMetric(v, unit = "") {
    if (!Number.isFinite(v)) return "--";
    if (unit) return `${fmtDelta(v)}${unit}`;
    return fmtDelta(v);
  }

  function setTrend(elm, values, unit = "") {
    if (!elm || values.length === 0) return;
    const curr = values[values.length - 1];
    if (values.length < 2) {
      elm.className = "meta trend flat";
      elm.textContent = `Trend: baseline (${fmtDelta(curr)}${unit})`;
      return;
    }
    const prev = values[values.length - 2];
    const delta = curr - prev;
    const sign = delta > 0 ? "+" : "";
    if (delta > 0) elm.className = "meta trend up";
    else if (delta < 0) elm.className = "meta trend down";
    else elm.className = "meta trend flat";
    elm.textContent = `Trend: ${sign}${fmtDelta(delta)}${unit} | now ${fmtDelta(curr)}${unit}`;
  }

  function ensureChartModal() {
    if (chartModal.root) return;
    const root = document.createElement("div");
    root.className = "chart-modal";
    root.hidden = true;
    root.innerHTML = `
      <div class="chart-modal__panel" role="dialog" aria-modal="true" aria-label="Expanded chart">
        <button type="button" class="chart-modal__close" data-close-modal aria-label="Close chart view">Close</button>
        <h2 class="chart-modal__title"></h2>
        <canvas class="chart-modal__canvas" width="960" height="280"></canvas>
        <div class="chart-modal__stats">
          <p><span>Current</span><strong data-stat-current>--</strong></p>
          <p><span>Min</span><strong data-stat-min>--</strong></p>
          <p><span>Max</span><strong data-stat-max>--</strong></p>
          <p><span>Delta</span><strong data-stat-delta>--</strong></p>
        </div>
        <p class="chart-modal__meta"><span data-stat-samples>0</span> samples over <span data-stat-window>24h</span>.</p>
      </div>
    `;
    document.body.appendChild(root);

    chartModal.root = root;
    chartModal.title = root.querySelector(".chart-modal__title");
    chartModal.canvas = root.querySelector(".chart-modal__canvas");
    chartModal.current = root.querySelector("[data-stat-current]");
    chartModal.min = root.querySelector("[data-stat-min]");
    chartModal.max = root.querySelector("[data-stat-max]");
    chartModal.delta = root.querySelector("[data-stat-delta]");
    chartModal.samples = root.querySelector("[data-stat-samples]");
    chartModal.window = root.querySelector("[data-stat-window]");

    root.addEventListener("click", (event) => {
      if (event.target === root || event.target.closest("[data-close-modal]")) closeChartModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeChartModal();
        closeFindingsModal();
      }
    });
  }

  function ensureFindingsModal() {
    if (findingsModal.root) return;
    const root = document.createElement("div");
    root.className = "chart-modal";
    root.hidden = true;
    root.innerHTML = `
      <div class="chart-modal__panel" role="dialog" aria-modal="true" aria-label="Expanded findings table">
        <button type="button" class="chart-modal__close" data-close-findings aria-label="Close findings view">Close</button>
        <h2 class="chart-modal__title">Findings (Expanded)</h2>
        <div class="chart-modal__table-wrap" data-findings-expanded></div>
      </div>
    `;
    document.body.appendChild(root);

    findingsModal.root = root;
    findingsModal.tableWrap = root.querySelector("[data-findings-expanded]");

    root.addEventListener("click", (event) => {
      if (event.target === root || event.target.closest("[data-close-findings]")) closeFindingsModal();
    });
  }

  function openChartModal(metric) {
    if (!history[metric]) return;
    closeFindingsModal();
    ensureChartModal();
    activeMetric = metric;
    chartModal.root.hidden = false;
    document.body.classList.add("modal-open");
    renderChartModal();
  }

  function closeChartModal() {
    if (!chartModal.root) return;
    chartModal.root.hidden = true;
    activeMetric = null;
    if (!findingsModal.root || findingsModal.root.hidden) {
      document.body.classList.remove("modal-open");
    }
  }

  function renderChartModal() {
    if (!chartModal.root || !activeMetric) return;
    const values = history[activeMetric] || [];
    const config = metricConfig[activeMetric] || { label: "Metric", color: "#fb7185", unit: "" };

    chartModal.title.textContent = `${config.label} (24h)`;
    chartModal.samples.textContent = String(values.length);
    chartModal.window.textContent = "24h";

    if (!values.length) {
      chartModal.current.textContent = "No data";
      chartModal.min.textContent = "--";
      chartModal.max.textContent = "--";
      chartModal.delta.textContent = "--";
      drawSparkline(chartModal.canvas, [], config.color);
      return;
    }

    const curr = values[values.length - 1];
    const prev = values.length > 1 ? values[values.length - 2] : curr;
    const min = Math.min(...values);
    const max = Math.max(...values);

    chartModal.current.textContent = fmtMetric(curr, config.unit);
    chartModal.min.textContent = fmtMetric(min, config.unit);
    chartModal.max.textContent = fmtMetric(max, config.unit);
    chartModal.delta.textContent = `${curr - prev >= 0 ? "+" : ""}${fmtMetric(curr - prev, config.unit)}`;

    drawSparkline(chartModal.canvas, values, config.color);
  }

  function openFindingsModal() {
    if (!el.findingsTable) return;
    closeChartModal();
    ensureFindingsModal();
    findingsModal.root.hidden = false;
    document.body.classList.add("modal-open");
    renderFindingsModal();
  }

  function closeFindingsModal() {
    if (!findingsModal.root) return;
    findingsModal.root.hidden = true;
    if (!chartModal.root || chartModal.root.hidden) {
      document.body.classList.remove("modal-open");
    }
  }

  function renderFindingsModal() {
    if (!findingsModal.root || findingsModal.root.hidden || !el.findingsTable) return;
    findingsModal.tableWrap.innerHTML = el.findingsTable.outerHTML;
  }

  function wireInteractions() {
    document.querySelectorAll(".chart-widget[data-metric]").forEach((widget) => {
      const metric = widget.dataset.metric;
      if (!metric) return;
      widget.setAttribute("role", "button");
      widget.setAttribute("tabindex", "0");
      widget.setAttribute("aria-label", "Expand chart");
      widget.addEventListener("click", () => openChartModal(metric));
      widget.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openChartModal(metric);
        }
      });
    });

    if (el.findingsTableWrap) {
      el.findingsTableWrap.setAttribute("role", "button");
      el.findingsTableWrap.setAttribute("tabindex", "0");
      el.findingsTableWrap.setAttribute("aria-label", "Expand findings table");
      el.findingsTableWrap.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        openFindingsModal();
      });
      el.findingsTableWrap.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openFindingsModal();
        }
      });
    }
  }

  async function refresh() {
    const [snapRes, tasksRes] = await Promise.all([
      fetch("/api/admin/security", { cache: "no-store" }),
      fetch("/api/admin/security/tasks", { cache: "no-store" }),
    ]);
    if (!snapRes.ok || !tasksRes.ok) throw new Error("security api unavailable");

    const snap = await snapRes.json();
    const tasks = await tasksRes.json();

    el.risk.textContent = String(snap.risk_score ?? "unknown");
    el.status.textContent = (snap.status || "unknown").toUpperCase();
    el.status.className = statusClass(snap.status);
    el.lastRun.textContent = snap.last_run ? new Date(snap.last_run).toLocaleString() : "never";

    const findingTotal = (snap.findings || []).length;
    el.findingCount.textContent = String(findingTotal);

    push(history.risk, Number(snap.risk_score) || 0);
    push(history.findingCount, findingTotal);
    drawSparkline(el.chartRisk, history.risk, "#fb7185");
    drawSparkline(el.chartFindings, history.findingCount, "#f97316");
    setTrend(el.trendRisk, history.risk);
    setTrend(el.trendFindings, history.findingCount);

    el.findings.innerHTML = "";
    if ((snap.findings || []).length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" class="sev-low">No active findings from the latest scan.</td>`;
      el.findings.appendChild(tr);
    } else {
      (snap.findings || []).forEach((f) => {
        const tr = document.createElement("tr");
        const cve = f.cve || "n/a";
        const ref = f.cve_url
          ? `<a href="${f.cve_url}" target="_blank" rel="noopener noreferrer">Link</a>`
          : "n/a";
        tr.innerHTML = `<td class="${severityClass(f.severity)}">${f.severity || "unknown"}</td><td>${f.tool || "n/a"}</td><td>${f.target || "n/a"}</td><td>${cve}</td><td>${ref}</td><td>${f.summary || "n/a"}</td>`;
        el.findings.appendChild(tr);
      });
    }

    el.tasks.innerHTML = "";
    if ((tasks.tasks || []).length === 0) {
      const li = document.createElement("li");
      li.className = "sev-low";
      li.textContent = "No open remediation tasks right now.";
      el.tasks.appendChild(li);
    } else {
      (tasks.tasks || []).forEach((t) => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>[${t.priority}] ${t.title}</strong> - ${t.action} (${t.status})`;
        el.tasks.appendChild(li);
      });
    }

    if (activeMetric) renderChartModal();
    renderFindingsModal();
  }

  async function safeRefresh() {
    try {
      await refresh();
    } catch {
      el.status.textContent = "DEGRADED";
      el.status.className = "value bad";
    }
  }

  wireInteractions();
  safeRefresh();
  setInterval(safeRefresh, POLL_MS);
})();
