// Bateria de testes aos dados cifrados de um caso (o que vai para o site).
// Uso: node bateria-dados.mjs <pasta com publico.json e caso.json> <caso em claro.json>
import { readFile, access } from 'node:fs/promises';
import { webcrypto as crypto } from 'node:crypto';
import { join } from 'node:path';

const [pasta, claro] = process.argv.slice(2);
const pub = JSON.parse(await readFile(join(pasta, 'publico.json'), 'utf8'));
const cas = JSON.parse(await readFile(join(pasta, 'caso.json'), 'utf8'));
const fonte = JSON.parse(await readFile(claro, 'utf8'));
const enc = new TextEncoder(), d = s => Uint8Array.from(Buffer.from(s, 'base64'));
const norm = c => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
async function abrir(codigo) {
  const k = norm(codigo);
  const id = Buffer.from(await crypto.subtle.digest('SHA-256', enc.encode('testamento|' + k))).toString('hex').slice(0, 24);
  const e = cas.entradas[id]; if (!e) return null;
  const b = await crypto.subtle.importKey('raw', enc.encode(k), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: d(e.s), iterations: cas.iteracoes, hash: 'SHA-256' }, b, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: d(e.iv) }, key, d(e.ct))));
}

let ok = 0, falhas = 0;
const teste = (nome, cond, extra = '') => { if (cond) ok++; else { falhas++; console.log('  ✗', nome, extra); } };

const jogadores = pub.jogadores.filter(j => !j.animal);
const ids = new Set(pub.jogadores.map(j => j.id));
const fichas = fonte.segredos.filter(s => s.tipo === 'ficha');
const rondas = fonte.segredos.filter(s => s.tipo === 'ronda').sort((a, b) => a.n - b.n);
const sol = fonte.segredos.find(s => s.tipo === 'solucao');

// Fichas
for (const f of fichas) {
  const c = await abrir(f.codigo);
  teste(`ficha ${f.jogador} abre com ${f.codigo}`, c?.tipo === 'ficha' && c.jogador === f.jogador);
  teste(`ficha ${f.jogador} abre com minúsculas e espaços`, (await abrir(' ' + f.codigo.toLowerCase() + ' '))?.jogador === f.jogador);
  for (const campo of ['quemEs', 'regra', 'ligacao', 'horario', 'viste', 'segredo', 'objetivo']) teste(`ficha ${f.jogador} tem ${campo}`, !!c?.[campo]);
}
teste('há uma ficha por jogador (sem o gato)', fichas.length === jogadores.length && jogadores.every(j => fichas.some(f => f.jogador === j.id)), `${fichas.length} fichas / ${jogadores.length} jogadores`);
teste('códigos das fichas são todos diferentes', new Set(fichas.map(f => norm(f.codigo))).size === fichas.length);

// Rondas: o guia leva as chaves; a última leva a chave da solução
teste('o caso tem 3 rondas', rondas.length === 3 && pub.rondas.length === 3);
const guia = await abrir(pub.chaveGuia ?? '');
teste('publico.chaveGuia abre o guia', guia?.tipo === 'guia');
for (const r of rondas) {
  const chave = guia?.rondas?.[r.n];
  const c = chave && await abrir(chave);
  teste(`guia.rondas[${r.n}] abre a ronda ${r.n}`, c?.tipo === 'ronda' && c.n === r.n);
  for (const m of c?.marcas ?? []) teste(`ronda ${r.n}: marca "${m.rotulo}" numa sala que existe`, ['lavandaria', 'sala', 'escadas', 'wcservico', 'wcprincipal', 'hospedes', 'corredor', 'closet', 'principal', 'escritorio'].includes(m.sala), m.sala);
  teste(`ronda ${r.n} tem provas`, c?.provas?.length > 0);
}
const ultima = await abrir(guia?.rondas?.[3] ?? '');
const solC = ultima?.chaveFinal && await abrir(ultima.chaveFinal);
teste('a 3.ª ronda traz a chave da solução', solC?.tipo === 'solucao');
teste('a solução diz quem é o assassino e ele é um jogador', !!solC?.assassino && jogadores.some(j => j.id === solC.assassino), solC?.assassino);
teste('a solução traz o segredo de todos', jogadores.every(j => solC?.segredos?.[j.id]));
teste('os segredos da solução são iguais aos das fichas', fichas.every(f => solC?.segredos?.[f.jogador] === f.segredo));
const fichaK = fichas.find(f => f.jogador === sol.assassino);
teste('a ficha do assassino explica o voto para incriminar', /incriminar/.test(fichaK?.objetivo ?? ''));
teste('só a ficha do assassino diz "És o assassino"', fichas.filter(f => /És o assassino/.test(f.regra)).map(f => f.jogador).join() === sol.assassino);

// O que não pode abrir pela caixa do código (a app rejeita tudo o que não é ficha; aqui confirma-se o tipo)
for (const r of rondas) teste(`código da ronda ${r.n} é do tipo ronda (a app recusa-o)`, (await abrir(r.codigo))?.tipo === 'ronda');

// Público
teste('regras: 4', pub.regras.length === 4, pub.regras.length);
teste('as regras não falam em "personagem"', !pub.regras.some(r => /personagem/i.test(r)));
teste('há prólogo', !!pub.prologo?.texto?.length);
teste(`hora de início marcada (publico.inicio)`, !!pub.inicio && !Number.isNaN(Date.parse(pub.inicio)), String(pub.inicio));
for (const j of pub.jogadores) {
  if (j.foto) { let existe = true; try { await access(join(pasta, '..', '..', j.foto)); } catch { existe = false; } teste(`foto de ${j.nome} existe (${j.foto})`, existe); }
  else teste(`${j.nome} tem foto`, false);
}
teste('nomes sem "Kátia"/"Cátia"', !JSON.stringify(fonte).match(/[KC]átia/));
teste('ids dos jogadores únicos', ids.size === pub.jogadores.length);

console.log(`${pub.id}: ${ok} certos, ${falhas} falhados`);
