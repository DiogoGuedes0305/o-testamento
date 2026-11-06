// Servidor local para testar o site no computador: node ferramentas/servir.mjs
// Abre http://localhost:8080 (a cifra do browser só funciona em localhost ou https).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const caminho = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\/])+/, '');
  try {
    const dados = await readFile(join(pasta, caminho || 'index.html'));
    res.writeHead(200, { 'Content-Type': tipos[extname(caminho || 'index.html')] ?? 'application/octet-stream' });
    res.end(dados);
  } catch {
    res.writeHead(404); res.end('Não encontrado');
  }
}).listen(8080, () => console.log('Site em http://localhost:8080'));
