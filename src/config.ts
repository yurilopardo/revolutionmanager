export const C = {
  seed: 42,
  confrontationChanceBase: 0.65,
  confrontationCohesionFactor: 0.002,
  confrontationStrengthFactor: 0.004,
  confrontationMinChance: 0.2,
  confrontationMaxChance: 0.85,
  policePressure: 5,
  policeBaseStrength: 35,
  policeStrengthStep: 10,
  confrontationSuccessLoss: 0.03,
  confrontationFailureLoss: 0.12,
  confrontationTension: 18,
  confrontationCohesion: 6,
  confrontationLegitimacy: 4,
  goalMinPresent: 350,
  occupationMaxSeconds: 75,
  occupationLossBase: 6,
  occupationCohesionLoss: 4,
  occupationCohesionFactor: 0.35,
  occupationFatigueFactor: 0.05,
  mediaProtection: 0.5,
  coroCohesion: 12,
  soundCohesionBonus: 4,
  coroWearMultiplier: 0.5,
  flagExtraJoin: 30,
  flagSpeedMultiplier: 0.75,
  careRestore: 30,
  careFatigue: 8,
  careCohesion: 4,
  evadeLoss: 30,
  evadeCohesion: 6,
  evadeTension: 8,
  occupationPressureInterval: 5,
  occupationTension: 2,
  occupationFatigue: 1,
  legitimacyConversion: 0.005,
  initialMinCrossings: 3,
  initialMaxCrossings: 12,
  maxResources: 3,
  maxActionsPerStreet: 2,
  initialTension: 15,
  bombCharges: 1,
  incidentChance: 0.5,
  incidentPenalty: 8,
  peacefulPenalty: 5,
  fatigueFreeCrossings: 3,
  fatigueAttendanceStep: 10,
  recruitmentAt: 24,
  peoplePerSprite: 8,
  supporters: 1000,
  legitimacy: 35,
  cohesion: 65,
  fatigue: 10,
  repression: 25,
  stability: 70,
  cash: 100,
  interventions: 4,
  speed: 64,
  extraFatigue: 3,
  maxCrossings: 16,
  recruitment: 24,
  blockadeAt: 0.55,
  attendance: 0.45,
  fatigueAttendance: 0.03,
  conversion: 0.2,
  minConversion: 0.1,
  maxConversion: 0.6,
  resignation: 0.03,
  reachEligibility: 0.18,
  incidentLoss: 0.1,
  wearLoss: 0.015,
  legitimacyResignation: 2,
  streetLength: 240,
};
export const resources = ["Bandeiras e faixas", "Som", "Acolhimento", "Bombas"];
export const actions = {
  coro: {
    name: "Puxar coro",
    cost: 1,
    visibility: 8,
    tension: 0,
    cohesion: C.coroCohesion,
    require: "",
    description:
      "Organiza a multidão: +12 de coesão (+4 com som) e metade do desgaste nesta rua. Na praça, coesão reduz saídas sob pressão.",
  },
  faixa: {
    name: "Abrir faixa",
    cost: 1,
    visibility: 15,
    tension: 5,
    cohesion: 0,
    require: "Bandeiras e faixas",
    description:
      "Atrai 30 presentes e aumenta o alcance. Durante a marcha, reduz a velocidade em 25% no restante desta rua; tensão +5.",
  },
  live: {
    name: "Transmitir ao vivo",
    cost: 1,
    visibility: 12,
    tension: 0,
    cohesion: 0,
    require: "",
    description:
      "Registra a repressão e amplia a repercussão. A cobertura reduz pela metade as saídas por pressão durante a ocupação.",
  },
  acolher: {
    name: "Acolher participantes",
    cost: 1,
    visibility: 0,
    tension: 0,
    cohesion: C.careCohesion,
    require: "Acolhimento",
    description:
      "Traz de volta até 30 participantes afastados por desgaste, inclusive na ocupação. Fadiga −8, coesão +4. Uma carga por ato.",
  },
  bombas: {
    name: "Lançar bombas",
    cost: 2,
    visibility: 25,
    tension: 30,
    cohesion: 0,
    require: "Bombas",
    description:
      "Aumenta visibilidade e tensão. Risco de danos graves e saída de 10% dos presentes; reduz legitimidade e coesão. Pode comprometer a ocupação.",
  },
};
export type Action = keyof typeof actions;

export const attendanceRate = () =>
  Math.max(
    0,
    C.attendance -
      C.fatigueAttendance * Math.floor(C.fatigue / C.fatigueAttendanceStep),
  );

export interface Mission {
  id: string;
  name: string;
  description: string;
  type: "occupation";
  destination: string;
  holdSeconds: number;
  minPresent: number;
}
export const missions: Mission[] = [
  {
    id: "occupation",
    name: "Sustentar a Praça da Liberdade",
    description:
      "Chegue à praça e mantenha ao menos 350 presentes por 30 segundos contínuos. Escolha a rota, responda à polícia e use suas quatro intervenções para sustentar a multidão.",
    type: "occupation",
    destination: "I",
    holdSeconds: 30,
    minPresent: C.goalMinPresent,
  },
];
