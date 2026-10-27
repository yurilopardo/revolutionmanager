import { describe, it, expect } from "vitest";
import { C, actions, attendanceRate, missions } from "./config";
import { CITY_HEIGHT, CITY_WIDTH, blocks, pois, road } from "./city";
import {
  Simulation,
  valid,
  presets,
  key,
  nodes,
  edges,
  length,
  node,
  findPath,
} from "./simulation";

type PoliceChoice = "disperse" | "confront" | "evade";
function untilEncounter(s: Simulation) {
  for (let i = 0; i < 1000 && !s.policeEncounter && !s.finished; i++)
    s.tick(0.1);
  expect(s.policeEncounter).toBeDefined();
  expect(s.paused).toBe(true);
}
function resolve(s: Simulation, choice: PoliceChoice = "evade") {
  if (s.policeEncounter) {
    expect(s.resolvePolice(choice)).toBe(true);
    if (choice === "evade") expect(s.reroute(s.suggest())).toBe(true);
  } else if (s.paused) expect(s.reroute(s.suggest())).toBe(true);
}
function arrive(s: Simulation, choice: PoliceChoice = "evade") {
  for (let i = 0; i < 2000 && s.phase === "marching" && !s.finished; i++) {
    resolve(s, choice);
    s.tick(0.1);
  }
  expect(s.phase).toBe("occupying");
  expect(s.completed).toBe(true);
  expect(s.finished).toBe(false);
  expect(s.paused).toBe(true);
  expect(s.occupationElapsed).toBe(0);
}
function occupationFixture(resources = ["Bandeiras e faixas", "Acolhimento"]) {
  const s = new Simulation(presets[0], resources);
  arrive(s);
  s.paused = false;
  return s;
}

describe("cidade compacta e escolhas de trajeto", () => {
  it("usa exatamente 24 cruzamentos em quatro colunas e seis linhas", () => {
    expect(nodes).toHaveLength(24);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(24);
    expect(new Set(nodes.map((n) => n.col)).size).toBe(4);
    expect(new Set(nodes.map((n) => n.row)).size).toBe(6);
    expect(CITY_HEIGHT).toBeGreaterThan(CITY_WIDTH);
    expect(node("A").y).toBeGreaterThan(node("I").y);
    expect(pois.some((p) => p.nodeId === "I" && p.kind === "praca")).toBe(true);
    expect(blocks.some((b) => b.kind === "park")).toBe(true);
  });
  it("oferece três percursos curtos e conectados com vantagens diferentes", () => {
    expect(presets).toHaveLength(3);
    expect(new Set(presets.map((p) => p.join(","))).size).toBe(3);
    const reached = new Set(["A"]),
      queue = ["A"];
    for (let i = 0; i < queue.length; i++)
      for (const [a, b] of edges) {
        const next = a === queue[i] ? b : b === queue[i] ? a : undefined;
        if (next && !reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    expect(reached.size).toBe(24);
    for (const p of presets) {
      expect(p[0]).toBe("A");
      expect(p.at(-1)).toBe("I");
      expect(valid(p, new Set())).toBe(true);
      expect(p.length - 1).toBeLessThanOrEqual(C.initialMaxCrossings);
    }
    const recruitment = presets.map((p) =>
      p.slice(1).reduce((sum, n, i) => sum + road(p[i], n).recruitment, 0),
    );
    const wear = presets.map((p) =>
      p.slice(1).reduce((sum, n, i) => sum + road(p[i], n).wear, 0),
    );
    expect(new Set(recruitment).size).toBeGreaterThan(1);
    expect(new Set(wear).size).toBeGreaterThan(1);
  });
  it("mantém ruas de tamanhos e hierarquias diferentes", () => {
    expect(
      new Set(edges.map(([a, b]) => Math.round(length(a, b)))).size,
    ).toBeGreaterThan(5);
    expect(
      new Set(edges.map(([a, b]) => road(a, b).kind)).size,
    ).toBeGreaterThanOrEqual(2);
    expect(valid(["A", "I"], new Set())).toBe(false);
    expect(valid(["desconhecido", "A"], new Set())).toBe(false);
    expect(
      valid(presets[0], new Set([key(presets[0][1], presets[0][2])])),
    ).toBe(false);
  });
});

describe("missão de ocupação legível", () => {
  it("expõe um único objetivo: manter 350 presentes durante 30 segundos", () => {
    expect(missions).toHaveLength(1);
    expect(missions[0]).toMatchObject({
      id: "occupation",
      type: "occupation",
      destination: "I",
      minPresent: 350,
      holdSeconds: 30,
    });
    expect(new Simulation().mission.id).toBe("occupation");
  });
  it("abre uma janela de decisão pausada ao chegar à praça", () => {
    const s = new Simulation();
    arrive(s);
    expect(s.paused).toBe(true);
    s.tick(15);
    expect(s.occupationElapsed).toBe(0);
    expect(s.occupationTotalElapsed).toBe(0);
    expect(s.canAct("coro")).toBe(true);
    expect(s.act("coro")).toBe(true);
    expect(s.occupationElapsed).toBe(0);
    expect(s.paused).toBe(true);
  });
  it("chegar à praça não completa instantaneamente a missão", () => {
    const s = occupationFixture();
    expect(s.occupationElapsed).toBeLessThan(s.mission.holdSeconds);
    expect(s.objectiveProgress).toBeLessThan(1);
    expect(s.objectiveSuccess).toBe(false);
    expect(s.canAct("coro")).toBe(true);
    expect(s.canAct("live")).toBe(true);
  });
  it("exige todo o período e congela o cronômetro durante a pausa", () => {
    const s = occupationFixture();
    s.present = 1000;
    s.cohesion = 100;
    s.paused = true;
    const elapsed = s.occupationElapsed;
    s.tick(10);
    expect(s.occupationElapsed).toBe(elapsed);
    s.paused = false;
    s.tick(s.mission.holdSeconds - s.occupationElapsed - 0.01);
    expect(s.finished).toBe(false);
    expect(s.objectiveSuccess).toBe(false);
    s.tick(0.02);
    expect(s.finished).toBe(true);
    expect(s.objectiveSuccess).toBe(true);
    const report = s.report();
    s.tick(100);
    expect(s.report()).toEqual(report);
  });
  it("perder a presença mínima interrompe a sequência de ocupação", () => {
    const s = occupationFixture();
    s.present = 1000;
    s.cohesion = 100;
    s.tick(5);
    expect(s.occupationElapsed).toBeGreaterThan(0);
    s.present = s.mission.minPresent - 1;
    s.tick(0.1);
    expect(s.occupationElapsed).toBe(0);
    expect(s.objectiveSuccess).toBe(false);
    s.present = 1000;
    s.tick(0.5);
    expect(s.occupationElapsed).toBeLessThan(1);
  });
  it("presença insuficiente não pode vencer só esperando o cronômetro", () => {
    const s = occupationFixture();
    s.present = s.mission.minPresent - 1;
    s.tick(120);
    expect(s.finished).toBe(true);
    expect(s.objectiveSuccess).toBe(false);
    expect(s.report().objectiveSuccess).toBe(false);
    expect(s.occupationTotalElapsed).toBeCloseTo(C.occupationMaxSeconds, 7);
  });
  it("acolhimento permite retomar a contagem sem devolver tempo perdido", () => {
    const s = occupationFixture();
    s.present = s.mission.minPresent - 10;
    s.leftWear += 40;
    s.tick(0.1);
    expect(s.occupationElapsed).toBe(0);
    expect(s.act("acolher")).toBe(true);
    expect(s.present).toBeGreaterThanOrEqual(s.mission.minPresent);
    expect(s.occupationElapsed).toBe(0);
    s.tick(0.25);
    expect(s.occupationElapsed).toBeCloseTo(0.25, 7);
  });
  it("intervenções mudam uma ocupação que fracassaria por desgaste", () => {
    const passive = occupationFixture(),
      active = occupationFixture();
    active.act("coro");
    active.act("live");
    passive.tick(120);
    active.tick(120);
    expect(passive.objectiveSuccess).toBe(false);
    expect(active.objectiveSuccess).toBe(true);
    expect(active.present).toBeGreaterThan(passive.present);
  });
  it("uma sequência de ações consegue sustentar uma ocupação completa", () => {
    const s = occupationFixture();
    expect(s.act("coro")).toBe(true);
    expect(s.act("live")).toBe(true);
    for (let i = 0; i < 500 && !s.finished; i++) s.tick(0.1);
    expect(s.finished).toBe(true);
    expect(s.objectiveSuccess).toBe(true);
    expect(s.present).toBeGreaterThanOrEqual(s.mission.minPresent);
  });
});

it("integra a pressão da ocupação independentemente do tamanho dos quadros", () => {
  const a = occupationFixture(),
    b = occupationFixture();
  a.present = b.present = 1000;
  a.cohesion = b.cohesion = 45;
  a.tick(12);
  for (let i = 0; i < 120; i++) b.tick(0.1);
  expect(a.present).toBe(b.present);
  expect(a.leftWear).toBe(b.leftWear);
  expect(a.cohesion).toBe(b.cohesion);
  expect(a.occupationElapsed).toBeCloseTo(b.occupationElapsed, 7);
  expect(a.occupationTotalElapsed).toBeCloseTo(b.occupationTotalElapsed, 7);
});

describe("função concreta das ações", () => {
  it("puxar coro melhora coesão e reduz a saída por desgaste", () => {
    const a = new Simulation(),
      b = new Simulation();
    a.police = [];
    b.police = [];
    expect(a.act("coro")).toBe(true);
    expect(a.cohesion).toBeGreaterThan(b.cohesion);
    const time = length(a.route[0], a.route[1]) / C.speed + 0.001;
    a.tick(time);
    b.tick(time);
    expect(a.leftWear).toBeLessThan(b.leftWear);
    expect(a.present).toBeGreaterThan(b.present);
    expect(a.interventions).toBe(C.interventions - actions.coro.cost);
    expect(a.lastActionEffect.length).toBeGreaterThan(0);
  });
  it("abrir faixa atrai pessoas, aumenta visibilidade e custa velocidade", () => {
    const a = new Simulation(),
      b = new Simulation();
    expect(a.act("faixa")).toBe(true);
    expect(a.present).toBeGreaterThan(b.present);
    expect(a.visibility).toBeGreaterThan(b.visibility);
    a.tick(0.5);
    b.tick(0.5);
    expect(a.distance).toBeLessThan(b.distance);
    expect(a.act("faixa")).toBe(false);
    expect(new Simulation(presets[0], []).act("faixa")).toBe(false);
  });
  it("transmitir ao vivo reduz perdas da repressão durante a ocupação", () => {
    const a = occupationFixture(),
      b = occupationFixture();
    a.present = b.present = 1000;
    a.cohesion = b.cohesion = 45;
    expect(a.act("live")).toBe(true);
    expect(a.mediaActive).toBe(true);
    a.tick(10);
    b.tick(10);
    expect(a.leftWear).toBeLessThan(b.leftWear);
    expect(a.present).toBeGreaterThan(b.present);
  });
  it("acolhimento recupera pessoas desgastadas com carga, sem criar adesões", () => {
    const s = occupationFixture();
    s.present -= 25;
    s.leftWear += 25;
    s.fatigue += 20;
    const before = s.present,
      joined = s.joined,
      fatigue = s.fatigue;
    expect(s.act("acolher")).toBe(true);
    expect(s.present).toBeGreaterThan(before);
    expect(s.present - before).toBeLessThanOrEqual(30);
    expect(s.fatigue).toBeLessThan(fatigue);
    expect(s.joined).toBe(joined);
    expect(s.careCharges).toBe(0);
    expect(s.act("acolher")).toBe(false);
  });
  it("acolhimento não recria pessoas que saíram por incidentes", () => {
    const s = new Simulation(presets[0], ["Acolhimento"]);
    s.present -= 20;
    s.leftIncidents = 20;
    const before = s.present;
    s.act("acolher");
    expect(s.present).toBe(before);
    expect(new Simulation(presets[0], []).act("acolher")).toBe(false);
  });
  it("preserva limite de duas ações e cobra intervenções e carga de bombas", () => {
    const s = new Simulation(presets[0], ["Bombas"]);
    expect(s.act("bombas")).toBe(true);
    expect(s.charges).toBe(C.bombCharges - 1);
    expect(s.interventions).toBe(C.interventions - actions.bombas.cost);
    expect(s.act("bombas")).toBe(false);
    expect(s.act("coro")).toBe(true);
    expect(s.act("live")).toBe(false);
    expect(s.interventions).toBe(
      C.interventions - actions.bombas.cost - actions.coro.cost,
    );
  });
  it("ações da caminhada não bloqueiam novas ações ao ocupar a praça", () => {
    const s = new Simulation();
    expect(s.act("coro")).toBe(true);
    arrive(s);
    expect(s.canAct("coro")).toBe(true);
    expect(s.act("coro")).toBe(true);
    expect(s.canAct("coro")).toBe(false);
  });
});

describe("polícia, continuidade e apuração", () => {
  it("faz um único encontro e preserva a posição e os pontos ao confirmar um desvio", () => {
    const s = new Simulation();
    expect(s.police).toHaveLength(1);
    untilEncounter(s);
    const position = { ...s.position },
      distance = s.distance,
      interventions = s.interventions;
    expect(s.resolvePolice("evade")).toBe(true);
    expect(s.paused).toBe(true);
    expect(valid(s.suggest(), s.blocked)).toBe(true);
    expect(s.reroute(s.suggest())).toBe(true);
    expect(s.position).toEqual(position);
    expect(s.distance).toBe(distance);
    expect(s.interventions).toBe(interventions);
    arrive(s);
    expect(s.policeEncounters).toBe(1);
  });
  it("impede cruzar a barricada e permite desviar do próprio cruzamento parado", () => {
    const s = new Simulation();
    untilEncounter(s);
    const anchor = s.anchor;
    s.resolvePolice("evade");
    s.paused = false;
    s.tick(100);
    expect(s.offset).toBe(0);
    expect(s.paused).toBe(true);
    expect(s.position).toMatchObject({ x: node(anchor).x, y: node(anchor).y });
    expect(s.reroute(s.suggest())).toBe(true);
    arrive(s);
  });
  it("confronto usa sorteio reproduzível e gera perdas distintas de desistências", () => {
    const a = new Simulation(),
      b = new Simulation();
    untilEncounter(a);
    untilEncounter(b);
    const prior = a.present;
    a.resolvePolice("confront");
    b.resolvePolice("confront");
    expect(a.present).toBeLessThan(prior);
    expect(a.present).toBe(b.present);
    expect(a.cohesion).toBe(b.cohesion);
    expect(a.leftPolice).toBeGreaterThan(0);
    expect(a.policeEncounter).toBeUndefined();
    expect(a.paused).toBe(false);
  });
  it("dispersar encerra o ato e conserva o alcance do resultado parcial", () => {
    const s = new Simulation();
    untilEncounter(s);
    const reach = s.reach;
    expect(s.resolvePolice("disperse")).toBe(true);
    expect(s.phase).toBe("dispersed");
    expect(s.finished).toBe(true);
    expect(s.present).toBe(0);
    expect(s.reach).toBe(reach);
    expect(s.objectiveSuccess).toBe(false);
    const r = s.report();
    expect(r.supporters).toBe(C.supporters + r.additions - r.departures);
  });
  it("revisitar uma rua não renova recrutamento nem as ações daquela rua", () => {
    const first = presets[0].slice(0, 2);
    const loop = [first[0], first[1], first[0], ...presets[0].slice(1)];
    const s = new Simulation(loop);
    s.police = [];
    expect(s.act("coro")).toBe(true);
    s.tick(length(first[0], first[1]) / C.speed + 0.001);
    expect(s.street).toBe(key(first[0], first[1]));
    expect(s.canAct("coro")).toBe(false);
    const joined = s.joined;
    s.tick(0.5);
    expect(s.joined).toBe(joined);
  });
  it("não repete o encontro resolvido quando a multidão retorna ao mesmo cruzamento", () => {
    const s = new Simulation();
    untilEncounter(s);
    expect(s.resolvePolice("confront")).toBe(true);
    const at = s.route[s.index],
      anchor = s.anchor;
    const returnPath = [
      anchor,
      at,
      anchor,
      ...findPath(
        anchor,
        s.mission.destination,
        s.blocked,
        C.maxCrossings,
      ).slice(1),
    ];
    expect(s.reroute(returnPath)).toBe(true);
    s.tick(100);
    expect(s.policeEncounters).toBe(1);
    expect(s.policeEncounter).toBeUndefined();
    expect(s.resolvePolice("confront")).toBe(false);
  });
  it("limita desvios e oferece encerramento quando não há caminho", () => {
    const s = new Simulation();
    untilEncounter(s);
    s.resolvePolice("evade");
    const neighbor = s.route[s.index];
    const huge = [
      s.anchor,
      ...Array.from({ length: C.maxCrossings }, () => [
        neighbor,
        s.anchor,
      ]).flat(),
      ...s.suggest().slice(1),
    ];
    const before = [...s.route];
    expect(s.reroute(huge)).toBe(false);
    expect(s.route).toEqual(before);
    for (const [a, b] of edges) s.blocked.add(key(a, b));
    expect(s.suggest()).toEqual([]);
    expect(s.reroute([])).toBe(false);
    s.end();
    expect(s.objectiveSuccess).toBe(false);
  });
  it("mantém movimento e alcance independentes da taxa de quadros", () => {
    const a = new Simulation(),
      b = new Simulation();
    a.tick(0.5);
    for (let i = 0; i < 30; i++) b.tick(1 / 60);
    expect(a.distance).toBeCloseTo(b.distance, 7);
    expect(a.reach).toBeCloseTo(b.reach, 7);
    expect(a.present).toBe(b.present);
    expect(a.joined).toBe(b.joined);
  });
  it("mantém saldo de apoiadores separado da presença e das saídas", () => {
    const s = new Simulation(presets[0], ["Bombas"]);
    expect(s.present).toBe(Math.floor(C.supporters * attendanceRate()));
    s.act("bombas");
    expect(s.leftIncidents).toBeGreaterThan(0);
    const r = s.report();
    expect(r.supporters).toBe(C.supporters + r.additions - r.departures);
    expect(r.balance).toBe(r.additions - r.departures);
    expect(r.departures).not.toBe(s.leftIncidents);
  });
  it("valida recursos e destino dentro da simulação", () => {
    expect(() => new Simulation(["A", "I"])).toThrow();
    expect(() => new Simulation(presets[0], ["Som", "Som"])).toThrow();
    expect(() => new Simulation(presets[0], ["inexistente"])).toThrow();
  });
});

it("a previsão da permanência corresponde ao resultado sem novas decisões", () => {
  const s = occupationFixture(["Som"]);
  s.act("coro");
  s.act("live");
  const forecast = s.occupationForecast;
  s.tick(s.mission.holdSeconds);
  expect(s.objectiveSuccess).toBe(true);
  expect(s.present).toBe(forecast);
});

it("o efeito de marcha da faixa termina no cruzamento e não renova em revisita", () => {
  const s = new Simulation();
  s.police = [];
  s.act("faixa");
  s.tick(
    length(presets[0][0], presets[0][1]) / (C.speed * C.flagSpeedMultiplier),
  );
  const b = presets[0][1];
  expect(s.reroute([b, "A", ...presets[0].slice(1)])).toBe(true);
  expect(s.canAct("faixa")).toBe(false);
  s.tick(0.5);
  expect(s.offset).toBeCloseTo(C.speed * 0.5, 7);
});
it("a previsão de desvio considera a marcha reduzida pela faixa no trecho atual", () => {
  const s = new Simulation();
  s.police = [];
  s.act("faixa");
  s.tick(0.5);
  const p = s.suggest(),
    current = length(s.route[s.index], s.anchor) - s.offset;
  const future = p.slice(1).reduce((sum, id, i) => sum + length(p[i], id), 0);
  expect(s.preview(p).seconds).toBe(
    Math.ceil(current / (C.speed * C.flagSpeedMultiplier) + future / C.speed),
  );
});
