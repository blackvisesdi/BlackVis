// CONFIGURAÇÃO PÚBLICA — define o endereço da API usada pela interface.
// Não coloque chaves, senhas ou arquivos de credenciais aqui.
// Em produção, substitua o valor vazio pela URL pública do backend Node.
window.BLACKVIS_API_URL = "";

// Descobre a porta da galeria quando outra instância já estiver usando a 5501.
window.getBlackvisApiBase = (() => {
  let pending;
  return () => {
    if (window.BLACKVIS_API_URL) return Promise.resolve(window.BLACKVIS_API_URL.replace(/\/$/, ""));
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      return Promise.resolve(window.location.origin);
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

