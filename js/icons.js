const iconTec = {
  // --- Comunicação ---
  "Design gráfico": "./assets/icons/comunica/designGrafico.svg",
  "Ilustração": "./assets/icons/comunica/ilustracao.svg",
  "Tipografia": "./assets/icons/comunica/tipografia.svg",
  "Direção de arte": "./assets/icons/comunica/DirecaoArte.svg",
  "Produção audiovisual": "./assets/icons/comunica/producaoAudiovisual.svg",
  "Fotografia": "./assets/icons/comunica/fotografia.svg",
  "Videografismo": "./assets/icons/comunica/videografismo.svg",
  "Design editorial": "./assets/icons/comunica/designEditorial.svg",
  "Identidade visual": "./assets/icons/comunica/identidadeVisual.svg",
  "Design de superfície": "./assets/icons/comunica/designSuperficie.svg",
  "Arte urbana": "./assets/icons/comunica/arteUrbana.svg",
  "Colagem": "./assets/icons/comunica/",

  // --- Produto ---
  "Design de objetos industriais": "./assets/icons/produ/designObjetos.svg",
  "Design de mobiliário": "./assets/icons/produ/designMobiliario.svg",
  "Moda e têxtil": "./assets/icons/produ/modaTextil.svg",
  "Escultura": "./assets/icons/produ/escultura.svg",
  "Prática 3D": "./assets/icons/produ/praticas3d.svg",
  "Design de interiores": "./assets/icons/produ/designInteriores.svg",
  "Design de adereços": "./assets/icons/produ/designAderecos.svg",
  "Embalagem": "./assets/icons/produ/embalagem.svg",

  // --- Interação ---
  "UI Design de interface": "./assets/icons/intera/desingInterface.svg",
  "Programação": "./assets/icons/intera/programacao.svg",
  "Instalações interativas": "./assets/icons/intera/instalacoesInterativas.svg",
  "Arte digital": "./assets/icons/intera/arteDigital.svg",
  "UX Experiência do usuário": "./assets/icons/intera/experienciaUsuario.svg",
  "Realidades mistas": "./assets/icons/intera/realidadesMistas.svg",

  // --- Serviço ---
  "CX Experiência do Cliente":
    "./assets/icons/servi/CX (Experiência do Cliente) .svg",
  "Design para impacto social":
    "./assets/icons/servi/Design para Impacto Social.svg",
  "Branding": "./assets/icons/servi/Branding.svg",
  "Curadoria": "./assets/icons/servi/Curadoria.svg",
  "Economia criativa": "./assets/icons/servi/Economia criativa.svg",

  // --- Teórico ---
  "Educação": "./assets/icons/teori/educacacao.svg",
  "Escrita e publicação": "./assets/icons/teori/escritaPublicacao.svg",
  "Ativismo e justiça social": "./assets/icons/teori/AtivismoJustica.svg",
  "Relações étnico-raciais": "./assets/icons/teori/relacoesEtinico.svg",
  "Design e gênero": "./assets/icons/teori/designGenero.svg",
};

window.getIconPath = function (name) {
  return iconTec[name] || null;
};
