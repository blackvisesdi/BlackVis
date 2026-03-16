# BlackVis

Visualização interativa de designers negros brasileiros e suas áreas de atuação, construída com D3.js v7.

## O que é

BlackVis exibe um grafo de força interativo onde cada nó representa um designer, uma técnica ou uma área do design. Os nós se conectam por afinidade e área, e o usuário pode filtrar por ano de nascimento, área do design ou nome.

## Como rodar

O projeto usa `fetch` para carregar o `data.json`, então precisa de um servidor local (não funciona abrindo `index.html` diretamente pelo sistema de arquivos):

```bash
# Node.js
npx serve .

# Python
python -m http.server 8080

# PHP
php -S localhost:8080
```

Acesse `http://localhost:3000` (ou a porta indicada).

## Estrutura de arquivos

```
/
├── index.html
├── data/
│   └── data.json
├── js/
│   ├── globals.js       — constantes, SVG principal, AppState
│   ├── utils.js         — normalizeKey, getId, showToast
│   ├── colors.js        — paletas e mapeamento de cores por área
│   ├── preprocess.js    — monta nós de categoria/técnica e links
│   ├── interactions.js  — drag, foco de nó, card de perfil
│   ├── draw.js          — renderização do grafo D3
│   ├── filters.js       — slider de ano, dropdown de categoria, busca
│   ├── loader.js        — carrega data.json e orquestra os filtros
│   └── icons.js         — mapa de ícones por nome de técnica
└── styles/
    ├── style.scss        — fonte principal de estilos
    └── style.css         — CSS compilado (não editar diretamente)
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
      "Cidade": "São Paulo",
      "Estado": "SP",
      "Minibio": "Breve descrição do designer.",
      "Links extras": "https://portfolio.com"
    }
  ],
  "links": [
    { "source": "designer-001", "target": "designer-002" }
  ]
}
```

## Áreas do design suportadas

- Comunicação
- Produto
- Interação
- Serviço
- Teórico

## Dependências

- [D3.js v7](https://d3js.org/) — via CDN, sem instalação necessária

## Compilar o SCSS

Se editar `style.scss`, recompile para `style.css`:

```bash
npm install -g sass
sass styles/style.scss styles/style.css
```
