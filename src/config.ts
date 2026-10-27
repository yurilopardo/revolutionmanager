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
  occupationPressureInterval: 5,
  occupationTension: 2,
  occupationFatigue: 1,
  legitimacyConversion: 0.005,
  initialMinCrossings: 3,
  initialMaxCrossings: 64,
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
  maxCrossings: 80,
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
export const resources = [
  "Bandeiras e faixas",
  "Som",
  "Acolhimento",
  "Bloco autônomo",
  "Fogos",
  "Bombas",
];
export const actions = {
  coro: {
    name: "Puxar coro",
    cost: 1,
    visibility: 8,
    tension: 0,
    cohesion: 2,
    require: "",
  },
  faixa: {
    name: "Abrir faixa",
    cost: 1,
    visibility: 15,
    tension: 5,
    cohesion: 0,
    require: "Bandeiras e faixas",
  },
  live: {
    name: "Transmitir ao vivo",
    cost: 1,
    visibility: 12,
    tension: 0,
    cohesion: 0,
    require: "",
  },
  bombas: {
    name: "Lançar bombas",
    cost: 2,
    visibility: 25,
    tension: 30,
    cohesion: 0,
    require: "Bombas",
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
  type: "arrival" | "occupation" | "peaceful" | "confrontation";
  destination: string;
  holdSeconds: number;
}
export const missions: Mission[] = [
  {
    id: "arrival",
    name: "Marcha ao Congresso",
    description: "Atravesse a cidade e chegue ao Congresso de Aurora.",
    type: "arrival",
    destination: "I",
    holdSeconds: 0,
  },
  {
    id: "occupation",
    name: "Ocupar a Praça da Liberdade",
    description:
      "Chegue à praça e mantenha a ocupação por 30 segundos de simulação.",
    type: "occupation",
    destination: "N5_10",
    holdSeconds: 30,
  },
  {
    id: "peaceful",
    name: "Ato pacífico na Igreja",
    description:
      "Chegue à Igreja de Santa Clara sem bombas nem confrontar a polícia. Desvie da repressão.",
    type: "peaceful",
    destination: "N2_8",
    holdSeconds: 0,
  },
  {
    id: "confrontation",
    name: "Pressão sobre a Corporação Atlas",
    description:
      "Supere ao menos um confronto policial e chegue à sede da empresa.",
    type: "confrontation",
    destination: "N8_5",
    holdSeconds: 0,
  },
  {
    id: "newspaper",
    name: "Protesto na gráfica governista",
    description: "Leve o movimento à Gráfica Voz do Governo.",
    type: "arrival",
    destination: "N1_12",
    holdSeconds: 0,
  },
  {
    id: "vigil",
    name: "Vigília pela educação",
    description: "Ocupe a Universidade Popular por 20 segundos de simulação.",
    type: "occupation",
    destination: "N2_3",
    holdSeconds: 20,
  },
  {
    id: "solidarity",
    name: "Solidariedade aos trabalhadores",
    description:
      "Chegue à Fábrica Horizonte sem bombas nem confrontos policiais.",
    type: "peaceful",
    destination: "N7_16",
    holdSeconds: 0,
  },
];
