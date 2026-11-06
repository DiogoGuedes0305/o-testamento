# O Testamento — murder mystery para o telemóvel

Um jogo de **murder mystery** para jogar ao jantar, com amigos, cada um no seu telemóvel.
Uma web app (PWA) feita de raiz: sem instalar nada, sem contas, funciona em Android e iPhone.

Este repositório traz o caso de exemplo **"O Lobo de Prata"**: oito herdeiros, um avaliador morto no closet
e uma estatueta de prata que desapareceu do cofre. Um de vocês é o assassino — e nem o anfitrião sabe quem.

▶ **Jogar agora:** https://diogoguedes0305.github.io/o-testamento/

## Como se joga

- **6 a 8 jogadores**, cada um com o seu telemóvel. Um deles é o **anfitrião** (também joga).
- Cada jogador recebe um **código secreto** que abre a sua **ficha**: a personagem, onde estava,
  o que viu, a ligação à vítima e um segredo.
- Pode-se mentir sobre si próprio, **nunca** sobre o que se viu. Não se mostra a ficha a ninguém.
- O jantar tem **3 rondas** (entrada, prato principal, sobremesa). Em cada uma, o anfitrião revela
  novas provas, que aparecem em todos os telemóveis ao mesmo tempo.
- No fim, cada um vota em quem acha que é o assassino e tenta adivinhar os segredos dos outros.
- Revela-se o assassino, a **reconstituição** animada na planta da casa, a solução e o **pódio**.

### Pontos
- +3 a cada inocente que acerta no assassino.
- +1 por cada segredo adivinhado (é o dono do segredo que confirma).
- O assassino ganha +1 por cada pessoa que não votou nele e +2 se quem ele incriminou for o mais votado.

## Experimentar com amigos

1. O anfitrião abre o link. A app cria uma **sala** só vossa e o endereço passa a ter `?sala=XXXXX`.
2. O anfitrião escreve o código dele (**TINTEIRO**) e carrega em **Salvar** e **Entrar**.
3. **5 toques rápidos no título** abrem o **guia do anfitrião** (só no telemóvel com a ficha do anfitrião).
   Em "Códigos dos jogadores", o botão **Copiar** prepara uma mensagem com o código e o link da sala
   para mandar a cada amigo.
4. O anfitrião lê a história em voz alta e usa o botão do guia para avançar:
   1.ª ronda → 2.ª → 3.ª → abrir a votação → revelar o assassino → solução → pódio.

> Para testar sozinho, abre a mesma sala em vários separadores ou janelas anónimas, cada um com um código.
> Cada código só pode estar num telemóvel de cada vez.

| Jogador | Código |
|---|---|
| Diogo (anfitrião) | TINTEIRO |
| Milene | CAMELIA |
| Tomás | ESTRIBO |
| Sofia | MONOCULO |
| Alex | CHARUTO |
| Cláudia | PERGAMINHO |
| Pedro | CRISTAL |
| Pinheiro | GALGO |

## O que tem a app

- **Ficha** pessoal, atrás de uma cortina ("Só para os teus olhos").
- **Provas** de cada ronda, com cruzes na **planta da casa** onde cada uma foi encontrada.
- **Caderno do detetive**: a planta, um quadro com onde estava cada pessoa à hora do crime, notas,
  e uma **linha do tempo** de 5 em 5 minutos. Fica só no teu telemóvel.
- **Família**: os retratos de todos, em molduras ovais douradas.
- **Votação** em três fases (votar, confirmar palpites, revelar), sincronizada entre telemóveis.
- **Reconstituição**: o percurso do assassino animado na planta, minuto a minuto.
- Funciona sem rede depois da primeira visita (service worker) e pode ser adicionada ao ecrã principal.

## Como funciona por dentro

- `site/` — a app: HTML, CSS e JavaScript simples, sem build nem dependências.
- Os segredos de cada caso estão **cifrados** (AES-GCM, chave PBKDF2 derivada de cada código):
  `site/dados/<caso>/caso.json`. Cada código só abre a sua parte. O que é público está em `publico.json`.
- A sincronização entre telemóveis (rondas, presenças, votos) usa uma Firebase Realtime Database por REST.
  Esta demonstração usa a pasta `testamento-demo/<sala>`.

### Correr no computador

```bash
node ferramentas/servir.mjs        # abre http://localhost:8080
```
A cifra do browser só funciona em `localhost` ou `https`.

### Escrever o teu próprio caso

> ⚠️ **Spoiler:** `casos/ensaio.json` é o caso de exemplo em claro, com a solução. Não abras se queres jogar.

1. Copia `casos/ensaio.json` e escreve a tua história: jogadores, fichas, rondas (com `marcas` na planta),
   solução (com o `percurso` do assassino) e guia.
2. `node ferramentas/cifrar.mjs casos/o-meu-caso.json --padrao` gera `site/dados/<id>/` e os envelopes para imprimir
   em `privado/` (fora do site).
3. `node ferramentas/testar-dados.mjs site/dados/<id> casos/o-meu-caso.json` confirma que tudo abre com os códigos certos.
4. Para a tua própria noite, troca o endereço da base de dados em `site/app.js` (constante `BD`) pelo da tua
   Firebase Realtime Database.

A planta da casa é desenhada em SVG em `site/app.js` (`SALAS`); adapta-a à tua casa.

---
Feito por Diogo Guedes, com a ajuda do Claude, para uma game night em casa.
