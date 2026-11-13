// GA4 só é carregado após a autorização explícita para análise.
(() => {
  const key = "blackvis-analytics-consent";
  const measurementId = String(window.BLACKVIS_GA_MEASUREMENT_ID || "").trim();
  const canMeasure = /^G-[A-Z0-9]+$/i.test(measurementId) &&
    !["localhost", "127.0.0.1"].includes(location.hostname);
  let enabled = false;
  let loaded = false;

  function readChoice() {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function send(event, params) {
    if (enabled && typeof window.gtag === "function") window.gtag("event", event, params);
  }

  function start() {
    if (!canMeasure || loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    window.gtag("js", new Date());
    window.gtag("config", measurementId);
    const tag = document.createElement("script");
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.append(tag);
  }

  function setChoice(accepted) {
    try { localStorage.setItem(key, accepted ? "accepted" : "rejected"); } catch { /* Escolha válida nesta página. */ }
    enabled = accepted && canMeasure;
    if (accepted) {
      window[`ga-disable-${measurementId}`] = false;
      if (loaded) window.gtag("consent", "update", { analytics_storage: "granted" });
      else start();
    } else if (loaded) {
      window.gtag("consent", "update", { analytics_storage: "denied" });
      window[`ga-disable-${measurementId}`] = true;
    }
    window.dispatchEvent(new CustomEvent("blackvis:consent-change", { detail: { accepted } }));
  }

  window.blackvisAnalytics = { readChoice, setChoice, send };
  enabled = readChoice() === "accepted" && canMeasure;
  if (enabled) start();

  // Mede apenas a categoria da interação. Nunca envia nomes ou texto dos cards.
  document.addEventListener("click", (event) => {
    if (!enabled) return;
    const target = event.target.closest("button, a");
    if (!target || target.closest("#cookie-banner, #cookie-settings")) return;
    let area = "interface";
    if (target.closest(".top-nav")) area = "navegacao";
    else if (target.closest(".bottom-bar")) area = "filtros";
    else if (target.closest(".info-panel")) area = "card";
    send("interface_click", { interface_area: area });
  });
  let graphPress;
  document.addEventListener("pointerdown", (event) => {
    graphPress = enabled && event.button === 0 && event.target.closest("#grafico-d3 .node, #grafico-d3 .label")
      ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  }, true);
  document.addEventListener("pointerup", (event) => {
    if (graphPress?.id === event.pointerId &&
        Math.hypot(event.clientX - graphPress.x, event.clientY - graphPress.y) <= 5) {
      send("interface_click", { interface_area: "grafo" });
    }
    graphPress = null;
  }, true);
})();
