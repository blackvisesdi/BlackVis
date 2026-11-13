// Acrescenta a referência bibliográfica à cópia de texto da página.
(() => {
  const reference = "Lopes, Larissa; Santos, Jésus; Silva, Barbara; Castro, Barbara. Blackvis: Acervo de designers negros. Rio de Janeiro, 2026. Base de dados on-line. Disponível em: https://www.blackvis.esdi.uerj.br";
  document.addEventListener("copy", (event) => {
    const source = event.target;
    if (source?.closest?.("input, textarea, [contenteditable]")) return;
    const selection = window.getSelection();
    const text = selection?.toString();
    if (!text?.trim() || !event.clipboardData) return;
    event.clipboardData.setData("text/plain", `${text}\n\n${reference}`);
    event.preventDefault();
  });
})();
