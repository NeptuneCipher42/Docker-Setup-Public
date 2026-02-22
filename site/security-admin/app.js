(function () {
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
  };

  const history = { risk: [], findingCount: [] };

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

  function push(arr, value, max = 40) {
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

  function drawSparkline(canvas, values, color) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
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

  function setTrend(el, values, unit = "") {
    if (!el || values.length === 0) return;
    const curr = values[values.length - 1];
    if (values.length < 2) {
      el.className = "meta trend flat";
      el.textContent = `Trend: baseline (${fmtDelta(curr)}${unit})`;
      return;
    }
    const prev = values[values.length - 2];
    const delta = curr - prev;
    const sign = delta > 0 ? "+" : "";
    if (delta > 0) el.className = "meta trend up";
    else if (delta < 0) el.className = "meta trend down";
    else el.className = "meta trend flat";
    el.textContent = `Trend: ${sign}${fmtDelta(delta)}${unit} | now ${fmtDelta(curr)}${unit}`;
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
  }

  async function safeRefresh() {
    try {
      await refresh();
    } catch {
      el.status.textContent = "DEGRADED";
      el.status.className = "value bad";
    }
  }

  safeRefresh();
  setInterval(safeRefresh, 30000);
})();
