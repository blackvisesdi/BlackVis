// Verifica o envio de page_view apenas após consentimento nas hospedagens publicadas.
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = readFileSync(path.join(__dirname, 'pageviews.js'), 'utf8');

function openPage(hostname, savedChoice = null) {
  const scripts = [];
  const storage = new Map();
  if (savedChoice) storage.set('blackvis-analytics-consent', savedChoice);
  const location = {
    hostname,
    origin: `https://${hostname}`,
    pathname: hostname === 'blackvisesdi.github.io' ? '/BlackVis/index.html' : '/index.html',
    search: '?private=ignored'
  };
  const document = {
    title: 'BLACKVIS',
    head: { append(script) { scripts.push(script); } },
    createElement() {
      const handlers = new Map();
      return {
        addEventListener(name, handler) { handlers.set(name, handler); },
        fire(name) { handlers.get(name)?.(); }
      };
    },
    addEventListener() {}
  };
  const window = {
    BLACKVIS_GA_MEASUREMENT_IDS: ['G-83S2SDQKFX', 'G-DBKNP7702J'],
    dispatchEvent() {}
  };
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); }
  };
  vm.runInNewContext(source, {
    window, document, location, localStorage,
    CustomEvent: class { constructor(name, options) { this.name = name; this.detail = options.detail; } }
  });
  const commands = () => (window.dataLayer || []).map(args => Array.from(args));
  return { window, scripts, commands };
}

test('não carrega a tag antes do aceite', () => {
  const page = openPage('blackvisesdi.github.io');
  assert.equal(page.scripts.length, 0);
  page.window.blackvisAnalytics.setChoice(true);
  assert.equal(page.scripts.length, 1);
  assert.match(page.scripts[0].src, /G-83S2SDQKFX/);
  assert.equal(page.commands().filter(command => command[1] === 'page_view').length, 0);
  page.scripts[0].fire('load');
  const pageViews = page.commands().filter(command => command[1] === 'page_view');
  assert.equal(pageViews.length, 1);
  assert.equal(pageViews[0][2].page_location, 'https://blackvisesdi.github.io/BlackVis/index.html');
  assert.equal(pageViews[0][2].send_to, 'blackvis');
  const configs = page.commands().filter(command => command[0] === 'config');
  assert.deepEqual(Array.from(configs, command => command[1]), ['G-83S2SDQKFX', 'G-DBKNP7702J']);
  assert.ok(configs.every(command => command[2].send_page_view === false && command[2].groups === 'blackvis'));
  page.window.blackvisAnalytics.send('interface_click', { interface_area: 'filtros' });
  assert.equal(page.commands().find(command => command[1] === 'interface_click')[2].send_to, 'blackvis');
});

test('aceite salvo conta uma visualização no domínio institucional', () => {
  const page = openPage('blackvis.esdi.uerj.br', 'accepted');
  assert.equal(page.scripts.length, 1);
  page.scripts[0].fire('load');
  assert.equal(page.commands().filter(command => command[1] === 'page_view').length, 1);
});

test('revogar o aceite enquanto a tag carrega impede a visualização', () => {
  const page = openPage('blackvis.esdi.uerj.br');
  page.window.blackvisAnalytics.setChoice(true);
  page.window.blackvisAnalytics.setChoice(false);
  page.scripts[0].fire('load');
  assert.equal(page.commands().filter(command => command[1] === 'page_view').length, 0);
  assert.equal(page.window['ga-disable-G-83S2SDQKFX'], true);
  assert.equal(page.window['ga-disable-G-DBKNP7702J'], true);
});

test('recusa e hospedagem local ou não autorizada não carregam a tag', () => {
  for (const hostname of ['blackvis.esdi.uerj.br', 'localhost', 'outro.exemplo.br']) {
    const page = openPage(hostname, hostname === 'blackvis.esdi.uerj.br' ? 'rejected' : 'accepted');
    assert.equal(page.scripts.length, 0, hostname);
  }
});
