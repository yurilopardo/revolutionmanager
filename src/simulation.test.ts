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
    s.tick(0.25);
  expect(s.policeEncounter).toBeDefined();
  expect(s.paused).toBe(true);
}

function finish(s: Simulation, choice: PoliceChoice = "evade") {
  for (let i = 0; i < 3000 && !s.finished; i++) {
    if (s.policeEncounter) {
      expect(s.resolvePolice(choice)).toBe(true);
      if (choice === "evade") {
        const diversion = s.suggest();
        expect(diversion.length).toBeGreaterThan(0);
        expect(s.reroute(diversion)).toBe(true);
      }
    } else if (s.paused) {
      expect(s.reroute(s.suggest())).toBe(true);
    }
    s.tick(1);
  }
  expect(s.finished).toBe(true);
}

function forMission(id: string) {
  const mission = missions.find((m) => m.id === id)!;
  const path = findPath(
    "A",
    mission.destination,
    new Set(),
    C.initialMaxCrossings,
  );
  return new Simulation(path, ["Bandeiras e faixas"], C.seed, true, id);
}

describe("cidade vertical e grafo irregular", () => {
  it("possui cerca de 10×20 cruzamentos, bairros e lugares de interesse", () => {
    expect(nodes.length).toBeGreaterThanOrEqual(180);
    expect(nodes.length).toBeLessThanOrEqual(220);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
    expect(CITY_HEIGHT / CITY_WIDTH).toBeGreaterThan(1.7);
    expect(node("A").y).toBeGreaterThan(node("I").y);
    expect(pois.length).toBeGreaterThanOrEqual(7);
    expect(pois.some((p) => p.kind === "igreja")).toBe(true);
    expect(pois.some((p) => p.kind === "jornal")).toBe(true);
    expect(blocks.some((b) => b.kind === "park")).toBe(true);
  });
  it("distingue avenidas, ruas, passagens e quadras de formatos variados", () => {
    const kinds = new Set(edges.map(([a, b]) => road(a, b).kind));
    expect([...kinds].sort()).toEqual(["alley", "avenue", "street"]);
    const sizes = new Set(edges.map(([a, b]) => Math.round(length(a, b))));
    expect(sizes.size).toBeGreaterThan(15);
    expect(blocks.some((b) => b.points.length === 3)).toBe(true);
    expect(
      edges.some(
        ([a, b]) =>
          Math.abs(node(a).x - node(b).x) > 80 &&
          Math.abs(node(a).y - node(b).y) > 80,
      ),
    ).toBe(true);
  });
  it("mantém todo o grafo conectado e três percursos distintos até o Congresso", () => {
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
    expect(reached.size).toBe(nodes.length);
    expect(new Set(presets.map((p) => p.join(","))).size).toBe(3);
    for (const path of presets) {
      expect(valid(path, new Set())).toBe(true);
      expect(path[0]).toBe("A");
      expect(path.at(-1)).toBe("I");
      expect(path.length).toBeGreaterThan(10);
    }
  });
  it("recusa saltos entre cruzamentos e ruas bloqueadas", () => {
    expect(valid(["A", "I"], new Set())).toBe(false);
    expect(valid(["desconhecido", "A"], new Set())).toBe(false);
    const p = presets[0];
    expect(valid(p, new Set([key(p[1], p[2])]))).toBe(false);
  });
});

describe("marcha, polícia e desvio", () => {
  it("encontra barricada e segue desvio sem teletransporte ou gasto de intervenção", () => {
    const s = new Simulation();
    untilEncounter(s);
    const position = { ...s.position },
      distance = s.distance,
      interventions = s.interventions;
    expect(s.resolvePolice("evade")).toBe(true);
    expect(s.paused).toBe(true);
    const path = s.suggest();
    expect(valid(path, s.blocked)).toBe(true);
    expect(s.reroute(path)).toBe(true);
    expect(s.position).toEqual(position);
    expect(s.distance).toBe(distance);
    expect(s.interventions).toBe(interventions);
    finish(s);
    expect(s.completed).toBe(true);
    expect(s.report().objectiveSuccess).toBe(true);
  });
  it("não cruza barricada mesmo que uma pausa seja removida manualmente", () => {
    const s = new Simulation();
    untilEncounter(s);
    const ahead = key(s.route[s.index + 1], s.route[s.index + 2]);
    expect(s.blocked.has(ahead)).toBe(true);
    s.resolvePolice("evade");
    s.paused = false;
    s.tick(100);
    expect(s.index).toBe(1);
    expect(s.offset).toBe(0);
    expect(s.paused).toBe(true);
    expect(s.position).toEqual({
      x: node(s.route[1]).x,
      y: node(s.route[1]).y,
    });
    expect(s.reroute(s.suggest())).toBe(true);
    finish(s);
  });
  it("dispersar encerra o ato sem transformar presentes em desistentes automáticos", () => {
    const s = new Simulation();
    untilEncounter(s);
    expect(s.resolvePolice("disperse")).toBe(true);
    expect(s.finished).toBe(true);
    expect(s.phase).toBe("dispersed");
    expect(s.completed).toBe(false);
    expect(s.report().objectiveSuccess).toBe(false);
    expect(s.report().completion).toBeLessThan(100);
    const r = s.report();
    expect(r.supporters).toBe(C.supporters + r.additions - r.departures);
  });
  it("confronto é abstrato, reproduzível e libera a via com consequências", () => {
    const a = new Simulation(),
      b = new Simulation();
    untilEncounter(a);
    untilEncounter(b);
    const prior = a.present;
    expect(a.resolvePolice("confront")).toBe(true);
    expect(b.resolvePolice("confront")).toBe(true);
    expect(a.policeEncounter).toBeUndefined();
    expect(a.present).toBeLessThan(prior);
    expect(a.present).toBe(b.present);
    expect(a.cohesion).toBe(b.cohesion);
    expect(a.legitimacy).toBe(b.legitimacy);
    expect(a.tension).toBeGreaterThan(C.initialTension);
    expect(a.paused).toBe(false);
    finish(a, "confront");
    expect(a.completed).toBe(true);
  });
  it("preserva ações e recrutamento ao retornar pela mesma rua", () => {
    const s = new Simulation();
    s.act("coro");
    untilEncounter(s);
    s.resolvePolice("evade");
    const back = [
      "A",
      ...findPath(
        "A",
        s.mission.destination,
        s.blocked,
        C.initialMaxCrossings,
      ).slice(1),
    ];
    expect(s.reroute([s.anchor, ...back])).toBe(true);
    s.tick(
      (length(s.route[s.index], s.route[s.index + 1]) - s.offset) / C.speed +
        0.001,
    );
    expect(s.street).toBe(key("A", presets[0][1]));
    expect(s.canAct("coro")).toBe(false);
    const joined = s.joined,
      encounters = s.policeEncounters;
    s.tick(0.4);
    expect(s.joined).toBe(joined);
    expect(s.policeEncounters).toBe(encounters);
    expect(s.police.filter((p) => p.encountered)).toHaveLength(encounters);
  });
  it("aumentar o percurso recalcula progresso sem apagar a distância já andada", () => {
    const s = new Simulation();
    untilEncounter(s);
    s.resolvePolice("evade");
    const before = s.progress,
      distance = s.distance;
    const longer = [
      s.anchor,
      "A",
      ...findPath(
        "A",
        s.mission.destination,
        s.blocked,
        C.initialMaxCrossings,
      ).slice(1),
    ];
    expect(s.reroute(longer)).toBe(true);
    expect(s.distance).toBe(distance);
    expect(s.progress).toBeLessThan(before);
  });
  it("não aceita desvio além da capacidade e permite encerrar sem caminho disponível", () => {
    const s = new Simulation();
    untilEncounter(s);
    s.resolvePolice("evade");
    const original = [...s.route];
    const huge = [
      s.anchor,
      ...Array.from({ length: C.maxCrossings + 1 }, () => [
        "A",
        s.anchor,
      ]).flat(),
      ...s.suggest().slice(1),
    ];
    expect(s.reroute(huge)).toBe(false);
    expect(s.route).toEqual(original);
    for (const [a, b] of edges) s.blocked.add(key(a, b));
    expect(s.suggest()).toEqual([]);
    expect(s.reroute([])).toBe(false);
    s.end();
    expect(s.finished).toBe(true);
    expect(s.report().objectiveSuccess).toBe(false);
  });
  it("integra movimento e alcance independentemente da taxa de quadros", () => {
    const a = new Simulation(),
      b = new Simulation();
    untilEncounter(a);
    untilEncounter(b);
    a.resolvePolice("evade");
    b.resolvePolice("evade");
    a.reroute(a.suggest());
    b.reroute(b.suggest());
    a.tick(0.5);
    for (let i = 0; i < 30; i++) b.tick(1 / 60);
    expect(a.distance).toBeCloseTo(b.distance, 7);
    expect(a.reach).toBeCloseTo(b.reach, 7);
    expect(a.present).toBe(b.present);
    expect(a.joined).toBe(b.joined);
  });
});

describe("objetivos de cada protesto", () => {
  for (const mission of missions)
    it(`apura o objetivo: ${mission.name}`, () => {
      const s = forMission(mission.id);
      finish(s, mission.type === "confrontation" ? "confront" : "evade");
      expect(s.completed).toBe(true);
      expect(s.report().objectiveSuccess).toBe(true);
      expect(s.report().objective.length).toBeGreaterThan(0);
      expect(s.objectiveProgress).toBe(1);
    });
  it("ocupar exige permanecer no local por todo o tempo definido", () => {
    const mission = missions.find((m) => m.type === "occupation")!,
      s = forMission(mission.id);
    for (let i = 0; i < 2000 && s.phase !== "occupying" && !s.finished; i++) {
      if (s.policeEncounter) {
        s.resolvePolice("evade");
        s.reroute(s.suggest());
      }
      s.tick(0.25);
    }
    expect(s.phase).toBe("occupying");
    expect(s.finished).toBe(false);
    // Entrar no local não deve cumprir a ocupação instantaneamente.
    expect(s.objectiveProgress).toBeLessThan(1);
    s.tick(mission.holdSeconds - s.occupationElapsed - 0.01);
    expect(s.finished).toBe(false);
    expect(s.report().objectiveSuccess).toBe(false);
    s.tick(0.02);
    expect(s.finished).toBe(true);
    expect(s.report().objectiveSuccess).toBe(true);
  });
  it("chegar após confronto não cumpre uma manifestação pacífica", () => {
    const mission = missions.find((m) => m.type === "peaceful")!,
      s = forMission(mission.id);
    finish(s, "confront");
    expect(s.completed).toBe(true);
    expect(s.report().objectiveSuccess).toBe(false);
  });
  it("bombas invalidam a condição pacífica mesmo sem confronto policial", () => {
    const mission = missions.find((m) => m.type === "peaceful")!;
    const path = findPath(
      "A",
      mission.destination,
      new Set(),
      C.initialMaxCrossings,
    );
    const s = new Simulation(path, ["Bombas"], C.seed, true, mission.id);
    expect(s.act("bombas")).toBe(true);
    finish(s, "evade");
    expect(s.confrontations).toBe(0);
    expect(s.completed).toBe(true);
    expect(s.report().objectiveSuccess).toBe(false);
  });
  it("desviar de todos os encontros não cumpre o objetivo de confronto", () => {
    const mission = missions.find((m) => m.type === "confrontation")!,
      s = forMission(mission.id);
    finish(s, "evade");
    expect(s.completed).toBe(true);
    expect(s.report().objectiveSuccess).toBe(false);
  });
});

describe("ações e apuração", () => {
  it("consome intervenções e carga e limita ações por rua", () => {
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
  it("exige bandeiras para abrir faixa", () => {
    const s = new Simulation(presets[0], []);
    expect(s.act("faixa")).toBe(false);
    expect(s.interventions).toBe(C.interventions);
  });
  it("separa comparecimento, perdas na rua e saldo da base", () => {
    const s = new Simulation(presets[0], ["Bombas"], 42, true);
    const initial = s.present;
    expect(initial).toBe(Math.floor(C.supporters * attendanceRate()));
    s.act("bombas");
    expect(s.leftIncidents).toBe(Math.ceil(initial * C.incidentLoss));
    expect(s.present).toBe(initial - s.leftIncidents);
    const r = s.report();
    expect(r.departures).toBe(
      Math.round(
        C.supporters * C.resignation +
          (C.legitimacy - s.legitimacy) * C.legitimacyResignation,
      ),
    );
    expect(r.supporters).toBe(C.supporters + r.additions - r.departures);
  });
  it("contabiliza desgaste de cada travessia uma vez e congela o resultado final", () => {
    const s = new Simulation();
    finish(s);
    expect(s.fatigue).toBe(
      C.fatigue +
        Math.max(0, s.traversals - C.fatigueFreeCrossings) * C.extraFatigue,
    );
    const report = s.report(),
      fatigue = s.fatigue;
    s.tick(100);
    expect(s.fatigue).toBe(fatigue);
    expect(s.report()).toEqual(report);
  });
  it("valida trajeto e recursos na camada da simulação", () => {
    expect(() => new Simulation(["A", "I"])).toThrow();
    expect(() => new Simulation(presets[0], ["Som", "Som"])).toThrow();
    expect(() => new Simulation(presets[0], ["inexistente"])).toThrow();
  });
});
