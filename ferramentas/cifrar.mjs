// Cifra um caso para o site.
// Uso: node ferramentas/cifrar.mjs casos/treino.json [--padrao]
//
// Lê o caso em claro e escreve:
//   site/dados/<id>/publico.json   o que todos podem ver (título, retratos, regras)
//   site/dados/<id>/caso.json      os segredos cifrados; cada código só abre a sua parte
//   site/dados/indice.json         lista de casos; --padrao faz deste o caso que abre sem ?caso=
//   privado/envelopes.html    códigos para imprimir e meter nos envelopes (não vai para o site)
//
// Cada segredo é cifrado com AES-GCM e uma chave derivada do próprio código (PBKDF2).
// O ficheiro só guarda um hash do código para o encontrar, nunca o código.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { webcrypto as crypto } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ITERACOES = 150000;
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function normalizar(codigo) {
  return codigo.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const b64 = buf => Buffer.from(buf).toString('base64');
const enc = new TextEncoder();

async function idDoCodigo(codigo) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode('testamento|' + codigo));
  return Buffer.from(h).toString('hex').slice(0, 24);
}

async function cifrar(codigo, conteudo) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey('raw', enc.encode(codigo), 'PBKDF2', false, ['deriveKey']);
  const chave = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal, iterations: ITERACOES, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, enc.encode(JSON.stringify(conteudo)));
  return { s: b64(sal), iv: b64(iv), ct: b64(ct) };
}

function envelopes(publico, segredos) {
  const nome = id => publico.jogadores.find(j => j.id === id)?.nome ?? id;
  const cartoes = segredos.filter(s => s.tipo === 'ficha').map(s => `
    <div class="env"><span class="lbl">Herdeiro</span><b>${nome(s.jogador)}</b><span class="lbl">Código</span><code>${s.codigo}</code></div>`);
  return `<!doctype html><meta charset="utf-8"><title>Envelopes · ${publico.titulo} ${publico.tituloDestaque ?? ''}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Marcellus+SC&display=swap">
<style>
  body { margin: 24px; font-family: "Cormorant Garamond", Georgia, serif; color: #12241b; }
  h1 { font-size: 22px; margin: 0 0 6px; } p { margin: 0 0 20px; color: #555; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .env { border: 1.5px solid #12241b; outline: 1px solid #c9a45c; outline-offset: -7px; padding: 22px; display: grid; gap: 4px; break-inside: avoid; }
  .lbl { font-family: "Marcellus SC", Georgia, serif; font-size: 11px; letter-spacing: .22em; color: #7d6232; }
  b { font-size: 26px; margin-bottom: 8px; }
  code { font-family: "Marcellus SC", Georgia, serif; font-size: 24px; letter-spacing: .2em; }
</style>
<h1>Envelopes · ${publico.titulo} ${publico.tituloDestaque ?? ''}</h1>
<p>Imprime, recorta pelas linhas, dobra cada cartão e mete-o no envelope com o nome por fora.</p>
<div class="grid">${cartoes.join('')}</div>`;
}

const entrada = process.argv[2];
if (!entrada) { console.error('Uso: node ferramentas/cifrar.mjs <caso.json>'); process.exit(1); }

const caso = JSON.parse(await readFile(resolve(entrada), 'utf8'));

// Votação final: a última ronda leva a chave da solução, para a revelação abrir sozinha
// em todos os telemóveis quando todos votarem. A solução leva os segredos de todos, para os mostrar.
const solucao = caso.segredos.find(s => s.tipo === 'solucao');
const ultima = caso.segredos.filter(s => s.tipo === 'ronda').sort((a, b) => b.n - a.n)[0];
if (solucao && ultima) {
  ultima.chaveFinal = normalizar(solucao.codigo);
  solucao.segredos = Object.fromEntries(caso.segredos.filter(s => s.tipo === 'ficha').map(s => [s.jogador, s.segredo]));
}
// O guia do anfitrião não tem código: abre-se com cinco toques no título, e a app usa esta chave.
const guiaDoCaso = caso.segredos.find(s => s.tipo === 'guia');
if (guiaDoCaso) caso.publico.chaveGuia = normalizar(guiaDoCaso.codigo);
// As rondas não têm código para os jogadores: o guia leva as chaves e o anfitrião revela-as com um botão.
// O guia mostra ao anfitrião o código de cada jogador, para os mandar por mensagem.
if (guiaDoCaso) guiaDoCaso.fichas = caso.segredos.filter(s => s.tipo === 'ficha').map(s => ({ jogador: s.jogador, codigo: s.codigo }));
if (guiaDoCaso) guiaDoCaso.rondas =Object.fromEntries(caso.segredos.filter(s => s.tipo === 'ronda').map(s => [s.n, normalizar(s.codigo)]));

const vistos = new Set();
const entradas = {};
for (const { codigo, ...conteudo } of caso.segredos) {
  const c = normalizar(codigo);
  if (vistos.has(c)) throw new Error(`Código repetido: ${codigo}`);
  vistos.add(c);
  entradas[await idDoCodigo(c)] = await cifrar(c, conteudo);
}

const id = caso.publico.id;
const pastaCaso = join(raiz, 'site', 'dados', id);
await mkdir(pastaCaso, { recursive: true });
await mkdir(join(raiz, 'privado'), { recursive: true });
await writeFile(join(pastaCaso, 'publico.json'), JSON.stringify(caso.publico, null, 2));
await writeFile(join(pastaCaso, 'caso.json'), JSON.stringify({ id, iteracoes: ITERACOES, entradas }));
await writeFile(join(raiz, 'privado', `envelopes-${id}.html`), envelopes(caso.publico, caso.segredos));

// O índice diz que casos existem e qual abre por defeito (sem ?caso= no link).
const ficheiroIndice = join(raiz, 'site', 'dados', 'indice.json');
let indice = { padrao: id, casos: [] };
try { indice = JSON.parse(await readFile(ficheiroIndice, 'utf8')); } catch { /* primeiro caso */ }
if (!indice.casos.includes(id)) indice.casos.push(id);
if (process.argv.includes('--padrao')) indice.padrao = id;
await writeFile(ficheiroIndice, JSON.stringify(indice, null, 2));

console.log(`Cifrados ${caso.segredos.length} segredos do caso "${id}". Caso por defeito: "${indice.padrao}".`);
