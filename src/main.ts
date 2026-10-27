import { drawMap, getMapTransform } from "./renderer";
import "./style.css";
import { Simulation, nodes, presets, valid, findPath } from "./simulation";
import { pois, road, length } from "./city";
import {
  C,
  attendanceRate,
  actions,
  resources,
  missions,
  type Action,
} from "./config";

type PoliceChoice = "disperse" | "confront" | "evade";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><span class="mark">R/M</span><div><small>AURORA · UMA PRAÇA, UMA CAUSA</small><h1>Revolution Manager</h1></div><span class="tag">Uma missão curta. Cada decisão conta.</span></header><main><section class="map"><canvas aria-label="Mapa de Aurora em 4 por 6 cruzamentos. Arraste ou selecione cruzamentos para editar o trajeto."></canvas><div class="map-title"><b>AURORA</b><span>↑ N · distrito 4 × 6</span></div><div class="map-hint">Praça da União → Praça da Liberdade</div><div class="camera"><button id="minus" aria-label="Diminuir zoom">−</button><button id="plus" aria-label="Aumentar zoom">+</button><button id="overview">Ver distrito</button><button id="follow">Concentração</button></div><div class="legend"><span><i style="background:#d0b77e"></i>Avenida</span><span><i style="background:#82908c"></i>Rua</span><span><i style="background:#678e83"></i>Percorrida</span><span><i style="background:#eabe66"></i>Rota</span><span><i style="background:#68d8bf"></i>Desvio</span><span><i style="background:#ed6868"></i>Polícia</span></div></section><aside id="panel"></aside></main>`;
const canvas = document.querySelector("canvas")!;
const panel = document.querySelector<HTMLElement>("#panel")!;
let sim: Simulation | undefined;
const missionId = missions[0].id;
let route = [...presets[0]];
let selected = ["Bandeiras e faixas", "Som", "Acolhimento"];
let editing = false,
  draft: string[] = [],
  wasPaused = false,
  actionWasPaused = false;
let speed = 1,
  zoom = 1,
  pan = { x: 0, y: 0 },
  follow = false,
  overview = false;
let action: Action | undefined, policeChoice: PoliceChoice | undefined;
let feedback = "";
const mission = () => missions[0];
const place = (id: string) => pois.find((p) => p.nodeId === id)?.name ?? id;
const button = (id: string, label: string, cls = "") =>
  `<button id="${id}" class="${cls}">${label}</button>`;
const on = (id: string, fn: () => void) =>
  document.getElementById(id)?.addEventListener("click", fn);
const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
function syncCamera() {
  document.querySelector<HTMLElement>(".map-hint")!.hidden = overview;
  document.getElementById("follow")!.textContent = sim
    ? "Seguir multidão"
    : "Concentração";
  document.getElementById("follow")!.classList.toggle("selected", follow);
  document.getElementById("overview")!.classList.toggle("selected", overview);
}
function resetCamera() {
  overview = false;
  follow = false;
  zoom = 1;
  pan = { x: 0, y: 0 };
  syncCamera();
}
function autoRoute() {
  route = findPath(
    "A",
    mission().destination,
    new Set(),
    C.initialMaxCrossings,
  );
  feedback = route.length ? "" : "Não há caminho até a praça.";
}
function routeSummary(path: string[]) {
  return `<p class="route">${path.length ? `${place(path[0])} → ${place(path.at(-1)!)} · ${Math.max(0, path.length - 1)} travessias` : "Sem trajeto selecionado"}</p><details class="route-detail"><summary>Ver cruzamentos</summary><p>${path.join(" → ")}</p></details>`;
}
function routeChoices(path: string[]) {
  const last = path.at(-1);
  if (!last) return "";
  return `<nav class="route-choices" aria-label="Próximo cruzamento">${nodes
    .filter(
      (n) =>
        n.id === path.at(-2) || valid([last, n.id], sim?.blocked ?? new Set()),
    )
    .map(
      (n) =>
        `<button data-node="${n.id}">${n.id === path.at(-2) ? "↶ Voltar a" : "Seguir para"} ${place(n.id)}</button>`,
    )
    .join("")}</nav>`;
}
function chooseNode(id: string) {
  if (sim && !editing) return;
  const path = editing ? draft : route;
  if (path.at(-2) === id) path.pop();
  else if (
    path.at(-1) !== id &&
    valid([path.at(-1)!, id], sim?.blocked ?? new Set())
  )
    path.push(id);
  feedback = "";
  renderUI();
}
panel.addEventListener("click", (e) => {
  const item = (e.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-node]",
  );
  if (item) chooseNode(item.dataset.node!);
});
function openEditor() {
  if (!sim || sim.finished || sim.phase === "occupying") return;
  wasPaused = sim.paused;
  sim.paused = true;
  editing = true;
  draft = sim.suggest();
  action = undefined;
  policeChoice = undefined;
  feedback = "";
  renderUI();
}
const routeNames = ["Avenida central", "Pelo comércio", "Ruas do bairro"];
const routeDescriptions = [
  "Caminho direto e exposto. Recruta gente na avenida; a polícia pode obrigar um desvio.",
  "Mais gente pode se juntar, com maior desgaste. Chegue à praça com uma reserva de presentes.",
  "Menos entradas e menos desgaste. Preserve a coesão e guarde recursos para a praça.",
];
function routeForecast(path: string[]) {
  let distance = 0,
    joins = 0,
    wear = 0;
  for (let i = 1; i < path.length; i++) {
    distance += length(path[i - 1], path[i]);
    const r = road(path[i - 1], path[i]);
    joins += r.recruitment;
    wear += r.wear;
  }
  return `${Math.ceil(distance / C.speed)}s de marcha · até +${joins} entradas · desgaste acumulado ~${Math.round(wear * 100)}%`;
}
function actionDescription(id: Action) {
  return actions[id].description;
}
function actionConsequence(id: Action, s: Simulation) {
  if (id === "coro")
    return `Coesão +${C.coroCohesion + (s.resources.includes("Som") ? C.soundCohesionBonus : 0)}. Uma multidão organizada sofre menos saídas sob pressão. Durante a marcha, reduz o desgaste no restante desta rua pela metade.`;
  if (id === "faixa")
    return `Atrai mais ${C.flagExtraJoin} presentes e amplia a visibilidade em ${actions[id].visibility}. Tensão +${actions[id].tension}. Durante a marcha, reduz o ritmo em ${Math.round((1 - C.flagSpeedMultiplier) * 100)}% no restante do trecho. Use para formar uma reserva de pessoas.`;
  if (id === "live")
    return "Ativa a transmissão até o fim do ato. Na ocupação, reduz pela metade as saídas causadas pela pressão. Visibilidade também aumenta.";
  if (id === "acolher")
    return `Recupera até ${Math.min(C.careRestore, s.leftWear)} participantes que saíram por desgaste, inclusive durante a ocupação, e reduz a fadiga em ${C.careFatigue}; coesão +${C.careCohesion}. Consome uma carga de acolhimento (${s.careCharges} restante). Não recupera perdas policiais.`;
  return `Consome uma carga. Visibilidade +${actions[id].visibility}; tensão +${actions[id].tension}; ${C.incidentChance * 100}% de risco de incidente: saída de ${C.incidentLoss * 100}% dos presentes, −${C.incidentPenalty} de legitimidade e coesão. Pela postura pacífica, −${C.peacefulPenalty} adicionais em ambas. Não é necessário para ocupar a praça.`;
}
function actionCards(s: Simulation) {
  if (s.policeEncounter) return "";
  const available = (Object.keys(actions) as Action[]).some((id) =>
    s.canAct(id),
  );
  if (!available)
    return `<section class="action-section"><h3>Preparação deste local concluída</h3><p class="muted">Não há mais ações disponíveis neste momento. ${s.phase === "occupying" ? "Continue e acompanhe a presença e o contador." : "Prossiga até o próximo trecho para avaliar a situação."}</p></section>`;
  return `<section class="action-section"><h3>${s.phase === "occupying" ? "Sustente a ocupação" : "Use uma intervenção quando fizer diferença"}</h3><p class="muted">${s.interventions} de ${C.interventions} intervenções restantes · até ${C.maxActionsPerStreet} ações por rua ou na praça.</p><div class="actions purpose-actions">${(
    Object.keys(actions) as Action[]
  )
    .filter((id) => id !== "bombas" || s.resources.includes("Bombas"))
    .map(
      (id) =>
        `<button id="act${id}" ${s.canAct(id) ? "" : "disabled"}><span class="action-copy"><b>${actions[id].name}</b><span>${actionDescription(id)}</span>${!s.canAct(id) ? `<span class="action-blocked">${s.actionBlockReason(id)}</span>` : ""}</span><span class="action-cost">${actions[id].cost} ponto${actions[id].cost > 1 ? "s" : ""}${id === "acolher" ? ` · ${s.careCharges} carga` : id === "bombas" ? ` · ${s.charges} carga` : ""}</span></button>`,
    )
    .join("")}</div></section>`;
}
function renderUI() {
  syncCamera();
  if (!sim) {
    const m = mission();
    panel.innerHTML = `<small>01 / UMA MISSÃO</small><h2>Ocupe a praça.</h2><div class="mission-brief"><strong>${m.minPresent} pessoas × ${m.holdSeconds} segundos</strong><p>Leve a marcha à Praça da Liberdade e mantenha pelo menos ${m.minPresent} presentes por ${m.holdSeconds}s seguidos. Se o número cair abaixo do mínimo, a contagem recomeça. Você tem até ${C.occupationMaxSeconds}s no local para completar o objetivo.</p></div><ol class="play-loop"><li>Escolha um caminho e forme uma reserva de gente.</li><li>Responda ao bloqueio policial sem perder o objetivo.</li><li>Use suas ações para sustentar a presença na praça.</li></ol><h3>1. Escolha o caminho</h3><div class="route-cards" role="group" aria-label="Caminho da manifestação">${presets.map((p, i) => `<button id="route${i}" aria-pressed="${JSON.stringify(route) === JSON.stringify(p)}" class="${JSON.stringify(route) === JSON.stringify(p) ? "selected" : ""}"><b>${routeNames[i]}</b><span>${routeDescriptions[i]}</span><small>${routeForecast(p)}</small></button>`).join("")}</div><details class="custom-route"><summary>Personalizar o trajeto</summary><div class="row">${button("autoRoute", "Sugerir caminho")}${button("resetRoute", "Desenhar no mapa")}</div>${routeSummary(route)}${routeChoices(route)}</details><h3>2. Leve recursos <small>${selected.length}/${C.maxResources}</small></h3><div class="resources">${resources.map((r, i) => `<button id="res${i}" aria-pressed="${selected.includes(r)}" class="${selected.includes(r) ? "selected" : ""}">${r}</button>`).join("")}</div><p class="muted">Bandeiras atraem gente; som fortalece o coro; acolhimento recupera desgaste. Bombas aumentam o risco e não são necessárias para esta missão.</p><div class="start-readiness"><span><b>${Math.floor(C.supporters * attendanceRate())}</b> presentes no início</span><span><b>${C.interventions}</b> intervenções no ato</span></div><p class="coach-note">Guarde recursos para a praça: a pressão faz as pessoas saírem. Coro, acolhimento e transmissão ajudam a manter o mínimo.</p>${feedback ? `<p class="notice error" role="alert">${feedback}</p>` : ""}${button("start", "Iniciar manifestação →", "primary")}<p class="muted">Postura anunciada: pacífica · Semente ${C.seed} · Pausa e 2× disponíveis.</p>`;
    presets.forEach((p, i) =>
      on("route" + i, () => {
        route = [...p];
        feedback = "";
        renderUI();
      }),
    );
    resources.forEach((r, i) =>
      on("res" + i, () => {
        selected = selected.includes(r)
          ? selected.filter((x) => x !== r)
          : selected.length < C.maxResources
            ? [...selected, r]
            : selected;
        renderUI();
      }),
    );
    on("autoRoute", () => {
      autoRoute();
      renderUI();
    });
    on("resetRoute", () => {
      route = ["A"];
      feedback = "";
      renderUI();
    });
    on("start", () => {
      if (
        route[0] !== "A" ||
        route.at(-1) !== m.destination ||
        !valid(route, new Set(), C.initialMaxCrossings) ||
        route.length - 1 < C.initialMinCrossings
      ) {
        feedback = "Escolha ruas conectadas da concentração até a praça.";
        renderUI();
        return;
      }
      sim = new Simulation(route, selected, C.seed, true, missionId);
      follow = true;
      overview = false;
      zoom = 1;
      pan = { x: 0, y: 0 };
      renderUI();
    });
    return;
  }
  const s = sim,
    m = s.mission;
  if (s.finished) {
    const r = s.report();
    panel.innerHTML = `<small>03 / RESULTADO DA MISSÃO</small><h2>${r.objectiveSuccess ? "A praça resistiu." : "O que faltou para ficar?"}</h2><div class="objective-card ${r.objectiveSuccess ? "success" : ""}"><small>${r.objectiveSuccess ? "OBJETIVO CUMPRIDO" : "OBJETIVO NÃO CUMPRIDO"}</small><b>${Math.floor(s.occupationElapsed)} / ${m.holdSeconds}s com ${m.minPresent}+ presentes</b><span>${r.objective}</span></div><p>${s.message}</p><div class="stats"><div><b>${fmt(r.peak)}</b>Pico de presentes</div><div><b>${fmt(r.final)}</b>Presença final</div><div><b>${r.completion}%</b>Percurso</div><div><b>${fmt(r.reach)}</b>Alcance</div></div><div class="report"><p>Novas adesões <b>+${fmt(r.additions)}</b></p><p>Desistências <b>−${fmt(r.departures)}</b></p><p>Saldo de apoiadores <b>${r.balance >= 0 ? "+" : ""}${fmt(r.balance)}</b></p><p>Nova base <b>${fmt(r.supporters)}</b></p></div><p>Entradas na marcha: +${r.joined}. Retornos por acolhimento: +${r.recovered}. Saídas restantes por desgaste: −${r.leftWear}; por incidentes: −${r.leftIncidents}; por repressão: −${r.leftPolice}; por dispersão: −${r.leftDispersed}. Participar ou sair da rua não gera adesão ou desistência automática.</p><details><summary>Como foram calculados os apoiadores?</summary><p>Alcance deriva de presença, visibilidade e distância percorrida. Conversão: ${(r.conversion * 100).toFixed(1)}% de ${C.reachEligibility * 100}% do alcance. Desistência básica: ${C.resignation * 100}% da base, acrescida de perdas de legitimidade.</p></details>${button("restart", "Tentar outra estratégia", "primary")}`;
    on("restart", () => {
      sim = undefined;
      editing = false;
      action = undefined;
      policeChoice = undefined;
      speed = 1;
      feedback = "";
      resetCamera();
      renderUI();
    });
    return;
  }
  const occupying = s.phase === "occupying",
    margin = s.present - m.minPresent;
  panel.innerHTML = `<small>02 / ${editing ? "ESCOLHA O DESVIO" : s.policeEncounter ? "DECISÃO: REPRESSÃO" : occupying ? "SUSTENTE A OCUPAÇÃO" : s.paused ? "ATO PAUSADO" : "LEVE A MARCHA À PRAÇA"}</small><h2>${occupying ? "Mantenha a praça." : "Chegue com gente."}</h2><div class="stats core-stats"><div class="${margin < 30 ? "at-risk" : ""}"><b id="present">${fmt(s.present)}</b>Presentes / mínimo ${m.minPresent}</div><div><b>${fmt(s.cohesion)}</b>Coesão</div><div><b>${fmt(s.fatigue)}</b>Fadiga</div><div><b>${s.interventions}</b>Intervenções</div></div><div class="objective-card"><small>${occupying ? "PERMANÊNCIA COM O MÍNIMO" : "OBJETIVO: CHEGAR E OCUPAR"}</small><b id="hold-count">${Math.floor(s.occupationElapsed)} / ${m.holdSeconds}s</b><span id="objective-label">${s.objectiveLabel}</span><progress id="objective-progress" max="1" value="${s.objectiveProgress}"></progress><span class="presence-margin">${margin >= 0 ? `${margin} pessoas acima do mínimo` : `Faltam ${-margin} pessoas; recupere presença para contar o tempo.`}</span></div><div class="problem-card" role="status"><small>O QUE PRECISA DE ATENÇÃO</small><p id="problem-label">${s.problemLabel}</p>${occupying ? `<p class="pressure-forecast">Sem novas ações, a previsão ao completar a sequência é de <b>${s.occupationForecast} presentes</b>; o mínimo é ${m.minPresent}. A pressão ocorre a cada ${C.occupationPressureInterval}s.</p>` : ""}</div>${occupying && s.paused && s.occupationTotalElapsed === 0 ? `<p class="arrival-callout" role="status">Você chegou. Prepare a permanência, depois toque <b>Continuar</b>. O cronômetro ainda não começou.</p>` : ""}${s.lastActionEffect ? `<p class="action-result" role="status">${s.lastActionEffect}</p>` : ""}<div class="row transport-controls">${button("pause", s.paused ? "▶ Continuar" : "Ⅱ Pausar")}${button("speed", "Velocidade " + speed + "×")}<span class="muted">Percurso: <b id="progress">${Math.round(s.progress * 100)}%</b></span></div>${s.policeEncounter && !editing ? `<section class="police-panel" aria-label="Encontro com a polícia"><h3>A polícia bloqueia uma rua adiante</h3><p>A marcha parou antes da barricada. Desviar preserva a marcha; confrontar pode custar presentes; dispersar encerra o ato.</p><div class="responses">${button("police-evade", "Buscar outro percurso")}${button("police-confront", "Confrontar a repressão")}${button("police-disperse", "Dispersar o ato")}</div></section>` : ""}${editing ? `<h3>Desvio a partir de ${place(s.anchor)}</h3><p>Amarelo: rota atual. Verde: proposta. Sua posição e o avanço realizado permanecem.</p>${draft.length ? routeSummary(draft) : "<p>Sem caminho disponível. É possível encerrar e apurar o resultado parcial.</p>"}${draft.length ? `<p>Mais ${s.preview(draft).seconds}s de marcha · +${s.preview(draft).fatigue} fadiga · ${s.preview(draft).crossings}/${C.maxCrossings} travessias · rua mais estreita: ${s.preview(draft).capacity} pessoas.</p>` : ""}<div class="row">${button("suggest", "Sugerir desvio")}${button("clear", "Redesenhar")}</div>${draft.length ? routeChoices(draft) : ""}${button("confirm", "Confirmar desvio", "primary")}${button("cancel", "Cancelar")}` : `${!occupying ? button("edit", "Alterar trajeto", "secondary") : ""}${actionCards(s)}`}<p class="muted">${s.mediaActive ? "● Transmissão ativa: proteção contra saídas na praça." : "Transmissão inativa."} Tensão ${fmt(s.tension)} · Acolhimento ${s.careCharges} carga.</p>${action ? `<section class="confirmation" role="dialog" aria-label="Confirmar ação"><b>${actions[action].name}</b><p>Custo: ${actions[action].cost} intervenção(ões).</p><p>${actionConsequence(action, s)}</p>${button("yesAction", "Confirmar ação")}${button("noAction", "Voltar")}</section>` : ""}${policeChoice ? policeConfirmation(policeChoice) : ""}${feedback ? `<p class="notice error" role="alert">${feedback}</p>` : ""}<details class="event-detail"><summary>Último acontecimento</summary><p>${s.message}</p></details>${button("end", "Encerrar antecipadamente", "quiet")}`;
  on("pause", () => {
    if (editing || action || policeChoice || s.policeEncounter) return;
    s.paused = !s.paused;
    renderUI();
  });
  on("speed", () => {
    speed = speed === 1 ? 2 : 1;
    renderUI();
  });
  on("edit", () => {
    if (action || occupying) return;
    if (s.policeEncounter) {
      policeChoice = "evade";
      renderUI();
    } else openEditor();
  });
  on("suggest", () => {
    draft = s.suggest();
    feedback = "";
    renderUI();
  });
  on("clear", () => {
    draft = [s.anchor];
    feedback = "";
    renderUI();
  });
  on("confirm", () => {
    if (s.reroute(draft)) {
      editing = false;
      feedback = "";
      follow = true;
      overview = false;
      zoom = 1;
      pan = { x: 0, y: 0 };
    } else feedback = "Escolha um caminho aberto e conectado até a praça.";
    renderUI();
  });
  on("cancel", () => {
    editing = false;
    s.paused = wasPaused;
    feedback = "";
    renderUI();
  });
  on("end", () => {
    s.message =
      "O ato foi encerrado antes de sustentar o objetivo. O relatório considera o avanço realizado.";
    s.end();
    action = undefined;
    policeChoice = undefined;
    editing = false;
    renderUI();
  });
  (Object.keys(actions) as Action[]).forEach((id) =>
    on("act" + id, () => {
      if (s.policeEncounter || action || !s.canAct(id)) return;
      actionWasPaused = s.paused;
      action = id;
      s.paused = true;
      renderUI();
    }),
  );
  on("yesAction", () => {
    s.paused = false;
    if (action) s.act(action);
    s.paused = actionWasPaused;
    action = undefined;
    renderUI();
  });
  on("noAction", () => {
    action = undefined;
    s.paused = actionWasPaused;
    renderUI();
  });
  (["disperse", "confront", "evade"] as PoliceChoice[]).forEach((choice) =>
    on("police-" + choice, () => {
      policeChoice = choice;
      renderUI();
    }),
  );
  on("police-cancel", () => {
    policeChoice = undefined;
    renderUI();
  });
  on("police-confirm", () => {
    const choice = policeChoice;
    policeChoice = undefined;
    if (choice && s.resolvePolice(choice) && choice === "evade") openEditor();
    else renderUI();
  });
  (document.getElementById("pause") as HTMLButtonElement).disabled =
    editing || !!action || !!policeChoice || !!s.policeEncounter;
  if (action || policeChoice)
    requestAnimationFrame(() => {
      const dialog = panel.querySelector<HTMLElement>('[role="dialog"]');
      dialog?.scrollIntoView({ block: "nearest" });
      dialog
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
    });
}
function policeConfirmation(choice: PoliceChoice) {
  const descriptions = {
    disperse: [
      "Dispersar o ato",
      "Os presentes saem das ruas e a missão termina agora. O relatório preserva alcance e resultados parciais. Não transforma automaticamente participantes em desistentes.",
    ],
    confront: [
      "Confrontar a repressão",
      `Se a passagem abrir, saem ${C.confrontationSuccessLoss * 100}% dos presentes; se a repressão prevalecer, saem ${C.confrontationFailureLoss * 100}%. Tensão +${C.confrontationTension}, coesão −${C.confrontationCohesion}, legitimidade −${C.confrontationLegitimacy}, mais −${C.peacefulPenalty} de coesão e legitimidade pela postura pacífica. O resultado é abstrato e reproduzível. Não consome intervenção.`,
    ],
    evade: [
      "Buscar outro percurso",
      `O recuo faz ${C.evadeLoss} presentes saírem e reduz a coesão em ${C.evadeCohesion}; tensão +${C.evadeTension}. Abre a edição pausada por ruas conectadas e abertas, sem custo de intervenção. Preserva sua posição. A barricada continua existindo; o caminho pode ficar mais longo e desgastante.`,
    ],
  }[choice];
  return `<section class="confirmation" role="dialog" aria-label="Confirmar resposta à polícia"><b>${descriptions[0]}</b><p>${descriptions[1]}</p>${button("police-confirm", "Confirmar resposta")}${button("police-cancel", "Voltar")}</section>`;
}
let scale = 1,
  ox = 0,
  oy = 0,
  last = performance.now(),
  ui = 0;
const stateKey = () =>
  sim
    ? `${sim.paused}:${sim.finished}:${sim.index}:${sim.present}:${sim.message}:${sim.phase}:${!!sim.policeEncounter}:${sim.tension}:${sim.fatigue}:${sim.cohesion}:${sim.lastActionEffect}:${sim.mediaActive}`
    : "";
function frame(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (sim && !editing && !action && !policeChoice) {
    const before = stateKey();
    sim.tick(dt * speed);
    if (before !== stateKey()) renderUI();
    ui += dt;
    if (ui > 0.1) {
      ui = 0;
      const progress = document.getElementById("progress");
      if (progress) progress.textContent = `${Math.round(sim.progress * 100)}%`;
      const objective = document.getElementById(
        "objective-progress",
      ) as HTMLProgressElement | null;
      if (objective) objective.value = sim.objectiveProgress;
      const label = document.getElementById("objective-label");
      if (label) label.textContent = sim.objectiveLabel;
      const problem = document.getElementById("problem-label");
      if (problem) problem.textContent = sim.problemLabel;
      const hold = document.getElementById("hold-count");
      if (hold)
        hold.textContent = `${Math.floor(sim.occupationElapsed)} / ${sim.mission.holdSeconds}s`;
    }
  }
  ({ scale, ox, oy } = drawMap(canvas, now, {
    sim,
    route,
    draft,
    editing,
    zoom,
    pan,
    follow,
    overview,
    destination: sim?.mission.destination ?? mission().destination,
  }));
  requestAnimationFrame(frame);
}
function cameraBase(s: number) {
  const base = getMapTransform(canvas.clientWidth, canvas.clientHeight, {
    sim,
    route,
    draft,
    editing,
    zoom,
    pan: { x: 0, y: 0 },
    follow,
    overview,
    destination: mission().destination,
  });
  const ratio = s / base.scale;
  return {
    x: canvas.clientWidth / 2 - (canvas.clientWidth / 2 - base.ox) * ratio,
    y: canvas.clientHeight / 2 - (canvas.clientHeight / 2 - base.oy) * ratio,
  };
}
function stopFollow() {
  if (!follow) return;
  follow = false;
  overview = false;
  const base = cameraBase(scale);
  pan = { x: ox - base.x, y: oy - base.y };
  syncCamera();
}
function zoomAt(
  factor: number,
  x = canvas.clientWidth / 2,
  y = canvas.clientHeight / 2,
) {
  stopFollow();
  const next = Math.min(overview ? 8 : 3, Math.max(0.2, zoom * factor));
  const ratio = next / zoom;
  const wx = (x - ox) / scale,
    wy = (y - oy) / scale;
  const base = cameraBase(scale * ratio);
  pan = {
    x: x - wx * scale * ratio - base.x,
    y: y - wy * scale * ratio - base.y,
  };
  zoom = next;
}
on("plus", () => zoomAt(1.25));
on("minus", () => zoomAt(0.8));
on("overview", () => {
  overview = true;
  follow = false;
  zoom = 1;
  pan = { x: 0, y: 0 };
  syncCamera();
});
on("follow", () => {
  overview = false;
  zoom = 1;
  pan = { x: 0, y: 0 };
  follow = !!sim;
  syncCamera();
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const box = canvas.getBoundingClientRect();
    zoomAt(
      Math.exp(-e.deltaY * 0.001),
      e.clientX - box.left,
      e.clientY - box.top,
    );
  },
  { passive: false },
);
const pointers = new Map<number, { x: number; y: number }>();
let gesture:
  | { x: number; y: number; startX: number; startY: number; moved: boolean }
  | undefined;
let pinchDistance = 0;
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1)
    gesture = {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  else {
    if (gesture) gesture.moved = true;
    const p = [...pointers.values()];
    pinchDistance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size > 1) {
    const p = [...pointers.values()],
      d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
      box = canvas.getBoundingClientRect();
    if (pinchDistance)
      zoomAt(
        d / pinchDistance,
        (p[0].x + p[1].x) / 2 - box.left,
        (p[0].y + p[1].y) / 2 - box.top,
      );
    pinchDistance = d;
    return;
  }
  if (!gesture) return;
  const dx = e.clientX - gesture.x,
    dy = e.clientY - gesture.y;
  if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > 6) {
    stopFollow();
    gesture.moved = true;
  }
  if (gesture.moved) {
    pan.x += dx;
    pan.y += dy;
  }
  gesture.x = e.clientX;
  gesture.y = e.clientY;
});
canvas.addEventListener("pointerup", (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size) {
    if (gesture) {
      const remaining = [...pointers.values()][0];
      gesture.x = remaining.x;
      gesture.y = remaining.y;
      gesture.moved = true;
    }
    return;
  }
  if (gesture && !gesture.moved) {
    const box = canvas.getBoundingClientRect(),
      x = (e.clientX - box.left - ox) / scale,
      y = (e.clientY - box.top - oy) / scale;
    const nearest = nodes.reduce(
      (best, n) =>
        Math.hypot(n.x - x, n.y - y) < Math.hypot(best.x - x, best.y - y)
          ? n
          : best,
      nodes[0],
    );
    if (Math.hypot(nearest.x - x, nearest.y - y) < Math.max(28, 22 / scale))
      chooseNode(nearest.id);
  }
  gesture = undefined;
  pinchDistance = 0;
});
canvas.addEventListener("pointercancel", (e) => {
  pointers.delete(e.pointerId);
  gesture = undefined;
  pinchDistance = 0;
});
document.addEventListener("visibilitychange", () => (last = performance.now()));
renderUI();
requestAnimationFrame(frame);
