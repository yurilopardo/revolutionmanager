import { drawMap } from "./renderer";
import "./style.css";
import { Simulation, nodes, presets, valid, findPath } from "./simulation";
import { CITY_WIDTH, CITY_HEIGHT, node, pois } from "./city";
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
app.innerHTML = `<header><span class="mark">R/M</span><div><small>CIDADE DE AURORA · PROTÓTIPO 02</small><h1>Revolution Manager</h1></div><span class="tag">A cidade inteira está em disputa</span></header><main><section class="map"><canvas aria-label="Mapa vertical de Aurora. Arraste para navegar; selecione cruzamentos para editar o trajeto."></canvas><div class="map-title"><b>AURORA</b><span>↑ N · cidade viva, ruas irregulares</span></div><div class="map-hint">Arraste para explorar · use +/− ou dois dedos</div><div class="camera"><button id="minus" aria-label="Diminuir zoom">−</button><button id="plus" aria-label="Aumentar zoom">+</button><button id="overview">Cidade inteira</button><button id="follow">Concentração</button></div><div class="legend"><span><i style="background:#d0b77e"></i>Avenida</span><span><i style="background:#82908c"></i>Rua</span><span><i style="background:#678e83"></i>Percorrida</span><span><i style="background:#eabe66"></i>Rota</span><span><i style="background:#68d8bf"></i>Desvio</span><span><i style="background:#ed6868"></i>Polícia</span></div></section><aside id="panel"></aside></main>`;
const canvas = document.querySelector("canvas")!;
const panel = document.querySelector<HTMLElement>("#panel")!;
let sim: Simulation | undefined;
let missionId = missions[0].id;
let route = [...presets[0]];
let selected = ["Bandeiras e faixas", "Som"];
let editing = false,
  draft: string[] = [],
  wasPaused = false;
let speed = 1,
  zoom = 1,
  pan = { x: 0, y: 0 },
  follow = false,
  overview = false;
let peaceful = true,
  action: Action | undefined,
  policeChoice: PoliceChoice | undefined;
let feedback = "";
const mission = () => missions.find((m) => m.id === missionId)!;
const place = (id: string) => pois.find((p) => p.nodeId === id)?.name ?? id;
const button = (id: string, label: string, cls = "") =>
  `<button id="${id}" class="${cls}">${label}</button>`;
const on = (id: string, fn: () => void) =>
  document.getElementById(id)?.addEventListener("click", fn);
const fmt = (n: number) => n.toLocaleString("pt-BR");
function resetCamera() {
  overview = false;
  follow = false;
  zoom = 1;
  pan = { x: 0, y: 0 };
  syncCamera();
}
function syncCamera() {
  document.querySelector<HTMLElement>(".map-hint")!.hidden = overview;
  document.getElementById("follow")!.textContent = sim
    ? "Seguir multidão"
    : "Concentração";
  document.getElementById("follow")!.classList.toggle("selected", follow);
  document.getElementById("overview")!.classList.toggle("selected", overview);
}
function autoRoute() {
  route = findPath(
    "A",
    mission().destination,
    new Set(),
    C.initialMaxCrossings,
  );
  feedback = route.length ? "" : "Não foi encontrado caminho até o objetivo.";
}
function routeSummary(path: string[]) {
  return `<p class="route">${path.length ? `${place(path[0])} → ${place(path.at(-1)!)} · ${Math.max(0, path.length - 1)} travessias` : "Nenhum trajeto selecionado"}</p><details class="route-detail"><summary>Ver cruzamentos do trajeto</summary><p>${path.join(" → ")}</p></details>`;
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
  const p = editing ? draft : route;
  if (p.at(-2) === id) p.pop();
  else if (p.at(-1) !== id && valid([p.at(-1)!, id], sim?.blocked ?? new Set()))
    p.push(id);
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
  if (!sim || sim.finished) return;
  wasPaused = sim.paused;
  sim.paused = true;
  editing = true;
  draft = sim.suggest();
  action = undefined;
  policeChoice = undefined;
  feedback = "";
  renderUI();
}
function renderUI() {
  syncCamera();
  if (!sim) {
    const m = mission();
    panel.innerHTML = `<small>01 / ORGANIZE O ATO</small><h2>A cidade inteira.<br>Uma causa.</h2><p>Aurora se estende do cinturão industrial ao Congresso. Avenidas largas, ruas de bairro e praças oferecem caminhos e riscos diferentes.</p><h3>Qual é o objetivo?</h3><div class="missions" role="group" aria-label="Objetivo do protesto">${missions.map((x) => `<button id="mission-${x.id}" aria-pressed="${x.id === missionId}" class="${x.id === missionId ? "selected" : ""}"><b>${x.name}</b><span>${x.description}</span></button>`).join("")}</div><div class="objective-card"><small>DESTINO DO ATO</small><b>${place(m.destination)}</b><span>${m.type === "occupation" ? `Chegar e permanecer ${m.holdSeconds}s no local.` : m.description}</span></div><h3>Planeje o trajeto</h3><div class="row">${button("autoRoute", "Sugerir caminho")}${button("resetRoute", "Desenhar no mapa")}</div>${m.destination === presets[0].at(-1) ? `<div class="row preset-routes">${presets.map((_, i) => button("route" + i, ["Avenida central", "Pelos bairros", "Rota alternativa"][i])).join("")}</div>` : ""}${routeSummary(route)}${routeChoices(route)}<h3>Recursos <small>${selected.length}/${C.maxResources}</small></h3><div class="resources">${resources.map((r, i) => `<button id="res${i}" aria-pressed="${selected.includes(r)}" class="${selected.includes(r) ? "selected" : ""}">${r}</button>`).join("")}</div><p class="muted">Bandeiras e bombas habilitam ações. Os demais recursos ainda não oferecem bônus nesta versão.</p><label><input type="checkbox" id="peace" ${peaceful ? "checked" : ""} ${m.type === "peaceful" ? "disabled" : ""}> Postura anunciada: pacífica</label><div class="info">Base: ${fmt(C.supporters)} apoiadores · Comparecimento: ${Math.round(attendanceRate() * 100)}%<br>Legitimidade ${C.legitimacy} · Coesão ${C.cohesion} · Fadiga ${C.fatigue}<br>Repressão ${C.repression} · Governo ${C.stability} · Caixa ${C.cash}</div>${feedback ? `<p class="notice error" role="alert">${feedback}</p>` : ""}${button("start", "Iniciar manifestação →", "primary")}<p class="muted">Escolha o objetivo antes de partir. A polícia pode tentar interromper a marcha. Semente ${C.seed}: condições reproduzíveis para testes.</p>`;
    missions.forEach((x) =>
      on("mission-" + x.id, () => {
        missionId = x.id;
        if (x.type === "peaceful") peaceful = true;
        if (x.type === "confrontation") peaceful = false;
        autoRoute();
        renderUI();
      }),
    );
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
    document
      .getElementById("peace")
      ?.addEventListener(
        "change",
        (e) => (peaceful = (e.target as HTMLInputElement).checked),
      );
    on("start", () => {
      if (
        route[0] !== "A" ||
        route.at(-1) !== mission().destination ||
        !valid(route, new Set(), C.initialMaxCrossings) ||
        route.length - 1 < C.initialMinCrossings
      ) {
        feedback = `Escolha ruas conectadas da concentração até ${place(mission().destination)}, com até ${C.initialMaxCrossings} travessias.`;
        renderUI();
        return;
      }
      sim = new Simulation(route, selected, C.seed, peaceful, missionId);
      follow = true;
      overview = false;
      zoom = 1;
      pan = { x: 0, y: 0 };
      renderUI();
    });
    return;
  }
  const s = sim;
  if (s.finished) {
    const r = s.report();
    panel.innerHTML = `<small>03 / RELATÓRIO DO ATO</small><h2>${r.objectiveSuccess ? "A causa avançou." : "Recuar também é decidir."}</h2><div class="objective-card ${r.objectiveSuccess ? "success" : ""}"><small>${r.objectiveSuccess ? "OBJETIVO CUMPRIDO" : "OBJETIVO NÃO CUMPRIDO"}</small><b>${s.mission.name}</b><span>${r.objective}</span></div><p>${s.message}</p><div class="stats"><div><b>${fmt(r.peak)}</b>Pico de presentes</div><div><b>${fmt(r.final)}</b>Presença final</div><div><b>${r.completion}%</b>Percurso</div><div><b>${fmt(r.reach)}</b>Alcance estimado</div></div><div class="report"><p>Novas adesões <b>+${fmt(r.additions)}</b></p><p>Desistências <b>−${fmt(r.departures)}</b></p><p>Saldo <b>${r.balance >= 0 ? "+" : ""}${fmt(r.balance)}</b></p><p>Nova base <b>${fmt(r.supporters)} apoiadores</b></p><p>Encontros com a polícia <b>${r.policeEncounters}</b></p></div><p>Conversão de ${(r.conversion * 100).toFixed(1)}% sobre o alcance elegível (${C.reachEligibility * 100}% do alcance total). Desistência básica: ${C.resignation * 100}% da base, acrescida de perdas de legitimidade.</p><p>Comparecimento inicial: ${r.initial}. Entradas laterais: +${r.joined}. Saídas por desgaste: −${r.leftWear}; por incidentes: −${r.leftIncidents}; por repressão: −${r.leftPolice}; por dispersão: −${r.leftDispersed}. Entrar ou sair da rua não altera automaticamente a base de apoiadores.</p><p>Fadiga final ${s.fatigue} · Legitimidade ${s.legitimacy} · Coesão ${s.cohesion}</p>${button("restart", "Organizar outro ato", "primary")}`;
    on("restart", () => {
      sim = undefined;
      editing = false;
      action = undefined;
      policeChoice = undefined;
      speed = 1;
      feedback = "";
      autoRoute();
      resetCamera();
      renderUI();
    });
    return;
  }
  const occupying = s.phase === "occupying";
  panel.innerHTML = `<small>02 / ${editing ? "EDIÇÃO DE DESVIO" : s.policeEncounter ? "REPRESSÃO POLICIAL" : occupying ? "OCUPANDO O ESPAÇO" : s.paused ? "MARCHA PAUSADA" : "NAS RUAS"}</small><h2>${occupying ? "Permanecer é resistir." : "O movimento vive."}</h2><div class="stats"><div><b id="present">${fmt(s.present)}</b>Presentes</div><div><b id="progress">${Math.round(s.progress * 100)}%</b>Percurso</div><div><b>${s.tension}</b>Tensão</div><div><b>${s.interventions}</b>Intervenções</div></div><div class="objective-card"><small>OBJETIVO · ${s.mission.name}</small><b>${place(s.mission.destination)}</b><span id="objective-label">${s.objectiveLabel}</span><progress id="objective-progress" max="1" value="${s.objectiveProgress}"></progress></div><p class="notice" role="status">${s.message}</p><div class="row">${button("pause", s.paused ? "▶ Continuar" : "Ⅱ Pausar")}${button("speed", "Velocidade " + speed + "×")}</div>${s.policeEncounter && !editing ? `<section class="police-panel" aria-label="Encontro com a polícia"><small>DECISÃO DO MOVIMENTO</small><h3>A polícia tenta reprimir o ato</h3><p>Há uma unidade em ${place(s.policeEncounter.nodeId)}. Força: ${s.policeEncounter.strength}. A simulação está pausada. Escolha como responder.</p><div class="responses">${button("police-disperse", "Dispersar o ato")}${button("police-confront", "Confrontar a repressão")}${button("police-evade", "Buscar outro percurso")}</div><p class="muted">Confrontos e danos são resolvidos como efeitos abstratos da simulação.</p></section>` : ""}${editing ? `<h3>Desvio a partir de ${place(s.anchor)}</h3><p>Escolha ruas conectadas e abertas. O avanço realizado permanece. A rota atual está em amarelo; o desvio aparece em verde.</p>${draft.length ? routeSummary(draft) : "<p>Sem caminho disponível. Você pode encerrar o ato e apurar o resultado parcial.</p>"}${draft.length ? `<p>Previsão: ${s.preview(draft).seconds}s · +${s.preview(draft).fatigue} fadiga · ${s.preview(draft).crossings}/${C.maxCrossings} travessias · capacidade da rua mais estreita: ${s.preview(draft).capacity} pessoas · ${s.preview(draft).remainingCrossings} travessias disponíveis</p>` : ""}<div class="row">${button("suggest", "Sugerir desvio")}${button("clear", "Redesenhar")}</div>${draft.length ? routeChoices(draft) : ""}${button("confirm", "Confirmar desvio", "primary")}${button("cancel", "Cancelar")}` : occupying ? '<p class="muted">A multidão chegou. Mantenha a ocupação até completar o tempo indicado. Pausar não avança o objetivo.</p>' : `${button("edit", "Alterar trajeto", "primary")}<h3>Ações na rua <small>máximo ${C.maxActionsPerStreet}</small></h3><div class="actions">${(Object.keys(actions) as Action[]).map((id) => `<button id="act${id}" ${s.canAct(id) ? "" : "disabled"}>${actions[id].name}<span>${actions[id].cost} ${actions[id].cost > 1 ? "intervenções" : "intervenção"}</span></button>`).join("")}</div><p class="muted">Bombas: ${s.charges} carga · Visibilidade nesta rua: +${s.visibility}<br>Coesão ${s.cohesion} · Fadiga ${s.fatigue}</p>`}${action ? `<section class="confirmation" role="dialog" aria-label="Confirmar ação"><b>${actions[action].name}</b><p>Custo: ${actions[action].cost} intervenção(ões). Visibilidade +${actions[action].visibility} no restante da rua; tensão +${actions[action].tension}; coesão +${actions[action].cohesion}.${action === "bombas" ? ` Consome 1 carga. ${C.incidentChance * 100}% de risco de danos graves: saída de ${C.incidentLoss * 100}%, −${C.incidentPenalty} legitimidade e coesão.${s.peaceful ? ` Postura pacífica: −${C.peacefulPenalty} adicionais em ambas.` : ""}` : ""}</p>${button("yesAction", "Confirmar ação")}${button("noAction", "Voltar")}</section>` : ""}${policeChoice ? policeConfirmation(policeChoice) : ""}${feedback ? `<p class="notice error" role="alert">${feedback}</p>` : ""}${button("end", "Encerrar antecipadamente", "quiet")}`;
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
      renderUI();
    } else {
      feedback = `Selecione ruas abertas até ${place(s.mission.destination)}, respeitando ${C.maxCrossings} travessias totais.`;
      renderUI();
    }
  });
  on("cancel", () => {
    editing = false;
    s.paused = wasPaused;
    feedback = "";
    renderUI();
  });
  on("end", () => {
    s.message =
      "O ato foi encerrado antes de cumprir o objetivo. O relatório considera o avanço realizado.";
    s.end();
    action = undefined;
    policeChoice = undefined;
    editing = false;
    renderUI();
  });
  (Object.keys(actions) as Action[]).forEach((id) =>
    on("act" + id, () => {
      if (!s.canAct(id)) return;
      action = id;
      s.paused = true;
      renderUI();
    }),
  );
  on("yesAction", () => {
    s.paused = false;
    if (action) s.act(action);
    action = undefined;
    renderUI();
  });
  on("noAction", () => {
    action = undefined;
    s.paused = false;
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
    if (choice && s.resolvePolice(choice)) {
      if (choice === "evade") openEditor();
      else renderUI();
    } else renderUI();
  });
  const pause = document.getElementById("pause") as HTMLButtonElement;
  pause.disabled = editing || !!action || !!policeChoice || !!s.policeEncounter;
  if (action || policeChoice) {
    requestAnimationFrame(() => {
      const dialog = panel.querySelector<HTMLElement>('[role="dialog"]');
      dialog?.scrollIntoView({ block: "nearest" });
      dialog
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
    });
  }
}
function policeConfirmation(choice: PoliceChoice) {
  const descriptions = {
    disperse: [
      "Dispersar o ato",
      "Encerra a manifestação agora. Os presentes deixam as ruas; o relatório preserva alcance e resultado parcial. O objetivo pode não ser cumprido.",
    ],
    confront: [
      "Confrontar a repressão",
      `Saída de ${C.confrontationSuccessLoss * 100}% dos presentes se a passagem for liberada, ou ${C.confrontationFailureLoss * 100}% se a repressão prevalecer. Tensão +${C.confrontationTension}, coesão −${C.confrontationCohesion}, legitimidade −${C.confrontationLegitimacy}.${sim?.peaceful ? ` Pela postura pacífica anunciada: −${C.peacefulPenalty} adicionais em legitimidade e coesão.` : ""} O resultado depende da força policial e de sorteio reproduzível. Não consome intervenção.`,
    ],
    evade: [
      "Buscar outro percurso",
      "Abre o planejamento de um desvio por ruas abertas. Preserva a posição da multidão e não consome intervenções. A marcha permanece pausada durante a edição.",
    ],
  }[choice];
  return `<section class="confirmation police-confirmation" role="dialog" aria-label="Confirmar resposta à polícia"><b>${descriptions[0]}</b><p>${descriptions[1]}</p>${button("police-confirm", "Confirmar resposta")}${button("police-cancel", "Voltar")}</section>`;
}
let scale = 1,
  ox = 0,
  oy = 0,
  last = performance.now(),
  ui = 0;
const stateKey = () =>
  sim
    ? `${sim.paused}:${sim.finished}:${sim.index}:${sim.present}:${sim.message}:${sim.phase}:${!!sim.policeEncounter}:${sim.tension}:${sim.fatigue}`
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
  const n = overview ? { x: CITY_WIDTH / 2, y: CITY_HEIGHT / 2 } : node("A");
  return {
    x: canvas.clientWidth / 2 - n.x * s,
    y: canvas.clientHeight / 2 - n.y * s,
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
