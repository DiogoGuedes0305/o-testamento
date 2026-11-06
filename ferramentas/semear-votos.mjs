// Prepara a pasta de testes (testamento-local/ensaio) com 7 jogadores que já votaram; falta o Diogo.
// Uso: node semear-votos.mjs votos | validacoes | limpar
// A sala vem do link (?sala=XXXXX): node semear-votos.mjs votos XXXXX
const URL = `https://battle-for-monte-gordo-default-rtdb.firebaseio.com/testamento-demo-local/${process.argv[3] ?? 'TESTE'}/ensaio`;
const put = (c, v) => fetch(`${URL}${c ? '/' + c : ''}.json`, v === null ? { method: 'DELETE' } : { method: 'PUT', body: JSON.stringify(v) }).then(r => r.status);
const todos = ['diogo', 'milene', 'tomas', 'sofia', 'alex', 'claudia', 'pedro', 'pinheiro'];
const passo = process.argv[2];
if (passo === 'limpar') console.log('limpar', await put('', null));
if (passo === 'votos') {
  await put('', null);
  await put('presentes', Object.fromEntries(todos.map(j => [j, true])));
  const votos = {
    milene: { suspeito: 'tomas', palpites: { diogo: 'Partiu a cartola do avô num truque' } },
    tomas: { suspeito: 'alex', palpites: { diogo: 'Deve dinheiro ao Alex', sofia: 'Quer ir estudar para fora' } },
    sofia: { suspeito: 'tomas', palpites: {} },
    alex: { suspeito: 'pedro', palpites: { tomas: 'Vendeu o lobo' } },
    claudia: { suspeito: 'alex', palpites: {} },
    pedro: { suspeito: 'tomas', palpites: { diogo: 'Tem uma dívida' } },
    pinheiro: { suspeito: 'alex', palpites: {} },
  };
  for (const [j, v] of Object.entries(votos)) console.log(j, await put(`votos/${j}`, { ...v, t: Date.now() }));
}
if (passo === 'validacoes') {
  // O Tomás marca certo o palpite do Alex; a Sofia marca errado o do Tomás. Os outros não têm palpites.
  const val = { milene: {}, tomas: { alex: true }, sofia: { tomas: false }, alex: {}, claudia: {}, pedro: {}, pinheiro: {} };
  for (const [j, m] of Object.entries(val)) console.log(j, await put(`validacoes/${j}`, { marcas: m, t: Date.now() }));
}
