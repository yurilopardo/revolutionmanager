import {
  C,
  actions,
  attendanceRate,
  resources as availableResources,
  missions,
  type Mission,
  type Action,
} from "./config";
import { nodes, edges, node, key, length, presets, road } from "./city";
export { nodes, edges, node, key, length, presets } from "./city";

const adjacency = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
for (const [a, b] of edges) {
  adjacency.get(a)!.push(b);
  adjacency.get(b)!.push(a);
}

export function valid(
  path: string[],
  blocked: Set<string>,
  max = C.maxCrossings,
) {
  return (
    path.length >= 2 &&
    path.length - 1 <= max &&
    path.every(
      (n, i) =>
        adjacency.has(n) &&
        (i === 0 ||
          (adjacency.get(path[i - 1])!.includes(n) &&
            !blocked.has(key(path[i - 1], n)))),
    )
  );
}
/** Breadth-first search visits each node once; the large city must not enumerate all possible paths. */
export function findPath(
  start: string,
  end: string,
  blocked: Set<string>,
  max: number,
): string[] {
  if (!adjacency.has(start) || !adjacency.has(end) || max < 0) return [];
  const queue = [start],
    previous = new Map<string, string | null>([[start, null]]),
    depth = new Map([[start, 0]]);
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    if (at === end) {
      const p: string[] = [];
      let n: string | null = end;
      while (n !== null) {
        p.push(n);
        n = previous.get(n)!;
      }
      return p.reverse();
    }
    if (depth.get(at)! >= max) continue;
    for (const next of adjacency.get(at)!) {
      if (previous.has(next) || blocked.has(key(at, next))) continue;
      previous.set(next, at);
      depth.set(next, depth.get(at)! + 1);
      queue.push(next);
    }
  }
  return [];
}
export interface PoliceUnit {
  id: number;
  nodeId: string;
  strength: number;
  resolved: boolean;
  encountered: boolean;
  blockedEdge?: string;
}
export type PoliceChoice = "disperse" | "confront" | "evade";
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
  leftPolice = 0;
  leftDispersed = 0;
  visibility = 0;
  reach = 0;
  present: number;
  peak: number;
  legitimacy: number = C.legitimacy;
  cohesion: number = C.cohesion;
  fatigue: number = C.fatigue;
  tension: number = C.initialTension;
  repression: number = C.repression;
  interventions: number = C.interventions;
  charges: number = C.bombCharges;
  paused = false;
  finished = false;
  completed = false;
  event = false;
  phase: "marching" | "occupying" | "dispersed" = "marching";
  occupationElapsed = 0;
  confrontations = 0;
  confrontationWins = 0;
  violentActions = 0;
  policeEncounters = 0;
  message = "A cidade está ouvindo. A marcha começou.";
  seed: number;
  resources: string[];
  peaceful: boolean;
  mission: Mission;
  police: PoliceUnit[];
  policeEncounter?: PoliceUnit;
  constructor(
    route = presets[0],
    resources = ["Bandeiras e faixas"],
    seed = C.seed,
    peaceful = true,
    missionId = "arrival",
  ) {
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) throw new Error("Objetivo desconhecido");
    this.mission = mission;
    if (
      route[0] !== "A" ||
      route.at(-1) !== mission.destination ||
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
    this.resources = [...resources];
    this.seed = seed;
    this.peaceful = mission.type === "peaceful" || peaceful;
    this.present = Math.floor(C.supporters * attendanceRate());
    this.peak = this.present;
    const checkpoints = [
      1,
      Math.floor((route.length - 1) * 0.5),
      route.length - 2,
    ];
    this.police = [
      ...new Set(checkpoints.filter((i) => i > 0 && i < route.length - 1)),
    ].map((i, index) => ({
      id: index,
      nodeId: route[i],
      strength: C.policeBaseStrength + index * C.policeStrengthStep,
      resolved: false,
      encountered: false,
    }));
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
  get objectiveProgress() {
    if (this.mission.type === "occupation")
      return (
        0.7 * this.progress +
        0.3 * Math.min(1, this.occupationElapsed / this.mission.holdSeconds)
      );
    if (this.mission.type === "confrontation")
      return 0.75 * this.progress + 0.25 * Math.min(1, this.confrontationWins);
    return this.progress;
  }
  get objectiveSuccess() {
    return (
      this.finished &&
      this.completed &&
      this.phase !== "dispersed" &&
      (this.mission.type !== "occupation" ||
        this.occupationElapsed >= this.mission.holdSeconds) &&
      (this.mission.type !== "peaceful" ||
        (this.violentActions === 0 && this.confrontations === 0)) &&
      (this.mission.type !== "confrontation" || this.confrontationWins > 0)
    );
  }
  get objectiveLabel() {
    if (this.phase === "occupying")
      return `Ocupação: ${Math.floor(this.occupationElapsed)} / ${this.mission.holdSeconds}s`;
    if (
      this.mission.type === "peaceful" &&
      (this.violentActions || this.confrontations)
    )
      return "Condição pacífica perdida; ainda é possível chegar ao destino.";
    if (this.mission.type === "confrontation")
      return `${this.mission.name} · confrontos superados: ${this.confrontationWins}/1`;
    return this.mission.name;
  }
  enter() {
    this.visibility = 0;
    this.visited.add(this.street);
  }
  tick(dt: number) {
    if (this.paused || this.finished || !Number.isFinite(dt) || dt <= 0) return;
    if (this.phase === "occupying") {
      this.tickOccupation(dt);
      return;
    }
    let budget = C.speed * dt;
    while (
      budget > 0 &&
      !this.paused &&
      !this.finished &&
      this.phase === "marching"
    ) {
      const len = length(this.route[this.index], this.route[this.index + 1]);
      if (this.blocked.has(this.street)) {
        this.paused = true;
        this.message = "Rua bloqueada. Altere o trajeto ou encerre o ato.";
        break;
      }
      const unit = this.police.find(
        (p) =>
          !p.encountered &&
          p.nodeId === this.route[this.index + 1] &&
          this.index + 2 < this.route.length,
      );
      if (unit && this.offset + budget >= len * C.blockadeAt) {
        const d = Math.max(0, len * C.blockadeAt - this.offset);
        this.advance(d);
        budget -= d;
        unit.encountered = true;
        unit.blockedEdge = key(
          this.route[this.index + 1],
          this.route[this.index + 2],
        );
        this.blocked.add(unit.blockedEdge);
        this.policeEncounter = unit;
        this.policeEncounters++;
        this.event = true;
        this.paused = true;
        this.message =
          "Repressão policial adiante: escolha dispersar, confrontar ou alterar o percurso.";
        break;
      }
      const step = Math.min(budget, len - this.offset);
      this.advance(step);
      budget -= step;
      if (this.offset >= len - 1e-7) {
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
          this.arrive();
          if (this.mission.type === "occupation" && budget > 0)
            this.tickOccupation(budget / C.speed);
          break;
        }
        this.enter();
      }
    }
  }
  private arrive() {
    this.completed = true;
    if (this.mission.type === "occupation") {
      this.phase = "occupying";
      this.message =
        "Destino alcançado. Mantenha a ocupação para cumprir o objetivo.";
    } else {
      this.end(true);
      this.message = this.objectiveSuccess
        ? "Destino alcançado. O movimento cumpriu o objetivo."
        : "Destino alcançado, mas uma condição do objetivo não foi cumprida.";
    }
  }
  private tickOccupation(dt: number) {
    const before = Math.floor(
      this.occupationElapsed / C.occupationPressureInterval,
    );
    this.occupationElapsed = Math.min(
      this.mission.holdSeconds,
      this.occupationElapsed + dt,
    );
    const intervals =
      Math.floor(this.occupationElapsed / C.occupationPressureInterval) -
      before;
    this.fatigue += intervals * C.occupationFatigue;
    this.tension += intervals * C.occupationTension;
    this.clampStats();
    if (this.occupationElapsed >= this.mission.holdSeconds) {
      this.message = "Ocupação concluída. O movimento sustentou sua presença.";
      this.end(true);
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
      this.phase === "marching" &&
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
    this.cohesion = Math.min(100, this.cohesion + a.cohesion);
    const u = this.used.get(this.street) ?? new Set();
    u.add(id);
    this.used.set(this.street, u);
    this.message = a.name + ": a multidão responde!";
    if (id === "bombas") {
      this.charges--;
      this.violentActions++;
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
          "Incidente grave: participantes saíram da rua; legitimidade e coesão caíram.";
      }
    }
    this.clampStats();
    return true;
  }
  resolvePolice(choice: PoliceChoice) {
    const unit = this.policeEncounter;
    if (!unit || this.finished) return false;
    this.policeEncounter = undefined;
    if (choice === "disperse") {
      this.leftDispersed += this.present;
      this.present = 0;
      this.phase = "dispersed";
      this.message =
        "A multidão se dispersou. O relatório considera o percurso e o alcance já realizados.";
      this.end(false);
      return true;
    }
    if (choice === "evade") {
      this.paused = true;
      this.message =
        "A rua segue bloqueada. Escolha um desvio a partir do próximo cruzamento.";
      return true;
    }
    this.confrontations++;
    const chance = Math.max(
      C.confrontationMinChance,
      Math.min(
        C.confrontationMaxChance,
        C.confrontationChanceBase +
          this.cohesion * C.confrontationCohesionFactor -
          unit.strength * C.confrontationStrengthFactor,
      ),
    );
    const success = this.random() < chance;
    const loss = Math.ceil(
      this.present *
        (success ? C.confrontationSuccessLoss : C.confrontationFailureLoss),
    );
    this.present -= loss;
    this.leftPolice += loss;
    this.tension += C.confrontationTension;
    this.cohesion -= C.confrontationCohesion;
    this.legitimacy -= C.confrontationLegitimacy;
    if (this.peaceful) {
      this.legitimacy -= C.peacefulPenalty;
      this.cohesion -= C.peacefulPenalty;
    }
    this.repression = Math.min(100, this.repression + C.policePressure);
    this.clampStats();
    if (success) {
      unit.resolved = true;
      if (unit.blockedEdge) this.blocked.delete(unit.blockedEdge);
      this.confrontationWins++;
      this.paused = false;
      this.message = `Confronto superado (efeito abstrato). ${loss} presentes saíram; a marcha pode prosseguir.`;
    } else {
      this.paused = true;
      this.message = `A repressão prevaleceu. ${loss} presentes saíram; a rua permanece fechada. Altere o trajeto ou encerre.`;
    }
    return true;
  }
  private clampStats() {
    this.legitimacy = Math.max(0, Math.min(100, this.legitimacy));
    this.cohesion = Math.max(0, Math.min(100, this.cohesion));
    this.tension = Math.max(0, Math.min(100, this.tension));
  }
  get anchorIndex() {
    return this.index + (this.offset > 0 ? 1 : 0);
  }
  get anchor() {
    return this.route[this.anchorIndex];
  }
  suggest() {
    if (this.finished || this.phase !== "marching") return [];
    return findPath(
      this.anchor,
      this.mission.destination,
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
    const capacity = path
      .slice(1)
      .reduce(
        (cap, n, i) => Math.min(cap, road(path[i], n).capacity),
        Infinity,
      );
    return {
      seconds: Math.ceil(remaining / C.speed),
      fatigue:
        (Math.max(0, crossings - C.fatigueFreeCrossings) -
          Math.max(0, this.traversals - C.fatigueFreeCrossings)) *
        C.extraFatigue,
      crossings,
      capacity: Number.isFinite(capacity)
        ? capacity
        : road(this.route[this.index], this.anchor).capacity,
      remainingCrossings: C.maxCrossings - crossings,
    };
  }
  reroute(path: string[]) {
    if (
      this.finished ||
      this.phase !== "marching" ||
      this.policeEncounter ||
      path[0] !== this.anchor ||
      path.at(-1) !== this.mission.destination ||
      !(
        (path.length === 1 && path[0] === this.mission.destination) ||
        valid(path, this.blocked)
      ) ||
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
  get objectiveOutcome() {
    if (this.phase === "dispersed")
      return "A manifestação foi dispersada; somente o alcance realizado foi contabilizado.";
    if (!this.completed)
      return "A marcha foi encerrada antes de chegar ao destino.";
    if (
      this.mission.type === "occupation" &&
      this.occupationElapsed < this.mission.holdSeconds
    )
      return `Chegou ao destino, mas permaneceu ${Math.floor(this.occupationElapsed)} de ${this.mission.holdSeconds} segundos exigidos.`;
    if (
      this.mission.type === "peaceful" &&
      (this.violentActions || this.confrontations)
    )
      return "Chegou ao destino, mas bombas ou confronto policial quebraram a condição pacífica.";
    if (this.mission.type === "confrontation" && !this.confrontationWins)
      return "Chegou ao destino sem superar o confronto policial exigido.";
    return this.mission.type === "occupation"
      ? `Ocupação mantida pelos ${this.mission.holdSeconds} segundos exigidos.`
      : "Destino alcançado e condições do objetivo cumpridas.";
  }
  report() {
    const conversion = Math.max(
      C.minConversion,
      Math.min(
        C.maxConversion,
        C.conversion + this.legitimacy * C.legitimacyConversion,
      ),
    );
    const additions = Math.floor(this.reach * conversion * C.reachEligibility),
      departures = Math.round(
        C.supporters * C.resignation +
          Math.max(0, C.legitimacy - this.legitimacy) * C.legitimacyResignation,
      );
    return {
      initial: Math.floor(C.supporters * attendanceRate()),
      joined: this.joined,
      leftWear: this.leftWear,
      leftIncidents: this.leftIncidents,
      leftPolice: this.leftPolice,
      leftDispersed: this.leftDispersed,
      peak: this.peak,
      final: this.present,
      completion: Math.round(this.progress * 100),
      reach: Math.round(this.reach),
      conversion,
      additions,
      departures,
      balance: additions - departures,
      supporters: C.supporters + additions - departures,
      objectiveSuccess: this.objectiveSuccess,
      objective: this.objectiveOutcome,
      policeEncounters: this.policeEncounters,
      confrontations: this.confrontations,
      confrontationWins: this.confrontationWins,
    };
  }
}
