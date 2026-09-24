/* DESENVOLVIMENTO LOCAL — inicia site e galeria em um único comando.
 * O .env é carregado pelo Node antes deste arquivo. A chave fica no servidor.
 * Ctrl+C encerra ambos; portas ocupadas são substituídas automaticamente por portas livres.
 */
const path = require('node:path');
const net = require('node:net');
const readline = require('node:readline');
const liveServer = require('live-server');
const { server: works } = require('./works.cjs');
let site;
let stopping = false;

function portAvailable(port) {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', error => resolve(error.code !== 'EADDRINUSE'));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(start, reserved = new Set()) {
  for (let port = start; port <= 65535; port += 1) {
    if (!reserved.has(port) && await portAvailable(port)) return port;
  }
  return null;
}

function askPort(defaultPort) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return Promise.resolve(null);
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    prompt.question(`A porta ${defaultPort} está em uso. Deseja usar outra porta? (s/N) `, answer => {
      if (!/^s( sim)?$/i.test(answer.trim())) {
        prompt.close();
        resolve(null);
        return;
      }
      prompt.question('Informe a nova porta do site (ex.: 5502): ', value => {
        const port = Number(value.trim());
        prompt.close();
        resolve(Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : null);
      });
    });
  });
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  liveServer.shutdown();
  site?.close();
  works.close();
  works.closeAllConnections?.();
  site?.closeAllConnections?.();
  // Também encerra conexões de live reload que estejam abertas no navegador.
  setTimeout(() => process.exit(code), 150);
}

function startupError(error) {
  console.error(error.code === 'EADDRINUSE'
    ? 'Uma porta ficou indisponível durante a inicialização. Execute npm run dev novamente.'
    : `Não foi possível iniciar o ambiente: ${error.code || 'erro de inicialização'}`);
  stop(1);
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
works.on('error', startupError);

// Procura portas livres para a galeria e para o site, evitando processos antigos.
(async () => {
  const worksPort = await findAvailablePort(5501);
  if (!worksPort) {
    console.error('Não foi encontrada uma porta livre para a galeria.');
    stop(1);
    return;
  }
  works.listen(worksPort, '127.0.0.1', async () => {
  const apiBase = `http://127.0.0.1:${worksPort}`;
  console.log(`API do Drive: ${apiBase}`);
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_FILE && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_DRIVE_API_KEY) {
    console.warn('Configure a conta de serviço ou GOOGLE_DRIVE_API_KEY no .env para carregar as obras.');
  } else {
    try {
      const health = await fetch(`${apiBase}/api/health`, { signal: AbortSignal.timeout(15000) });
      const body = await health.json();
      if (health.ok && body.drive === 'connected') {
        console.log(`API conectada ao Google Drive. SVGs de técnicas encontrados: ${body.techniqueSvgs}.`);
      } else {
        console.log('API iniciou, mas o Drive não foi autenticado.');
      }
    } catch (error) {
      console.warn(`API iniciou, mas o teste do Drive falhou: ${error.message}`);
    }
  }
  const defaultPort = Number(process.env.DEV_PORT || 5500);
  const sitePort = await findAvailablePort(defaultPort, new Set([worksPort]));
  if (!sitePort || !(await portAvailable(sitePort))) {
    console.error('O site não foi iniciado: nenhuma porta livre foi encontrada.');
    stop(1);
    return;
  }
  process.env.WORKS_ALLOWED_ORIGINS = `${process.env.WORKS_ALLOWED_ORIGINS || ''},http://127.0.0.1:${sitePort},http://localhost:${sitePort}`;
  site = liveServer.start({
    root: path.resolve(__dirname, '..'), host: '127.0.0.1', port: sitePort,
    open: process.env.DEV_NO_OPEN === '1' ? false : '/index.html',
    ignore: '.env,server/**,node_modules/**'
  });
  site.on('error', startupError);
  });
})();
