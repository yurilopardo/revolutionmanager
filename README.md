# Revolution Manager — Aurora inteira

Protótipo web de um gerenciador de manifestações numa cidade fictícia. TypeScript + Vite + Canvas 2D. Sem backend, serviços externos ou credenciais para jogar. Node.js 22+ recomendado (CI usa 24).

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
npm test
npm run build
npm run build:html
```

`build:html` gera `revolution-manager.html`, um arquivo independente com código e estilos incorporados. Copie o arquivo e abra no navegador; não requer servidor. Também é incluído em `dist` para download no GitHub Pages. A interface funciona com mouse e celular vertical.

## Cidade e navegação

Aurora tem 200 cruzamentos em um território vertical de aproximadamente 10 × 20, 362 trechos, 163 polígonos de quadras, 12 superquadras fundidas, quatro boulevards diagonais e nove áreas verdes. As quadras variam de tamanho, proporção e alinhamento. Avenidas têm pistas mais largas e nomes; ruas locais e passagens são mais estreitas. A cidade inclui Congresso, igreja, sede empresarial, gráfica governista, fábrica, universidade e praças.

A câmera mantém o norte fixo. Arraste o mapa; amplie/reduza pelos botões, roda do mouse ou pinça. **Cidade inteira** mostra a visão geral; **Concentração** retorna ao ponto de partida e **Seguir multidão** retoma o acompanhamento durante a marcha. A visão local mostra vários quarteirões de cada vez, sem reduzir toda a cidade a miniatura.

## Objetivos dos atos

- **Marcha ao Congresso:** sair da Praça da União, no sul, e chegar ao Congresso, no norte.
- **Ocupar a Praça da Liberdade:** chegar e permanecer 30 segundos de simulação.
- **Ato pacífico na Igreja:** chegar sem usar bombas nem confrontar a polícia.
- **Pressão sobre a Corporação Atlas:** superar ao menos um confronto policial e chegar à sede da empresa.
- **Protesto na gráfica governista:** chegar à Gráfica Voz do Governo.
- **Vigília pela educação:** manter uma ocupação de 20 segundos na universidade.
- **Solidariedade aos trabalhadores:** chegar à fábrica sem bombas nem confrontos.

A preparação sugere uma rota conectada ao objetivo escolhido. Há três percursos longos ao Congresso, com 17, 21 e 23 travessias. O objetivo pacífico força postura anunciada pacífica; o de confronto sugere postura não pacífica. A condição do objetivo é separada da conclusão do trajeto: chegar não basta para completar uma ocupação ou cumprir uma condição de comportamento.

## Jogar, repressão e desvios

1. Escolha o objetivo, trajeto e até três recursos. É possível desenhar o trajeto nos cruzamentos ou pelos botões de próximo cruzamento.
2. Inicie a marcha. A multidão acompanha os trechos e as curvas. Cada personagem representa até oito presentes; grupos entram pelas laterais uma única vez por rua.
3. As unidades policiais exibidas no mapa tentam bloquear uma rua adiante. A primeira abordagem ocorre no meio do primeiro trecho; outras unidades podem interceptar a rota depois. A simulação pausa antes do bloqueio.
4. Escolha uma resposta e confira as consequências antes de confirmar:
   - **Dispersar:** todos deixam a rua, o ato termina e o alcance já realizado entra no relatório. Isso não implica desistência automática de apoiadores.
   - **Confrontar:** sorteio reproduzível, influenciado por coesão e força policial. Sucesso libera a rua, com saída de 3% dos presentes; derrota mantém o bloqueio, com saída de 12%. Aumenta tensão e reduz coesão e legitimidade. A postura anunciada pacífica agrava a perda. Sem custo de intervenção. Confrontos são apenas efeitos abstratos.
   - **Buscar outro percurso:** mantém a barricada e abre o editor pausado. A posição e o caminho já realizado são preservados. Confira tempo, desgaste e capacidade da rua mais estreita; confirme ou cancele.
5. **Alterar trajeto** também está disponível sem encontro policial. A mudança começa no próximo cruzamento acessível (ou no cruzamento atual, se a marcha já parou ali). Ruas bloqueadas são inválidas; revisitas não renovam recrutamento, eventos ou ações. Se não houver caminho, encerre o ato.
6. Na ocupação, deixe o tempo avançar até cumprir a permanência. Pausar interrompe a contagem; 2× acelera o relógio. Pressão e fadiga crescem durante a permanência.
7. Confira objetivo cumprido/não cumprido, presença final, pico, adesões, desistências e nova base. Organize outro ato para reiniciar.

## Arquitetura

- `src/city.ts`: grafo e geometria determinística, hierarquia viária, bairros, praças e pontos de interesse.
- `src/config.ts`: estado inicial, balanceamento, ações e sete objetivos.
- `src/simulation.ts`: regras sem DOM; movimento por distância real de cada trecho, RNG, polícia, ocupação, desvio e relatório. A busca de caminhos visita cada nó uma única vez para funcionar na cidade ampliada.
- `src/renderer.ts`: Canvas 2D ortográfico, arte procedural, câmera, destaques de rota e polícia; desenha apenas quadras relevantes à tela.
- `src/main.ts` e `src/style.css`: interface em português e controles acessíveis.
- `src/simulation.test.ts`: cidade conectada, todos os objetivos e invariantes da simulação.
- `scripts/build-html.mjs`: empacota o build num HTML único e reproduzível.

## Regras e simplificações temporárias

O GDD e as artes não estavam acessíveis na primeira implementação (HTTP 403). A cidade e as regras são um protótipo baseado nas solicitações, com arte procedural substituível.

A escala maior substitui o antigo limite de oito travessias: até 64 no planejamento inicial e 80 no percurso completo com desvios. A velocidade base foi elevada de 38 para 64 unidades/s. Mantidos quatro pontos de intervenção por ato, até duas ações por rua, uma vez cada. Bandeiras e bombas habilitam suas ações; som, acolhimento, bloco autônomo e fogos ainda não têm bônus. Pausa e 1×/2× usam tempo de simulação independente dos quadros.

O estado inicial continua em 1.000 apoiadores, legitimidade 35, coesão 65, fadiga 10, repressão 25, estabilidade 70 e caixa 100. Comparecimento é 45% menos 3 pontos percentuais por grupo completo de 10 de fadiga: 420 presentes iniciais. Há 24 entradas aos primeiros 24 pixels de cada rua inédita. Cada travessia após a terceira soma 3 de fadiga uma única vez e retira 1,5% dos presentes. Isso altera presença, não apoiadores.

Alcance integra presença × distância/240 × (1 + visibilidade/100), apenas sobre o percurso realizado. Conversão = clamp(20% + metade da legitimidade em pontos percentuais, 10%, 60%). Para limitar impressões repetidas, 18% do alcance é elegível para conversão. Desistências = 3% da base anterior + 2 por ponto de legitimidade perdido. Nova base = base anterior + adesões − desistências. O relatório separa entradas e saídas por desgaste, incidentes, polícia e dispersão.

Polícia usa três pontos de interceptação no percurso inicialmente anunciado. Desviar pode evitar as demais unidades. Encontros resolvidos não reaparecem; confrontos usam semente 42 e não exigem recursos violentos. A ocupação exige permanência, com pressão periódica abstrata; ainda não tem cercos ou contramedidas específicas. Capacidade das ruas é informativa, não um limite rígido da multidão. Não há campanha de 12 semanas, salvamento, economia funcional nem áudio.

## Validação

28 testes automatizados cobrem conectividade da cidade ampliada, variação e hierarquia das ruas, três percursos, todos os sete objetivos, ocupação sem conclusão antecipada, condição pacífica, polícia e dispersão, desvios sem teletransporte, impedimento de ruas fechadas, ausência de recrutamento/eventos duplicados, consumo de intervenções/cargas, resultados reproduzíveis, tempo independente dos quadros e saldo de apoiadores. `npm run build` valida tipos e produção.

No Chromium em viewport móvel de 390 × 844, foram executados marcha com desvio manual, ocupação com pausa no cronômetro, ato pacífico, confronto e dispersão. Os cenários concluíram sem erros JavaScript nem transbordamento horizontal. O HTML independente também concluiu uma marcha com três encontros e desvios, sem carregar recursos externos.

## Publicação

`.github/workflows/pages.yml` instala pelo lockfile, testa e executa `npm run build:html` em cada push para `main`. Publica `dist` pelo GitHub Pages quando o administrador tiver escolhido **Settings → Pages → Source: GitHub Actions**. A geração local não confirma publicação remota. O HTML também fica disponível no repositório para download direto.

## Próximos passos

1. Evoluir a polícia para patrulhas móveis, repressão territorial e respostas específicas durante ocupações.
2. Dar efeitos aos demais recursos, testar acessibilidade em aparelhos reais e balancear rotas longas.
3. Validar GDD/artes e implementar campanha de 12 semanas, economia e persistência.
