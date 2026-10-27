/** Deterministic, irregular city graph. Geometry is shared by route planning and rendering. */
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
}
export interface CityBlock {
  points: Point[];
  kind: "park" | "civic" | "commercial" | "industrial" | "residential";
  seed: number;
}
export const CITY_WIDTH = 1900;
export const CITY_HEIGHT = 3680;
const columns = [120, 245, 475, 590, 845, 1000, 1250, 1360, 1570, 1760];
const rows = [
  125, 245, 470, 615, 875, 1015, 1260, 1390, 1625, 1750, 2020, 2140, 2340, 2470,
  2720, 2850, 3100, 3220, 3450, 3600,
];
const jitter = (c: number, r: number, k: number) =>
  Math.sin(c * 19.13 + r * 7.71 + k * 11.91) * 17;
export const idAt = (c: number, r: number) =>
  c === 4 && r === 18 ? "A" : c === 5 && r === 2 ? "I" : `N${c}_${r}`;
export const nodes: CityNode[] = rows.flatMap((y, r) =>
  columns.map((x, c) => ({
    id: idAt(c, r),
    col: c,
    row: r,
    x: x + jitter(c, r, 1) + (r < 6 ? Math.sin(r * 0.65) * 30 : 0),
    y: y + jitter(c, r, 2) + (c > 6 ? Math.sin(c) * 20 : 0),
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
function add(c: number, r: number, dc: number, dr: number, diagonal = false) {
  const a = idAt(c, r),
    b = idAt(c + dc, r + dr);
  let kind: Road["kind"] = "street",
    name = "";
  if (dc === 0 && [1, 5, 8].includes(c)) {
    kind = "avenue";
    name = {
      1: "Av. dos Trabalhadores",
      5: "Av. da República",
      8: "Av. das Indústrias",
    }[c]!;
  } else if (dr === 0 && [3, 8, 14, 18].includes(r)) {
    kind = "avenue";
    name = {
      3: "Av. da Constituição",
      8: "Av. da Memória",
      14: "Av. Popular",
      18: "Av. da União",
    }[r]!;
  } else if (diagonal) {
    kind = "avenue";
    name = "Boulevard da Liberdade";
  } else if ((c + r) % 5 === 0) {
    kind = "alley";
    name = dr === 0 ? "Travessa das Oficinas" : "Passagem dos Ipês";
  } else
    name =
      dr === 0
        ? [
            "Rua das Laranjeiras",
            "Rua do Mercado",
            "Rua da Esperança",
            "Rua da Estação",
            "Rua das Flores",
          ][r % 5]
        : [
            "Rua dos Arcos",
            "Rua das Palmeiras",
            "Rua do Sol",
            "Rua da Ponte",
            "Rua do Porto",
          ][c % 5];
  edges.push([a, b]);
  roads.set(key(a, b), {
    kind,
    name,
    capacity: kind === "avenue" ? 900 : kind === "street" ? 520 : 260,
  });
}
// A handful of missing separating streets produces superblocks, not an unbroken lattice.
const merged = [
  { c: 3, r: 6, kind: "civic" },
  { c: 7, r: 11, kind: "industrial" },
  { c: 3, r: 15, kind: "park" },
  { c: 7, r: 3, kind: "commercial" },
  { c: 4, r: 2, kind: "civic" },
  { c: 6, r: 5, kind: "park" },
  { c: 3, r: 9, kind: "residential" },
  { c: 7, r: 7, kind: "commercial" },
  { c: 4, r: 12, kind: "industrial" },
  { c: 6, r: 17, kind: "industrial" },
  { c: 3, r: 18, kind: "park" },
  { c: 7, r: 14, kind: "industrial" },
] as const;
for (let r = 0; r < 20; r++)
  for (let c = 0; c < 10; c++) {
    if (c < 9) add(c, r, 1, 0);
    if (r < 19 && !merged.some((m) => m.c === c && m.r === r)) add(c, r, 0, 1);
  }
const diagonals = [
  { c: 1, r: 5 },
  { c: 6, r: 8 },
  { c: 6, r: 15 },
  { c: 3, r: 11 },
];
for (const d of diagonals) add(d.c, d.r, 1, 1, true);
export const road = (a: string, b: string): Road =>
  roads.get(key(a, b)) ?? { kind: "street", name: "Rua local", capacity: 520 };
function polygon(c: number, r: number, w = 1): Point[] {
  return [
    node(idAt(c, r)),
    node(idAt(c + w, r)),
    node(idAt(c + w, r + 1)),
    node(idAt(c, r + 1)),
  ].map((p) => ({ x: p.x, y: p.y }));
}
const parks = new Set(["1,2", "5,9", "7,6", "2,17", "0,13", "6,17", "3,1"]);
export const blocks: CityBlock[] = [];
for (let r = 0; r < 19; r++)
  for (let c = 0; c < 9; c++) {
    const merge = merged.find((m) => m.r === r && (m.c === c || m.c === c + 1));
    if (merge && c === merge.c) continue;
    const w = merge ? 2 : 1;
    const pts = polygon(c, r, w),
      kind: CityBlock["kind"] =
        merge?.kind ??
        (parks.has(`${c},${r}`)
          ? "park"
          : c > 5 && r > 10
            ? "industrial"
            : r < 5
              ? "civic"
              : c < 3
                ? "residential"
                : "commercial");
    const diagonal = diagonals.some((d) => d.c === c && d.r === r);
    if (diagonal) {
      blocks.push(
        { points: [pts[0], pts[1], pts[2]], kind, seed: c * 71 + r * 13 },
        { points: [pts[0], pts[2], pts[3]], kind, seed: c * 71 + r * 13 + 1 },
      );
    } else blocks.push({ points: pts, kind, seed: c * 71 + r * 13 });
  }
export const pois = [
  {
    id: "congresso",
    nodeId: "I",
    name: "Congresso de Aurora",
    kind: "governo",
  },
  {
    id: "igreja",
    nodeId: "N2_8",
    name: "Igreja de Santa Clara",
    kind: "igreja",
  },
  {
    id: "empresa",
    nodeId: "N8_5",
    name: "Sede da Corporação Atlas",
    kind: "empresa",
  },
  {
    id: "jornal",
    nodeId: "N1_12",
    name: "Gráfica Voz do Governo",
    kind: "jornal",
  },
  { id: "praca", nodeId: "N5_10", name: "Praça da Liberdade", kind: "praca" },
  {
    id: "fabrica",
    nodeId: "N7_16",
    name: "Fábrica Horizonte",
    kind: "fabrica",
  },
  {
    id: "universidade",
    nodeId: "N2_3",
    name: "Universidade Popular",
    kind: "universidade",
  },
  { id: "uniao", nodeId: "A", name: "Praça da União", kind: "praca" },
];
export const districts = [
  { name: "ALTO AURORA", x: 420, y: 790, color: "#4f6760" },
  { name: "CENTRO CÍVICO", x: 1350, y: 825, color: "#71664e" },
  { name: "CIDADE BAIXA", x: 410, y: 2630, color: "#5c6a58" },
  { name: "DISTRITO INDUSTRIAL", x: 1350, y: 2740, color: "#665b55" },
];
function via(column: number) {
  const p = [idAt(4, 18)];
  const step = column > 4 ? 1 : -1;
  for (let c = 4 + step; step > 0 ? c <= column : c >= column; c += step)
    p.push(idAt(c, 18));
  for (let r = 17; r >= 2; r--) p.push(idAt(column, r));
  const finish = column > 5 ? -1 : 1;
  for (let c = column + finish; finish > 0 ? c <= 5 : c >= 5; c += finish)
    p.push(idAt(c, 2));
  return p;
}
export const presets = [via(5), via(2), via(8)];
