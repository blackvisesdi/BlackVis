/* Servidor estático de desenvolvimento com recarga automática, sem dependências. */
const http = require('node:http');
const fs = require('node:fs');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function openBrowser(url) {
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [url], { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
}

function startSite({ root, host, port, open }) {
  const clients = new Set();
  const watchers = [];
  let reloadTimer;

  function scheduleReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      for (const client of clients) client.write('data: reload\n\n');
    }, 150);
  }

  const server = http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }

    if (pathname === '/__reload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const segments = relative.split(/[\\/]/);
    if (segments.some(segment => !segment || segment.startsWith('.') || ['server', 'node_modules', 'secrets'].includes(segment))) {
      res.writeHead(404).end();
      return;
    }
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(404).end();
      return;
    }
    try {
      let content = await readFile(file);
      if (path.extname(file).toLowerCase() === '.html') {
        const reloadScript = '<script>new EventSource("/__reload").onmessage = () => location.reload()</script>';
        content = Buffer.from(content.toString('utf8').replace('</body>', `${reloadScript}</body>`));
      }
      res.writeHead(200, {
        'Content-Type': mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch {
      res.writeHead(404).end();
    }
  });

  server.listen(port, host, () => {
    watchers.push(fs.watch(root, (_event, filename) => {
      if (filename && String(filename).toLowerCase() === 'index.html') scheduleReload();
    }));
    for (const relative of ['js', 'styles/css', 'assets', 'data']) {
      const folder = path.join(root, relative);
      if (fs.existsSync(folder)) watchers.push(fs.watch(folder, { recursive: true }, scheduleReload));
    }
    const url = `http://${host}:${port}/index.html`;
    console.log(`Site iniciado: ${url}`);
    if (open) openBrowser(url);
  });

  return {
    server,
    stopWatching() {
      clearTimeout(reloadTimer);
      for (const watcher of watchers) watcher.close();
      for (const client of clients) client.end();
      clients.clear();
    }
  };
}

module.exports = { startSite };
