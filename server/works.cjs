/* GALERIA DO DRIVE — lista imagens das pastas cadastradas e repassa miniaturas.
 * A chave fica no ambiente do servidor. Nenhuma imagem é gravada em disco.
 * Somente pastas do banco são aceitas; cache de metadados dura cinco minutos.
 */
const http = require('node:http');
const crypto = require('node:crypto');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const cache = new Map();
const techniqueIndexCache = { until: 0, files: new Map() };
const techniqueContentCache = new Map();
const designersFile = process.env.DESIGNERS_DATA_FILE || path.join(__dirname, '../secrets/designers.json');
const serviceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const techniquesFolderId = process.env.TECHNIQUES_DRIVE_FOLDER_ID || '1jpMSbLnRn3p27HaIF_Ldy8x92fupFMWR';
let serviceAccount;
let accessToken;
let accessTokenExpiresAt = 0;

async function readDesigners() {
  return JSON.parse(await readFile(designersFile, 'utf8'));
}

// Campos que a interface realmente utiliza. Links privados do Drive e colunas
// internas de obras nunca são enviados para o navegador.
function publicDesigner(person) {
  return {
    id: person.id,
    Nome: person.Nome,
    'Data de nascimento': person['Data de nascimento'],
    'Data de falecimento (se houver)': person['Data de falecimento (se houver)'],
    Nacionalidade: person.Nacionalidade,
    País: person.País,
    Continente: person.Continente,
    Região: person.Região,
    Estado: person.Estado,
    Cidade: person.Cidade,
    'Gênero': person['Gênero'],
    'Área do design': person['Área do design'],
    'Técnicas': person['Técnicas'],
    'Redes sociais': person['Redes sociais'],
    'Links extras': person['Links extras'],
    Minibio: person.Minibio
  };
}
function folderFrom(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== 'drive.google.com') return null;
    const id = url.pathname.match(/\/folders\/([\w-]+)/)?.[1];
    return id ? { id, key: url.searchParams.get('resourcekey') } : null;
  } catch { return null; }
}
// Relê o cadastro: alterações nos links não podem deixar a lista permitida
// presa à versão antiga carregada ao iniciar o processo.
async function registeredFolders() {
  const designers = await readDesigners();
  return new Map(designers.map(person => {
    const folder = folderFrom(person['Links para fotos']);
    return folder ? [person.id, folder] : null;
  }).filter(Boolean));
}
function fail(status, message) { return Object.assign(new Error(message), { status }); }

function normalizeDriveName(value) {
  return String(value || '')
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function base64Url(value) {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getServiceAccount() {
  if (!serviceAccountFile) return null;
  if (!serviceAccount) serviceAccount = JSON.parse(await readFile(serviceAccountFile, 'utf8'));
  return serviceAccount;
}

async function getDriveHeaders() {
  const account = await getServiceAccount();
  if (!account) return {};
  if (accessToken && accessTokenExpiresAt > Date.now() + 60000) {
    return { Authorization: `Bearer ${accessToken}` };
  }
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: account.token_uri,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000)
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const assertion = `${header}.${payload}.${base64Url(signer.sign(account.private_key))}`;
  const tokenResponse = await fetch(account.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!tokenResponse.ok) throw fail(502, 'Não foi possível autenticar a conta de serviço do Google Drive.');
  const token = await tokenResponse.json();
  accessToken = token.access_token;
  accessTokenExpiresAt = Date.now() + Number(token.expires_in || 3600) * 1000;
  return { Authorization: `Bearer ${accessToken}` };
}

async function getDriveRequestConfig(url) {
  const headers = await getDriveHeaders();
  if (!Object.keys(headers).length) {
    if (!process.env.GOOGLE_DRIVE_API_KEY) throw fail(503, 'Configure a conta de serviço ou a chave do Google Drive no servidor.');
    url.searchParams.set('key', process.env.GOOGLE_DRIVE_API_KEY);
  }
  return { headers };
}

async function list(folder) {
  const saved = cache.get(folder.id);
  if (saved && saved.until > Date.now()) return saved.files;
  const files = [];
  let pageToken;
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.search = new URLSearchParams({
      q: `'${folder.id}' in parents and trashed = false and mimeType contains 'image/'`,
      fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink,resourceKey)',
      pageSize: '100', orderBy: 'name', ...(pageToken ? { pageToken } : {})
    });
    const config = await getDriveRequestConfig(url);
    if (folder.key) config.headers['X-Goog-Drive-Resource-Keys'] = `${folder.id}/${folder.key}`;
    const response = await fetch(url, { ...config, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw fail(502, 'Não foi possível acessar as obras. Verifique a chave, a API do Drive e o compartilhamento da pasta.');
    const body = await response.json();
    files.push(...(body.files || []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  cache.set(folder.id, { until: Date.now() + 300000, files });
  return files;
}

async function listDriveChildren(parentId) {
  const files = [];
  let pageToken;
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.search = new URLSearchParams({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,resourceKey)',
      pageSize: '100', orderBy: 'name', ...(pageToken ? { pageToken } : {})
    });
    const config = await getDriveRequestConfig(url);
    const response = await fetch(url, { ...config, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw fail(502, 'Não foi possível listar a pasta de técnicas no Google Drive.');
    const body = await response.json();
    files.push(...(body.files || []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

async function techniqueFiles() {
  if (!techniquesFolderId) throw fail(503, 'Configure TECHNIQUES_DRIVE_FOLDER_ID no servidor.');
  if (techniqueIndexCache.until > Date.now()) return techniqueIndexCache.files;

  const result = new Map();
  const pendingFolders = [techniquesFolderId];
  const visited = new Set();
  while (pendingFolders.length) {
    const folderId = pendingFolders.shift();
    if (visited.has(folderId)) continue;
    visited.add(folderId);
    for (const file of await listDriveChildren(folderId)) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        pendingFolders.push(file.id);
        continue;
      }
      if (file.mimeType !== 'image/svg+xml' && !/\.svg$/i.test(file.name)) continue;
      result.set(normalizeDriveName(file.name), file);
    }
  }
  techniqueIndexCache.files = result;
  techniqueIndexCache.until = Date.now() + 300000;
  return result;
}

async function readTechniqueIcon(name) {
  const files = await techniqueFiles();
  const file = files.get(normalizeDriveName(name));
  if (!file) throw fail(404, 'SVG da técnica não encontrado no Drive.');
  const saved = techniqueContentCache.get(file.id);
  if (saved && saved.until > Date.now()) return saved;

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`);
  url.searchParams.set('alt', 'media');
  const config = await getDriveRequestConfig(url);
  const response = await fetch(url, { ...config, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw fail(502, 'Não foi possível carregar o SVG da técnica.');
  const content = Buffer.from(await response.arrayBuffer());
  const savedIcon = { content, until: Date.now() + 300000 };
  techniqueContentCache.set(file.id, savedIcon);
  return savedIcon;
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origins = (process.env.WORKS_ALLOWED_ORIGINS || 'http://127.0.0.1:5500,http://localhost:5500').split(',');
  if (req.headers.origin && !origins.includes(req.headers.origin)) {
    res.writeHead(403).end(); return;
  }
  if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Vary', 'Origin');
  try {
    if (req.method !== 'GET') throw fail(405, 'Método não permitido.');
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/health') {
      await getDriveHeaders();
      const techniqueFilesFound = await techniqueFiles();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({
        ok: true,
        api: 'connected',
        drive: 'connected',
        techniquesFolder: Boolean(techniquesFolderId),
        techniqueSvgs: techniqueFilesFound.size,
        techniqueSvgsStatus: techniqueFilesFound.size > 0 ? 'connected' : 'empty'
      }));
      return;
    }
    if (url.pathname === '/api/designers') {
      const designers = await readDesigners();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ designers: designers.map(publicDesigner) }));
      return;
    }
    if (url.pathname === '/api/techniques/icon') {
      const name = url.searchParams.get('name');
      if (!name) throw fail(400, 'Informe o nome da técnica.');
      const icon = await readTechniqueIcon(name);
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.end(icon.content);
      return;
    }
    if (url.pathname !== '/api/works' && url.pathname !== '/api/works/thumbnail') throw fail(404, 'Rota não encontrada.');
    const folders = await registeredFolders();
    const personId = url.searchParams.get('person');
    const folder = folders.get(personId);
    if (!folder) throw fail(404, 'Pasta não cadastrada.');
    const files = await list(folder);
    if (url.pathname.endsWith('/thumbnail')) {
      const file = files.find(item => item.id === url.searchParams.get('file'));
      if (!file?.thumbnailLink) throw fail(404, 'Miniatura indisponível.');
      const thumbnail = new URL(file.thumbnailLink);
      if (thumbnail.protocol !== 'https:' || !/(^|\.)(googleusercontent\.com|google\.com)$/.test(thumbnail.hostname)) throw fail(502, 'Endereço de miniatura inválido.');
      let image = await fetch(thumbnail, { headers: await getDriveHeaders(), signal: AbortSignal.timeout(15000) });
      let type = image.headers.get('content-type') || '';
      if (!image.ok || !/^image\/(jpeg|png|webp|gif)(;|$)/i.test(type)) {
        const mediaUrl = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`);
        mediaUrl.searchParams.set('alt', 'media');
        const mediaConfig = await getDriveRequestConfig(mediaUrl);
        if (folder.key) mediaConfig.headers['X-Goog-Drive-Resource-Keys'] = `${folder.id}/${folder.key}`;
        image = await fetch(mediaUrl, { ...mediaConfig, signal: AbortSignal.timeout(15000) });
        type = image.headers.get('content-type') || file.mimeType || '';
      }
      if (!image.ok || !/^image\/(jpeg|png|webp|gif)(;|$)/i.test(type)) {
        cache.delete(folder.id);
        throw fail(502, 'Miniatura indisponível. Tente novamente.');
      }
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.end(Buffer.from(await image.arrayBuffer()));
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ files: files.map(file => ({
      id: file.id, name: file.name,
      url: `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view${file.resourceKey ? `?resourcekey=${encodeURIComponent(file.resourceKey)}` : ''}`,
      thumbnail: file.thumbnailLink ? `/api/works/thumbnail?person=${encodeURIComponent(personId)}&file=${encodeURIComponent(file.id)}` : null
    })) }));
  } catch (error) {
    res.writeHead(error.status || 502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: error.status ? error.message : 'Não foi possível carregar as obras. Tente novamente.' }));
  }
});
if (require.main === module) {
  const port = Number(process.env.PORT || process.env.WORKS_PORT || 5501);
  const host = process.env.WORKS_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  server.listen(port, host, () => {
  console.log('Galeria de obras iniciada. Porta:', server.address().port);
  });
}
module.exports = { server, folderFrom };
