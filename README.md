# Revolution Manager — uma praça, uma causa

Protótipo de uma única missão curta, em TypeScript + Vite + Canvas 2D. Sem backend, serviços externos ou credenciais para jogar. Node.js 22+ (CI usa 24).

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
npm test
npm run build:html
```

`build:html` valida os tipos, gera o build e empacota código e estilos em `revolution-manager.html`. Copie e abra esse arquivo no navegador para jogar sem instalação ou internet. O arquivo também fica em `dist` para publicação pelo GitHub Pages.

## O que você precisa fazer

**Chegar à Praça da Liberdade e manter pelo menos 350 presentes por 30 segundos contínuos.** Cair abaixo de 350 zera a sequência. Há até 75 segundos de simulação no local para completar a permanência. Chegar à praça não encerra a missão.

O ciclo tem três decisões principais: escolher um caminho, responder à barricada e preparar a ocupação. Você começa com 420 presentes, quatro intervenções e até três recursos. A chegada pausa automaticamente: leia a situação, use ações se necessário e toque em **Continuar** para iniciar a permanência. Pausa e confirmações não avançam o relógio; há velocidades 1× e 2×.

## Distrito 4 × 6

O mapa tem 24 cruzamentos (quatro colunas e seis linhas), 37 trechos, 14 quadras irregulares e duas áreas verdes. O norte é fixo. Arraste, use os botões de zoom, a roda do mouse ou pinça. O distrito inteiro fica enquadrado por padrão; ampliar permite acompanhar a multidão. Há avenidas, ruas menores, mercado, igreja, posto policial, concentração e praça de destino.

Os três caminhos têm custos diferentes:

- **Avenida central:** cinco trechos, recrutamento moderado e desgaste intermediário.
- **Pelo comércio:** cinco trechos, mais recrutamento e maior desgaste.
- **Ruas do bairro:** sete trechos, menos desgaste por rua e poucas entradas; a caminhada mais longa exige mais preparo.

Recrutamento, desgaste, capacidade, geometria e nomes pertencem às ruas do mesmo grafo usado pela simulação. Desvios podem misturar características dos caminhos e alteram a previsão. Ruas revisitadas não renovam recrutamento, ações ou encontros.

## Para que servem as ações

Cada ação custa intervenções e pede confirmação, exibindo consequências. Há no máximo duas ações por rua e duas na ocupação; cada ação só pode ser usada uma vez no mesmo local. É possível agir com a simulação pausada. A interface mostra o problema atual, previsão de presença, efeitos aplicados e motivos de indisponibilidade.

| Ação                  | Custo | Função                                                                                                                                                                                   |
| --------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Puxar coro            |     1 | +12 de coesão, mais 4 com som. Reduz pela metade o desgaste da rua atual. Na praça, coesão maior reduz saídas sob pressão.                                                               |
| Abrir faixa           |     1 | Exige bandeiras. Atrai 30 presentes, +15 de visibilidade e +5 de tensão. A marcha fica 25% mais lenta no restante da rua. Também pode atrair participantes na praça.                     |
| Transmitir ao vivo    |     1 | +12 de visibilidade na rua e cobertura até o final do ato. Reduz pela metade as saídas por pressão na ocupação.                                                                          |
| Acolher participantes |     1 | Exige acolhimento e sua única carga. Recupera até 30 pessoas afastadas por desgaste, inclusive na praça; fadiga −8 e coesão +4. Não recupera perdas policiais nem cria novos apoiadores. |
| Lançar bombas         |     2 | Opcional, aparece somente com o recurso. Consome carga; +25 de visibilidade e +30 de tensão, com risco reproduzível de incidentes e perdas. Não é necessário para cumprir a missão.      |

Som, bandeiras e acolhimento vêm selecionados. As bombas exigem trocar um recurso. Efeitos de violência e repressão são abstratos.

## Polícia e desvio

Há uma abordagem policial reproduzível no caminho anunciado, normalmente no segundo trecho. A marcha pausa antes da rua fechada e oferece:

- **Buscar outro percurso:** o recuo retira 30 presentes e reduz coesão em 6. Abre o editor pausado, sem custo de intervenção. A barricada permanece.
- **Confrontar:** teste influenciado por coesão, força policial e semente. Sucesso libera a rua, com saída de 3% dos presentes; derrota mantém o bloqueio, com saída de 12%. Aumenta tensão e reduz coesão e legitimidade. Postura pacífica anunciada agrava as penalidades.
- **Dispersar:** todos deixam as ruas e o ato termina com relatório parcial. Isso não significa desistência automática do movimento.

No editor, a rota atual é amarela e a proposta verde. Confirme ou cancele. A posição da multidão e a distância já realizada são preservadas; o desvio começa no próximo cruzamento acessível ou no atual, se a marcha parou nele. Confira tempo, fadiga e capacidade. Se não houver caminho válido, encerre o ato.

## Como a ocupação funciona

A cada cinco segundos de permanência ocorre pressão: coesão −4, fadiga +1 e tensão +2. As saídas são `ceil((6 + max(0,70−coesão)×0,35 + fadiga×0,05) × proteção)`, sendo proteção 0,5 com transmissão ou 1 sem ela. O relógio só conta com presença mínima. O teste no limite de 30s inclui a pressão daquele instante antes de conceder vitória. A integração por eventos mantém resultados independentes da taxa de quadros.

É possível recuperar o mínimo com faixa ou acolhimento e iniciar outra sequência, respeitando os 75s totais. Sem novas ações, a interface prevê quantas pessoas restariam; a previsão não inclui ações ou escolhas futuras.

## Resultado e regras provisórias

O relatório separa objetivo, percurso, pico, presença final, entradas, recuperações, saídas, adesões e desistências. Voltar de um afastamento não conta como recrutamento; sair da marcha não equivale automaticamente a abandonar o movimento.

Base inicial: 1.000 apoiadores, legitimidade 35, coesão 65, fadiga 10, repressão 25, estabilidade 70 e caixa 100. Comparecimento = 45% −3 pontos percentuais por grupo completo de 10 de fadiga. Entradas ocorrem nos primeiros 24 pixels de ruas inéditas, usando a taxa da rua. Desgaste ocorre ao completar cada rua; após a terceira travessia há também +3 de fadiga. O percurso aceita até 12 travessias iniciais e 16 após desvios.

Alcance integra presença × distância/240 × (1+visibilidade/100), somente no percurso realizado. Conversão = clamp(20% + metade da legitimidade em pontos percentuais, 10%, 60%). Para limitar impressões repetidas, 18% do alcance é elegível. Desistências = 3% da base anterior +2 por ponto de legitimidade perdido. Nova base = base anterior + adesões − desistências.

GDD/artes não estavam acessíveis durante a implementação inicial. Arte procedural substituível; capacidade das ruas ainda é informativa. Não há campanha, economia funcional, salvamento, áudio ou patrulhas móveis. A seleção anterior de sete objetivos foi substituída por esta missão para concentrar esta entrega na missão curta.

## Arquitetura

- `src/city.ts`: mapa, grafo, hierarquia viária e custos das rotas.
- `src/config.ts`: balanceamento, missão, recursos e ações.
- `src/simulation.ts`: regras sem DOM, tempo, polícia, desvio, pressão e relatório.
- `src/renderer.ts`: Canvas ortográfico e câmera.
- `src/main.ts` e `src/style.css`: interface, previsões e controles.
- `src/simulation.test.ts`: testes de regras e cenários completos.
- `scripts/build-html.mjs`: HTML único reproduzível.

## Validação

33 testes automatizados cobrem conectividade 4 × 6, rotas distintas, efeitos reais das ações, intervenções e cargas, recuperação sem duplicar recrutamento, chegada pausada, permanência contínua, reinício do relógio, limite de 75s, polícia, dispersão, desvio contínuo, revisitas, saldo e tempo independente dos quadros.

Balanceamento verificado com postura pacífica e desvio policial: aos 30s, a rota central termina com 341 presentes sem ações (falha), 405 usando coro com som + transmissão (sucesso), ou 466 com faixa e acolhimento durante a marcha e coro + transmissão na praça (sucesso). São exemplos reproduzíveis, não escolhas obrigatórias.

## Publicação e próximos passos

O workflow testa, gera o HTML e publica `dist` no GitHub Pages quando habilitado pelo administrador em **Settings → Pages → Source: GitHub Actions**. O HTML independente também fica no repositório para download direto. Um build local não confirma deploy remoto.

Próximas prioridades: playtest desta missão, ajustar a leitura das decisões e consequências, e só então variar objetivos/eventos antes de retomar a campanha.
