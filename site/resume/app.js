(function () {
  const statusEl = document.getElementById("live-status");

  function setStatus(text, cls) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove("ok", "warn", "bad");
    if (cls) statusEl.classList.add(cls);
  }

  async function loadPublicStatus() {
    try {
      const res = await fetch("/api/public", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const status = String(data.status || "unknown").toUpperCase();
      const containers = Number(data.containers_up);
      const load = String(data.load_avg || "n/a").split(" ")[0];

      if (status === "OK") {
        setStatus(`${status} | load ${load} | containers ${Number.isFinite(containers) ? containers : "n/a"}`, "ok");
      } else {
        setStatus(`${status} | load ${load} | containers ${Number.isFinite(containers) ? containers : "n/a"}`, "warn");
      }
    } catch {
      setStatus("UNAVAILABLE", "bad");
    }
  }

  function revealPanels() {
    const panels = Array.from(document.querySelectorAll(".panel"));
    panels.forEach((panel, i) => {
      panel.style.opacity = "0";
      panel.style.transform = "translateY(10px)";
      setTimeout(() => {
        panel.style.transition = "opacity 260ms ease, transform 260ms ease";
        panel.style.opacity = "1";
        panel.style.transform = "translateY(0)";
      }, 80 * i);
    });
  }

  revealPanels();
  loadPublicStatus();
  setInterval(loadPublicStatus, 20000);
})();
