# Revolution Manager

Protótipo de um ato em Aurora. TypeScript + Vite + Canvas 2D, sem backend e sem credenciais. Node 22+ recomendado.

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
npm run build
npm test
```

Acesse o endereço servido pelo Vite no seu ambiente de desenvolvimento. A interface adapta-se ao celular vertical; arraste o mapa e use +/− para zoom. Norte permanece fixo.

## Jogar e testar o desvio

1. Escolha um dos três percursos ou clique em **Redesenhar no mapa**, depois em cruzamentos vizinhos de A até I (3–5 ruas). Os botões **Seguir para** e **Voltar a** permitem editar também por teclado.
2. Selecione até três recursos. Bombas e bandeiras habilitam suas ações; os demais são preparatórios nesta versão.
3. Inicie. No meio da primeira rua uma barricada fecha a próxima rua e pausa a marcha, com semente fixa 42.
4. Clique em **Alterar trajeto**. O desvio sugerido aparece em verde; redesenhe clicando em cruzamentos ou confirme a sugestão. O trecho atual é preservado. Se a marcha já parou no cruzamento anterior à rua fechada, o desvio começa nesse cruzamento. No último trecho, é possível confirmar somente o destino. Cancelar preserva a pausa anterior.
5. Confirme o desvio e acompanhe a chegada. Use 2× para acelerar. Ações pedem confirmação e param o tempo enquanto se decide.
6. Leia o relatório e organize outro ato. É possível encerrar antes do destino.

## Arquitetura e regras provisórias

- `src/config.ts`: balanceamento inicial e definições das ações.
- `src/simulation.ts`: grafo, trajetos, tempo em segundos, estado, RNG determinístico e relatório, sem DOM.
- `src/main.ts`: interface e controles de câmera/planejamento.
- `src/renderer.ts`: desenho Canvas independente da interface; cada ponto representa até oito presentes. Bandeiras acompanham a seleção do recurso; a ação Abrir faixa desenha uma faixa, e grupos recém-chegados convergem pelas laterais.
- `src/simulation.test.ts`: invariantes e cenário completo.

GDD remoto indisponível (HTTP 403 durante a implementação); usadas as regras da solicitação. Artes não acessíveis. Arte procedural substituível, vista estritamente ortográfica.

Simplificações explícitas: 24 pessoas entram após os primeiros 24 pixels percorridos em uma rua inédita, com representação visual de entrada lateral; não se tornam apoiadores automaticamente. Desgaste após a terceira travessia remove 1,5% dos presentes e soma 3 de fadiga uma vez por travessia. Alcance integra presença × distância/240 × (1 + bônus de visibilidade/100), somente sobre a distância percorrida. Para evitar contar impressões repetidas como pessoas únicas, 18% desse alcance é elegível para conversão. Conversão = clamp(20% + legitimidade/2 pontos percentuais, 10%, 60%). Desistências = 3% da base + 2 por ponto de legitimidade perdido. Base final = base inicial + adesões − desistências. Bombas usam RNG LCG semente 42. Cada rua conserva limites de ações e recrutamento ao ser revisitada. Recursos não implementados não produzem bônus. Caixa, repressão e estabilidade ainda são referências, sem economia/campanha. Não há salvamento persistente nem áudio.

## Próximos passos

1. Validar fórmulas e linguagem visual contra GDD e artes com acesso autorizado.
2. Implementar efeitos dos demais recursos, eventos de bairro e maior variedade de protestos.
3. Campanha de 12 semanas, economia, persistência e balanceamento com playtests.

## Validação realizada

Build TypeScript/Vite e 15 testes Vitest. Fluxo da interface exercitado em Chromium headless em viewport 390 × 844: início, barricada, desvio sugerido confirmado, chegada, relatório e reinício; zero erros JavaScript e sem transbordamento horizontal. O relatório discrimina comparecimento inicial, entradas laterais e saídas por desgaste/incidentes; os valores finais de apoiadores derivam do alcance efetivamente integrado. Também validado: Abrir faixa, cancelar a edição preservando a pausa, continuar até o cruzamento fechado e redesenhar manualmente B → E → H → I. Captura desktop também inspecionada. Ferramenta de navegador usada externamente ao checkout; o teste de integração reproduzível da simulação está no Vitest.

## Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` instala dependências pelo lockfile, executa os testes, gera o build e publica `dist` a cada push em `main`. Os assets usam caminhos relativos para funcionar no subdiretório do repositório.

Na primeira publicação, um administrador deve selecionar **Settings → Pages → Build and deployment → Source: GitHub Actions**. Depois execute novamente o workflow **Testar e publicar protótipo** na aba Actions, se a execução inicial ocorreu antes da ativação. O job `deploy` fornece o endereço confirmado da publicação. Endereço padrão esperado: https://yurilopardo.github.io/revolutionmanager/ (só estará disponível após ativação do Pages e deploy bem-sucedido).
