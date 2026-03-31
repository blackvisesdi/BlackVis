# BlackVis

Visualização interativa de designers negros e suas áreas de atuação, construída com D3.js v7.

## O que é

BlackVis exibe um grafo de força interativo onde cada nó representa um designer, uma técnica ou uma área do design. Os nós se conectam por afinidade e área, e o usuário pode filtrar por ano de nascimento, área do design, nacionalidade, período ou nome.

## Como rodar

O projeto usa `fetch` para carregar o `data.json`, então precisa de um servidor local (não funciona abrindo `index.html` diretamente pelo sistema de arquivos):

```bash
# Node.js
npx serve .

# Python
python -m http.server 8080
```

Acesse `http://localhost:8080` (ou a porta indicada pelo servidor).

## Estrutura de arquivos

```
BlackVis/
├── index.html
├── data.json                  (dados dos designers)
├── js/
│   ├── globals.js             (estado global, utilitários, sistema de cores)
│   ├── draw.js                (renderização D3, simulação de forças, ícones)
│   ├── interactions.js        (drag, foco de nó, card de perfil)
│   └── data.js                (carregamento, pré-processamento, filtros)
├── styles/
│   ├── style.scss             (source)
│   └── style.css              (CSS compilado)
└── assets/icons/              (SVGs das técnicas)
```

## Schema do data.json

```json
{
  "nodes": [
    {
      "id": "designer-001",
      "Nome": "Nome Completo",
      "Área do design": "Comunicação, Produto",
      "Técnicas atualizadas": "Design gráfico, Tipografia",
      "Data de nascimento": 1985,
      "Data de falecimento (se houver)": null,
      "Nacionalidade": "Brasileira",
      "Período": "Contemporâneo",
      "Cidade": "São Paulo",
      "Estado": "SP",
      "Minibio": "Breve descrição do designer.",
      "Links extras": "https://portfolio.com"
    }
  ],
  "links": []
}
```

## Áreas do design suportadas

| Área | Cor |
|------|-----|
| Comunicação | Azul |
| Produto | Amarelo |
| Interação | Rosa |
| Serviço | Laranja |
| Teórico | Verde |

## Dependências

- [D3.js v7](https://d3js.org/) — via CDN com SRI, sem instalação necessária

## Compilar o SCSS

Se editar `style.scss`, recompile para `style.css`:

```bash
npm install -g sass
sass styles/style.scss styles/style.css
```
