/** Compact, deterministic city: four columns × six rows of intersections. */
export interface Point {
  x: number;
  y: number;
}
export interface CityNode extends Point {
  id: string;
  col: number;
  row: number;
}
export interface Road {
  kind: "avenue" | "street" | "alley";
  name: string;
  capacity: number;
  recruitment: number;
  wear: number;
  description: string;
}
export interface CityBlock {
  points: Point[];
  kind: "park" | "civic" | "commercial" | "industrial" | "residential";
  seed: number;
}
export const CITY_WIDTH = 900;
export const CITY_HEIGHT = 1420;
const columns = [110, 310, 570, 790];
const rows = [130, 335, 540, 760, 1010, 1250];
const jitter = (c: number, r: number, k: number) =>
  Math.sin(c * 19.13 + r * 7.71 + k * 11.91) * 13;
export const idAt = (c: number, r: number) =>
  c === 1 && r === 5 ? "A" : c === 2 && r === 1 ? "I" : `N${c}_${r}`;
export const nodes: CityNode[] = rows.flatMap((y, r) =>
  columns.map((x, c) => ({
    id: idAt(c, r),
    col: c,
    row: r,
    x: x + jitter(c, r, 1) + (r === 2 ? 12 : 0),
    y: y + jitter(c, r, 2) + (c === 3 ? 16 : 0),
  })),
);
const nodeMap = new Map(nodes.map((n) => [n.id, n]));
export const node = (id: string): CityNode => {
  const n = nodeMap.get(id);
  if (!n) throw new Error(`Cruzamento desconhecido: ${id}`);
  return n;
};
export const key = (a: string, b: string) => [a, b].sort().join("-");
export const length = (a: string, b: string) =>
  Math.hypot(node(a).x - node(b).x, node(a).y - node(b).y);
const roads = new Map<string, Road>();
export const edges: string[][] = [];
function add(c: number, r: number, dc: number, dr: number) {
  const a = idAt(c, r),
    b = idAt(c + dc, r + dr);
  let meta: Road = {
    kind: "street",
    name: "Rua dos Jardins",
    capacity: 520,
    recruitment: 8,
    wear: 0.015,
    description: "Rua de ligação: poucas entradas e desgaste moderado.",
  };
  if (dc === 0 && c === 1) {
    meta = {
      kind: "avenue",
      name: "Av. da União",
      capacity: 900,
      recruitment: 16,
      wear: 0.02,
      description:
        "Avenida central: trajeto direto, visibilidade e presença policial.",
    };
  } else if ((dc === 0 && c === 2) || (dr === 0 && r === 5 && c === 1)) {
    meta = {
      kind: "street",
      name: "Rua do Mercado",
      capacity: 580,
      recruitment: 28,
      wear: 0.025,
      description:
        "Comércio movimentado: mais pessoas podem entrar, com maior desgaste.",
    };
  } else if (
    (dc === 0 && c === 0) ||
    (dr === 0 && c === 0 && (r === 1 || r === 5))
  ) {
    meta = {
      kind: "alley",
      name: "Rua da Igreja",
      capacity: 380,
      recruitment: 0,
      wear: 0.008,
      description:
        "Bairro tranquilo: pouco desgaste, sem recrutamento espontâneo.",
    };
  } else if (dr === 0 && r === 1) {
    meta = { ...meta, kind: "avenue", name: "Av. da Liberdade", capacity: 850 };
  } else if (dc === 0 && c === 3) {
    meta = { ...meta, name: "Rua da Guarda", recruitment: 4 };
  }
  edges.push([a, b]);
  roads.set(key(a, b), meta);
}
for (let r = 0; r < 6; r++)
  for (let c = 0; c < 4; c++) {
    if (c < 3) add(c, r, 1, 0);
    // A single civic superblock keeps the tiny map irregular without interrupting routes.
    if (r < 5 && !(c === 1 && r === 0)) add(c, r, 0, 1);
  }
export const road = (a: string, b: string): Road =>
  roads.get(key(a, b)) ?? {
    kind: "street",
    name: "Rua local",
    capacity: 520,
    recruitment: 8,
    wear: 0.015,
    description: "Rua local de ligação.",
  };
function polygon(c: number, r: number, width = 1): Point[] {
  return [
    node(idAt(c, r)),
    node(idAt(c + width, r)),
    node(idAt(c + width, r + 1)),
    node(idAt(c, r + 1)),
  ].map((p) => ({ x: p.x, y: p.y }));
}
export const blocks: CityBlock[] = [];
for (let r = 0; r < 5; r++)
  for (let c = 0; c < 3; c++) {
    if (c === 1 && r === 0) continue;
    const width = c === 0 && r === 0 ? 2 : 1;
    const kind: CityBlock["kind"] =
      (c === 1 && r === 1) || (c === 0 && r === 4)
        ? "park"
        : r === 0
          ? "civic"
          : c === 2
            ? "commercial"
            : "residential";
    blocks.push({ points: polygon(c, r, width), kind, seed: c * 71 + r * 13 });
  }
export const pois = [
  { id: "uniao", nodeId: "A", name: "Praça da União", kind: "praca" },
  { id: "praca", nodeId: "I", name: "Praça da Liberdade", kind: "praca" },
  { id: "mercado", nodeId: "N2_3", name: "Mercado Popular", kind: "mercado" },
  {
    id: "igreja",
    nodeId: "N0_2",
    name: "Igreja de Santa Clara",
    kind: "igreja",
  },
  { id: "guarda", nodeId: "N3_2", name: "Comando da Guarda", kind: "governo" },
];
export const districts = [
  { name: "BAIRRO DA IGREJA", x: 195, y: 660, color: "#6b7e64" },
  { name: "CENTRO COMERCIAL", x: 660, y: 910, color: "#82715e" },
];
export const presets = [
  ["A", "N1_4", "N1_3", "N1_2", "N1_1", "I"],
  ["A", "N2_5", "N2_4", "N2_3", "N2_2", "I"],
  ["A", "N0_5", "N0_4", "N0_3", "N0_2", "N0_1", "N1_1", "I"],
];
export const routeProfiles = [
  {
    name: "Avenida central",
    description: "5 ruas · direta e visível; presença policial.",
    path: presets[0],
  },
  {
    name: "Pelo mercado",
    description: "5 ruas · mais entradas; maior desgaste.",
    path: presets[1],
  },
  {
    name: "Pela igreja",
    description: "7 ruas · pouco desgaste; quase nenhuma entrada.",
    path: presets[2],
  },
];
