/* Verifica os limites de leitura de imagens remotas e os cabeçalhos da API. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { server, readBoundedImage, withIconFetchSlot } = require('./works.cjs');

test('aceita uma imagem abaixo do limite', async () => {
  const response = new Response(Buffer.from('imagem'));
  assert.equal((await readBoundedImage(response, 16)).toString(), 'imagem');
});

test('rejeita tamanho declarado acima do limite', async () => {
  const response = new Response(Buffer.from('imagem'), {
    headers: { 'content-length': '100' }
  });
  await assert.rejects(readBoundedImage(response, 16), /acima do limite/);
});

test('rejeita corpo acima do limite mesmo sem tamanho declarado', async () => {
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(9));
      controller.enqueue(new Uint8Array(9));
      controller.close();
    }
  }));
  await assert.rejects(readBoundedImage(response, 16), /acima do limite/);
});

test('limita as leituras simultâneas de ícones', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let active = 0;
  let peak = 0;
  const jobs = Array.from({ length: 8 }, () => withIconFetchSlot(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await gate;
    active -= 1;
  }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(peak, 6);
  release();
  await Promise.all(jobs);
  assert.equal(active, 0);
});

test('API aplica cabeçalhos básicos e não expõe rota desconhecida', async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/nao-existe`);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
