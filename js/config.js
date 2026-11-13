// CONFIGURAÇÃO PÚBLICA — define o endereço da API usada pela interface.
// Não coloque chaves, senhas ou arquivos de credenciais aqui.
// URL de produção; em localhost a API é descoberta nas portas locais.
window.BLACKVIS_API_URL = "https://blackvis-api.onrender.com";

// ID de medição público do fluxo Web no Google Analytics 4.
// Nunca coloque credenciais aqui.
window.BLACKVIS_GA_MEASUREMENT_ID = "G-83S2SDQKFX";

// Lançamento sem galeria de obras. Troque para true quando as obras estiverem prontas.
window.BLACKVIS_SHOW_WORKS = false;

// Descobre a porta da galeria quando outra instância já estiver usando a 5501.
window.getBlackvisApiBase = (() => {
  let pending;
  return () => {
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      return Promise.resolve((window.BLACKVIS_API_URL || window.location.origin).replace(/\/$/, ""));
    }
    if (!pending) {
      pending = (async () => {
        for (let port = 5501; port <= 5510; port += 1) {
          try {
            const response = await fetch(`http://${window.location.hostname}:${port}/api/designers`, {
              signal: AbortSignal.timeout(400)
            });
            if (response.ok) return `http://${window.location.hostname}:${port}`;
          } catch { /* Tenta a próxima porta. */ }
        }
        return `http://${window.location.hostname}:5501`;
      })();
    }
    return pending;
  };
})();

