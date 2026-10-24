import { describe, it, expect } from "vitest";
import { Simulation, valid, presets, key } from "./simulation";
describe("trajetos e simulação", () => {
  it("oferece três rotas conectadas e impede ruas fechadas", () => {
    for (const p of presets) expect(valid(p, new Set())).toBe(true);
    expect(valid(["A", "I"], new Set())).toBe(false);
    expect(valid(presets[0], new Set(["B-C"]))).toBe(false);
  });
  it("completa barricada, desvio contínuo e relatório", () => {
    const s = new Simulation();
    s.tick(10);
    expect(s.event).toBe(true);
    expect(s.paused).toBe(true);
    const position = { ...s.position },
      distance = s.distance;
    const p = s.suggest();
    expect(p).toEqual(["B", "E", "F", "I"]);
    expect(s.reroute(p)).toBe(true);
    expect(s.position).toEqual(position);
    expect(s.distance).toBe(distance);
    for (let i = 0; i < 200; i++) s.tick(1);
    expect(s.completed).toBe(true);
    expect(s.report().supporters).toBe(1000 + s.report().balance);
    expect(s.traversals).toBe(4);
    expect(s.fatigue).toBe(13);
  });
  it("não atravessa bloqueio e rejeita desvio inválido", () => {
    const s = new Simulation();
    s.tick(10);
    expect(s.reroute(["B", "C", "F", "I"])).toBe(false);
    s.paused = false;
    s.tick(20);
    expect(s.position).toEqual({ x: 340, y: 100 });
    expect(s.paused).toBe(true);
    expect(s.traversals).toBe(1);
  });
  it("consome intervenções e carga, limita duas ações por rua", () => {
    const s = new Simulation(presets[0], ["Bombas"]);
    expect(s.act("bombas")).toBe(true);
    expect(s.charges).toBe(0);
    expect(s.interventions).toBe(2);
    expect(s.act("bombas")).toBe(false);
    expect(s.act("coro")).toBe(true);
    expect(s.act("live")).toBe(false);
    expect(s.interventions).toBe(1);
  });
  it("exige bandeiras e não renova recrutamento nem ações em revisitas", () => {
    const s = new Simulation(presets[0], []);
    expect(s.act("faixa")).toBe(false);
    s.act("coro");
    const count = s.present;
    s.enter();
    expect(s.present).toBe(count);
    expect(s.canAct("coro")).toBe(false);
    expect(s.visited.has(key("A", "B"))).toBe(true);
  });
  it("recalcula progresso de um caminho mais longo e contabiliza desgaste uma vez", () => {
    const s = new Simulation();
    s.tick(10);
    const before = s.progress,
      distance = s.distance;
    expect(s.reroute(["B", "E", "D", "G", "H", "I"])).toBe(true);
    expect(s.distance).toBe(distance);
    expect(s.progress).toBeLessThan(before);
    for (let i = 0; i < 100; i++) s.tick(1);
    expect(s.completed).toBe(true);
    expect(s.fatigue).toBe(19);
    s.tick(100);
    expect(s.fatigue).toBe(19);
  });
  it("mantém sorteio reproduzível e apura encerramento parcial", () => {
    const a = new Simulation(presets[0], ["Bombas"]),
      b = new Simulation(presets[0], ["Bombas"]);
    a.act("bombas");
    b.act("bombas");
    expect(a.present).toBe(b.present);
    a.tick(1);
    a.end();
    expect(a.report().completion).toBeLessThan(100);
    expect(a.report().departures).toBeGreaterThanOrEqual(30);
  });
});

describe("casos adicionais do anexo", () => {
  it("permite desvio no cruzamento imediatamente antes da rua fechada", () => {
    const s = new Simulation();
    s.tick(10);
    s.paused = false;
    s.tick(20);
    expect(s.anchor).toBe("B");
    const distance = s.distance,
      interventions = s.interventions;
    expect(s.reroute(s.suggest())).toBe(true);
    expect(s.distance).toBe(distance);
    expect(s.interventions).toBe(interventions);
    expect(s.position).toEqual({ x: 340, y: 100 });
    s.tick(100);
    expect(s.completed).toBe(true);
  });
  it("não repete recrutamento, ações ou barricada ao voltar pela mesma rua", () => {
    const s = new Simulation();
    s.act("coro");
    s.tick(10);
    expect(s.reroute(["B", "A", "D", "G", "H", "I"])).toBe(true);
    s.tick((240 - s.offset) / 38); // chega em B; próxima rua é B-A
    expect(s.street).toBe("A-B");
    expect(s.canAct("coro")).toBe(false);
    const joined = s.joined;
    s.tick(1);
    expect(s.joined).toBe(joined);
    expect(s.paused).toBe(false);
    s.tick(100);
    expect(s.completed).toBe(true);
    expect(s.joined).toBe(5 * 24);
    expect(s.traversals).toBe(6);
  });
  it("aceita oito travessias e rejeita nove sem alterar o estado", () => {
    const s = new Simulation();
    s.tick(10);
    const before = [...s.route];
    expect(s.reroute(["B", "E", "D", "G", "H", "E", "F", "C", "F", "I"])).toBe(
      false,
    );
    expect(s.route).toEqual(before);
    expect(s.reroute(["B", "E", "D", "G", "H", "E", "F", "I"])).toBe(true);
    s.tick(100);
    expect(s.traversals).toBe(8);
    expect(s.fatigue).toBe(25);
  });
  it("aceita confirmar a chegada no último trecho sem inventar nova rua", () => {
    const s = new Simulation();
    s.tick(10);
    s.reroute(s.suggest());
    while (s.index < 3) s.tick(0.1);
    expect(s.anchor).toBe("I");
    expect(s.suggest()).toEqual(["I"]);
    expect(s.reroute(["I"])).toBe(true);
    s.tick(100);
    expect(s.completed).toBe(true);
  });
  it("permite encerramento quando não há desvio acessível", () => {
    const s = new Simulation();
    s.tick(10);
    s.blocked.add("A-B");
    s.blocked.add("B-E");
    expect(s.suggest()).toEqual([]);
    expect(s.reroute([])).toBe(false);
    s.end();
    expect(s.report().completion).toBeLessThan(100);
    expect(s.report().supporters).toBe(
      1000 + s.report().additions - s.report().departures,
    );
  });
  it("integra entradas, alcance e movimento independentemente dos quadros", () => {
    const a = new Simulation(),
      b = new Simulation();
    a.tick(10);
    b.tick(10);
    a.reroute(a.suggest());
    b.reroute(b.suggest());
    a.tick(12);
    for (let i = 0; i < 720; i++) b.tick(1 / 60);
    expect(a.distance).toBeCloseTo(b.distance, 7);
    expect(a.reach).toBeCloseTo(b.reach, 7);
    expect(a.present).toBe(b.present);
    expect(a.joined).toBe(b.joined);
  });
  it("aplica exatamente os danos e separa saídas da rua de desistências", () => {
    const s = new Simulation(presets[0], ["Bombas"], 42, true);
    const initial = s.present;
    expect(initial).toBe(420);
    s.act("bombas");
    expect(s.leftIncidents).toBe(Math.ceil(initial * 0.1));
    expect(s.present).toBe(initial - s.leftIncidents);
    expect(s.legitimacy).toBe(22);
    expect(s.cohesion).toBe(52);
    expect(s.report().departures).toBe(56);
    expect(s.report().departures).not.toBe(s.leftIncidents);
  });
  it("valida o trajeto e os recursos também na camada da simulação", () => {
    expect(() => new Simulation(["A", "I"])).toThrow();
    expect(() => new Simulation(presets[0], ["Som", "Som"])).toThrow();
    expect(valid(["Z", "A"], new Set())).toBe(false);
  });
});
