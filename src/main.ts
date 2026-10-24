import { drawMap } from "./renderer";
import "./style.css";
import { Simulation, nodes, presets, valid } from "./simulation";
import { C, attendanceRate, actions, resources, type Action } from "./config";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><span class="mark">R/M</span><div><small>CIDADE DE AURORA · PROTÓTIPO 01</small><h1>Revolution Manager</h1></div><span class="tag">O povo ocupa a cidade</span></header><main><section class="map"><canvas aria-label="Mapa da cidade. Selecione cruzamentos para planejar o trajeto."></canvas><div class="map-title"><b>AURORA</b><span>↑ N · vista vertical</span></div><div class="camera"><button id="minus" aria-label="Diminuir zoom">−</button><button id="plus" aria-label="Aumentar zoom">+</button><button id="follow">Seguir multidão</button></div><div class="legend"> <i style="background:#eabe66"></i> Rota <i style="background:#68d8bf"></i> Desvio <i style="background:#ed6868"></i> Bloqueio</div></section><aside id="panel"></aside></main>`;
const canvas = document.querySelector("canvas")!,
  panel = document.querySelector<HTMLElement>("#panel")!;
let sim: Simulation | undefined,
  route = [...presets[0]],
  selected = ["Bandeiras e faixas", "Som"],
  editing = false,
  draft: string[] = [],
  wasPaused = false,
  speed = 1,
  zoom = 1,
  pan = { x: 0, y: 0 },
  follow = false,
  peaceful = true,
  action: Action | undefined;
const button = (id: string, label: string, cls = "") =>
  `<button id="${id}" class="${cls}">${label}</button>`;
function on(id: string, fn: () => void) {
  document.getElementById(id)?.addEventListener("click", fn);
}
function routeChoices(path: string[]) {
  const lastNode = path.at(-1)!;
  return `<nav class="route-choices" aria-label="Próximo cruzamento">${nodes
    .filter(
      (n) =>
        n.id === path.at(-2) ||
        valid([lastNode, n.id], sim?.blocked ?? new Set()),
    )
    .map(
      (n) =>
        `<button data-node="${n.id}">${n.id === path.at(-2) ? "↶ Voltar a" : "Seguir para"} ${n.id}</button>`,
    )
    .join("")}</nav>`;
}
function chooseNode(id: string) {
  const p = editing ? draft : route;
  if (sim && !editing) return;
  if (p.at(-2) === id) p.pop();
  else if (p.at(-1) !== id && valid([p.at(-1)!, id], sim?.blocked ?? new Set()))
    p.push(id);
  renderUI();
}
panel.addEventListener("click", (e) => {
  const choice = (e.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-node]",
  );
  if (choice) chooseNode(choice.dataset.node!);
});
function renderUI() {
  if (!sim) {
    panel.innerHTML = `<small>01 / PREPARAÇÃO</small><h2>Uma cidade.<br>Mil vozes.</h2><p>Leve o movimento da Praça da União (A) até a Assembleia (I). Escolha ruas conectadas no mapa ou um percurso abaixo.</p><h3>Planeje o trajeto</h3><div class="row">${presets.map((_, i) => button("route" + i, ["Centro", "Jardins", "Ribeira"][i])).join("")}</div><p class="route">${route.join(" → ")} · ${route.length - 1} travessias</p>${button("resetRoute", "Redesenhar no mapa")}${routeChoices(route)}<h3>Recursos <small>${selected.length}/${C.maxResources}</small></h3><div class="resources">${resources.map((r, i) => `<button id="res${i}" class="${selected.includes(r) ? "selected" : ""}">${r}</button>`).join("")}</div><p class="muted">Som, acolhimento, bloco autônomo e fogos: efeitos ainda não implementados.</p><label><input type="checkbox" id="peace" ${peaceful ? "checked" : ""}> Postura anunciada: pacífica</label><div class="info">Base: ${C.supporters.toLocaleString("pt-BR")} apoiadores · Comparecimento: ${Math.round(attendanceRate() * 100)}%<br>Legitimidade ${C.legitimacy} · Coesão ${C.cohesion} · Fadiga ${C.fatigue}<br>Repressão ${C.repression} · Governo ${C.stability} · Caixa ${C.cash}</div>${button("start", "Iniciar manifestação →", "primary")}<p class="muted">Arraste para mover o mapa. Use os botões de zoom. Cenário reproduzível: semente ${C.seed}.</p>`;
    presets.forEach((p, i) =>
      on("route" + i, () => {
        route = [...p];
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
    on("resetRoute", () => {
      route = ["A"];
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
        route.at(-1) !== "I" ||
        !valid(route, new Set(), C.initialMaxCrossings) ||
        route.length - 1 < C.initialMinCrossings
      ) {
        alert("Escolha de 3 a 5 ruas conectadas, de A até I.");
        return;
      }
      sim = new Simulation(route, selected, C.seed, peaceful);
      follow = false;
      renderUI();
    });
    return;
  }
  const s = sim;
  if (s.finished) {
    const r = s.report();
    panel.innerHTML = `<small>03 / RELATÓRIO DO ATO</small><h2>${s.completed ? "A praça é nossa." : "Recuar também é decidir."}</h2><p>${s.completed ? "A manifestação chegou à Assembleia." : "O ato foi encerrado antecipadamente."}</p><div class="stats"><div><b>${r.peak}</b>Pico de presentes</div><div><b>${r.final}</b>Presença final</div><div><b>${r.completion}%</b>Percurso</div><div><b>${r.reach}</b>Alcance estimado</div></div><div class="report"><p>Novas adesões <b>+${r.additions}</b></p><p>Desistências <b>−${r.departures}</b></p><p>Saldo <b>${r.balance >= 0 ? "+" : ""}${r.balance}</b></p><p>Nova base <b>${r.supporters} apoiadores</b></p></div><p>Conversão de ${(r.conversion * 100).toFixed(1)}% sobre o alcance elegível (${C.reachEligibility * 100}% do alcance total). Desistência básica: ${C.resignation * 100}% da base, acrescida de perdas de legitimidade.</p><p>Comparecimento inicial: ${r.initial}. Entradas pelas laterais: +${r.joined}. Saídas por desgaste: −${r.leftWear}; por incidentes: −${r.leftIncidents}.<br>Entradas e saídas da rua alteram presentes; não representam adesões ou desistências automáticas. Fadiga final: ${s.fatigue}. Legitimidade: ${s.legitimacy}.</p>${button("restart", "Organizar outro ato", "primary")}`;
    on("restart", () => {
      sim = undefined;
      editing = false;
      route = [...presets[0]];
      speed = 1;
      zoom = 1;
      pan = { x: 0, y: 0 };
      follow = false;
      document.getElementById("follow")?.classList.remove("selected");
      action = undefined;
      renderUI();
    });
    return;
  }
  panel.innerHTML = `<small>02 / ${editing ? "EDIÇÃO DE DESVIO" : s.paused ? "MARCHA PAUSADA" : "NAS RUAS"}</small><h2>O movimento vive.</h2><div class="stats"><div><b id="present">${s.present}</b>Presentes</div><div><b id="progress">${Math.round(s.progress * 100)}%</b>Progresso</div><div><b>${s.tension}</b>Tensão</div><div><b>${s.interventions}</b>Intervenções</div></div><p class="notice">${s.message}</p><div class="row">${button("pause", s.paused ? "▶ Continuar" : "Ⅱ Pausar")}${button("speed", "Velocidade " + speed + "×")}</div>${editing ? `<h3>Desvio a partir de ${s.anchor}</h3><p>Toque nos cruzamentos conectados. A posição atual e a rua em andamento serão preservadas.</p><p class="route">${draft.join(" → ") || "Sem caminho disponível"}</p><p>${draft.length ? `Previsão: ${s.preview(draft).seconds}s · +${s.preview(draft).fatigue} fadiga · ${s.preview(draft).crossings}/${C.maxCrossings} travessias · capacidade restante ${s.preview(draft).capacity}` : "Sem caminho: encerre o ato."}</p><div class="row">${button("suggest", "Sugerir desvio")}${button("clear", "Redesenhar")}</div>${draft.length ? routeChoices(draft) : ""}${button("confirm", "Confirmar desvio", "primary")}${button("cancel", "Cancelar")}` : `${button("edit", "Alterar trajeto", "primary")}<h3>Ações na rua <small>máximo ${C.maxActionsPerStreet}</small></h3><div class="actions">${(Object.keys(actions) as Action[]).map((id) => `<button id="act${id}" ${s.canAct(id) ? "" : "disabled"}>${actions[id].name}<span>${actions[id].cost} ${actions[id].cost > 1 ? "intervenções" : "intervenção"}</span></button>`).join("")}</div><p class="muted">Bombas: ${s.charges} carga · Visibilidade nesta rua: +${s.visibility}<br>Coesão ${s.cohesion} · Fadiga ${s.fatigue}</p>`}${action ? `<div class="confirmation"><b>${actions[action].name}</b><p>Custo: ${actions[action].cost}. Visibilidade +${actions[action].visibility} no restante da rua; tensão +${actions[action].tension}; coesão +${actions[action].cohesion}.${action === "bombas" ? ` Consome 1 carga. ${C.incidentChance * 100}% de risco de danos graves: saída de ${C.incidentLoss * 100}%, −${C.incidentPenalty} legitimidade e coesão.${s.peaceful ? ` Postura pacífica: −${C.peacefulPenalty} adicionais em ambas.` : ""}` : ""}</p>${button("yesAction", "Confirmar ação")}${button("noAction", "Voltar")}</div>` : ""}${button("end", "Encerrar antecipadamente", "quiet")}`;
  on("pause", () => {
    if (editing || action) return;
    s.paused = !s.paused;
    renderUI();
  });
  on("speed", () => {
    speed = speed === 1 ? 2 : 1;
    renderUI();
  });
  on("edit", () => {
    if (action) return;
    wasPaused = s.paused;
    s.paused = true;
    editing = true;
    draft = s.suggest();
    action = undefined;
    renderUI();
  });
  on("suggest", () => {
    draft = s.suggest();
    renderUI();
  });
  on("clear", () => {
    draft = [s.anchor];
    renderUI();
  });
  on("confirm", () => {
    if (s.reroute(draft)) {
      editing = false;
      renderUI();
    } else
      alert(
        "Selecione um caminho aberto até I com no máximo 8 travessias totais.",
      );
  });
  on("cancel", () => {
    editing = false;
    s.paused = wasPaused;
    renderUI();
  });
  on("end", () => {
    s.end();
    action = undefined;
    editing = false;
    renderUI();
  });
  (Object.keys(actions) as Action[]).forEach((id) =>
    on("act" + id, () => {
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
}
let scale = 1,
  ox = 0,
  oy = 0;
let last = performance.now(),
  ui = 0;
function frame(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (sim && !editing && !action) {
    const before = `${sim.paused}:${sim.finished}:${sim.index}:${sim.present}:${sim.message}`;
    sim.tick(dt * speed);
    ui += dt;
    if (
      before !==
      `${sim.paused}:${sim.finished}:${sim.index}:${sim.present}:${sim.message}`
    ) {
      renderUI();
    }
    if (ui > 0.1) {
      ui = 0;
      const el = document.getElementById("progress");
      if (el) el.textContent = `${Math.round(sim.progress * 100)}%`;
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
  }));
  requestAnimationFrame(frame);
}
renderUI();
requestAnimationFrame(frame);
on("plus", () => (zoom = Math.min(2.6, zoom * 1.2)));
on("minus", () => (zoom = Math.max(0.65, zoom / 1.2)));
on("follow", () => {
  follow = !follow;
  document.getElementById("follow")!.classList.toggle("selected", follow);
});
let pointer:
  { x: number; y: number; startX: number; startY: number } | undefined;
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointer = {
    x: e.clientX,
    y: e.clientY,
    startX: e.clientX,
    startY: e.clientY,
  };
});
canvas.addEventListener("pointermove", (e) => {
  if (!pointer) return;
  const dx = e.clientX - pointer.x,
    dy = e.clientY - pointer.y;
  pan.x += dx;
  pan.y += dy;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 5)
    follow = false;
  document.getElementById("follow")?.classList.toggle("selected", follow);
});
canvas.addEventListener("pointerup", (e) => {
  if (!pointer) return;
  const moved = Math.hypot(
    e.clientX - pointer.startX,
    e.clientY - pointer.startY,
  );
  pointer = undefined;
  if (moved > 8) return;
  const rect = canvas.getBoundingClientRect(),
    x = (e.clientX - rect.left - ox) / scale,
    y = (e.clientY - rect.top - oy) / scale,
    n = nodes.find((n) => Math.hypot(n.x - x, n.y - y) < 30);
  if (!n) return;
  chooseNode(n.id);
});

canvas.addEventListener("pointercancel", () => {
  pointer = undefined;
});
document.addEventListener("visibilitychange", () => {
  last = performance.now();
});
