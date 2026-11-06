// O Testamento · motor do site.
// Os segredos estão cifrados em dados/caso.json; cada código só abre a sua parte.
// Os códigos já abertos ficam guardados neste telemóvel para não ter de os escrever outra vez.

const vista = document.getElementById('vista');
const enc = new TextEncoder();
const dec = new TextDecoder();

let publico, caso;
const abertos = new Map(); // código normalizado -> conteúdo decifrado
let fichaVisivel = false;
let wakeLock = null;

// ---------- Utilidades ----------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normalizar = c => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const chaveGuardada = () => `testamento-${publico.id}-codigos`;

function lerGuardados() {
  try { return JSON.parse(localStorage.getItem(chaveGuardada())) ?? []; } catch { return []; }
}
function guardar() {
  try { localStorage.setItem(chaveGuardada(), JSON.stringify([...abertos.keys()])); } catch { /* sem armazenamento: fica só nesta sessão */ }
}

async function idDoCodigo(codigo) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode('testamento|' + codigo));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

async function decifrar(codigo) {
  const entrada = caso.entradas[await idDoCodigo(codigo)];
  if (!entrada) return null;
  const base = await crypto.subtle.importKey('raw', enc.encode(codigo), 'PBKDF2', false, ['deriveKey']);
  const chave = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: deB64(entrada.s), iterations: caso.iteracoes, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(entrada.iv) }, chave, deB64(entrada.ct));
  return JSON.parse(dec.decode(claro));
}

const lista = tipo => [...abertos.values()].filter(c => c.tipo === tipo);
const jogador = id => publico.jogadores.find(j => j.id === id);
const pratoDa = n => publico.rondas.find(r => r.n === n)?.prato ?? '';

// ---------- Retrato (moldura oval dourada) ----------

let nRetrato = 0;
function retrato(j) {
  const k = ++nRetrato;
  const iniciais = j.nome.replace(/^(Dr|Dra|D)\.\s*/, '').split(/\s+/).map(p => p[0]).slice(0, 2).join('');
  const e = j.enquadramento ?? { x: -66, y: -54, w: 440 };
  const foto = j.foto
    ? `<image href="${esc(j.foto)}" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.w * 1.5}" preserveAspectRatio="xMidYMid slice" filter="url(#envelhecer)"/>`
    : `<text x="150" y="228" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-size="96" fill="#c9b48a">${esc(iniciais)}</text>`;
  return `<svg class="retrato" viewBox="0 0 300 400" role="img" aria-label="Retrato de ${esc(j.nome)}">
    <clipPath id="oval${k}"><ellipse cx="150" cy="200" rx="112" ry="160"/></clipPath>
    <ellipse cx="150" cy="200" rx="112" ry="160" fill="#2b2218"/>
    <g clip-path="url(#oval${k})">${foto}
      <ellipse cx="150" cy="200" rx="112" ry="160" fill="url(#vinheta)"/>
      <ellipse cx="150" cy="200" rx="112" ry="160" fill="url(#verniz)"/></g>
    <ellipse cx="150" cy="200" rx="114" ry="162" fill="none" stroke="#3a2b12" stroke-width="4"/>
    <ellipse cx="150" cy="200" rx="117.5" ry="165.5" fill="none" stroke="url(#ouro-inv)" stroke-width="3"/>
    <ellipse cx="150" cy="200" rx="128" ry="176" fill="none" stroke="url(#ouro)" stroke-width="18"/>
    <ellipse cx="150" cy="200" rx="128" ry="176" fill="none" stroke="#fff3cf" stroke-opacity=".22" stroke-width="2" transform="translate(-1.5 -1.5)"/>
    <ellipse cx="150" cy="200" rx="139.5" ry="187.5" fill="none" stroke="#f3dc9e" stroke-width="3.6" stroke-dasharray="0 7.4" stroke-linecap="round"/>
    <ellipse cx="150" cy="200" rx="145" ry="193" fill="none" stroke="url(#ouro-inv)" stroke-width="3"/>
    <ellipse cx="150" cy="200" rx="147" ry="195" fill="none" stroke="#2e220e" stroke-width="1.5"/>
  </svg>`;
}

const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="ouro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2a8"/><stop offset=".22" stop-color="#d4af62"/><stop offset=".5" stop-color="#8a6a30"/><stop offset=".74" stop-color="#c79f52"/><stop offset="1" stop-color="#5e4720"/></linearGradient>
  <linearGradient id="ouro-inv" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f1d896"/><stop offset=".45" stop-color="#9c7a38"/><stop offset="1" stop-color="#4f3b19"/></linearGradient>
  <filter id="envelhecer" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values=".55"/><feColorMatrix type="matrix" values="1.02 .06 .02 0 .015 .03 .98 .03 0 .01 .02 .05 .86 0 0 0 0 0 1 0"/></filter>
  <radialGradient id="vinheta" cx=".5" cy=".42" r=".62"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1a0f05" stop-opacity=".6"/></radialGradient>
  <radialGradient id="verniz" cx=".32" cy=".2" r=".5"><stop offset="0" stop-color="#fff6dc" stop-opacity=".16"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient>
</defs></svg>`;
document.body.insertAdjacentHTML('afterbegin', DEFS);

// ---------- Planta ----------

// Coordenadas tiradas da planta real (piso 1 e escritório do piso 2).
// marca: onde fica a cruz de uma prova; centro: onde ficam as fichas das pessoas (quadro e reconstituição).
const SALAS = {
  lavandaria:  { forma: 'M0 24h480v84H0z', nome: [[240, 72, 'LAVANDARIA']], marca: [440, 76], centro: [110, 66] },
  sala:        { forma: 'M0 116H480V559H214V476H238V374H0Z', nome: [[330, 256, 'COZINHA · SALA']], nota: [330, 280, 'mesa de jantar · sofá'], marca: [440, 170], centro: [330, 330] },
  escadas:     { forma: 'M0 378h234v94H0z', nome: [[117, 422, 'ESCADAS']], nota: [117, 444, 'sobem ao escritório'], marca: [214, 400], centro: [117, 396] },
  wcservico:   { forma: 'M0 476h210v96H0z', nome: [[105, 522, 'WC SERVIÇO']], marca: [190, 498], centro: [105, 552] },
  wcprincipal: { forma: 'M0 576h210v116H0z', nome: [[105, 632, 'WC PRINCIPAL']], nota: [105, 654, 'duche'], marca: [190, 598], centro: [105, 604] },
  hospedes:    { forma: 'M0 696h210v278H0z', nome: [[105, 828, 'QUARTO DE'], [105, 850, 'HÓSPEDES']], marca: [105, 920], centro: [105, 760] },
  corredor:    { forma: 'M214 563h64v217h-64z', nome: [], vertical: [252, 672, 'CORREDOR'], marca: [246, 590], centro: [246, 640] },
  closet:      { forma: 'M282 563h198v217H282z', nome: [[381, 676, 'CLOSET']], marca: [381, 740], centro: [381, 620] },
  principal:   { forma: 'M214 784h266v190H214z', nome: [[347, 876, 'QUARTO'], [347, 898, 'PRINCIPAL']], marca: [347, 946], centro: [347, 830] },
  escritorio:  { forma: 'M0 1020h480v156H0z', nome: [[240, 1092, 'ESCRITÓRIO']], nota: [240, 1116, 'duas secretárias · poltronas'], marca: [420, 1144], centro: [200, 1052] },
};

const nomeSala = id => SALAS[id] ? SALAS[id].nome.map(n => n[2]).join(' ').toLowerCase().replace(/^./, c => c.toUpperCase()) || (SALAS[id].vertical?.[2] ?? id).toLowerCase().replace(/^./, c => c.toUpperCase()) : id;

// Fichas na planta: pequenos círculos com as iniciais, no centro de cada divisão (o corredor é estreito: em coluna).
function fichasNaPlanta(fichas) {
  const porSala = {};
  for (const f of fichas) if (SALAS[f.sala]) (porSala[f.sala] ??= []).push(f);
  return Object.entries(porSala).map(([sala, lista]) => {
    const [mx, my] = SALAS[sala].centro ?? SALAS[sala].marca;
    return lista.map((f, i) => {
      const desvio = (i - (lista.length - 1) / 2) * 38;
      const [x, y] = sala === 'corredor' ? [mx, my + desvio] : [mx + desvio, my];
      // Quem está no quadro abre o pop-up da personagem (na reconstituição, só para ler).
      const toque = f.id && noQuadro(f.id) ? ` data-acao="personagem" data-id="${esc(f.id)}"${f.soLer ? ' data-ler="1"' : ''} role="button" tabindex="0"` : '';
      return `<g class="ficha-planta ${f.classe ?? ''}${toque ? ' tocavel' : ''}" transform="translate(${x} ${y})"${toque}>
        <circle r="17"/><text y="6">${esc(f.rotulo)}</text></g>`;
    }).join('');
  }).join('');
}

function planta(marcas, { fichas = [], acesas = [] } = {}) {
  const salas = Object.entries(SALAS).map(([id, s]) => {
    const nomes = s.nome.map(([x, y, t]) => `<text class="nome" x="${x}" y="${y}">${t}</text>`).join('');
    const nota = s.nota ? `<text class="nota" x="${s.nota[0]}" y="${s.nota[1]}">${s.nota[2]}</text>` : '';
    const vert = s.vertical ? `<text class="nome" transform="translate(${s.vertical[0]} ${s.vertical[1]}) rotate(-90)">${s.vertical[2]}</text>` : '';
    return `<path class="sala${acesas.includes(id) ? ' acesa' : ''}" d="${s.forma}" data-sala="${id}"/>${nomes}${nota}${vert}`;
  }).join('');
  // Cada cruz pode ser tocada: mostra as provas da ronda que a pôs ali.
  const xs = marcas.filter(m => SALAS[m.sala]).map((m, i) => {
    const [x, y] = SALAS[m.sala].marca;
    return `<g class="cruz" data-acao="marca" data-i="${i}" role="button" tabindex="0" aria-label="Ver as provas: ${esc(m.rotulo)}">
      <circle class="alvo" cx="${x}" cy="${y}" r="26"/>
      <line class="x" x1="${x - 11}" y1="${y - 11}" x2="${x + 11}" y2="${y + 11}"/><line class="x" x1="${x + 11}" y1="${y - 11}" x2="${x - 11}" y2="${y + 11}"/>
      <text class="marca" x="${x - 20}" y="${y + 5}" text-anchor="end">${esc(m.rotulo)}</text></g>`;
  }).join('');
  return `<svg viewBox="-4 -4 488 1184" role="img" aria-label="Planta da casa">
    <text class="piso" x="0" y="10">PISO 1</text>
    <text class="piso" x="0" y="1006">PISO 2</text>
    ${salas}
    <line class="porta" x1="480" y1="486" x2="480" y2="550"/>
    <text class="nota" x="470" y="524" style="text-anchor:end">entrada</text>
    ${xs}
    ${fichasNaPlanta(fichas)}
  </svg>`;
}

// ---------- Vistas ----------

// Hora a que a noite começa (publico.inicio). Até lá a app fica presa no lobby, com a contagem.
// Sem publico.inicio (casos de teste), o lobby mostra o botão "Entrar".
// Cinco toques na data do lobby abrem um editor da hora. A hora escolhida vai para a base de dados (inicio) e
// vale para todos os telemóveis; cada um guarda uma cópia local para funcionar sem rede.
const chaveHora = () => `testamento-${publico.id}-inicio`;
function horaLocal() {
  try { const v = localStorage.getItem(chaveHora()); return v ? Number(v) : null; } catch { return null; }
}
const horaInicio = () => horaLocal() ?? (publico.inicio ? Date.parse(publico.inicio) : null);
let editarHora = false;

// Cinco toques rápidos (menos de 3 segundos) no mesmo sítio ativam os atalhos escondidos do anfitrião.
const toques = {};
function cincoToques(alvo) {
  const agora = Date.now();
  toques[alvo] = [...(toques[alvo] ?? []).filter(t => agora - t < 3000), agora];
  if (toques[alvo].length < 5) return false;
  toques[alvo] = [];
  return true;
}

// Recomeçar: apaga o que está aberto neste telemóvel e põe a noite a começar daqui a 10 minutos.
function recomecar(inicio = Date.now() + 10 * 60000) {
  try { localStorage.setItem(chaveHora(), String(inicio)); localStorage.removeItem(`testamento-${publico.id}-quadro`); localStorage.removeItem(`testamento-${publico.id}-linha`); } catch { /* sem armazenamento */ }
  abertos.clear();
  guardar();
  fichaVisivel = false;
  editarHora = false;
  if (location.hash !== '#lobby') location.hash = 'lobby'; else mostrar();
}
const antesDaHora = () => { const h = horaInicio(); return h !== null && Date.now() < h; };
let relogio = null;

function contagem() {
  const falta = Math.max(0, horaInicio() - Date.now());
  const s = Math.floor(falta / 1000);
  return [['dias', Math.floor(s / 86400)], ['horas', Math.floor(s / 3600) % 24], ['min', Math.floor(s / 60) % 60], ['seg', s % 60]];
}

function textoHora() {
  const h = horaInicio();
  return h === null ? 'Sem hora marcada'
    : new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(h).replace(/^./, c => c.toUpperCase());
}
// A hora já não se muda no lobby (qualquer convidado podia tocar): muda-se no guia do anfitrião.
function vData() {
  return `<p class="sub data">${esc(textoHora())}</p>`;
}

function vEditorHora() {
  const h = horaInicio() ?? Date.now() + 3600000;
  const d = new Date(h - new Date(h).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return `<form class="editor-hora" id="form-hora">
    <label class="lbl" for="nova-hora">Hora de início para todos</label>
    <input id="nova-hora" type="datetime-local" value="${d}" required>
    <div class="confirmar">
      <button class="botao" type="submit">Guardar</button>
      ${horaLocal() !== null ? `<button class="ligacao" type="button" data-acao="hora-repor">Voltar à hora do caso</button>` : ''}
      <button class="ligacao" type="button" data-acao="hora-fechar">Cancelar</button>
    </div>
  </form>`;
}

function vContagem() {
  return `<div class="contagem" role="timer" aria-live="off">
    <span class="lbl acc">A noite começa em</span>
    <div class="digitos">${contagem().map(([r, v]) => `<div><b data-r="${r}">${String(v).padStart(2, '0')}</b><span>${r}</span></div>`).join('')}</div>
  </div>`;
}

function arrancarRelogio() {
  clearInterval(relogio);
  relogio = setInterval(() => {
    if (!antesDaHora()) {
      clearInterval(relogio);
      vista.querySelector('.lobby')?.classList.add('a-abrir');
      setTimeout(() => { if (location.hash === '#inicio') mostrar(); else location.hash = 'inicio'; }, 900);
      return;
    }
    for (const [r, v] of contagem()) {
      const el = vista.querySelector(`.digitos b[data-r="${r}"]`);
      if (el) el.textContent = String(v).padStart(2, '0');
    }
  }, 1000);
}

// O lobby cobre a app quando se abre o link: só o nome do caso, as regras e a contagem (ou a entrada).
function vLobby() {
  return `<section class="lobby">
    <span class="lbl">${esc(publico.processo)}</span>
    <svg class="brasao" viewBox="0 0 120 160" aria-hidden="true">
      <ellipse cx="60" cy="80" rx="52" ry="72" fill="none" stroke="url(#ouro)" stroke-width="5"/>
      <ellipse cx="60" cy="80" rx="44" ry="64" fill="none" stroke="#c9a45c" stroke-width="1"/>
      <text x="60" y="100" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-size="58" fill="#ecd49a">T</text>
    </svg>
    <h1 data-acao="titulo">${esc(publico.titulo)} <em>${esc(publico.tituloDestaque)}</em></h1>
    <p class="sub">${esc(publico.subtitulo)}</p>
    <div class="filete"></div>
    ${vRegras()}
    ${antesDaHora() ? vContagem() : `<a class="botao" href="#inicio">Entrar</a>`}
    ${vCodigo(true)}
    ${vData()}
  </section>`;
}

// O código só se pede uma vez, e pode ser dado ainda na contagem. Antes da hora a ficha fica fechada.
// "Salvar" só guarda o código: a pessoa fica onde está e entra no jogo quando quiser.
function vCodigo(noLobby = false) {
  const minha = lista('ficha')[0];
  if (minha) return noLobby
    ? `<p class="guardado">Código guardado: <b>${esc(nomeDe(minha.jogador))}</b>.${antesDaHora() ? ' A tua ficha abre quando a noite começar.' : ''}</p>`
    : '';
  return `<section class="bloco entrada-codigo">
      ${avisoCodigo ? `<p class="msg erro">${esc(avisoCodigo)}</p>` : ''}
      <label class="lbl" for="codigo">Apresente o seu código</label>
      <form class="codigo" id="form-codigo" autocomplete="off">
        <input id="codigo" name="codigo" placeholder="Código" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go">
        <button class="botao" type="submit">Salvar</button>
      </form>
      <p class="msg" id="msg" aria-live="polite"></p>
    </section>`;
}

// O início mostra só o essencial. Sem ficha, o código vem logo a seguir ao título; depois de o dar, desaparece.
function vInicio() {
  const veredicto = votacaoAberta() && !lista('solucao').length
    ? `<a class="botao" href="#veredicto" style="display:grid;place-items:center;text-decoration:none">Dar o meu veredicto</a>` : '';
  return `
    <section class="bloco">
      <span class="lbl">${esc(publico.processo)}</span>
      <div class="filete"></div>
      <h1 data-acao="titulo">${esc(publico.titulo)} <em>${esc(publico.tituloDestaque)}</em></h1>
      <p class="sub">${esc(publico.subtitulo)}</p>
    </section>
    ${vCodigo()}
    ${veredicto}
    ${vPrologo()}
    ${vRegras()}`;
}

// A história de abertura é pública: o anfitrião lê-a em voz alta antes de alguém abrir a ficha.
// No início a ordem é sempre: história, regras, código.
function vPrologo() {
  const p = publico.prologo;
  if (!p) return '';
  return `<article class="cartao prologo">
    <span class="lbl acc">O que aconteceu</span>
    <h2>${esc(p.titulo)}</h2>
    ${p.texto.map(t => `<p>${esc(t)}</p>`).join('')}
    ${p.factos?.length ? `<dl class="factos">${p.factos.map(f => `<div><dt>${esc(f.rotulo)}</dt><dd>${esc(f.valor)}</dd></div>`).join('')}</dl>` : ''}
  </article>`;
}

function vRegras() {
  return `<section class="regras">
    <span class="lbl acc">As regras da noite</span>
    <ol>${publico.regras.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
  </section>`;
}

// O retrato de quem está a jogar neste telemóvel, no lugar do antigo lacre "MD".
const meuRetrato = id => `<div class="meu-retrato" aria-hidden="true">${retrato(jogador(id) ?? { nome: id })}</div>`;

function vFicha() {
  const fichas = lista('ficha');
  if (!fichas.length) return `
    <section class="bloco"><span class="lbl">Ficha confidencial</span><h2>Ainda não abriste a tua ficha</h2>
    <p class="sub">Escreve no início o código que está dentro do teu envelope.</p>
    <a class="botao" href="#inicio" style="display:grid;place-items:center;text-decoration:none">Escrever código</a></section>`;
  if (!fichaVisivel) return `
    <section class="cartao cortina">
      ${meuRetrato(fichas[0].jogador)}
      <span class="lbl acc">Ficha confidencial</span>
      <h2>Só para os teus olhos</h2>
      <p class="sub">Confirma que ninguém está a espreitar.</p>
      <button class="botao" type="button" data-acao="revelar">Abrir a ficha</button>
    </section>`;
  return fichas.map(f => {
    const j = jogador(f.jogador) ?? { nome: f.jogador, papel: '' };
    return `<article class="cartao">
      <span class="lbl acc">Ficha confidencial</span>
      <div class="ficha-topo">${retrato(j)}<div class="bloco" style="gap:6px"><h2>${esc(j.nome)}</h2><p class="papel">${esc(j.papel)}</p></div></div>
      <div class="seccao"><span class="lbl">Quem és esta noite</span><p>${esc(f.quemEs)}</p><p class="regra">${esc(f.regra)}</p></div>
      <div class="seccao"><span class="lbl">A tua ligação à vítima</span><p>${esc(f.ligacao)}</p></div>
      <div class="seccao"><span class="lbl">Onde estavas</span><div class="horas">${f.horario.map(h => `<div class="hora"><span>${esc(h.hora)}</span><span>${esc(h.texto)}</span></div>`).join('')}</div></div>
      <div class="seccao"><span class="lbl">O que viste</span><ul class="pontos">${f.viste.map(v => `<li>${esc(v)}</li>`).join('')}</ul></div>
      <div class="seccao"><span class="lbl">O teu segredo</span><p class="segredo">${esc(f.segredo)}</p></div>
      <div class="seccao"><span class="lbl">O teu objetivo</span><p>${esc(f.objetivo)}</p></div>
    </article>`;
  }).join('') + `<button class="botao" type="button" data-acao="tapar">Tapar a ficha</button>`;
}

function vProvas() {
  const abertas = new Map(lista('ronda').map(r => [r.n, r]));
  let nProva = 0;
  const rondas = publico.rondas.map(({ n, prato }) => {
    const r = abertas.get(n);
    if (!r) return `<div class="fechada"><span class="lbl">Ronda ${n} · ${esc(prato)}</span><b>Por abrir</b><span>O anfitrião revela-a quando o prato chegar à mesa.</span></div>`;
    return `<section class="ronda">
      <span class="lbl acc">Ronda ${n} · ${esc(prato)}</span>
      <h2>${esc(r.titulo)}</h2>
      <p>${esc(r.texto)}</p>
      ${r.provas.map(p => `<article class="prova">
        <span class="lbl">Prova n.º ${String(++nProva).padStart(2, '0')}</span>
        <h3>${esc(p.titulo)}</h3>
        ${p.tipo === 'documento' ? `<p class="doc">${esc(p.texto)}</p>` : `<ul>${p.itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`}
      </article>`).join('')}
    </section>`;
  }).join('');
  const sol = lista('solucao')[0];
  // A solução só aparece nas provas depois de o anfitrião a revelar (antes disso deixava ver o assassino).
  const solucao = sol && bd?.solucaoAberta ? `<section class="cartao solucao">
      <span class="lbl acc">O veredicto</span>
      <h2>${esc(sol.titulo)}</h2>
      ${sol.texto.map(t => `<p>${esc(t)}</p>`).join('')}
      <div class="seccao"><span class="lbl">O que aconteceu</span><div class="horas">${sol.cronologia.map(h => `<div class="hora"><span>${esc(h.hora)}</span><span>${esc(h.texto)}</span></div>`).join('')}</div></div>
    </section>` : '';
  const votar = votacaoAberta() && !sol ? `<a class="botao" href="#veredicto" style="display:grid;place-items:center;text-decoration:none">Dar o meu veredicto</a>` : '';
  return `<section class="bloco"><span class="lbl">Provas</span><h1>As <em>rondas</em></h1></section>${rondas}${votar}${solucao}`;
}

// ---------- Planta: cruzes com provas e o quadro do detetive ----------

// Cada cruz vem de uma ronda; tocar nela mostra as provas dessa ronda.
const marcasAbertas = () => lista('ronda').sort((a, b) => a.n - b.n).flatMap(r => (r.marcas ?? []).map(m => ({ ...m, ronda: r })));
let marcaAberta = null;

// O quadro do detetive: onde cada jogador acha que estava cada pessoa à hora do crime. Só neste telemóvel.
// O quadro é o caderno do detetive: por pessoa, onde achas que estava à hora do crime e as tuas notas.
// { <jogador>: { sala, notas } }, só neste telemóvel; o Recomeçar apaga-o. Nunca vai para a base de dados.
const chaveQuadro = () => `testamento-${publico.id}-quadro`;
function lerQuadro() {
  let q = {};
  try { q = JSON.parse(localStorage.getItem(chaveQuadro())) ?? {}; } catch { /* vazio */ }
  // Versão antiga: só a divisão, em texto.
  for (const [id, v] of Object.entries(q)) if (typeof v === 'string') q[id] = { sala: v };
  return q;
}
function gravarQuadro(q) {
  try { localStorage.setItem(chaveQuadro(), JSON.stringify(q)); } catch { /* sem armazenamento: fica só nesta sessão */ }
}
const iniciais = nome => nome.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
const suspeitosDoQuadro = () => publico.jogadores.filter(j => !j.animal && !minhasFichas().includes(j.id));
const noQuadro = id => minhasFichas().length && suspeitosDoQuadro().some(j => j.id === id);

function plantaDoJogo() {
  const q = lerQuadro();
  // Tracejada = só a tua ideia de onde estava; cheia = marcaste como possível assassino.
  const fichas = suspeitosDoQuadro().filter(j => q[j.id]?.sala).map(j => ({ id: j.id, sala: q[j.id].sala, rotulo: iniciais(j.nome), classe: q[j.id].suspeito ? 'palpite marcado-suspeito' : 'palpite' }));
  return planta(marcasAbertas(), { fichas });
}

// Tocar numa cruz mostra só uma frase sobre o que se encontrou ali; as provas completas estão nas Provas.
function vProvaDaMarca() {
  const m = marcasAbertas()[marcaAberta];
  if (!m) return '';
  return `<section class="marca-aberta">
      <span class="lbl acc">Ronda ${m.ronda.n} · ${esc(nomeSala(m.sala))}</span>
      <b>${esc(m.rotulo.replace(/^./, c => c.toUpperCase()))}</b>
      <p>${esc(m.descricao ?? m.ronda.texto)}</p>
      <div class="confirmar"><a class="ligacao" href="#provas">Ver as provas</a><button class="ligacao" type="button" data-acao="marca-fechar">Fechar</button></div>
    </section>`;
}

function vQuadro() {
  if (!minhasFichas().length || !publico.horaCrime) return '';
  const q = lerQuadro();
  return `<section class="cartao quadro">
      <span class="lbl acc">O teu quadro</span>
      <h3>O que sabes de cada um</h3>
      <p class="regra">Toca numa pessoa para dizer onde achas que estava às ${esc(publico.horaCrime)} e tomar notas. Só tu vês isto.</p>
      <div class="quadro-linhas" data-quadro-linhas>${linhasQuadro(q)}</div>
    </section>`;
}

function linhasQuadro(q) {
  return suspeitosDoQuadro().map(j => {
    const nota = q[j.id]?.notas?.trim();
    return `<button class="quadro-linha${q[j.id]?.suspeito ? ' marcado-suspeito' : ''}" type="button" data-acao="personagem" data-id="${esc(j.id)}">
      <b>${esc(iniciais(j.nome))}</b>
      <span class="nome">${esc(j.nome)}</span>
      <span class="onde">${q[j.id]?.sala ? esc(nomeSala(q[j.id].sala)) : '—'}</span>
      ${nota ? `<span class="nota-curta">${esc(nota.length > 70 ? nota.slice(0, 70) + '…' : nota)}</span>` : ''}
    </button>`;
  }).join('');
}

// ---------- Pop-up da personagem (o caderno de uma pessoa) ----------

const popup = Object.assign(document.createElement('div'), { className: 'popup', hidden: true });
popup.setAttribute('role', 'dialog');
popup.setAttribute('aria-modal', 'true');
document.body.append(popup);
let popupId = null;

function abrirPersonagem(id, soLer = false) {
  const j = jogador(id);
  if (!j) return;
  popupId = id;
  const q = lerQuadro(), meu = q[id] ?? {};
  const hora = publico.horaCrime ?? '';
  const opcoes = `<option value="">Não sei</option>${Object.keys(SALAS).map(s => `<option value="${s}"${meu.sala === s ? ' selected' : ''}>${esc(nomeSala(s))}</option>`).join('')}`;
  popup.innerHTML = `<div class="popup-fundo" data-popup="fechar"></div>
    <section class="popup-cartao" aria-labelledby="popup-nome">
      <div class="popup-topo">${retrato(j)}<div><h2 id="popup-nome">${esc(j.nome)}</h2><p class="papel">${esc(j.papel)}</p>${j.frase ? `<p class="frase">«${esc(j.frase)}»</p>` : ''}</div></div>
      ${soLer ? `<div class="seccao"><span class="lbl">Disseste que às ${esc(hora)} estava em</span><p>${meu.sala ? esc(nomeSala(meu.sala)) : 'Não sei'}</p></div>
        ${meu.suspeito ? `<p class="marca-suspeito">Marcaste como possível assassino</p>` : ''}
        <div class="seccao"><span class="lbl">As tuas notas</span><p class="notas-lidas">${meu.notas?.trim() ? esc(meu.notas) : 'Sem notas.'}</p></div>`
      : `<label class="seccao"><span class="lbl">Às ${esc(hora)} estava em</span><select data-popup-sala>${opcoes}</select></label>
        <label class="caixa-suspeito"><input type="checkbox" data-popup-suspeito${meu.suspeito ? ' checked' : ''}><span>Possível assassino</span></label>
        <label class="seccao"><span class="lbl">As tuas notas</span><textarea data-popup-notas rows="6" placeholder="O que disse, o que viste, o que não bate certo…">${esc(meu.notas ?? '')}</textarea></label>
        <p class="regra">Só tu vês isto. Guarda-se sozinho.</p>`}
      ${notasDaLinha(id)}
      <button class="botao" type="button" data-popup="fechar">Fechar</button>
    </section>`;
  popup.hidden = false;
  document.body.classList.add('com-popup');
  popup.querySelector('select, textarea, .botao')?.focus({ preventScroll: true });
}

// No pop-up de uma pessoa: as notas da linha do tempo que escreveste sobre ela, por hora.
function notasDaLinha(id) {
  const minhas = lerLinha().filter(x => x.quem === id).sort((p, q) => p.m - q.m);
  if (!minhas.length) return '';
  return `<div class="seccao"><span class="lbl">Na tua linha do tempo</span>
    <ul class="notas-pessoa">${minhas.map(x => `<li><b>${horaMin(x.m)}</b> ${esc(x.t)}</li>`).join('')}</ul></div>`;
}

function fecharPersonagem() {
  if (popup.hidden) return;
  popup.hidden = true; popup.innerHTML = ''; popupId = null;
  document.body.classList.remove('com-popup');
  // Atualiza o que estiver à vista: as fichas na planta e as linhas do quadro.
  const el = vista.querySelector('.planta:not(.recon)');
  if (el) el.innerHTML = plantaDoJogo();
  const linhas = vista.querySelector('[data-quadro-linhas]');
  if (linhas) linhas.innerHTML = linhasQuadro(lerQuadro());
  const linhaTempo = vista.querySelector('[data-linha]');
  if (linhaTempo) linhaTempo.innerHTML = blocosLinha();
}

function gravarDoPopup() {
  if (!popupId) return;
  const q = lerQuadro(), meu = q[popupId] ?? {};
  const sala = popup.querySelector('[data-popup-sala]'), notas = popup.querySelector('[data-popup-notas]'), suspeito = popup.querySelector('[data-popup-suspeito]');
  if (sala) meu.sala = sala.value || undefined;
  if (suspeito) meu.suspeito = suspeito.checked || undefined;
  if (notas) meu.notas = notas.value.slice(0, 2000) || undefined;
  if (meu.sala || meu.notas || meu.suspeito) q[popupId] = meu; else delete q[popupId];
  gravarQuadro(q);
}
popup.addEventListener('input', gravarDoPopup);
popup.addEventListener('change', gravarDoPopup);

// ---------- Linha do tempo do detetive (só neste telemóvel) ----------
// Grelha de 5 em 5 minutos na janela da história (publico.linhaTempo), com notas ao minuto, o "Onde estavas"
// da própria ficha e os marcos públicos (da história de abertura e das rondas já abertas).
// [{ id, m (minutos), quem, t }] em testamento-<caso>-linha; o Recomeçar apaga; nunca vai para a base de dados.
const chaveLinha = () => `testamento-${publico.id}-linha`;
function lerLinha() {
  try { return JSON.parse(localStorage.getItem(chaveLinha())) ?? []; } catch { return []; }
}
function gravarLinha(l) {
  try { localStorage.setItem(chaveLinha(), JSON.stringify(l)); } catch { /* sem armazenamento: fica só nesta sessão */ }
}
const minutos = s => { const m = /(\d{1,2})h(\d{2})/.exec(s ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const horaMin = m => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
const janela = () => ({ a: minutos(publico.linhaTempo?.inicio), z: minutos(publico.linhaTempo?.fim) });

function momentosAbertos() {
  // Cada marco diz de onde vem, para se perceber como é que já se sabe.
  return [...(publico.linhaTempo?.momentos ?? []).map(x => ({ ...x, origem: 'história de abertura' })),
    ...lista('ronda').flatMap(r => (r.momentos ?? []).map(x => ({ ...x, origem: `ronda ${r.n}` })))]
    .map(x => ({ ...x, m: minutos(x.hora) })).filter(x => x.m !== null);
}
// O "Onde estavas" da minha ficha, em intervalos de minutos.
function meuHorario() {
  const f = lista('ficha')[0];
  return (f?.horario ?? []).map(h => {
    const t = [...h.hora.matchAll(/(\d{1,2})h(\d{2})/g)].map(x => Number(x[1]) * 60 + Number(x[2]));
    return t.length ? { a: t[0], z: t[1] ?? t[0] + 1, texto: h.texto } : null;
  }).filter(Boolean);
}

function vLinhaTempo() {
  const { a, z } = janela();
  if (!minhasFichas().length || a === null || z === null) return '';
  return `<section class="cartao linha-tempo">
      <span class="lbl acc">A tua linha do tempo</span>
      <h3>Das ${horaMin(a)} às ${horaMin(z)}</h3>
      <p class="regra">Escreve o que ouves à mesa, à hora certa. Só tu vês isto.</p>
      <div class="legenda-linha" data-legenda>${legendaLinha()}</div>
      <button class="botao" type="button" data-acao="nota-nova">+ Nota</button>
      <div class="linha" data-linha>${blocosLinha()}</div>
    </section>`;
}

// Cada camada da linha do tempo liga e desliga com o olho da legenda (por exemplo, para mostrar a linha a alguém
// sem mostrar onde tu estavas). Lembra-se neste telemóvel.
const chaveCamadas = () => `testamento-${publico.id}-linha-camadas`;
function lerCamadas() {
  try { return { eu: true, marcos: true, notas: true, ...JSON.parse(localStorage.getItem(chaveCamadas()) ?? '{}') }; } catch { return { eu: true, marcos: true, notas: true }; }
}
const OLHO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const OLHO_FECHADO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20 20 4"/></svg>';
function legendaLinha() {
  const c = lerCamadas();
  return [['eu', 'l-eu', 'Onde tu estavas'], ['marcos', 'l-marco', 'Marco público'], ['notas', 'l-nota', 'As tuas notas']]
    .map(([id, cor, nome]) => `<button type="button" class="camada${c[id] ? '' : ' desligada'}" data-acao="camada" data-c="${id}" aria-pressed="${c[id]}" aria-label="${c[id] ? 'Esconder' : 'Mostrar'}: ${nome}">
      <i class="${cor}"></i>${nome}${c[id] ? OLHO : OLHO_FECHADO}</button>`).join('');
}

function blocosLinha() {
  const { a, z } = janela();
  const c = lerCamadas();
  const eu = c.eu ? meuHorario() : [], marcos = c.marcos ? momentosAbertos() : [], notas = c.notas ? lerLinha() : [];
  const blocos = [];
  for (let b = a; b <= z; b += 5) {
    const dentro = m => (m >= b && m < b + 5) || (b === z && m === z);
    const comeca = eu.find(x => dentro(x.a) || (b === a && x.a < a && x.z > a));
    const estou = eu.some(x => b < x.z && b + 5 > x.a);
    const itens = [
      ...marcos.filter(x => dentro(x.m)).map(x => ({ m: x.m, html: `<div class="marco${x.crime ? ' crime' : ''}"><span class="min">${horaMin(x.m)}</span><span>${esc(x.texto)} <i class="origem">${esc(x.origem)}</i></span></div>` })),
      ...notas.filter(x => dentro(x.m)).map(x => {
        const j = x.quem && jogador(x.quem);
        return { m: x.m, html: `<div class="nota-linha" data-acao="nota-editar" data-n="${esc(x.id)}" role="button" tabindex="0">
          <span class="min">${horaMin(x.m)}</span><p>${esc(x.t)}</p>
          ${j ? `<button class="quem" type="button" data-acao="personagem" data-id="${esc(j.id)}"><i>${esc(iniciais(j.nome))}</i>${esc(j.nome)}</button>` : ''}</div>` };
      }),
    ].sort((p, q) => p.m - q.m).map(x => x.html).join('');
    const vazio = !comeca && !itens;
    blocos.push(`<div class="bloco-linha${vazio ? ' vazio' : ''}">
      <span class="hora-bloco">${horaMin(b)}</span>
      <span class="trilho">${estou ? '<span class="eu"></span>' : ''}<span class="ponto"></span></span>
      <div class="conteudo">
        ${comeca ? `<p class="onde"><b>Tu</b>${esc(comeca.texto)}</p>` : ''}
        ${itens}
        ${b < z ? `<button class="mais" type="button" data-acao="nota-nova" data-m="${b}">+ nota</button>` : ''}
      </div></div>`);
  }
  return blocos.join('');
}

// A folha para escrever (ou mudar) uma nota usa a mesma caixa do pop-up da personagem.
function abrirNota(m, id = null) {
  const { a, z } = janela();
  const nota = id ? lerLinha().find(x => x.id === id) : null;
  const hora = nota?.m ?? m ?? a;
  popupId = null;
  popup.innerHTML = `<div class="popup-fundo" data-popup="fechar"></div>
    <form class="popup-cartao" id="form-nota" data-id="${esc(id ?? '')}" aria-labelledby="titulo-nota">
      <h2 id="titulo-nota">${nota ? 'A tua nota' : 'Nova nota'}</h2>
      <div class="campos-nota">
        <label class="seccao"><span class="lbl">Hora</span><select name="m">${Array.from({ length: z - a + 1 }, (_, k) => a + k).map(x => `<option value="${x}"${x === hora ? ' selected' : ''}>${horaMin(x)}</option>`).join('')}</select></label>
        <label class="seccao"><span class="lbl">Sobre quem</span><select name="quem"><option value="">Ninguém em especial</option>${suspeitosDoQuadro().map(j => `<option value="${esc(j.id)}"${nota?.quem === j.id ? ' selected' : ''}>${esc(j.nome)}</option>`).join('')}</select></label>
      </div>
      <label class="seccao"><span class="lbl">O que aconteceu</span><textarea name="t" rows="4" required placeholder="Ex.: diz que o WC principal estava vazio">${esc(nota?.t ?? '')}</textarea></label>
      <button class="botao" type="submit">Guardar</button>
      <div class="confirmar">${nota ? `<button class="ligacao" type="button" data-acao-nota="apagar">Apagar a nota</button>` : ''}<button class="ligacao" type="button" data-popup="fechar">Cancelar</button></div>
    </form>`;
  popup.hidden = false;
  document.body.classList.add('com-popup');
  popup.querySelector('textarea').focus({ preventScroll: true });
}

popup.addEventListener('submit', e => {
  if (e.target.id !== 'form-nota') return;
  e.preventDefault();
  const d = new FormData(e.target), t = String(d.get('t') ?? '').trim();
  if (!t) return;
  const id = e.target.dataset.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const linha = lerLinha().filter(x => x.id !== id);
  linha.push({ id, m: Number(d.get('m')), quem: String(d.get('quem') || '') || undefined, t: t.slice(0, 1000) });
  gravarLinha(linha);
  fecharPersonagem();
});
popup.addEventListener('click', e => {
  if (e.target.closest('[data-acao-nota="apagar"]')) {
    const id = popup.querySelector('#form-nota')?.dataset.id;
    gravarLinha(lerLinha().filter(x => x.id !== id));
    fecharPersonagem();
  }
});
popup.addEventListener('click', e => { if (e.target.closest('[data-popup="fechar"]')) fecharPersonagem(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharPersonagem(); });
window.addEventListener('hashchange', fecharPersonagem);

// O caderno do detetive: a planta, o quadro e a linha do tempo. Tem notas privadas, por isso abre atrás da
// mesma cortina da ficha ("Só para os teus olhos") e volta a fechar quando se sai do separador.
let cadernoVisivel = false;
function vCaderno() {
  const marcas = marcasAbertas();
  if (minhasFichas().length && !cadernoVisivel) return `
    <section class="cartao cortina">
      ${meuRetrato(minhasFichas()[0])}
      <span class="lbl acc">Caderno do detetive</span>
      <h2>Só para os teus olhos</h2>
      <p class="sub">As tuas notas e suspeitas. Confirma que ninguém está a espreitar.</p>
      <button class="botao" type="button" data-acao="abrir-caderno">Abrir o caderno</button>
    </section>`;
  return `<section class="bloco"><span class="lbl">Caderno do detetive</span><h1>O teu <em>caderno</em></h1>
    <p class="sub">${marcas.length ? 'Toca numa cruz da planta para ver o que se encontrou aí.' : 'A planta da casa. As cruzes aparecem quando as rondas abrem.'}</p></section>
    <div class="planta">${plantaDoJogo()}</div>
    <div data-marca-aberta>${vProvaDaMarca()}</div>
    ${vQuadro()}
    ${vLinhaTempo()}
    ${minhasFichas().length ? `<button class="botao" type="button" data-acao="tapar-caderno">Fechar o caderno</button>` : ''}`;
}

function vFamilia() {
  return `<section class="bloco"><span class="lbl">Galeria da família</span><h1>Os <em>herdeiros</em></h1>
    <p class="sub">Todos estão nesta casa esta noite. Todos tinham um motivo.</p></section>
    <div class="galeria">${publico.jogadores.map(j => `<figure class="pessoa${j.animal ? ' animal' : ''}${noQuadro(j.id) ? ' tocavel' : ''}"${noQuadro(j.id) ? ` data-acao="personagem" data-id="${esc(j.id)}" role="button" tabindex="0" aria-label="Abrir o caderno: ${esc(j.nome)}"` : ''}>
      ${retrato(j)}
      <figcaption class="nome">${esc(j.nome)}</figcaption>
      <p class="papel">${esc(j.papel)}</p>
      <p class="frase">${j.frase ? `«${esc(j.frase)}»` : ''}</p>
    </figure>`).join('')}</div>`;
}

// O guia não tem código: só se entra com cinco toques no título, e fecha-se ao sair do ecrã.
// Só funciona no telemóvel com a ficha do anfitrião (publico.anfitriao, por defeito o Diogo).
// A chave vem em publico.chaveGuia (posta pelo cifrar.mjs); fica escondido, não protegido.
let guia = null, guiaPedido = false, confirmarReset = false, confirmarSolucao = false;
let confirmarAvancar = false, aTirar = null, mudarHora = false;
const ANFITRIAO = () => publico.anfitriao ?? 'diogo';

async function abrirGuia() {
  if (!minhasFichas().includes(ANFITRIAO())) return;
  if (!guia) { try { guia = await decifrar(publico.chaveGuia ?? ''); } catch { guia = null; } }
  if (!guia) return;
  guiaPedido = true; confirmarReset = false;
  if (location.hash === '#guia') mostrar(); else location.hash = 'guia';
  vigiar();
}

function vGuia() {
  const g = guia;
  // Só o essencial: recomeçar (pequeno, logo a seguir ao título) e o botão da noite.
  return `<section class="bloco"><span class="lbl">Só para o anfitrião · sala ${esc(SALA)}</span><h1>${esc(g.titulo)}</h1>
      <div class="confirmar">${confirmarReset
        ? `<span>Recomeçar o jogo daqui a 10 minutos?</span>
          <button class="ligacao" type="button" data-acao="reset-sim">Sim, recomeçar</button>
          <button class="ligacao" type="button" data-acao="reset-nao">Cancelar</button>`
        : `<button class="ligacao" type="button" data-acao="reset">Recomeçar daqui a 10 minutos</button>`}</div>
    </section>
    <article class="cartao noite"><div data-guia>${painelGuia()}</div></article>
    <article class="cartao hora-guia">
      <span class="lbl acc">Hora de início</span>
      ${mudarHora ? vEditorHora() : `<div class="linha-hora"><span>${esc(textoHora())}</span>
        <button class="ligacao" type="button" data-acao="hora-mudar">Mudar</button></div>`}
    </article>
    ${g.fichas?.length ? `<article class="cartao codigos-guia"><details>
      <summary>Códigos dos jogadores</summary>
      <div data-codigos>${painelCodigos()}</div>
    </details></article>` : ''}`;
}

// Os códigos de cada jogador, para o anfitrião os copiar e mandar por mensagem.
// Quem já deu o código (está presente na base de dados) aparece "Em jogo" em vez do código.
let copiado = null;
function painelCodigos() {
  const presentes = bd?.presentes ?? {};
  const emJogo = guia.fichas.filter(f => presentes[f.jogador]).length;
  return `<p class="regra">${emJogo} de ${guia.fichas.length} em jogo</p>
    <ul class="codigos">${guia.fichas.map(f => `<li>
      <span class="nome">${esc(nomeDe(f.jogador))}</span>
      ${presentes[f.jogador]
        ? aTirar === f.jogador
          ? `<span class="tirar-confirma">Tirar do jogo?
              <button class="ligacao" type="button" data-acao="tirar-sim">Sim</button>
              <button class="ligacao" type="button" data-acao="tirar-nao">Não</button></span>`
          : `<span class="em-jogo">Em jogo</span><button class="lixo" type="button" data-acao="tirar" data-id="${esc(f.jogador)}" aria-label="Tirar ${esc(nomeDe(f.jogador))} do jogo">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button>`
        : `<code>${esc(f.codigo)}</code><button class="chip" type="button" data-acao="copiar" data-id="${esc(f.jogador)}" data-codigo="${esc(f.codigo)}">${copiado === f.jogador ? 'Copiado' : 'Copiar'}</button>`}
    </li>`).join('')}</ul>`;
}

async function copiarTexto(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* sem permissão: tenta à moda antiga */ }
  const campo = Object.assign(document.createElement('textarea'), { value: texto });
  campo.style.cssText = 'position:fixed;opacity:0';
  document.body.append(campo); campo.select();
  const ok = document.execCommand('copy');
  campo.remove();
  return ok;
}

// Um só botão leva a noite para a frente: 1.ª ronda → 2.ª → 3.ª → (sem botão, à espera dos votos) → solução → pódio.
// A revelação do assassino abre sozinha quando todos votam e marcam os palpites; a solução e o pódio só o anfitrião os abre.
const rondasReveladas = () => Object.keys(bd?.chaves ?? {}).length;
function painelGuia() {
  if (!bd) return `<p class="sub">A ligar…</p>`;
  const e = estado(), total = publico.rondas.length, r = rondasReveladas();
  if (r < total) return `<span class="lbl acc">Rondas · ${r} de ${total}</span>
    <button class="botao" type="button" data-acao="noite">Revelar a ${r + 1}.ª ronda</button>`;
  // Depois da 3.ª ronda: o anfitrião abre a votação e os telemóveis saltam para ela.
  if (!votacaoLiberta()) return `<span class="lbl acc">Rondas · ${r} de ${total}</span>
      <button class="botao" type="button" data-acao="abrir-votacao">Abrir a votação</button>`;
  if (e.fase !== 'revelar') {
    // O anfitrião vê pelo nome quem ainda falta, para o poder chamar.
    const feitos = e.fase === 'votar' ? e.votaram : e.validaram;
    const faltam = e.presentes.filter(p => !feitos.includes(p)).map(nomeDe);
    const titulo = e.fase === 'votar' ? 'Falta votar' : 'Falta marcar os palpites';
    // Saída de emergência, discreta: se alguém não consegue acabar (sem bateria, foi-se embora), segue sem essa pessoa.
    const avancar = !faltam.length ? '' : confirmarAvancar
      ? `<div class="confirmar"><span>Seguir sem ${faltam.length === 1 ? 'essa pessoa' : 'essas pessoas'}?</span>
          <button class="ligacao" type="button" data-acao="avancar-sim">Sim, seguir</button>
          <button class="ligacao" type="button" data-acao="avancar-nao">Cancelar</button></div>`
      : `<button class="ligacao emergencia" type="button" data-acao="avancar">Seguir sem esperar</button>`;
    return `${painelVivo(e)}${faltam.length ? `<div class="faltam"><span class="lbl acc">${titulo}</span><b>${faltam.map(esc).join(', ')}</b></div>` : ''}${avancar}`;
  }
  // O assassino só aparece quando o anfitrião o revela, a todos ao mesmo tempo.
  if (!assassinoRevelado()) return `<span class="lbl acc">Todos marcaram os palpites</span>
      <button class="botao" type="button" data-acao="noite">Revelar o assassino</button>`;
  if (!reconLiberta(e)) return `<span class="lbl acc">Assassino revelado</span>
    <p class="sub">Como aconteceu · ${prontosRecon(e)}/${e.presentes.length} prontos</p>
    <button class="ligacao" type="button" data-acao="recon-ja">Começar já, sem esperar</button>`;
  if (!bd.solucaoAberta) return `<span class="lbl acc">Assassino revelado</span>
    <button class="botao" type="button" data-acao="noite">Revelar a solução</button>`;
  if (!bd.podio) return `<span class="lbl acc">Solução revelada</span>
    <button class="botao" type="button" data-acao="noite">Revelar o pódio</button>`;
  return `<span class="lbl acc">Pódio revelado</span>`;
}

// ---------- Votação final ----------

// Os votos ficam na Realtime Database do Firebase (projeto battle-for-monte-gordo), em testamento/<caso>:
//   presentes/<jogador>   quem abriu a ficha (é por estes que a votação espera)
//   votos/<jogador>       { suspeito, palpites: { <jogador>: texto } }
//   validacoes/<jogador>  { marcas: { <autor>: true|false } }: os palpites certos sobre o segredo de cada um
//   avancar               { votos, validacao }: o anfitrião avança sem esperar por quem falta
//   chaves/r<n>           a chave da ronda n, posta pelo anfitrião quando a revela
// Fases: votar → validar → revelar. Cada fase acaba quando todos os presentes a fazem.
// Versão de demonstração: usa uma pasta própria, separada do jogo a sério; em localhost, outra ainda.
// Para alojar o teu próprio jogo, troca este endereço pelo da tua Realtime Database (ver o README).
const BD = 'https://battle-for-monte-gordo-default-rtdb.firebaseio.com/' + (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'testamento-demo-local' : 'testamento-demo');
// Cada grupo joga na sua sala (?sala=XXXXX no link). Sem sala, cria-se uma nova e o link passa a levá-la:
// é esse link que se manda aos outros jogadores (o "Copiar" do guia já o inclui).
const SALA = (() => {
  const q = new URLSearchParams(location.search);
  let s = (q.get('sala') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!s) {
    s = Array.from(crypto.getRandomValues(new Uint8Array(5)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
    q.set('sala', s);
    history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`);
  }
  return s;
})();
let bd = null;
let euId = null;          // com que ficha vota este telemóvel (nos testes pode haver várias)
let editarVoto = false;
let passoFinal = 0;       // 0 revelação, 1 reconstituição na planta, 2 solução, 3 pódio
let marcasLocais = {};
let sincronia = null, aSincronizar = false, ultimaChave = '', podioVisto = false, solucaoVista = false;

const urlBD = (caminho = '') => `${BD}/${SALA}/${publico.id}${caminho ? '/' + caminho : ''}.json`;
const escrever = (caminho, valor) => fetch(urlBD(caminho), valor === null ? { method: 'DELETE' } : { method: 'PUT', body: JSON.stringify(valor) })
  .then(r => { if (!r.ok) throw new Error(String(r.status)); });
const nomeDe = id => jogador(id)?.nome ?? id;
const ultimaRonda = () => lista('ronda').find(r => r.chaveFinal);
const minhasFichas = () => lista('ficha').map(f => f.jogador);
// A votação só abre quando o anfitrião a abre (bd.votacao); votos já feitos contam como aberta.
const votacaoLiberta = () => !!bd?.votacao || Object.keys(bd?.votos ?? {}).length > 0;
const votacaoAberta = () => !!ultimaRonda() && minhasFichas().length > 0 && votacaoLiberta();
// O assassino só aparece quando o anfitrião o revela (bd.assassinoRevelado); com a solução já aberta, conta como revelado.
const assassinoRevelado = () => !!bd?.assassinoRevelado || !!bd?.solucaoAberta;
let votacaoVista = null, assassinoVisto = null, reconVista = null;

function estado() {
  const presentes = publico.jogadores.map(j => j.id).filter(id => bd?.presentes?.[id]);
  const votos = bd?.votos ?? {}, val = bd?.validacoes ?? {}, av = bd?.avancar ?? {};
  const votaram = presentes.filter(p => votos[p]), validaram = presentes.filter(p => val[p]);
  let fase = 'votar';
  if (presentes.length && (votaram.length === presentes.length || av.votos)) fase = 'validar';
  if (fase === 'validar' && (validaram.length === presentes.length || av.validacao)) fase = 'revelar';
  return { presentes, votos, val, votaram, validaram, fase };
}

const palpitesSobre = (id, e) => Object.entries(e.votos)
  .filter(([autor, v]) => autor !== id && v.palpites?.[id]?.trim())
  .map(([autor, v]) => ({ autor, texto: v.palpites[id] }));

const chaveVisto = () => `testamento-${publico.id}-reinicio`;
function lerVisto() {
  try { const v = localStorage.getItem(chaveVisto()); return v === null ? null : Number(v); } catch { return null; }
}
function gravarVisto(t) {
  try { localStorage.setItem(chaveVisto(), String(t)); } catch { /* sem armazenamento */ }
}

function reiniciarAqui(inicio) {
  bd = null; ultimaChave = ''; passoFinal = 0; editarVoto = false; marcasLocais = {};
  confirmarSolucao = false; confirmarReset = false; guiaPedido = false;
  recomecar(inicio ?? Date.now() + 10 * 60000);
}

// Cada telemóvel tem um identificador seu. A presença guarda-o, para o anfitrião poder tirar do jogo o telemóvel
// errado (quem deu o código de outra pessoa) sem tirar o certo.
const DISPOSITIVO = (() => {
  try {
    let d = localStorage.getItem('testamento-dispositivo');
    if (!d) { d = crypto.randomUUID?.() ?? String(Math.random()).slice(2); localStorage.setItem('testamento-dispositivo', d); }
    return d;
  } catch { return String(Math.random()).slice(2); }
})();
let avisoCodigo = '';   // porque é que este telemóvel perdeu a ficha (aparece por cima da caixa do código)

// Cada ficha só pode estar num telemóvel. Reservar é condicional (ETag do Firebase): se outro telemóvel a
// apanhou entretanto, a escrita é recusada (412) e volta-se a ler. Sem rede, deixa entrar; a sincronização resolve.
async function reservar(id, tentativas = 3) {
  try {
    const r = await fetch(urlBD(`presentes/${id}`), { headers: { 'X-Firebase-ETag': 'true' }, cache: 'no-store' });
    const atual = await r.json(), etag = r.headers.get('ETag');
    if (typeof atual === 'string' && atual !== DISPOSITIVO) return false;
    const w = await fetch(urlBD(`presentes/${id}`), { method: 'PUT', headers: etag ? { 'if-match': etag } : {}, body: JSON.stringify(DISPOSITIVO) });
    if (w.status === 412 && tentativas > 1) return reservar(id, tentativas - 1);
    if (w.ok) (bd ??= {}, bd.presentes ??= {})[id] = DISPOSITIVO;
    return w.ok;
  } catch { return true; }
}

function vigiar() {
  // Todos os telemóveis acompanham o jogo, mesmo antes de abrirem a ficha, para receberem as rondas.
  if (sincronia) return;
  sincronizar();
  sincronia = setInterval(sincronizar, 2500);
}

async function sincronizar() {
  if (aSincronizar) return;
  aSincronizar = true;
  try {
    bd = (await (await fetch(urlBD(), { cache: 'no-store' })).json()) ?? {};
    // O anfitrião recomeçou o jogo depois da última vez que este telemóvel viu: perde a ficha e volta ao lobby.
    // Um telemóvel que nunca viu nenhum recomeço só toma nota, para não perder um código acabado de dar.
    const r = bd.reinicio;
    if (!r?.t && lerVisto() === null) gravarVisto(0);
    if (r?.t) {
      const visto = lerVisto();
      if (visto === null) gravarVisto(r.t);
      else if (r.t > visto) { gravarVisto(r.t); reiniciarAqui(r.inicio); return; }
    }
    // A hora de início partilhada manda; a cópia local só serve sem rede.
    const partilhada = typeof bd.inicio === 'number' ? bd.inicio : null;
    if (partilhada !== horaLocal()) {
      try { if (partilhada === null) localStorage.removeItem(chaveHora()); else localStorage.setItem(chaveHora(), String(partilhada)); } catch { /* sem armazenamento */ }
      if (!editarHora) { mostrar(); return; }
    }
    // Este telemóvel perde a ficha se o anfitrião a tirou daqui, ou se ela está registada noutro telemóvel
    // (só fica com ela o primeiro que a deu).
    const tiradas = minhasFichas().filter(id => bd.expulsos?.[id] === DISPOSITIVO || bd.expulsos?.[id] === true);
    const noutro = minhasFichas().filter(id => typeof bd.presentes?.[id] === 'string' && bd.presentes[id] !== DISPOSITIVO);
    if (tiradas.length || noutro.length) {
      const perdidas = [...tiradas, ...noutro];
      for (const [c, v] of abertos) if (v.tipo === 'ficha' && perdidas.includes(v.jogador)) abertos.delete(c);
      avisoCodigo = tiradas.length ? 'O anfitrião tirou este código deste telemóvel. Escreve o código do teu envelope.'
        : 'Este código já está a ser usado noutro telemóvel. Escreve o código do teu envelope.';
      guardar(); fichaVisivel = false; editarVoto = false; marcasLocais = {};
      if (location.hash === '#inicio' || location.hash === '#lobby') mostrar(); else location.hash = antesDaHora() ? 'lobby' : 'inicio';
      return;
    }
    const minhas = minhasFichas();
    if (!minhas.includes(euId)) euId = minhas[0] ?? null;
    for (const id of minhas.filter(id => bd.presentes?.[id] !== DISPOSITIVO)) await reservar(id);
    // As rondas abrem quando o anfitrião as revela; a base de dados manda (um recomeço volta a escondê-las).
    const chaves = bd.chaves ?? {};
    let novaRonda = false, mudou = false;
    for (const c of Object.values(chaves)) {
      if (abertos.has(c)) continue;
      const r = await decifrar(c);
      if (r?.tipo === 'ronda') { abertos.set(c, r); novaRonda = mudou = true; }
    }
    for (const [c, v] of abertos) if (v.tipo === 'ronda' && chaves['r' + v.n] !== c) { abertos.delete(c); mudou = true; }
    let e = estado();
    // Sem palpites sobre o meu segredo, não há nada para validar.
    // Leva a hora (t): o Firebase deita fora objetos vazios, e { marcas: {} } sozinho nunca ficaria gravado.
    if (e.fase === 'validar') {
      for (const id of minhas.filter(id => e.presentes.includes(id) && !e.val[id] && !palpitesSobre(id, e).length)) {
        const v = { marcas: {}, t: Date.now() };
        await escrever(`validacoes/${id}`, v); (bd.validacoes ??= {})[id] = v;
      }
      e = estado();
    }
    // A última ronda traz a chave da solução: a revelação abre sozinha, sem ninguém escrever o código.
    if (e.fase === 'revelar' && !lista('solucao').length && ultimaRonda()) {
      const c = ultimaRonda().chaveFinal, s = await decifrar(c);
      if (s) { abertos.set(c, s); mudou = true; }
    }
    if (e.fase !== 'revelar') for (const [c, v] of abertos) if (v.tipo === 'solucao') { abertos.delete(c); mudou = true; passoFinal = 0; }
    if (mudou) guardar();
    const naGuia = location.hash === '#guia';
    vista.querySelectorAll('[data-guia]').forEach(el => { el.innerHTML = painelGuia(); });
    if (guia?.fichas) vista.querySelectorAll('[data-codigos]').forEach(el => { el.innerHTML = painelCodigos(); });
    // A votação acabou de abrir: todos vão para o veredicto, menos quem está no guia.
    const liberta = votacaoLiberta();
    if (votacaoVista === false && liberta && votacaoAberta() && !naGuia) { votacaoVista = true; location.hash = 'veredicto'; return; }
    votacaoVista = liberta;
    // O anfitrião revelou o assassino: todos vão vê-lo, o anfitrião (no guia) incluído.
    const revelado = assassinoRevelado();
    if (assassinoVisto === false && revelado) {
      // ultimaChave já com o estado novo: senão a sincronização seguinte voltava a desenhar o ecrã (piscava duas vezes)
      assassinoVisto = true; passoFinal = 0; ultimaChave = `${e.fase}|${!!e.votos[euId]}|${!!e.val[euId]}|${lista('solucao').length}|true`;
      if (location.hash === '#veredicto') mostrar(); else location.hash = 'veredicto';
      return;
    }
    assassinoVisto = revelado;
    // Todos carregaram em "Ver como aconteceu" (ou o anfitrião avançou): a reconstituição abre em todos ao mesmo tempo.
    const recon = revelado && e.fase === 'revelar' && reconLiberta(e);
    if (reconVista === false && recon && passoFinal === 0 && lista('solucao').length) {
      reconVista = true; passoFinal = 1;
      ultimaChave = `${e.fase}|${!!e.votos[euId]}|${!!e.val[euId]}|${lista('solucao').length}|true`;
      if (location.hash === '#veredicto') mostrar(); else { location.hash = 'veredicto'; await new Promise(r => setTimeout(r, 50)); }
      iniciarReconstituicao();
      return;
    }
    reconVista = recon;
    // Só se mudou: redesenhar sempre recomeçava a animação de entrada e o botão nunca chegava a aparecer
    const como = botaoComoAconteceu(e);
    vista.querySelectorAll('[data-como]').forEach(el => { if (el.innerHTML !== como) el.innerHTML = como; });
    // Quem estava preso na contagem entra no jogo assim que há uma ronda revelada.
    if (rondasReveladas() && document.body.classList.contains('em-lobby') && location.hash !== '#lobby') {
      if (novaRonda) location.hash = 'provas'; else mostrar();
      return;
    }
    // Uma ronda nova leva todos às provas, o anfitrião incluído.
    if (novaRonda) { if (location.hash === '#provas') mostrar(); else location.hash = 'provas'; return; }
    if (mudou && ['#provas', '#caderno', '#inicio'].includes(location.hash)) { mostrar(); return; }
    // O anfitrião revelou a solução: todos vão para ela ao mesmo tempo (quem ainda está na reconstituição também).
    if (bd.solucaoAberta && !bd.podio && lista('solucao').length && !solucaoVista) {
      solucaoVista = true; passoFinal = 2; clearTimeout(reconRelogio);
      if (location.hash === '#veredicto') mostrar(); else location.hash = 'veredicto';
      ultimaChave = `${e.fase}|${!!e.votos[euId]}|${!!e.val[euId]}|${lista('solucao').length}|${assassinoRevelado()}`;
      return;
    }
    if (!bd.solucaoAberta) solucaoVista = false;
    // O anfitrião revelou o pódio: todos vão para ele ao mesmo tempo, e ele entra do último ao primeiro.
    if (bd.podio && lista('solucao').length && !podioVisto) {
      podioVisto = true; passoFinal = 3;
      const animar = !!ultimaChave;   // a abrir a app já com o pódio revelado, mostra-o sem animação
      if (location.hash === '#veredicto') mostrar(); else { location.hash = 'veredicto'; await new Promise(r => setTimeout(r, 50)); }
      if (animar) animarPodio();
      ultimaChave = `${e.fase}|${!!e.votos[euId]}|${!!e.val[euId]}|${lista('solucao').length}|${assassinoRevelado()}`;
      return;
    }
    if (!bd.podio) podioVisto = false;
    const chave = `${e.fase}|${!!e.votos[euId]}|${!!e.val[euId]}|${lista('solucao').length}|${assassinoRevelado()}`;
    const mudouFase = !ultimaChave.startsWith(e.fase + '|');
    if (chave !== ultimaChave) {
      const primeira = !ultimaChave;
      ultimaChave = chave;
      if (mudouFase && e.fase !== 'votar' && !(e.fase === 'revelar' && !assassinoRevelado()) && votacaoAberta() && !naGuia && location.hash !== '#veredicto') { location.hash = 'veredicto'; return; }
      // O formulário do voto não é redesenhado a meio, para não apagar o que se está a escrever.
      if (location.hash === '#veredicto' && (primeira || !(e.fase === 'votar' && (!e.votos[euId] || editarVoto)))) { mostrar(); return; }
    }
    vista.querySelectorAll('[data-viva]').forEach(el => { el.innerHTML = painelVivo(e); });
  } catch { /* sem rede: tenta outra vez daqui a pouco */ } finally {
    aSincronizar = false;
  }
}

function painelVivo(e) {
  if (e.fase === 'revelar') return `<p class="sub">${assassinoRevelado() ? 'A revelação já abriu.' : 'Todos marcaram os palpites. Aguardem que o anfitrião revele o assassino.'}</p>`;
  const feitos = e.fase === 'votar' ? e.votaram : e.validaram;
  const verbo = e.fase === 'votar' ? 'já selaram o veredicto' : 'já marcaram os palpites';
  return `<p class="contador"><b>${feitos.length}</b> de <b>${e.presentes.length}</b> ${verbo}</p>
    <ul class="quem">${e.presentes.map(p => `<li class="${feitos.includes(p) ? 'feito' : ''}">${esc(nomeDe(p))}</li>`).join('')}</ul>`;
}

function pontuacao(e, sol) {
  const k = sol.assassino;
  const recebidos = {};
  for (const [autor, v] of Object.entries(e.votos)) if (e.presentes.includes(autor)) recebidos[v.suspeito] = (recebidos[v.suspeito] ?? 0) + 1;
  const maximo = Math.max(0, ...Object.values(recebidos));
  const tabela = e.presentes.map(id => {
    const linhas = [], voto = e.votos[id];
    const segredos = e.presentes.filter(q => q !== id && e.val[q]?.marcas?.[id] === true).length;
    if (id === k) {
      const enganados = e.presentes.filter(a => a !== k && e.votos[a]?.suspeito !== k).length;
      if (enganados) linhas.push([enganados, enganados === 1 ? 'Enganou 1 pessoa' : `Enganou ${enganados} pessoas`]);
      if (voto && maximo > 0 && recebidos[voto.suspeito] === maximo) linhas.push([2, `Incriminou ${nomeDe(voto.suspeito)}, a pessoa mais votada`]);
    } else {
      if (voto?.suspeito === k) linhas.push([3, 'Acertou no assassino']);
    }
    if (segredos) linhas.push([segredos, segredos === 1 ? 'Adivinhou 1 segredo' : `Adivinhou ${segredos} segredos`]);
    return { id, total: Math.max(0, linhas.reduce((s, [p]) => s + p, 0)), linhas, segredos, suspeitas: recebidos[id] ?? 0, hora: voto?.t ?? Infinity };
  });
  // Desempate, só entre quem tem os mesmos pontos: 1) mais segredos adivinhados, 2) menos suspeitas recebidas,
  // 3) quem selou o voto primeiro. Só fica o mesmo lugar se tudo for igual.
  const criterios = [
    [(a, b) => b.segredos - a.segredos, 'mais segredos adivinhados'],
    [(a, b) => a.suspeitas - b.suspeitas, 'menos suspeitas'],
    [(a, b) => a.hora - b.hora, 'votou primeiro'],
  ];
  const comparar = (a, b) => {
    if (b.total !== a.total) return [b.total - a.total, null];
    for (const [f, nome] of criterios) { const r = f(a, b); if (r) return [r, nome]; }
    return [0, null];
  };
  tabela.sort((a, b) => comparar(a, b)[0]);
  tabela.forEach((l, i) => {
    const antes = tabela[i - 1];
    if (!antes) { l.lugar = 1; return; }
    const [r, nome] = comparar(antes, l);
    l.lugar = r ? i + 1 : antes.lugar;
    // A nota de desempate vai para quem ficou à frente por causa dele.
    if (r && nome && !antes.desempate) antes.desempate = nome;
  });
  return tabela;
}

function vVeredicto() {
  const cab = (titulo, sub) => `<section class="bloco"><span class="lbl">Fim da noite</span><h1>${titulo}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</section>`;
  if (!minhasFichas().length) return cab('O teu <em>veredicto</em>', 'Abre primeiro a tua ficha no início.');
  if (!ultimaRonda()) return cab('O teu <em>veredicto</em>', 'A votação abre com a última ronda.');
  if (!bd) return cab('O teu <em>veredicto</em>', 'A ligar…');
  if (!votacaoLiberta()) return cab('O teu <em>veredicto</em>', 'A votação abre quando o anfitrião a abrir.');
  const e = estado();
  const seletor = minhasFichas().length > 1 && e.fase !== 'revelar' ? `<div class="seletor"><span class="lbl">Neste telemóvel, como</span>
    ${minhasFichas().map(id => `<button type="button" class="chip" data-acao="eu" data-id="${esc(id)}" aria-pressed="${id === euId}">${esc(nomeDe(id))}</button>`).join('')}</div>` : '';

  if (e.fase === 'votar' && (!e.votos[euId] || editarVoto)) {
    const outros = e.presentes.filter(p => p !== euId).map(jogador);
    const meu = e.votos[euId] ?? {};
    return `${cab('O teu <em>veredicto</em>', 'Escolhe quem matou. Se quiseres, tenta adivinhar os segredos dos outros.')}${seletor}
      <form class="veredicto" id="form-voto" autocomplete="off">
        <fieldset class="suspeitos"><legend class="lbl acc">Quem é o assassino?</legend>
          ${outros.map(j => `<label class="suspeito"><input type="radio" name="suspeito" value="${esc(j.id)}"${meu.suspeito === j.id ? ' checked' : ''}>${retrato(j)}<span>${esc(j.nome)}</span></label>`).join('')}
        </fieldset>
        <section class="bloco"><span class="lbl acc">Os segredos dos outros</span>
          <p class="sub">Escreve só os que quiseres adivinhar. Cada segredo certo vale um ponto, e não perdes pontos por falhares.</p>
          ${outros.map(j => `<label class="palpite"><span class="lbl">${esc(j.nome)}</span>
            <textarea name="p-${esc(j.id)}" rows="2" placeholder="Acho que…">${esc(meu.palpites?.[j.id] ?? '')}</textarea></label>`).join('')}
        </section>
        <p class="msg" id="msg-voto" aria-live="polite"></p>
        <button class="botao" type="submit">Selar o veredicto</button>
        ${editarVoto ? `<button class="ligacao" type="button" data-acao="voto-cancelar">Manter o voto que tinha</button>` : ''}
      </form>`;
  }
  if (e.fase === 'votar') return `${cab('Veredicto <em>selado</em>', 'Ainda podes mudar de ideias até a última pessoa votar.')}${seletor}
    <section class="cartao espera">${meuRetrato(euId)}<div data-viva>${painelVivo(e)}</div>
      <button class="ligacao" type="button" data-acao="voto-alterar">Alterar o meu voto</button></section>`;

  if (e.fase === 'validar' && !e.val[euId] && e.presentes.includes(euId)) {
    const sobreMim = palpitesSobre(euId, e);
    const segredo = lista('ficha').find(f => f.jogador === euId)?.segredo;
    const pronto = sobreMim.every(p => p.autor in marcasLocais);
    return `${cab('Os <em>palpites</em>', 'Isto foi o que disseram do teu segredo. Marca os que acertaram. Ninguém vê as tuas marcas até à revelação.')}${seletor}
      <section class="seccao"><span class="lbl">O teu segredo</span><p class="segredo">${esc(segredo)}</p></section>
      ${sobreMim.map(({ autor, texto }) => `<article class="palpite-cartao">
        <span class="lbl acc">${esc(nomeDe(autor))} disse</span><p>«${esc(texto)}»</p>
        <div class="certo-errado">
          <button type="button" class="chip" data-acao="marcar" data-autor="${esc(autor)}" data-valor="1" aria-pressed="${marcasLocais[autor] === true}">Certo</button>
          <button type="button" class="chip" data-acao="marcar" data-autor="${esc(autor)}" data-valor="0" aria-pressed="${marcasLocais[autor] === false}">Errado</button>
        </div></article>`).join('')}
      <button class="botao" type="button" data-acao="validar"${pronto ? '' : ' disabled'}>Confirmar</button>`;
  }
  // Depois de confirmar os palpites, cada um fica aqui até o anfitrião revelar o assassino (a todos ao mesmo tempo).
  if (e.fase === 'validar' || !assassinoRevelado()) return `${cab('Quase <em>lá</em>', 'Quando todos marcarem os palpites, segue-se a revelação.')}${seletor}
    <section class="cartao espera">${meuRetrato(euId)}<div data-viva>${painelVivo(e)}</div></section>`;

  const sol = lista('solucao')[0];
  if (!sol) return cab('A <em>revelação</em>', 'A abrir…');
  if (passoFinal === 1) return vReconstituicao(e, sol);
  // A solução só abre quando o anfitrião a revela; até lá fica a reconstituição com a mensagem de espera.
  if (passoFinal === 2) return bd.solucaoAberta ? vSolucaoFinal(e, sol) : vReconstituicao(e, sol);
  if (passoFinal === 3 && bd.podio) return vPodio(e, sol);
  return vRevelacao(e, sol);
}

function vRevelacao(e, sol) {
  const k = sol.assassino;
  const votosK = e.votos[k];
  const linhas = e.presentes.filter(p => p !== k).map(p => {
    const v = e.votos[p];
    const certo = v?.suspeito === k;
    return `<li class="${certo ? 'certo' : 'errado'}"><b>${esc(nomeDe(p))}</b> ${v ? `votou em ${esc(nomeDe(v.suspeito))}` : 'não votou'}</li>`;
  }).join('');
  return `<section class="revelacao">
      <span class="lbl acc">O veredicto</span>
      <p class="suspense">O assassino é…</p>
      <div class="revela">${retrato(jogador(k))}<h1>${esc(nomeDe(k))}</h1></div>
      <div class="depois">
        <ul class="votos">${linhas}</ul>
        ${votosK ? `<p class="incriminar">${esc(nomeDe(k))} tentou incriminar <b>${esc(nomeDe(votosK.suspeito))}</b>.</p>` : ''}
      </div>
      <div class="como" data-como>${botaoComoAconteceu(e)}</div>
    </section>`;
}

// "Ver como aconteceu": cada um carrega (comoAconteceu/<id>) e espera; quando todos carregaram, a reconstituição
// abre em todos ao mesmo tempo. O anfitrião pode avançar sem esperar (avancar/recon).
const prontosRecon = e => e.presentes.filter(p => bd?.comoAconteceu?.[p]).length;
const reconLiberta = (e = estado()) => !!bd?.avancar?.recon || (e.presentes.length > 0 && prontosRecon(e) >= e.presentes.length);
function botaoComoAconteceu(e) {
  if (reconLiberta(e)) return `<button class="botao ver-solucao" type="button" data-acao="passo" data-passo="1">Ver como aconteceu</button>`;
  const eu = minhasFichas().filter(id => e.presentes.includes(id));
  const conta = `${prontosRecon(e)}/${e.presentes.length}`;
  return eu.length && eu.every(id => bd?.comoAconteceu?.[id])
    ? `<button class="botao ver-solucao" type="button" disabled>À espera dos outros · ${conta}</button>`
    : `<button class="botao ver-solucao" type="button" data-acao="como-aconteceu">Ver como aconteceu</button>`;
}

// ---------- Reconstituição: o caminho do assassino na planta, antes da solução ----------

let passoRecon = 0, reconRelogio = null;

function fichasDoPasso(passo, sol) {
  return Object.entries(passo.pos ?? {}).map(([id, sala]) => {
    if (id === 'vitima') return { sala, rotulo: '†', classe: 'vitima' };
    const j = jogador(id);
    return { id, soLer: true, sala, rotulo: iniciais(j?.nome ?? id), classe: id === sol.assassino ? 'assassino' : j?.animal ? 'animal' : 'outro' };
  });
}

// O fim da reconstituição: onde estava cada um à hora do crime, comparado com o quadro deste jogador.
function vComparacaoQuadro(sol) {
  if (!sol.posicoes) return '';
  const q = lerQuadro();
  const linhas = suspeitosDoQuadro().filter(j => sol.posicoes[j.id]);
  const marcados = linhas.filter(j => q[j.id]?.sala);
  const certos = marcados.filter(j => q[j.id].sala === sol.posicoes[j.id]).length;
  return `<section class="cartao quadro-final">
      <span class="lbl acc">Às ${esc(sol.horaCrime ?? publico.horaCrime ?? '')}, cada um estava…</span>
      ${marcados.length ? `<h3>O teu quadro: acertaste ${certos} de ${marcados.length}</h3>` : `<p class="regra">Não preencheste o teu quadro.</p>`}
      <ul class="votos">${linhas.map(j => {
        const palpite = q[j.id]?.sala, certo = palpite === sol.posicoes[j.id];
        return `<li class="${!palpite ? '' : certo ? 'certo' : 'errado'}"><b>${esc(j.nome)}</b> · ${esc(nomeSala(sol.posicoes[j.id]))}${palpite && !certo ? ` <span class="regra">(disseste ${esc(nomeSala(palpite).toLowerCase())})</span>` : ''}</li>`;
      }).join('')}</ul>
    </section>`;
}

function vPassoRecon(sol) {
  const percurso = sol.percurso ?? [];
  const i = Math.min(passoRecon, percurso.length - 1);
  const passo = percurso[i];
  const fim = i >= percurso.length - 1;
  const salaK = passo.pos?.[sol.assassino];
  return `<div class="recon-passo${passo.crime ? ' crime' : ''}"><span class="hora">${esc(passo.hora)}</span><p>${esc(passo.texto)}</p></div>
    <div class="planta recon">${planta([], { fichas: fichasDoPasso(passo, sol), acesas: salaK ? [salaK] : [] })}</div>
    <div class="recon-pontos">${percurso.map((p, k) => `<button type="button" data-acao="recon-ir" data-k="${k}" aria-label="Passo das ${esc(p.hora)}" class="${k === i ? 'atual' : k < i ? 'visto' : ''}${p.crime ? ' crime' : ''}"${k === i ? ' aria-current="step"' : ''}></button>`).join('')}</div>
    <p class="recon-dica">Desliza para o lado para andar entre os passos.</p>
    ${fim ? `${vComparacaoQuadro(sol)}
      ${bd?.solucaoAberta ? `<button class="botao" type="button" data-acao="passo" data-passo="2">Ver a solução</button>`
        : `<section class="cartao aguarda-podio">
            <span class="lbl acc">Ainda não acabou</span>
            <h3>O processo vai ser lido</h3>
            <p class="sub">O anfitrião está a reunir as provas para a leitura final. Fica à mesa: a solução abre em todos os telemóveis ao mesmo tempo.</p>
          </section>`}
      <div class="confirmar"><button class="ligacao" type="button" data-acao="recon-repetir">Ver outra vez</button></div>` : ''}`;
}

function vReconstituicao(e, sol) {
  if (!sol.percurso?.length) return vSolucaoFinal(e, sol);
  return `<section class="bloco"><span class="lbl">A reconstituição</span><h1>Como <em>aconteceu</em></h1>
      <p class="sub">${esc(nomeDe(sol.assassino))}, minuto a minuto.</p></section>
    <div data-recon>${vPassoRecon(sol)}</div>`;
}

// Avança sozinho, devagar para dar tempo de ler: 7 s por passo, 10 s no momento do crime.
function iniciarReconstituicao() { irParaPasso(0); }

// Mostra o passo k e continua sozinho a partir daí. Também serve para deslizar o dedo e tocar nas bolinhas.
function irParaPasso(k) {
  clearTimeout(reconRelogio);
  const sol = lista('solucao')[0];
  const el = vista.querySelector('[data-recon]');
  if (!sol?.percurso?.length || !el) return;
  passoRecon = Math.max(0, Math.min(k, sol.percurso.length - 1));
  el.innerHTML = vPassoRecon(sol);
  // A cada passo, o ecrã acompanha o assassino (o texto do passo fica fixo no topo).
  // No último passo, desce até ao quadro e à mensagem (ou ao botão) do fim.
  const fim = passoRecon >= sol.percurso.length - 1;
  el.querySelector(fim ? '.quadro-final, .aguarda-podio, [data-passo="2"]' : '.ficha-planta.assassino')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (fim) return;
  // Com o pop-up de uma personagem aberto, a reconstituição espera.
  const avancar = () => { if (passoFinal !== 1) return; if (popupId) reconRelogio = setTimeout(avancar, 1000); else irParaPasso(passoRecon + 1); };
  reconRelogio = setTimeout(avancar, sol.percurso[passoRecon]?.crime ? 10000 : 7000);
}

const irParaPassoMao = k => irParaPasso(k);

// Deslizar o dedo na reconstituição: para a direita volta ao passo anterior, para a esquerda avança.
let toqueInicio = null;
vista.addEventListener('touchstart', e => {
  if (!e.target.closest('[data-recon]')) { toqueInicio = null; return; }
  toqueInicio = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
vista.addEventListener('touchend', e => {
  if (!toqueInicio) return;
  const dx = e.changedTouches[0].clientX - toqueInicio.x, dy = e.changedTouches[0].clientY - toqueInicio.y;
  toqueInicio = null;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  irParaPassoMao(passoRecon + (dx > 0 ? -1 : 1));
}, { passive: true });
document.addEventListener('keydown', e => {
  if (passoFinal !== 1 || !vista.querySelector('[data-recon]')) return;
  if (e.key === 'ArrowLeft') irParaPassoMao(passoRecon - 1);
  if (e.key === 'ArrowRight') irParaPassoMao(passoRecon + 1);
});

function vSolucaoFinal(e, sol) {
  const segredos = e.presentes.map(id => {
    const palpites = palpitesSobre(id, e).map(({ autor, texto }) => {
      const m = e.val[id]?.marcas?.[autor];
      return `<li class="${m === true ? 'certo' : 'errado'}"><b>${esc(nomeDe(autor))}:</b> «${esc(texto)}»</li>`;
    }).join('');
    return `<div class="seccao"><span class="lbl acc">${esc(nomeDe(id))}</span><p>${esc(sol.segredos?.[id] ?? '')}</p>
      ${palpites ? `<ul class="votos">${palpites}</ul>` : `<p class="regra">Ninguém tentou adivinhar.</p>`}</div>`;
  }).join('');
  return `<section class="cartao solucao">
      <span class="lbl acc">A solução</span>
      <h2>${esc(sol.titulo)}</h2>
      ${sol.texto.map(t => `<p>${esc(t)}</p>`).join('')}
      <div class="seccao"><span class="lbl">O que aconteceu</span><div class="horas">${sol.cronologia.map(h => `<div class="hora"><span>${esc(h.hora)}</span><span>${esc(h.texto)}</span></div>`).join('')}</div></div>
    </section>
    <section class="cartao"><span class="lbl acc">Os segredos de todos</span>${segredos}</section>
    ${bd?.podio ? `<button class="botao" type="button" data-acao="passo" data-passo="3">Ver o pódio</button>`
      : `<section class="cartao aguarda-podio">
          <span class="lbl acc">Ainda não acabou</span>
          <h3>As contas da noite</h3>
          <p class="sub">O anfitrião está a somar os pontos de cada herdeiro. Fica à mesa: o pódio abre em todos os telemóveis ao mesmo tempo.</p>
        </section>`}
    <div class="confirmar"><button class="ligacao" type="button" data-acao="passo" data-passo="1">Voltar à reconstituição</button></div>`;
}

// O pódio entra devagar, do último lugar para o primeiro: 3,5 s entre lugares, 5 s entre os três primeiros.
function animarPodio() {
  const itens = [...vista.querySelectorAll('.podio > li')];
  itens.forEach(li => li.classList.add('escondido'));
  let t = 1200;
  itens.slice().reverse().forEach((li, i) => {
    const posicao = itens.length - i;
    t += posicao <= 3 ? 5000 : 3500;
    setTimeout(() => {
      if (!li.isConnected) return;
      li.classList.remove('escondido');
      li.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, t);
  });
}

function vPodio(e, sol) {
  const tabela = pontuacao(e, sol);
  return `<section class="bloco"><span class="lbl">Fim da noite</span><h1>O <em>pódio</em></h1></section>
    <ol class="podio">${tabela.map(l => `<li class="lugar l${l.lugar}">
      <span class="pos">${l.lugar}.º</span>${retrato(jogador(l.id))}
      <div><b>${esc(nomeDe(l.id))}${l.id === sol.assassino ? ' <i>· o assassino</i>' : ''}</b>
        <ul>${l.linhas.map(([p, t]) => `<li><span>${p > 0 ? '+' : ''}${p}</span> ${esc(t)}</li>`).join('')}</ul>
        <span class="suspeitas">Suspeitas: ${l.suspeitas} ${l.suspeitas === 1 ? 'voto' : 'votos'}${l.desempate ? ` · desempate: ${l.desempate}` : ''}</span></div>
      <span class="pts">${l.total}<small>pts</small></span></li>`).join('')}</ol>
    <div class="confirmar"><button class="ligacao" type="button" data-acao="passo" data-passo="2">Voltar à solução</button></div>`;
}

const VISTAS = { lobby: vLobby, inicio: vInicio, ficha: vFicha, provas: vProvas, caderno: vCaderno, familia: vFamilia, guia: vGuia, veredicto: vVeredicto };

function mostrar() {
  let nome = location.hash.slice(1) || 'lobby';
  if (nome === 'planta') nome = 'caderno';   // o separador chamava-se Planta
  // Antes da hora só existe o lobby; depois da hora, com hora marcada, o lobby já não aparece.
  // Só o link sem hash é desviado; #lobby escrito à mão mostra sempre o lobby (para mudar a hora).
  // O guia só abre depois dos cinco toques no título, e abre a qualquer hora.
  const noGuia = nome === 'guia' && guiaPedido && guia;
  if (nome === 'guia' && !noGuia) nome = 'inicio';
  // Com uma ronda já revelada, o jogo começou, mesmo que a contagem ainda não tenha chegado ao fim.
  if (antesDaHora() && !noGuia && !rondasReveladas()) nome = 'lobby';
  else if (!location.hash && horaInicio() !== null) nome = 'inicio';
  const aba = VISTAS[nome] ? nome : 'inicio';
  if (aba !== 'guia') guiaPedido = false;
  document.body.classList.toggle('em-lobby', aba === 'lobby');
  if (aba === 'lobby' && antesDaHora()) arrancarRelogio(); else clearInterval(relogio);
  if (aba !== 'ficha') { fichaVisivel = false; largarEcra(); }
  if (aba !== 'caderno') cadernoVisivel = false;
  vista.innerHTML = VISTAS[aba]();
  const abaMarcada = { guia: 'inicio', veredicto: 'provas' }[aba] ?? aba;
  document.querySelectorAll('.abas a').forEach(a => a.toggleAttribute('aria-current', a.dataset.aba === abaMarcada));
  document.querySelectorAll('.abas a[aria-current]').forEach(a => a.setAttribute('aria-current', 'page'));
  window.scrollTo(0, 0);
}

// ---------- Ações ----------

async function submeter(e) {
  e.preventDefault();
  const input = document.getElementById('codigo'), msg = document.getElementById('msg'), botao = e.target.querySelector('button');
  const codigo = normalizar(input.value);
  msg.classList.remove('erro');
  if (!codigo) { msg.textContent = 'Escreve o código que te deram.'; msg.classList.add('erro'); return; }
  if (abertos.has(codigo)) { msg.textContent = 'Este código já está aberto neste telemóvel.'; return; }
  botao.disabled = true; msg.textContent = 'A abrir…';
  try {
    const conteudo = await decifrar(codigo);
    // Só as fichas abrem por código. As rondas e a solução abrem pelo anfitrião; o guia, pelos cinco toques no título.
    if (!conteudo || conteudo.tipo !== 'ficha') { msg.textContent = 'Este código não existe. Confirma as letras.'; msg.classList.add('erro'); return; }
    // Uma ficha só pode estar num telemóvel: se outro já a tem, este não entra.
    if (!await reservar(conteudo.jogador)) {
      msg.textContent = 'Este código já está a ser usado noutro telemóvel. Se é o teu, pede ao anfitrião para o libertar.';
      msg.classList.add('erro'); return;
    }
    // Quem volta a dar um código que o anfitrião tinha tirado entra de novo de propósito.
    // (Só se foi este telemóvel o tirado; se foi outro, o aviso fica para esse o apanhar.)
    const tirado = bd?.expulsos?.[conteudo.jogador];
    if (tirado === DISPOSITIVO || tirado === true) { delete bd.expulsos[conteudo.jogador]; await escrever(`expulsos/${conteudo.jogador}`, null).catch(() => {}); }
    abertos.set(codigo, conteudo);
    guardar();
    avisoCodigo = '';
    if (bd?.reinicio?.t) gravarVisto(bd.reinicio.t);
    vigiar();
    mostrar();
  } catch {
    msg.textContent = 'Não foi possível abrir. Tenta outra vez.'; msg.classList.add('erro');
  } finally {
    botao.disabled = false;
  }
}

async function manterEcra() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}
function largarEcra() { wakeLock?.release?.().catch(() => {}); wakeLock = null; }

async function selarVoto(e) {
  e.preventDefault();
  const dados = new FormData(e.target), msg = document.getElementById('msg-voto'), botao = e.target.querySelector('button[type="submit"]');
  const suspeito = dados.get('suspeito');
  if (!suspeito) { msg.textContent = 'Escolhe quem achas que é o assassino.'; msg.classList.add('erro'); return; }
  const palpites = {};
  for (const [k, v] of dados) if (k.startsWith('p-') && String(v).trim()) palpites[k.slice(2)] = String(v).trim().slice(0, 500);
  botao.disabled = true; msg.classList.remove('erro'); msg.textContent = 'A selar…';
  try {
    const voto = { suspeito, palpites, t: Date.now() };
    await escrever(`votos/${euId}`, voto);
    (bd.votos ??= {})[euId] = voto;
    editarVoto = false;
    await sincronizar();
    mostrar();
  } catch {
    msg.textContent = 'Não foi possível guardar. Confirma a internet e tenta outra vez.'; msg.classList.add('erro');
    botao.disabled = false;
  }
}

vista.addEventListener('submit', e => {
  if (e.target.id === 'form-codigo') submeter(e);
  if (e.target.id === 'form-voto') selarVoto(e);
  if (e.target.id === 'form-hora') {
    e.preventDefault();
    const v = new Date(document.getElementById('nova-hora').value).getTime();
    if (Number.isNaN(v)) return;
    try { localStorage.setItem(chaveHora(), String(v)); } catch { /* sem armazenamento */ }
    if (bd) bd.inicio = v;
    escrever('inicio', v).catch(() => {});
    editarHora = false; mudarHora = false;
    mostrar();
  }
});
vista.addEventListener('click', e => {
  const acao = e.target.closest('[data-acao]')?.dataset.acao;
  if (acao === 'titulo' && cincoToques('titulo')) abrirGuia();
  if (acao === 'hora-mudar') { mudarHora = true; editarHora = true; mostrar(); }
  if (acao === 'reset') { confirmarReset = true; mostrar(); }
  if (acao === 'reset-nao') { confirmarReset = false; mostrar(); }
  // Recomeçar apaga o jogo partilhado (rondas, presenças, votos) e deixa um aviso: todos os telemóveis perdem a
  // ficha e voltam ao lobby, com a mesma hora de início.
  if (acao === 'reset-sim') {
    const inicio = Date.now() + 10 * 60000;
    // Este telemóvel toma nota do seu próprio recomeço, para não voltar a recomeçar na sincronização seguinte.
    escrever('', { reinicio: { t: { '.sv': 'timestamp' }, inicio }, inicio })
      .then(() => fetch(urlBD('reinicio/t'), { cache: 'no-store' }).then(r => r.json()).then(t => { if (t) gravarVisto(t); }))
      .catch(() => {}).finally(() => reiniciarAqui(inicio));
  }
  if (acao === 'hora-fechar') { editarHora = false; mudarHora = false; mostrar(); }
  if (acao === 'hora-repor') {
    try { localStorage.removeItem(chaveHora()); } catch { /* sem armazenamento */ }
    if (bd) delete bd.inicio;
    escrever('inicio', null).catch(() => {});
    editarHora = false; mudarHora = false; mostrar();
  }
  if (acao === 'revelar') { fichaVisivel = true; manterEcra(); mostrar(); }
  if (acao === 'tapar') { fichaVisivel = false; largarEcra(); mostrar(); }
  if (acao === 'abrir-caderno') { cadernoVisivel = true; mostrar(); }
  if (acao === 'tapar-caderno') { cadernoVisivel = false; mostrar(); }
  // Votação final
  const botao = e.target.closest('[data-acao]');
  if (acao === 'eu') { euId = botao.dataset.id; editarVoto = false; marcasLocais = {}; mostrar(); }
  if (acao === 'voto-alterar') { editarVoto = true; mostrar(); }
  if (acao === 'voto-cancelar') { editarVoto = false; mostrar(); }
  if (acao === 'marcar') {
    marcasLocais[botao.dataset.autor] = botao.dataset.valor === '1';
    botao.parentElement.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b === botao)));
    const faltam = palpitesSobre(euId, estado()).some(p => !(p.autor in marcasLocais));
    vista.querySelector('[data-acao="validar"]').disabled = faltam;
  }
  if (acao === 'validar') {
    botao.disabled = true;
    const v = { marcas: marcasLocais, t: Date.now() };
    escrever(`validacoes/${euId}`, v)
      .then(() => { (bd.validacoes ??= {})[euId] = v; marcasLocais = {}; mostrar(); sincronizar(); })
      .catch(() => { botao.disabled = false; });
  }
  if (acao === 'passo') { passoFinal = Number(botao.dataset.passo); mostrar(); if (passoFinal === 1) iniciarReconstituicao(); }
  if (acao === 'como-aconteceu' && bd) {
    const e = estado();
    botao.disabled = true;
    const eu = minhasFichas().filter(id => e.presentes.includes(id));
    for (const id of eu) (bd.comoAconteceu ??= {})[id] = true;
    vista.querySelectorAll('[data-como]').forEach(el => { el.innerHTML = botaoComoAconteceu(e); });
    Promise.all(eu.map(id => escrever(`comoAconteceu/${id}`, true))).then(() => sincronizar()).catch(() => {});
  }
  if (acao === 'recon-ja' && bd) { botao.disabled = true; escrever('avancar/recon', true).then(() => sincronizar()).catch(() => {}); }
  if (acao === 'recon-repetir') iniciarReconstituicao();
  if (acao === 'recon-ir') irParaPassoMao(Number(botao.dataset.k));
  if (acao === 'personagem') abrirPersonagem(botao.dataset.id, botao.dataset.ler === '1');
  if (acao === 'camada') {
    const c = lerCamadas(); c[botao.dataset.c] = !c[botao.dataset.c];
    try { localStorage.setItem(chaveCamadas(), JSON.stringify(c)); } catch { /* sem armazenamento */ }
    vista.querySelector('[data-legenda]').innerHTML = legendaLinha();
    vista.querySelector('[data-linha]').innerHTML = blocosLinha();
  }
  if (acao === 'nota-nova') abrirNota(botao.dataset.m ? Number(botao.dataset.m) : undefined);
  if (acao === 'nota-editar') abrirNota(undefined, botao.dataset.n);
  const redesenharGuia = () => vista.querySelectorAll('[data-guia]').forEach(el => { el.innerHTML = painelGuia(); });
  const redesenharCodigos = () => vista.querySelectorAll('[data-codigos]').forEach(el => { el.innerHTML = painelCodigos(); });
  if (acao === 'abrir-votacao' && bd) {
    botao.disabled = true;
    escrever('votacao', true)
      .then(() => { bd.votacao = true; redesenharGuia(); sincronizar(); }, () => { botao.disabled = false; });
  }
  if (acao === 'avancar') { confirmarAvancar = true; redesenharGuia(); }
  if (acao === 'avancar-nao') { confirmarAvancar = false; redesenharGuia(); }
  if (acao === 'avancar-sim') {
    confirmarAvancar = false;
    const fase = estado().fase;
    const caminho = fase === 'votar' ? 'avancar/votos' : fase === 'validar' ? 'avancar/validacao' : null;
    if (caminho) escrever(caminho, true).then(() => sincronizar()).catch(() => {});
    redesenharGuia();
  }
  // Tirar alguém do jogo (por exemplo, quem deu o código de outra pessoa): apaga a presença, o voto e as marcas,
  // e avisa o telemóvel dessa pessoa, que perde a ficha. Quem for o dono certo pode voltar a dar o código.
  if (acao === 'tirar') { aTirar = botao.dataset.id; redesenharCodigos(); }
  if (acao === 'tirar-nao') { aTirar = null; redesenharCodigos(); }
  if (acao === 'tirar-sim' && bd) {
    const id = aTirar; aTirar = null;
    const dispositivo = bd.presentes?.[id];
    Promise.all([
      escrever(`expulsos/${id}`, typeof dispositivo === 'string' ? dispositivo : true),
      escrever(`presentes/${id}`, null), escrever(`votos/${id}`, null), escrever(`validacoes/${id}`, null),
    ]).then(() => sincronizar()).catch(() => {});
    if (bd.presentes) delete bd.presentes[id];
    redesenharCodigos();
  }
  // Planta: tocar numa cruz mostra as provas dessa ronda, por baixo da planta.
  if (acao === 'marca') {
    marcaAberta = Number(botao.dataset.i);
    const el = vista.querySelector('[data-marca-aberta]');
    if (el) { el.innerHTML = vProvaDaMarca(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  if (acao === 'marca-fechar') { marcaAberta = null; const el = vista.querySelector('[data-marca-aberta]'); if (el) el.innerHTML = ''; }
  // Copiar um código: vai uma mensagem pronta a colar no WhatsApp, com o código e o link.
  if (acao === 'copiar') {
    const texto = `${publico.titulo} ${publico.tituloDestaque ?? ''}`.trim() + `\nO teu código: ${botao.dataset.codigo}\n${location.origin}${location.pathname}${location.search}`;
    copiarTexto(texto).then(ok => {
      copiado = ok ? botao.dataset.id : null;
      vista.querySelectorAll('[data-codigos]').forEach(el => { el.innerHTML = painelCodigos(); });
      setTimeout(() => { copiado = null; vista.querySelectorAll('[data-codigos]').forEach(el => { el.innerHTML = painelCodigos(); }); }, 2000);
    });
  }
  // O botão da noite, no guia
  if (acao === 'noite' && bd) {
    const r = rondasReveladas();
    if (r < publico.rondas.length) {
      const chave = guia.rondas?.[r + 1];
      if (!chave) return;
      botao.disabled = true;
      escrever(`chaves/r${r + 1}`, chave)
        .then(() => { redesenharGuia(); sincronizar(); })
        .catch(() => { botao.disabled = false; });
    } else if (estado().fase === 'revelar' && !assassinoRevelado()) {
      botao.disabled = true;
      escrever('assassinoRevelado', true)
        .then(() => { bd.assassinoRevelado = true; redesenharGuia(); sincronizar(); })
        .catch(() => { botao.disabled = false; });
    } else if (estado().fase === 'revelar' && !bd.solucaoAberta) {
      botao.disabled = true;
      escrever('solucaoAberta', true)
        .then(() => { sincronizar(); })
        .catch(() => { botao.disabled = false; });
    } else if (estado().fase === 'revelar' && !bd.podio) {
      botao.disabled = true;
      escrever('podio', true)
        .then(() => { sincronizar(); })
        .catch(() => { botao.disabled = false; });
    }
  }
});
// Elementos tocáveis que não são botões (retratos, fichas na planta): abrem também com Enter ou espaço.
vista.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"][data-acao]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
window.addEventListener('hashchange', mostrar);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && fichaVisivel) manterEcra(); });

// ---------- Arranque ----------

async function arrancar() {
  try {
    // O caso vem do link (?caso=simples) ou, sem ele, do caso por defeito do índice.
    const json = u => fetch(u, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
    const indice = await json('dados/indice.json');
    const pedido = new URLSearchParams(location.search).get('caso');
    const id = indice.casos.includes(pedido) ? pedido : indice.padrao;
    [publico, caso] = await Promise.all([json(`dados/${id}/publico.json`), json(`dados/${id}/caso.json`)]);
  } catch {
    vista.innerHTML = `<section class="bloco"><h2>Sem ligação</h2><p class="sub">Não foi possível carregar o caso. Liga-te à internet e volta a abrir.</p></section>`;
    return;
  }
  document.title = `${publico.titulo} ${publico.tituloDestaque ?? ''}`.trim();
  for (const c of lerGuardados()) {
    try { const conteudo = await decifrar(c); if (conteudo && conteudo.tipo !== 'guia') abertos.set(c, conteudo); } catch { /* código antigo de outro caso */ }
  }
  mostrar();
  // A presença é registada pela sincronização, depois de ver se houve um recomeço (senão uma ficha antiga
  // ficava marcada como presente e a votação esperava por ela).
  vigiar();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // Quando chega uma versão nova do site, recarrega uma vez para não ficar a correr o código antigo.
  const havia = !!navigator.serviceWorker.controller;
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (havia && !recarregou) { recarregou = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
arrancar();
