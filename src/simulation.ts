import {
  C,
  actions,
  attendanceRate,
  resources as availableResources,
  type Action,
} from "./config";
export const nodes = [
  { id: "A", x: 100, y: 100 },
  { id: "B", x: 340, y: 100 },
  { id: "C", x: 580, y: 100 },
  { id: "D", x: 100, y: 340 },
  { id: "E", x: 340, y: 340 },
  { id: "F", x: 580, y: 340 },
  { id: "G", x: 100, y: 580 },
  { id: "H", x: 340, y: 580 },
  { id: "I", x: 580, y: 580 },
];
export const edges = [
  ["A", "B"],
  ["B", "C"],
  ["D", "E"],
  ["E", "F"],
  ["G", "H"],
  ["H", "I"],
  ["A", "D"],
  ["D", "G"],
  ["B", "E"],
  ["E", "H"],
  ["C", "F"],
  ["F", "I"],
];
export const presets = [
  ["A", "B", "C", "F", "I"],
  ["A", "B", "E", "H", "I"],
  ["A", "D", "G", "H", "I"],
];
export const key = (a: string, b: string) => [a, b].sort().join("-");
export const node = (id: string) => nodes.find((n) => n.id === id)!;
export const length = (a: string, b: string) =>
  Math.hypot(node(a).x - node(b).x, node(a).y - node(b).y);
export function valid(
  path: string[],
  blocked: Set<string>,
  max = C.maxCrossings,
) {
  return (
    path.every((id) => nodes.some((n) => n.id === id)) &&
    path.length >= 2 &&
    path.length - 1 <= max &&
    path.every(
      (n, i) =>
        i === 0 ||
        (edges.some(([a, b]) => key(a, b) === key(path[i - 1], n)) &&
          !blocked.has(key(path[i - 1], n))),
    )
  );
}
export function findPath(
  start: string,
  end: string,
  blocked: Set<string>,
  max: number,
): string[] {
  const q = [[start]];
  while (q.length) {
    const p = q.shift()!;
    if (p.at(-1) === end) return p;
    if (p.length - 1 >= max) continue;
    for (const [a, b] of edges) {
      const next = a === p.at(-1) ? b : b === p.at(-1) ? a : "";
      if (next && !p.includes(next) && !blocked.has(key(a, b)))
        q.push([...p, next]);
    }
  }
  return [];
}
export class Simulation {
  route: string[];
  index = 0;
  offset = 0;
  distance = 0;
  traversals = 0;
  blocked = new Set<string>();
  visited = new Set<string>();
  used = new Map<string, Set<Action>>();
  recruited = new Set<string>();
  travelled = new Set<string>();
  lastJoinDistance = -Infinity;
  joined = 0;
  leftWear = 0;
  leftIncidents = 0;
  visibility = 0;
  reach = 0;
  present: number;
  peak: number;
  legitimacy: number = C.legitimacy;
  cohesion: number = C.cohesion;
  fatigue: number = C.fatigue;
  tension: number = C.initialTension;
  interventions: number = C.interventions;
  charges: number = C.bombCharges;
  paused = false;
  finished = false;
  completed = false;
  event = false;
  message = "A cidade está ouvindo. A marcha começou.";
  seed: number;
  resources: string[];
  peaceful: boolean;
  constructor(
    route = presets[0],
    resources = ["Bandeiras e faixas"],
    seed = C.seed,
    peaceful = true,
  ) {
    if (
      route[0] !== "A" ||
      route.at(-1) !== "I" ||
      !valid(route, new Set(), C.initialMaxCrossings) ||
      route.length - 1 < C.initialMinCrossings
    )
      throw new Error("Trajeto inicial inválido");
    if (
      resources.length > C.maxResources ||
      new Set(resources).size !== resources.length ||
      resources.some((r) => !availableResources.includes(r))
    )
      throw new Error("Recursos inválidos");
    this.route = [...route];
    this.resources = resources;
    this.seed = seed;
    this.peaceful = peaceful;
    this.present = Math.floor(C.supporters * attendanceRate());
    this.peak = this.present;
    this.enter();
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  get street() {
    return key(
      this.route[this.index],
      this.route[this.index + 1] ?? this.route[this.index],
    );
  }
  get position() {
    if (this.finished && this.completed) return node("I");
    const a = node(this.route[this.index]),
      b = node(this.route[this.index + 1] ?? this.route[this.index]);
    const t = this.offset / (length(a.id, b.id) || 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  get remaining() {
    let d = -this.offset;
    for (let i = this.index; i < this.route.length - 1; i++)
      d += length(this.route[i], this.route[i + 1]);
    return Math.max(0, d);
  }
  get progress() {
    return this.distance / (this.distance + this.remaining || 1);
  }
  enter() {
    this.visibility = 0;
    this.visited.add(this.street);
  }

  tick(dt: number) {
    if (this.paused || this.finished || !Number.isFinite(dt) || dt <= 0) return;
    let budget = C.speed * dt;
    while (budget > 0 && !this.paused && !this.finished) {
      const len = length(this.route[this.index], this.route[this.index + 1]);
      if (this.blocked.has(this.street)) {
        this.paused = true;
        this.message = "Rua bloqueada. Escolha um desvio ou encerre.";
        break;
      }
      if (!this.event && this.offset + budget >= len * C.blockadeAt) {
        const advance = Math.max(0, len * C.blockadeAt - this.offset);
        this.advance(advance);
        budget -= advance;
        this.event = true;
        this.blocked.add(
          key(this.route[this.index + 1], this.route[this.index + 2]),
        );
        this.paused = true;
        this.message =
          "Barricada policial adiante. Altere o trajeto a partir do próximo cruzamento.";
        break;
      }
      const step = Math.min(budget, len - this.offset);
      this.advance(step);
      budget -= step;
      if (this.offset >= len - 0.001) {
        this.traversals++;
        this.travelled.add(this.street);
        if (this.traversals > C.fatigueFreeCrossings) {
          this.fatigue += C.extraFatigue;
          const loss = Math.ceil(this.present * C.wearLoss);
          this.present -= loss;
          this.leftWear += loss;
        }
        this.index++;
        this.offset = 0;
        if (this.index === this.route.length - 1) {
          this.end(true);
          break;
        }
        if (this.blocked.has(this.street)) {
          this.paused = true;
          break;
        }
        this.enter();
      }
    }
  }
  advance(d: number) {
    const beforeJoin = Math.max(0, C.recruitmentAt - this.offset);
    if (!this.recruited.has(this.street) && d >= beforeJoin) {
      this.advanceDistance(beforeJoin);
      this.recruited.add(this.street);
      this.present += C.recruitment;
      this.joined += C.recruitment;
      this.peak = Math.max(this.peak, this.present);
      this.lastJoinDistance = this.distance;
      this.advanceDistance(d - beforeJoin);
    } else this.advanceDistance(d);
  }
  private advanceDistance(d: number) {
    this.offset += d;
    this.distance += d;
    this.reach +=
      (d / C.streetLength) * this.present * (1 + this.visibility / 100);
  }
  canAct(id: Action) {
    const a = actions[id],
      u = this.used.get(this.street) ?? new Set();
    return (
      !this.finished &&
      !this.paused &&
      !this.blocked.has(this.street) &&
      this.interventions >= a.cost &&
      u.size < C.maxActionsPerStreet &&
      !u.has(id) &&
      (!a.require || this.resources.includes(a.require)) &&
      (id !== "bombas" || this.charges > 0)
    );
  }
  act(id: Action) {
    if (!this.canAct(id)) return false;
    const a = actions[id];
    this.interventions -= a.cost;
    this.visibility += a.visibility;
    this.tension += a.tension;
    this.cohesion += a.cohesion;
    const u = this.used.get(this.street) ?? new Set();
    u.add(id);
    this.used.set(this.street, u);
    this.message = a.name + ": a multidão responde!";
    if (id === "bombas") {
      this.charges--;
      if (this.peaceful) {
        this.legitimacy -= C.peacefulPenalty;
        this.cohesion -= C.peacefulPenalty;
      }
      if (this.random() < C.incidentChance) {
        const loss = Math.ceil(this.present * C.incidentLoss);
        this.present -= loss;
        this.leftIncidents += loss;
        this.legitimacy -= C.incidentPenalty;
        this.cohesion -= C.incidentPenalty;
        this.message =
          "Incidente grave: 10% saíram da rua; legitimidade e coesão caíram.";
      }
    }
    return true;
  }
  get anchorIndex() {
    return this.index + (this.offset > 0 ? 1 : 0);
  }
  get anchor() {
    return this.route[this.anchorIndex];
  }
  suggest() {
    if (this.finished) return [];
    return findPath(
      this.anchor,
      "I",
      this.blocked,
      C.maxCrossings - this.traversals - (this.offset > 0 ? 1 : 0),
    );
  }
  preview(path: string[]) {
    const currentRemaining =
      this.offset > 0
        ? length(this.route[this.index], this.anchor) - this.offset
        : 0;
    const remaining =
      currentRemaining +
      path.slice(1).reduce((s, n, i) => s + length(path[i], n), 0);
    const crossings =
      this.traversals +
      (this.offset > 0 ? 1 : 0) +
      Math.max(0, path.length - 1);
    return {
      seconds: Math.ceil(remaining / C.speed),
      fatigue:
        (Math.max(0, crossings - C.fatigueFreeCrossings) -
          Math.max(0, this.traversals - C.fatigueFreeCrossings)) *
        C.extraFatigue,
      crossings,
      capacity: C.maxCrossings - crossings,
    };
  }
  reroute(path: string[]) {
    if (
      this.finished ||
      path[0] !== this.anchor ||
      path.at(-1) !== "I" ||
      !((path.length === 1 && path[0] === "I") || valid(path, this.blocked)) ||
      this.preview(path).crossings > C.maxCrossings ||
      (this.offset > 0 && this.blocked.has(this.street))
    )
      return false;
    this.route = [...this.route.slice(0, this.anchorIndex), ...path];
    this.paused = false;
    if (this.offset === 0) this.enter();
    this.message = "Desvio confirmado. Seguimos juntos.";
    return true;
  }
  end(completed = false) {
    this.finished = true;
    this.completed = completed;
    this.paused = true;
  }
  report() {
    const conversion = Math.max(
      C.minConversion,
      Math.min(
        C.maxConversion,
        C.conversion + this.legitimacy * C.legitimacyConversion,
      ),
    );
    const additions = Math.floor(this.reach * conversion * C.reachEligibility);
    const departures = Math.round(
      C.supporters * C.resignation +
        Math.max(0, C.legitimacy - this.legitimacy) * C.legitimacyResignation,
    );
    return {
      initial: Math.floor(C.supporters * attendanceRate()),
      joined: this.joined,
      leftWear: this.leftWear,
      leftIncidents: this.leftIncidents,
      peak: this.peak,
      final: this.present,
      completion: Math.round(this.progress * 100),
      reach: Math.round(this.reach),
      conversion,
      additions,
      departures,
      balance: additions - departures,
      supporters: C.supporters + additions - departures,
    };
  }
}
