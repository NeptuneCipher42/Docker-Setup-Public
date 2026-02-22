(function () {
  const el = {
    status: document.getElementById("status"),
    load: document.getElementById("load"),
    memory: document.getElementById("memory"),
    disk: document.getElementById("disk"),
    containers: document.getElementById("containers"),
    dnsStatus: document.getElementById("dns-status"),
    dnsDetails: document.getElementById("dns-details"),
    services: document.getElementById("services"),
    updated: document.getElementById("updated"),
    chartLoad: document.getElementById("chart-load"),
    chartMemory: document.getElementById("chart-memory"),
    chartContainers: document.getElementById("chart-containers"),
    trendLoad: document.getElementById("trend-load"),
    trendMemory: document.getElementById("trend-memory"),
    trendContainers: document.getElementById("trend-containers"),
  };

  const history = { load: [], memoryPct: [], containers: [] };

  function cls(value) {
    if (value === "ok" || value === "active") return "value ok";
    if (value === "degraded") return "value warn";
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
    const res = await fetch("/api/admin/health", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    el.status.textContent = (data.status || "unknown").toUpperCase();
    el.status.className = cls(data.status);
    el.load.textContent = data.load_avg || "unknown";
    el.memory.textContent = `${data.memory_used_mb || 0} MB / ${data.memory_total_mb || 0} MB`;
    el.disk.textContent = data.disk_used_pct || "unknown";
    el.containers.textContent = data.containers_up ?? "unknown";
    el.dnsStatus.textContent = (data.dns_status || "unknown").toUpperCase();
    el.dnsStatus.className = cls(data.dns_status || "degraded");

    el.services.innerHTML = "";
    (data.services || []).forEach((s) => {
      const li = document.createElement("li");
      li.textContent = `${s.name}: ${s.status}`;
      li.className = s.status === "active" ? "value ok" : "value warn";
      el.services.appendChild(li);
    });

    el.dnsDetails.innerHTML = "";
    (data.dns_details || []).forEach((d) => {
      const li = document.createElement("li");
      li.textContent = d;
      li.className = d.includes("unresolved") ? "value bad" : "value ok";
      el.dnsDetails.appendChild(li);
    });

    el.updated.textContent = `Updated: ${new Date(data.updated_at).toLocaleString()}`;

    const load1m = Number(String(data.load_avg || "0").split(" ")[0]) || 0;
    const memPct = (Number(data.memory_total_mb) > 0) ? (Number(data.memory_used_mb) / Number(data.memory_total_mb)) * 100 : 0;
    push(history.load, load1m);
    push(history.memoryPct, memPct);
    push(history.containers, Number(data.containers_up) || 0);
    drawSparkline(el.chartLoad, history.load, "#5eead4");
    drawSparkline(el.chartMemory, history.memoryPct, "#f59e0b");
    drawSparkline(el.chartContainers, history.containers, "#38bdf8");
    setTrend(el.trendLoad, history.load);
    setTrend(el.trendMemory, history.memoryPct, "%");
    setTrend(el.trendContainers, history.containers);
  }

  async function safeRefresh() {
    try {
      await refresh();
    } catch {
      el.status.textContent = "DEGRADED";
      el.status.className = "value bad";
      el.dnsStatus.textContent = "DEGRADED";
      el.dnsStatus.className = "value bad";
      el.updated.textContent = "Updated: unavailable";
    }
  }

  safeRefresh();
  setInterval(safeRefresh, 15000);
})();
