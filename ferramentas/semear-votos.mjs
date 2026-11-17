// Prepara a pasta de testes (testamento-local/ensaio) com 7 jogadores que já votaram; falta o Rui.
// Uso: node semear-votos.mjs votos | validacoes | limpar
// A sala vem do link (?sala=XXXXX): node semear-votos.mjs votos XXXXX
const URL = `https://battle-for-monte-gordo-default-rtdb.firebaseio.com/testamento-demo-local/${process.argv[3] ?? 'TESTE'}/ensaio`;
const put = (c, v) => fetch(`${URL}${c ? '/' + c : ''}.json`, v === null ? { method: 'DELETE' } : { method: 'PUT', body: JSON.stringify(v) }).then(r => r.status);
const todos = ['rui', 'ines', 'tiago', 'beatriz', 'hugo', 'marta', 'nuno', 'filipe'];
const passo = process.argv[2];
if (passo === 'limpar') console.log('limpar', await put('', null));
if (passo === 'votos') {
  await put('', null);
  await put('presentes', Object.fromEntries(todos.map(j => [j, true])));
  const votos = {
    ines: { suspeito: 'tiago', palpites: { rui: 'Partiu a cartola do avô num truque' } },
    tiago: { suspeito: 'hugo', palpites: { rui: 'Deve dinheiro ao Hugo', beatriz: 'Quer ir estudar para fora' } },
    beatriz: { suspeito: 'tiago', palpites: {} },
    hugo: { suspeito: 'nuno', palpites: { tiago: 'Vendeu o lobo' } },
    marta: { suspeito: 'hugo', palpites: {} },
    nuno: { suspeito: 'tiago', palpites: { rui: 'Tem uma dívida' } },
    filipe: { suspeito: 'hugo', palpites: {} },
  };
  for (const [j, v] of Object.entries(votos)) console.log(j, await put(`votos/${j}`, { ...v, t: Date.now() }));
}
if (passo === 'validacoes') {
  // O Tiago marca certo o palpite do Hugo; a Beatriz marca errado o do Tiago. Os outros não têm palpites.
  const val = { ines: {}, tiago: { hugo: true }, beatriz: { tiago: false }, hugo: {}, marta: {}, nuno: {}, filipe: {} };
  for (const [j, m] of Object.entries(val)) console.log(j, await put(`validacoes/${j}`, { marcas: m, t: Date.now() }));
}
