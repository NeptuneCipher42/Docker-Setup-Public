(function () {
  const ids = {
    status: document.getElementById("w-status"),
    uptime: document.getElementById("w-uptime"),
    containers: document.getElementById("w-containers"),
    updated: document.getElementById("w-updated"),
    load: document.getElementById("w-load"),
    memory: document.getElementById("w-memory"),
    secPosture: document.getElementById("w-sec-posture"),
    secRisk: document.getElementById("w-sec-risk"),
    secTasks: document.getElementById("w-sec-tasks"),
    secScan: document.getElementById("w-sec-scan"),
    chartSecRisk: document.getElementById("chart-sec-risk"),
    chartSecTasks: document.getElementById("chart-sec-tasks"),
    chartLoad: document.getElementById("chart-load"),
    chartContainers: document.getElementById("chart-containers"),
    trendLoad: document.getElementById("trend-load"),
    trendContainers: document.getElementById("trend-containers"),
    trendSecRisk: document.getElementById("trend-sec-risk"),
    trendSecTasks: document.getElementById("trend-sec-tasks"),
  };

  const history = { load: [], containers: [], secRisk: [], secTasks: [] };

  function fmtUptime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "Unknown";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  }

  function push(historyArr, value, max = 40) {
    historyArr.push(value);
    if (historyArr.length > max) historyArr.shift();
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
    try {
      const res = await fetch("/api/public", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      ids.status.textContent = (data.status || "unknown").toUpperCase();
      ids.uptime.textContent = fmtUptime(data.uptime_seconds);
      ids.containers.textContent = (Number(data.containers_up) >= 0) ? String(data.containers_up) : "Unavailable";
      ids.updated.textContent = data.updated_at ? new Date(data.updated_at).toLocaleString() : "Unknown";
      ids.load.textContent = data.load_avg || "Unknown";
      if (Number.isFinite(data.memory_used_mb) && Number.isFinite(data.memory_total_mb) && data.memory_total_mb > 0) {
        const pct = ((data.memory_used_mb / data.memory_total_mb) * 100).toFixed(1);
        ids.memory.textContent = `${pct}% (${data.memory_used_mb}MB/${data.memory_total_mb}MB)`;
      } else {
        ids.memory.textContent = "Unknown";
      }
      ids.status.className = `value ${data.status === "ok" ? "ok" : "bad"}`;

      const sec = data.security || {};
      ids.secPosture.textContent = (sec.posture || "unknown").toUpperCase();
      ids.secRisk.textContent = (sec.risk_band || "unknown").toUpperCase();
      ids.secTasks.textContent = Number.isFinite(sec.open_tasks) ? String(sec.open_tasks) : "Unknown";
      ids.secScan.textContent = sec.last_scan ? new Date(sec.last_scan).toLocaleString() : "Unknown";
      ids.secPosture.className = `value ${sec.posture === "good" ? "ok" : "bad"}`;
      const bandMap = { low: 1, medium: 2, high: 3 };
      const secRisk = bandMap[String(sec.risk_band || "").toLowerCase()] || 0;
      const secTasks = Number(sec.open_tasks) || 0;
      push(history.secRisk, secRisk);
      push(history.secTasks, secTasks);
      drawSparkline(ids.chartSecRisk, history.secRisk, "#c084fc");
      drawSparkline(ids.chartSecTasks, history.secTasks, "#38bdf8");
      setTrend(ids.trendSecRisk, history.secRisk);
      setTrend(ids.trendSecTasks, history.secTasks);

      const loadParts = String(data.load_avg || "0").split(" ");
      const load1m = Number(loadParts[0]) || 0;
      const rawRuntime = Number(data.container_runtime_minutes);
      const rawContainers = Number(data.containers_up);
      const prevContainers = history.containers.length ? history.containers[history.containers.length - 1] : 0;
      const runtimeMinutes = Number.isFinite(rawRuntime) && rawRuntime >= 0
        ? rawRuntime
        : (Number.isFinite(rawContainers) && rawContainers >= 0 ? rawContainers : prevContainers);
      push(history.load, load1m);
      push(history.containers, runtimeMinutes);
      drawSparkline(ids.chartLoad, history.load, "#5eead4");
      drawSparkline(ids.chartContainers, history.containers, "#38bdf8");
      setTrend(ids.trendLoad, history.load);
      setTrend(ids.trendContainers, history.containers, "m");
    } catch (err) {
      ids.status.textContent = "DEGRADED";
      ids.status.className = "value bad";
      ids.uptime.textContent = "Unavailable";
      ids.containers.textContent = "Unavailable";
      ids.updated.textContent = "Unavailable";
      ids.load.textContent = "Unavailable";
      ids.memory.textContent = "Unavailable";
      ids.secPosture.textContent = "Unavailable";
      ids.secRisk.textContent = "Unavailable";
      ids.secTasks.textContent = "Unavailable";
      ids.secScan.textContent = "Unavailable";
    }
  }

  refresh();
  setInterval(refresh, 15000);
})();
