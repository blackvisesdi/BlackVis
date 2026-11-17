# Manual de desenvolvimento e publicação do BlackVis

Este manual é para quem recebe o código e precisa manter o site, a visualização e a API. Leia também o [README principal](../README.md) e o [mapa de JavaScript](../js/README.md). Os comandos abaixo usam PowerShell, na raiz do repositório.

> **Situação das contas:** o contato institucional do projeto é **blackvis@esdi.uerj.br** (usado pelo projeto no Gmail). Este endereço é a referência para solicitar ou centralizar acessos futuros. O serviço atual do Render pode continuar vinculado à conta pessoal da responsável; o e-mail de contato **não concede acesso automaticamente** ao Render, GitHub, Google Cloud ou FTP. Confira os proprietários reais em cada painel antes de assumir a manutenção.

## 1. Como o projeto funciona

```text
Navegador (index.html / visualizacao.html / aviso-de-privacidade.html)
  ├─ HTML, JS, CSS compilado, imagens e JSON públicos → hospedagem estática
  └─ /api/* → blackvis-api.onrender.com (Node, server/works.cjs)
                 ├─ cadastro privado de designers → arquivo JSON secreto
                 └─ ícones, adinkras e fotos da equipe → Google Drive
```

- **Página inicial e páginas institucionais:** HTML e JavaScript próprios. A equipe e as publicações são lidas de `data/*.json` públicos.
- **Visualização:** D3.js desenha o grafo. Filtros, cards e pop-ups ficam em módulos de `js/` carregados na ordem indicada em `visualizacao.html`.
- **API:** `server/works.cjs` entrega designers, imagens e estado do Drive. O navegador recebe somente os campos públicos dos designers.
- **Estilos:** a fonte de edição é SCSS. `styles/css/style.css` é gerado pelo Sass e precisa acompanhar o deploy.
- **Estatísticas:** Google Analytics 4 é carregado conforme a escolha de cookies. Os IDs públicos estão em `js/config.js`; credenciais nunca ficam ali.

### Conferir os acessos no Google Analytics

Os IDs `G-83S2SDQKFX` e `G-DBKNP7702J` recebem os mesmos eventos em `blackvisesdi.github.io/BlackVis` e `blackvis.esdi.uerj.br` (e na variante `www`). `js/analytics/pageviews.js` envia **uma visualização a cada propriedade por abertura de página** após o visitante aceitar a análise; `index.html`, `visualizacao.html` e `aviso-de-privacidade.html` carregam esse módulo. A recusa impede o carregamento da tag. O hostname fica em `page_location`, permitindo separar os dois endereços nos relatórios. Localhost e outras hospedagens não enviam dados.

Para validar uma publicação, abra cada domínio em uma janela limpa, aceite os cookies e confira na aba Network do navegador a carga de `gtag/js?id=G-83S2SDQKFX` e o envio de `page_view` para **ambos os IDs**. Em seguida, verifique **Tempo real** ou **DebugView** nas duas propriedades GA4. Repita com recusa: não deve carregar a tag. Bloqueadores de rastreamento podem impedir a contagem. Se o mesmo visitante navegar entre os dois domínios e for necessário manter uma sessão única, configure **medição entre domínios** em cada fluxo Web; o código das páginas sozinho não liga as sessões. Consulte a [orientação oficial do Google](https://support.google.com/analytics/answer/10071811).

## 2. Arquivos e pastas

| Caminho | Responsabilidade / quando editar |
| --- | --- |
| `index.html` | Página inicial, seções Sobre, Equipe, Publicações, Metodologia, Fundamentos, rodapé e modal de cookies. |
| `visualizacao.html` | Grafo, filtros, cards, pop-ups e ordem dos scripts clássicos. |
| `aviso-de-privacidade.html` | Texto e estrutura do aviso de privacidade. |
| `data/areas.json` | Eixos, técnicas e conteúdo de apoio da visualização. |
| `data/legend-descriptions.json` | Textos da legenda e ajuda. |
| `data/equipe-proj.json` | Nome, cargo, minibio, tags e **nome do arquivo da foto** de cada membro da equipe. |
| `data/publicacoes.json` | Publicações, links, arquivo para download e vídeo. Campo vazio significa indisponível. |
| `js/config.js` | URL pública da API, ID público do GA4 e opção de exibir obras. **Não inserir senhas.** |
| `js/pages/home/home-content.js` | Monta equipe e publicações dos JSONs e pede fotos à API. |
| `js/pages/home/home.js` | Navegação e interações da página inicial. |
| `js/analytics/consent.js`, `pageviews.js` | Consentimento de cookies e carregamento das métricas. |
| `js/base/core.js`, `js/core/globals.js` | Funções e estado compartilhado da visualização. |
| `js/graph/focus.js`, `appearance.js`, `renderer.js`, `interaction-helpers.js`, `name-collision.js` | Foco, aparência, desenho, interação e posicionamento dos nomes no grafo. |
| `js/filters/data.js`, `counts.js`, `engine.js` | Preparam os dados, calculam contadores e combinam filtros; `engine.js` inicia a carga. |
| `js/filters/nationality.js`, `design-axis.js`, `name-search.js`, `birth-year.js` | Um controle por filtro. |
| `js/filters/menu-controls.js`, `reset.js` | Ações compartilhadas e limpeza dos filtros. |
| `js/interface/*-card.js`, `works.js` | Cards de pessoa, técnica, adinkra e galeria de obras (desativada no lançamento). |
| `js/interface/popups.js`, `tutorial.js`, `navigation.js`, `card-scrollbar.js`, `copy-attribution.js` | Pop-ups, tutorial, navegação, rolagem dos cards e cópia de citações. |
| `styles/main.scss` | Entrada única e ordem da cascata SCSS. |
| `styles/base/`, `layout/`, `filters/`, `components/`, `graph/`, `pages/` | Regras de fonte/cores, layout, filtros, cards, grafo e páginas. |
| `styles/css/style.css` | Resultado gerado; **não editar diretamente**. |
| `assets/icons/`, `assets/partners/`, `assets/fonts/` | Ícones locais, marcas de realização e fontes. Ícones vindos do Drive não são guardados aqui. |
| `package.json`, `package-lock.json` | Scripts npm e versões das dependências; prefira `npm ci` para reproduzir o ambiente. |
| `.gitignore` | Protege segredos e arquivos locais contra inclusão acidental no Git. |
| `README.md`, `js/README.md` | Instruções curtas de entrada e ordem de carga dos scripts. |
| `server/works.cjs` | API HTTP, leitura do cadastro, acesso ao Drive, CORS e rotas de imagens. |
| `server/dev.cjs`, `local-site.cjs` | Inicialização local conjunta e servidor estático de desenvolvimento. |
| `server/works.security.test.cjs` | Testes da API. |
| `.env.example` | Nomes e exemplos das variáveis locais; copiar para `.env`. |
| `secrets/` e `.env` | Arquivos locais privados, ignorados pelo Git. **Nunca publicar.** |

Se adicionar um arquivo JavaScript à visualização, inclua o `<script>` em `visualizacao.html` **antes** de `js/filters/engine.js` e respeite as dependências descritas em `js/README.md`.

## 3. Primeira execução local

1. Instale **Node.js 22 ou superior** e npm. Na raiz do projeto, execute `npm ci` (usa o `package-lock.json`).
2. Crie o arquivo local: `Copy-Item .env.example .env`. Preencha somente as variáveis necessárias. Peça o cadastro e as credenciais por um canal seguro à pessoa responsável; não estão no Git.
3. Coloque o cadastro em `secrets/designers.json` ou ajuste `DESIGNERS_DATA_FILE`. Se usar conta de serviço do Google, coloque seu JSON em `secrets/` e configure `GOOGLE_SERVICE_ACCOUNT_FILE` no `.env`.
4. Execute `npm run dev`. O comando acompanha o SCSS e inicia **site e API**; abra a URL impressa no terminal. Normalmente o site usa `http://127.0.0.1:5500/` e a API `http://127.0.0.1:5501/`, mas portas ocupadas podem mudar isso.
5. Confira `http://127.0.0.1:5501/api/health` e `http://127.0.0.1:5501/api/designers` (troque a porta pela mostrada no terminal). O primeiro informa a conexão com o Drive; o segundo deve devolver `designers` e `lastUpdated`.

Para compilar sem deixar o servidor aberto, execute `npm run sass`. Para rodar só a API, use `npm run works`. `npm run dev` é o caminho normal de desenvolvimento; um servidor estático isolado deixa a interface dependente da API remota ou de outra API local.

### Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `DESIGNERS_DATA_FILE` | Caminho do JSON privado dos designers; padrão `secrets/designers.json`. |
| `GOOGLE_SERVICE_ACCOUNT_FILE` / `GOOGLE_APPLICATION_CREDENTIALS` | Caminho do JSON da conta de serviço para ler o Drive. |
| `GOOGLE_DRIVE_API_KEY` | Alternativa apenas para pastas públicas, com a API Drive habilitada. |
| `TECHNIQUES_DRIVE_FOLDER_ID` | Pasta dos ícones das técnicas. |
| `ADINKRA_DRIVE_FOLDER_ID` | Pasta dos adinkras da visualização. |
| `HOME_ADINKRA_DRIVE_FOLDER_ID` | Pasta dos adinkras da página inicial. |
| `TEAM_PHOTOS_DRIVE_FOLDER_ID` | Pasta das fotos da equipe. |
| `WORKS_ALLOWED_ORIGINS` | Origens autorizadas para acessar a API pelo navegador, separadas por vírgulas, sem barra final. |
| `WORKS_ENABLED` | Galeria de obras; atualmente `false`. |
| `WORKS_PORT` / `PORT` | Porta da API local / porta fornecida pelo Render. |

Os IDs de pasta têm valores padrão em `server/works.cjs`. **O valor configurado no `.env` ou no Render prevalece sobre o padrão.** Se uma pasta for movida ou trocada, atualize a variável no ambiente que executa a API. O `.env` local não altera o Render.

## 4. Onde alterar cada tipo de conteúdo

### Pessoas da visualização

O cadastro é lido pela API a partir de `DESIGNERS_DATA_FILE`. Não edite `data/designers.json` como se fosse conteúdo público. O arquivo esperado é um array JSON; campos usados pela interface incluem `id`, `Nome`, `Nacionalidade`, `Área do design`, `Técnicas`, `Data de nascimento`, `Minibio` e links. Veja `publicDesigner()` e `readDesigners()` em `server/works.cjs` para o contrato exato. Preserve IDs únicos. Depois de atualizar o arquivo **no ambiente de produção**, teste `/api/designers`; o contador do site deriva da resposta dessa rota, não de um número fixo no HTML.

No Render, o cadastro deve estar disponível como **Secret File** (ou outro armazenamento privado configurado), e `DESIGNERS_DATA_FILE` deve apontar para seu caminho real, por exemplo `/etc/secrets/designers.json`. Substituir o arquivo local ou fazer push de código não substitui automaticamente o Secret File do Render. Ao atualizar o Secret File no painel, aguarde o novo deploy e confirme a contagem na rota. Confira o tamanho permitido pelo Render antes do upload.

### Fotos da equipe

Em `data/equipe-proj.json`, cada `foto` deve corresponder **exatamente** ao nome do arquivo na pasta Drive da equipe. A API serve `GET /api/team/photo?file=nome-do-arquivo.png`. Se a foto mudar mantendo o mesmo nome e pasta, aguarde até cinco minutos para a atualização do índice de arquivos e recarregue a página. Se trocar o nome, atualize também o JSON público e publique o site. Se trocar a pasta, ajuste `TEAM_PHOTOS_DRIVE_FOLDER_ID` no Render e faça o deploy da API. A conta de serviço precisa ter permissão de leitura na pasta.

### Adinkras e técnicas

Os arquivos são servidos por `GET /api/adinkras/icon?name=...`, com `variant=home` para a página inicial, e `GET /api/techniques/icon?name=...` para técnicas. As pastas são escolhidas pelas variáveis `HOME_ADINKRA_DRIVE_FOLDER_ID`, `ADINKRA_DRIVE_FOLDER_ID` e `TECHNIQUES_DRIVE_FOLDER_ID`. Se novos arquivos não aparecerem, verifique nome, formato, permissão da conta de serviço, pasta configurada no Render e cache de até cinco minutos. As correspondências entre nomes da interface e nomes históricos no Drive ficam em `server/works.cjs` (`techniqueFileAliases` e `adinkraFileNames`).

### Equipe, publicações, textos e visual

- Equipe: `data/equipe-proj.json`; fotos: pasta Drive e API.
- Publicações, links de vídeo e arquivos: `data/publicacoes.json`; apresentação: `js/pages/home/home-content.js`.
- Textos institucionais e política: `index.html`, `aviso-de-privacidade.html`.
- Textos das técnicas/eixos: `data/areas.json`; legendas: `data/legend-descriptions.json`.
- Layout, fontes, cores e responsividade: arquivos em `styles/`; depois `npm run sass` e inclua `styles/css/style.css` no commit.
- Se o navegador continuar mostrando um JSON, JS ou CSS antigo após publicar, atualize com critério o parâmetro `?v=` da referência em HTML/JS e teste novamente.

## 5. Publicação: qual parte precisa ser atualizada?

| Mudança | Publicar interface estática? | Atualizar Render/API? |
| --- | --- | --- |
| HTML, SCSS/CSS, JS da interface, `data/*.json` públicos ou assets locais | Sim | Não |
| Código em `server/works.cjs`, configuração ou credencial da API | Não, salvo mudança no contrato da interface | Sim |
| Cadastro privado `designers.json` | Não | Sim: atualizar o arquivo privado no Render e validar a rota |
| Foto ou ícone no **mesmo** lugar do Drive, mesmo nome | Geralmente não | Em geral não; aguarde cache e confira acesso |
| Nova pasta Drive ou novo nome de foto em `data/equipe-proj.json` | Sim, se o JSON mudou | Sim, se a variável da pasta mudou |
| API e interface mudam juntas | Sim | Sim; publique/valide a API antes de publicar a interface dependente |

### 5.1. Fluxo de código no GitHub

Repositório: [blackvisesdi/BlackVis](https://github.com/blackvisesdi/BlackVis). **Não suponha que a branch local `main` está atualizada**: neste checkout, o trabalho corrente está em `v2.1`, enquanto o GitHub Pages publica a branch `gh-pages`. Antes de cada alteração:

```powershell
git status
git fetch origin
git branch -vv
```

Trabalhe na branch de desenvolvimento combinada pela equipe; não force push nem sobrescreva arquivos de outra pessoa. Execute `npm run sass` se mudou SCSS, confira a página local e rode `node --test server/works.security.test.cjs` se alterou a API. Depois:

```powershell
git add -p
git commit -m "Descreve a alteração"
git push origin HEAD
```

`git add -p` seleciona alterações em arquivos já rastreados. Para arquivos novos, adicione cada caminho explicitamente com `git add caminho/do/arquivo` (substitua pelo caminho real). Abra um Pull Request para `main` e revise o resultado antes do merge. Não inclua `.env`, `secrets/`, `node_modules/` ou arquivos pessoais. `git status` deve mostrar somente o que se pretende publicar.

### 5.2. GitHub Pages

Confira em **GitHub → Settings → Pages** qual branch e pasta estão configuradas. Neste projeto, a publicação usa `gh-pages` a partir da raiz. URL conhecida: [blackvisesdi.github.io/BlackVis](https://blackvisesdi.github.io/BlackVis/). Depois de aprovar a alteração em `main`, integre `main` em `gh-pages` por Pull Request ou por merge local, preservando o histórico, e confira a publicação no navegador. Um exemplo de merge local, **somente com árvore de trabalho limpa e acesso de publicação**, é:

```powershell
git fetch origin
$branchPublicacao = "publicar-$(Get-Date -Format yyyyMMdd-HHmmss)"
git switch -c $branchPublicacao origin/gh-pages
git merge origin/main --no-ff
git push origin HEAD:gh-pages
git switch -
```

Se houver conflitos, resolva e teste antes do push. O script `npm run deploy` executa apenas `git push origin HEAD:gh-pages`; ele pode falhar quando a branch atual e `gh-pages` têm históricos diferentes. Não use `--force` para contornar isso. Após o deploy, verifique `index.html`, `visualizacao.html`, imagens, filtros, console do navegador e a chamada à API.

### 5.3. Domínio institucional por FTP

O endereço [www.blackvis.esdi.uerj.br](https://www.blackvis.esdi.uerj.br/) pode usar uma hospedagem separada. **Enviar ao GitHub Pages não atualiza automaticamente o FTP.** Confirme com a equipe para onde o DNS do domínio aponta e qual é a pasta pública do servidor antes do upload.

Se a publicação for manual por FTP, envie a versão revisada dos arquivos estáticos da raiz (`index.html`, `visualizacao.html`, `aviso-de-privacidade.html`, `js/`, `styles/css/style.css`, `assets/` e `data/*.json` públicos), preservando a estrutura de pastas. Não envie `server/`, `.env`, `secrets/`, `node_modules/`, `.git/`, testes ou arquivos de trabalho. A API continua no Render; confira a URL em `js/config.js` e a origem institucional em `WORKS_ALLOWED_ORIGINS`. Após o upload, teste tanto `www` quanto a versão sem `www` se ambas forem usadas.

### 5.4. API no Render

Serviço: `blackvis-api` (URL: [blackvis-api.onrender.com](https://blackvis-api.onrender.com/api/health)). No painel do Render, confirme em **Settings** qual repositório, branch, build command e start command estão ligados ao serviço; não presuma que seja `main`. O comando de entrada precisa executar `server/works.cjs` (por exemplo `npm run works`).

Para publicar código novo da API: (1) faça merge na branch **realmente conectada** ao Render; (2) acompanhe **Deploys**; (3) se o deploy automático estiver desligado, use **Manual Deploy → Deploy latest commit**; (4) espere o estado **Live**; (5) teste `/api/health`, `/api/designers`, uma foto e um ícone. **Restart service** reutiliza o commit já implantado: não substitui um deploy de código novo.

Para mudar pasta do Drive, origens CORS ou caminho do cadastro, altere as variáveis em **Environment** no Render e escolha uma opção que implante a nova configuração. Para credenciais e cadastro, use **Secret Files** e caminhos correspondentes nas variáveis. O Render disponibiliza esses arquivos em `/etc/secrets/<nome>`; não copie os valores ao Git. Mudanças no `.env` local não alteram produção. Documentação oficial: [deploys](https://render.com/docs/deploys) e [variáveis e Secret Files](https://render.com/docs/configure-environment-variables).

## 6. Verificações e problemas frequentes

- **Site abre, mas ninguém aparece:** abra a aba Network e teste `/api/designers` diretamente. `502` pode indicar arquivo privado ausente, inválido ou caminho incorreto; `403` com erro de CORS pode significar origem ausente em `WORKS_ALLOWED_ORIGINS`. A lista deve conter a **origem exata** (`https://www.blackvis.esdi.uerj.br`, `https://blackvis.esdi.uerj.br`, `https://blackvisesdi.github.io`, conforme os endereços realmente usados), sem caminho `/BlackVis`.
- **Quantidade desatualizada:** compare o total de objetos em `/api/designers` com o cadastro privado efetivamente montado no Render. A data mostrada pelo site vem do horário de modificação do arquivo de dados (`lastUpdated`), não de uma data digitada na interface.
- **Foto/ícone 404:** confira o nome exato, a variável da pasta, permissão da conta de serviço, se a versão de `server/works.cjs` foi implantada e o cache do Drive. `/api/health` ajuda a verificar os ícones.
- **Site funciona localmente, não no domínio:** a página local pode descobrir uma API em `5501–5510`; em produção ela usa `window.BLACKVIS_API_URL`. Confira CORS, CSP em cada HTML, URL da API e se o FTP/GitHub Pages recebeu o CSS compilado.
- **`d3 is not defined`:** verifique a carga de `https://d3js.org/d3.v7.min.js` em `visualizacao.html`, inclusive `integrity`/SRI e CSP, antes dos outros scripts do grafo.
- **Conteúdo antigo depois de atualizar:** confira a branch publicada, a conclusão do deploy, o arquivo realmente enviado ao FTP e o cache do navegador; atualize `?v=` quando fizer sentido.

Checklist mínimo após qualquer publicação: abrir página inicial, acessar visualização, selecionar um eixo e um filtro combinado, pesquisar um nome, abrir e fechar um card, carregar uma foto da equipe e confirmar que não há erros de API no console. Depois de mexer em cookies ou estatísticas, teste aceitar e recusar separadamente.

## 7. Acessos e futura transferência para a conta do projeto

Use **blackvis@esdi.uerj.br** como contato de referência para o novo desenvolvedor e para solicitar os acessos. A pessoa responsável deve registrar em um gerenciador de senhas institucional ou outro canal seguro, fora do repositório:

1. Quem administra a organização/repositório GitHub `blackvisesdi/BlackVis`, permissões para PR e publicação em `gh-pages`.
2. Quem administra o serviço `blackvis-api` no Render, branch conectada, variáveis, Secret Files e política de deploy automático.
3. Quem administra o projeto Google Cloud, a conta de serviço, a API Drive e as permissões das quatro pastas usadas pelo projeto.
4. Quem administra o domínio, DNS e hospedagem FTP institucional, inclusive a pasta pública e os dados de acesso.
5. Quem administra a propriedade GA4 e o fluxo de medição do BlackVis.
6. Onde fica a versão autorizada do cadastro privado, quem pode editá-la e como atualizar sua cópia no Render.

**Migração futura:** primeiro conceda acesso de equipe ao novo responsável em cada serviço; depois transfira a propriedade do serviço ou recrie-o sob uma conta institucional, configure segredos e domínio, teste todos os endpoints e só então remova a dependência da conta pessoal. Troque/rotacione credenciais compartilhadas durante a transferência. Não altere o destino da API em `js/config.js` antes de a nova API estar pronta e validada.

## Fontes para os procedimentos de publicação

- [GitHub Docs: fonte de publicação do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Render Docs: deploy automático, manual e reinício](https://render.com/docs/deploys)
- [Render Docs: variáveis de ambiente e Secret Files](https://render.com/docs/configure-environment-variables)
