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
  private activeStreetActions = new Set<Action>();
  recruited = new Set<string>();
  travelled = new Set<string>();
  lastJoinDistance = -Infinity;
  lastJoinCount = 0;
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
  occupationTotalElapsed = 0;
  private occupationPressureTicks = 0;
  mediaActive = false;
  careCharges = 1;
  recovered = 0;
  bannerOpen = false;
  lastActionEffect = "";
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
    missionId = "occupation",
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
    this.peaceful = peaceful;
    this.present = Math.floor(C.supporters * attendanceRate());
    this.peak = this.present;
    const checkpoint = Math.min(2, route.length - 2);
    this.police = [
      {
        id: 0,
        nodeId: route[checkpoint],
        strength: C.policeBaseStrength,
        resolved: false,
        encountered: false,
      },
    ];
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
    return (
      0.5 * this.progress +
      0.5 * Math.min(1, this.occupationElapsed / this.mission.holdSeconds)
    );
  }
  get objectiveSuccess() {
    return (
      this.finished &&
      this.completed &&
      this.phase !== "dispersed" &&
      this.present >= this.mission.minPresent &&
      this.occupationElapsed >= this.mission.holdSeconds
    );
  }
  get objectiveLabel() {
    if (this.phase === "occupying")
      return `${Math.floor(this.occupationElapsed)}/${this.mission.holdSeconds}s com ${this.present}/${this.mission.minPresent} presentes · ${Math.max(0, Math.ceil(C.occupationMaxSeconds - this.occupationTotalElapsed))}s para sustentar a praça`;
    return `Chegue à praça e sustente ${this.mission.minPresent} presentes por ${this.mission.holdSeconds}s contínuos.`;
  }
  get occupationForecast() {
    let p = this.present,
      cohesion = this.cohesion,
      fatigue = this.fatigue;
    const seconds = this.mission.holdSeconds - this.occupationElapsed;
    const count =
      Math.floor(
        (this.occupationTotalElapsed + seconds) / C.occupationPressureInterval,
      ) - this.occupationPressureTicks;
    for (let i = 0; i < count; i++) {
      cohesion = Math.max(0, cohesion - C.occupationCohesionLoss);
      fatigue += C.occupationFatigue;
      p = Math.max(0, p - this.pressureLoss(cohesion, fatigue));
    }
    return p;
  }
  get problemLabel() {
    if (this.policeEncounter)
      return "A polícia fechou a passagem. Compare perdas e desgaste antes de responder.";
    if (this.phase === "occupying") {
      if (this.present < this.mission.minPresent)
        return `Faltam ${this.mission.minPresent - this.present} presentes. A contagem está zerada: acolha quem saiu por desgaste ou atraia gente com a faixa.`;
      if (this.occupationForecast < this.mission.minPresent)
        return `Sem novas ações, a previsão é terminar com ${this.occupationForecast} presentes. Coro reduz desorganização; transmissão protege a permanência; acolhimento recupera quem saiu.`;
      return `A margem é de ${this.present - this.mission.minPresent} presentes. A cada 5s há pressão; mantenha a coesão e acompanhe a contagem.`;
    }
    if (this.present < this.mission.minPresent + 30)
      return "A margem para ocupar é pequena. Abrir faixa atrai pessoas; acolhimento recupera quem saiu por desgaste.";
    if (this.fatigue >= 18)
      return "O trajeto está desgastando a multidão. Acolhimento recupera participantes; coro reduz perdas nesta rua.";
    return "Prepare a permanência: escolha onde atrair gente e reserve intervenções para sustentar a praça.";
  }
  private get actionStreet() {
    return this.phase === "occupying"
      ? `ocupacao:${this.mission.destination}`
      : this.street;
  }
  enter() {
    this.activeStreetActions.clear();
    this.visibility = 0;
    this.visited.add(this.street);
  }
  tick(dt: number) {
    if (this.paused || this.finished || !Number.isFinite(dt) || dt <= 0) return;
    if (this.phase === "occupying") {
      this.tickOccupation(dt);
      return;
    }
    let time = dt;
    while (
      time > 1e-9 &&
      !this.paused &&
      !this.finished &&
      this.phase === "marching"
    ) {
      const speed =
        C.speed *
        (this.activeStreetActions.has("faixa") ? C.flagSpeedMultiplier : 1);
      const budget = speed * time;
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
        time -= d / speed;
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
          "A polícia interrompeu o trajeto. Dispersar encerra o ato; desviar tem perdas de organização; confrontar tem risco de repressão.";
        break;
      }
      const step = Math.min(budget, len - this.offset);
      this.advance(step);
      time -= step / speed;
      if (this.offset >= len - 1e-7) {
        this.traversals++;
        this.travelled.add(this.street);
        if (this.traversals > C.fatigueFreeCrossings)
          this.fatigue += C.extraFatigue;
        const meta = road(this.route[this.index], this.route[this.index + 1]);
        const loss = Math.ceil(
          this.present *
            meta.wear *
            (this.activeStreetActions.has("coro") ? C.coroWearMultiplier : 1),
        );
        this.present -= loss;
        this.leftWear += loss;
        this.index++;
        this.offset = 0;
        if (this.index === this.route.length - 1) {
          this.arrive();
          break;
        }
        this.enter();
      }
    }
  }
  private arrive() {
    this.completed = true;
    this.phase = "occupying";
    this.paused = true;
    this.message = `A praça foi alcançada. Sustente ${this.mission.minPresent} presentes por ${this.mission.holdSeconds}s contínuos. A chegada não conclui a missão.`;
  }
  private pressureLoss(cohesion = this.cohesion, fatigue = this.fatigue) {
    return Math.ceil(
      (C.occupationLossBase +
        Math.max(0, 70 - cohesion) * C.occupationCohesionFactor +
        fatigue * C.occupationFatigueFactor) *
        (this.mediaActive ? C.mediaProtection : 1),
    );
  }
  private tickOccupation(dt: number) {
    let time = dt;
    while (time > 1e-9 && !this.finished) {
      if (this.present < this.mission.minPresent) this.occupationElapsed = 0;
      const untilPressure =
        (this.occupationPressureTicks + 1) * C.occupationPressureInterval -
        this.occupationTotalElapsed;
      const untilGoal =
        this.present >= this.mission.minPresent
          ? this.mission.holdSeconds - this.occupationElapsed
          : Infinity;
      const step = Math.min(
        time,
        untilPressure,
        untilGoal,
        C.occupationMaxSeconds - this.occupationTotalElapsed,
      );
      if (step > 0) {
        this.occupationTotalElapsed += step;
        if (this.present >= this.mission.minPresent)
          this.occupationElapsed += step;
        time -= step;
      }
      if (
        this.occupationTotalElapsed >=
        (this.occupationPressureTicks + 1) * C.occupationPressureInterval - 1e-8
      ) {
        this.occupationPressureTicks++;
        this.fatigue += C.occupationFatigue;
        this.cohesion -= C.occupationCohesionLoss;
        this.tension += C.occupationTension;
        this.clampStats();
        const loss = Math.min(this.present, this.pressureLoss());
        this.present -= loss;
        this.leftWear += loss;
        this.message = `Pressão na praça: ${loss} presentes saíram por desgaste${this.mediaActive ? " (cobertura ao vivo reduziu as perdas)" : ""}. ${this.cohesion} de coesão.`;
      }
      if (this.present < this.mission.minPresent) this.occupationElapsed = 0;
      if (
        this.occupationElapsed >= this.mission.holdSeconds - 1e-8 &&
        this.present >= this.mission.minPresent
      ) {
        this.occupationElapsed = this.mission.holdSeconds;
        this.message =
          "Objetivo cumprido: a praça foi sustentada com presença suficiente durante 30 segundos.";
        this.end(true);
        break;
      }
      if (this.occupationTotalElapsed >= C.occupationMaxSeconds - 1e-8) {
        this.message =
          "A ocupação não reuniu presença suficiente pelo tempo exigido. O ato terminou e o alcance realizado foi contabilizado.";
        this.end(true);
        break;
      }
      if (step <= 0) break;
    }
  }
  advance(d: number) {
    const beforeJoin = Math.max(0, C.recruitmentAt - this.offset);
    if (!this.recruited.has(this.street) && d >= beforeJoin) {
      this.advanceDistance(beforeJoin);
      this.recruited.add(this.street);
      const recruitment = road(
        this.route[this.index],
        this.route[this.index + 1],
      ).recruitment;
      this.lastJoinCount = recruitment;
      this.present += recruitment;
      this.joined += recruitment;
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
  actionBlockReason(id: Action) {
    const a = actions[id],
      u = this.used.get(this.actionStreet) ?? new Set();
    if (this.finished) return "O ato terminou.";
    if (this.policeEncounter) return "Responda primeiro à abordagem policial.";
    if (this.blocked.has(this.street))
      return "Escolha primeiro uma rua aberta.";
    if (u.has(id)) return "Já usada nesta rua ou nesta ocupação.";
    if (u.size >= C.maxActionsPerStreet)
      return "As duas ações deste local já foram usadas.";
    if (a.require && !this.resources.includes(a.require))
      return `Requer ${a.require.toLowerCase()}.`;
    if (this.interventions < a.cost) return "Intervenções insuficientes.";
    if (id === "bombas" && this.charges <= 0) return "Não há mais cargas.";
    if (id === "acolher" && this.careCharges <= 0)
      return "A carga de acolhimento foi usada.";
    if (id === "acolher" && this.leftWear <= 0)
      return "Ainda não há participantes afastados por desgaste.";
    if (id === "live" && this.mediaActive)
      return "A transmissão já está ativa.";
    return "";
  }
  canAct(id: Action) {
    return this.actionBlockReason(id) === "";
  }
  act(id: Action) {
    if (!this.canAct(id)) return false;
    const a = actions[id];
    this.interventions -= a.cost;
    this.visibility += a.visibility;
    this.tension += a.tension;
    this.cohesion += a.cohesion;
    const u = this.used.get(this.actionStreet) ?? new Set();
    u.add(id);
    this.used.set(this.actionStreet, u);
    if (this.phase === "marching") this.activeStreetActions.add(id);
    if (id === "coro") {
      const bonus = this.resources.includes("Som") ? C.soundCohesionBonus : 0;
      this.cohesion += bonus;
      this.lastActionEffect = `Coro: +${C.coroCohesion + bonus} de coesão. ${this.phase === "occupying" ? "A multidão perde menos gente sob pressão." : "Desgaste desta rua reduzido pela metade."}`;
    } else if (id === "faixa") {
      this.bannerOpen = true;
      this.lastJoinCount = C.flagExtraJoin;
      this.present += C.flagExtraJoin;
      this.joined += C.flagExtraJoin;
      this.peak = Math.max(this.peak, this.present);
      this.lastJoinDistance = this.distance;
      this.lastActionEffect = `Faixa aberta: +${C.flagExtraJoin} presentes; +${a.visibility} de visibilidade; tensão +${a.tension}${this.phase === "marching" ? "; marcha 25% mais lenta até o cruzamento" : ""}.`;
    } else if (id === "live") {
      this.mediaActive = true;
      this.lastActionEffect =
        "Transmissão ativa: as saídas por pressão na praça serão reduzidas pela metade. O alcance desta rua também aumentou.";
    } else if (id === "acolher") {
      const returned = Math.min(C.careRestore, this.leftWear);
      this.leftWear -= returned;
      this.recovered += returned;
      this.present += returned;
      this.careCharges--;
      this.fatigue = Math.max(0, this.fatigue - C.careFatigue);
      this.lastActionEffect = `Acolhimento: ${returned} participantes voltaram; fadiga −${C.careFatigue}; coesão +${C.careCohesion}. Isso não cria novos apoiadores.`;
    } else if (id === "bombas") {
      this.charges--;
      this.violentActions++;
      if (this.peaceful) {
        this.legitimacy -= C.peacefulPenalty;
        this.cohesion -= C.peacefulPenalty;
      }
      this.lastActionEffect = "Escalada: visibilidade +25 e tensão +30.";
      if (this.random() < C.incidentChance) {
        const loss = Math.ceil(this.present * C.incidentLoss);
        this.present -= loss;
        this.leftIncidents += loss;
        this.legitimacy -= C.incidentPenalty;
        this.cohesion -= C.incidentPenalty;
        this.lastActionEffect = `Incidente grave: ${loss} presentes saíram; legitimidade e coesão caíram.`;
      }
    }
    if (this.phase === "occupying" && this.present < this.mission.minPresent)
      this.occupationElapsed = 0;
    this.peak = Math.max(this.peak, this.present);
    this.message = this.lastActionEffect;
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
      const loss = Math.min(this.present, C.evadeLoss);
      this.present -= loss;
      this.leftPolice += loss;
      this.cohesion -= C.evadeCohesion;
      this.tension += C.evadeTension;
      this.clampStats();
      this.paused = true;
      this.message = `O recuo desorganizou a marcha: ${C.evadeLoss} presentes saíram; coesão −${C.evadeCohesion}. A rua segue bloqueada. Escolha o desvio.`;
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
      seconds: Math.ceil(
        (remaining - currentRemaining) / C.speed +
          currentRemaining /
            (C.speed *
              (this.activeStreetActions.has("faixa")
                ? C.flagSpeedMultiplier
                : 1)),
      ),
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
  end(completed = this.completed) {
    this.finished = true;
    this.completed = completed;
    this.paused = true;
  }
  get objectiveOutcome() {
    if (this.phase === "dispersed")
      return "O ato foi dispersado. O alcance já realizado conta no resultado.";
    if (!this.completed) return "O ato terminou antes de alcançar a praça.";
    if (!this.objectiveSuccess)
      return `A praça foi alcançada, mas não manteve ${this.mission.minPresent} presentes por ${this.mission.holdSeconds}s contínuos.`;
    return `A praça foi sustentada por ${this.mission.holdSeconds}s com ao menos ${this.mission.minPresent} presentes.`;
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
      recovered: this.recovered,
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
