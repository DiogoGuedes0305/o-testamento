// Guarda o site para funcionar sem internet depois da primeira visita.
// O código e os dados do caso vêm sempre da rede primeiro, para apanhar correções feitas antes da noite;
// só as fotos e os ícones vêm primeiro da cópia guardada.
// Pedidos a outros sites (a base de dados do Firebase, as fontes) nunca passam por aqui: o jogo tem de os ver ao vivo.
const VERSAO = 'testamento-demo-v1';
const BASE = ['./', 'index.html', 'estilo.css', 'app.js', 'manifest.webmanifest', 'icones/icone-192.png', 'icones/icone-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const primeiroCache = /\/(fotos|icones)\//.test(url.pathname);
  e.respondWith(primeiroCache ? cache(e.request) : rede(e.request));
});

async function rede(pedido) {
  const c = await caches.open(VERSAO);
  try {
    const r = await fetch(pedido);
    if (r.ok) c.put(pedido, r.clone());
    return r;
  } catch {
    return (await c.match(pedido, { ignoreSearch: true })) ?? Response.error();
  }
}

async function cache(pedido) {
  const c = await caches.open(VERSAO);
  const guardado = await c.match(pedido);
  if (guardado) return guardado;
  const r = await fetch(pedido);
  if (r.ok) c.put(pedido, r.clone());
  return r;
}
