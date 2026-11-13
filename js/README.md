# Organização do JavaScript

O grafo carrega scripts clássicos na ordem indicada em `visualizacao.html`. Os arquivos compartilham o estado definido em `core/globals.js`; mantenha os módulos de interface e filtros antes de `filters/engine.js`, que inicia os dados e aplica os filtros. A página inicial usa `pages/home/home.js` e `pages/home/home-content.js`.

- `base/` e `core/`: funções e estado compartilhados.
- `analytics/pageviews.js`: carrega o contador privado de visualizações apenas no site publicado, quando configurado.
- `graph/`: arraste, foco, aparência, renderização e posicionamento dos nomes.
- `interface/popups.js`: mensagens de erro, legendas e aviso de atualização dos dados.
- `interface/navigation.js`: botões de navegação e redimensionamento.
- `interface/*-card.js`: conteúdo dos cards de adinkra, técnica e pessoa.
- `filters/nationality.js`, `design-axis.js`, `name-search.js` e `birth-year.js`: controles de cada filtro.
- `filters/data.js` e `counts.js`: preparação dos nós e contadores do menu.
- `filters/menu-controls.js` e `reset.js`: comandos compartilhados e limpeza dos filtros.
- `filters/engine.js`: carregamento inicial e combinação dos filtros ativos.

Ao criar um módulo do grafo, inclua seu script em `visualizacao.html` antes de `filters/engine.js` e confira as dependências globais. `npm run dev` inicia a interface e a API local para testar os fluxos.
