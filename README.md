# BlackVis

Visualização interativa de designers negros e suas áreas de atuação, construída com D3.js.
O BlackVis é uma visualização interativa de designers negros, suas áreas de atuação, técnicas e conexões.

## Requisitos

- Node.js 22 ou superior
- npm

## Instalação

Na pasta do projeto, execute:

```powershell
npm install
```

## Executar localmente

```powershell
npm run dev
```

## Organização do projeto

- `data/`: dados públicos de apoio, como as áreas e técnicas do design.
- `js/`: módulos de estado, grafo, interface e filtros. Veja [js/README.md](js/README.md) para a ordem de carregamento.
- `styles/main.scss`: entrada única do Sass; a ordem dos módulos mantém a cascata.
- `styles/base/`: tipografia, tokens e regras globais.
- `styles/layout/`: navegação, disposição da página e adaptação de tela.
- `styles/filters/`: filtros de nacionalidade, eixos, busca e ano.
- `styles/components/`: cards e botões; `styles/graph/`: estados do grafo.
- `styles/css/style.css`: arquivo gerado para o navegador. Edite apenas os arquivos SCSS.
- `assets/`: imagens, ícones e outros recursos visuais.

Para recompilar os estilos sem iniciar o servidor, execute `npm run sass`. O `npm run dev` acompanha as alterações em SCSS. Como o site é estático, o CSS compilado precisa acompanhar os arquivos publicados.

## Visualizações da página

As visualizações são acompanhadas de forma privada pelo Google Analytics 4. O contador não aparece no site e não precisa de armazenamento na API do Render.

1. No [Google Analytics](https://support.google.com/analytics/answer/9304153), crie uma propriedade GA4 e um fluxo **Web** para o domínio publicado do BlackVis. Copie o ID de medição que começa com `G-`.
2. Em `js/config.js`, coloque esse ID em `window.BLACKVIS_GA_MEASUREMENT_ID`. Não use chave de API nem senha.
3. Publique o site e consulte a métrica **Visualizações** no painel do GA4. Cada carregamento da página publicada envia uma visualização; cliques nos filtros não geram outra visualização.

O rastreamento fica desligado em `localhost` e `127.0.0.1`. Se o ID estiver vazio, nenhum script de estatísticas é carregado. Bloqueadores de conteúdo e falhas de rede podem impedir algumas contagens.

## Galeria de obras

O lançamento inicial não mostra obras nos cards das pessoas e a API não serve imagens dessa galeria. Os ícones das técnicas e dos adinkras continuam vindo da API do Google Drive.

Para reativar a galeria futuramente, mude `window.BLACKVIS_SHOW_WORKS` para `true` em `js/config.js` e configure `WORKS_ENABLED=true` no ambiente da API do Render (ou no `.env` local). Publique a interface e a API com essas duas configurações. O código da galeria permanece em `js/interface/works.js` e `server/works.cjs`.
