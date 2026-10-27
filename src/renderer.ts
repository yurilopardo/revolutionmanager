import type { Simulation } from "./simulation";
import { C } from "./config";
import {
  CITY_WIDTH,
  CITY_HEIGHT,
  blocks,
  districts,
  nodes,
  edges,
  node,
  key,
  length,
  road,
  pois,
  type Point,
} from "./city";
export interface MapView {
  sim?: Simulation;
  route: string[];
  draft: string[];
  editing: boolean;
  zoom: number;
  pan: { x: number; y: number };
  follow: boolean;
  overview?: boolean;
  destination?: string;
}
/** Shared with pointer controls, so toggling follow/overview keeps the camera continuous. */
export function getMapTransform(w: number, h: number, view: MapView) {
  const { overview, zoom, pan, follow, sim } = view;
  const scale =
    (overview
      ? Math.min((w - 36) / CITY_WIDTH, (h - 140) / CITY_HEIGHT)
      : Math.min(0.78, w / 720)) * zoom;
  const center = overview
    ? { x: CITY_WIDTH / 2, y: CITY_HEIGHT / 2 }
    : follow && sim
      ? sim.position
      : node("A");
  return {
    scale,
    ox: w / 2 - center.x * scale + pan.x,
    oy: h / 2 - center.y * scale + pan.y,
  };
}
export function drawMap(
  canvas: HTMLCanvasElement,
  time: number,
  view: MapView,
) {
  const ctx = canvas.getContext("2d")!,
    { sim, route, draft, editing, overview } = view;
  const { width: w, height: h } = canvas.getBoundingClientRect(),
    dpr = devicePixelRatio;
  if (
    canvas.width !== Math.round(w * dpr) ||
    canvas.height !== Math.round(h * dpr)
  ) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const { scale, ox, oy } = getMapTransform(w, h, view);
  const left = -ox / scale,
    top = -oy / scale,
    right = (w - ox) / scale,
    bottom = (h - oy) / scale;
  const visible = (points: Point[], margin = 80) =>
    points.some(
      (p) =>
        p.x > left - margin &&
        p.x < right + margin &&
        p.y > top - margin &&
        p.y < bottom + margin,
    ) ||
    (points.length > 2 &&
      Math.min(...points.map((p) => p.x)) < right &&
      Math.max(...points.map((p) => p.x)) > left &&
      Math.min(...points.map((p) => p.y)) < bottom &&
      Math.max(...points.map((p) => p.y)) > top);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#14282c";
  ctx.fillRect(0, 0, w, h);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#273934";
  ctx.fillRect(45, 45, CITY_WIDTH - 90, CITY_HEIGHT - 60);
  // The coast bends along Aurora's western boundary; north is always fixed.
  ctx.fillStyle = "#1a4146";
  ctx.beginPath();
  ctx.moveTo(-200, 0);
  ctx.lineTo(50, 0);
  for (let y = 0; y <= CITY_HEIGHT; y += 90)
    ctx.lineTo(48 + Math.sin(y / 330) * 22, y);
  ctx.lineTo(-200, CITY_HEIGHT);
  ctx.fill();
  function polygon(points: Point[]) {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
  for (const block of blocks) {
    if (!visible(block.points)) continue;
    const cx = block.points.reduce((s, p) => s + p.x, 0) / block.points.length,
      cy = block.points.reduce((s, p) => s + p.y, 0) / block.points.length;
    const inset = block.points.map((p) => {
      const d = Math.hypot(p.x - cx, p.y - cy);
      return {
        x: p.x + (cx - p.x) * Math.min(0.33, 27 / d),
        y: p.y + (cy - p.y) * Math.min(0.33, 27 / d),
      };
    });
    const minX = Math.min(...inset.map((p) => p.x)),
      maxX = Math.max(...inset.map((p) => p.x)),
      minY = Math.min(...inset.map((p) => p.y)),
      maxY = Math.max(...inset.map((p) => p.y));
    ctx.save();
    polygon(inset);
    ctx.fillStyle =
      block.kind === "park"
        ? "#355c49"
        : block.kind === "industrial"
          ? "#4a4840"
          : block.kind === "civic"
            ? "#57604e"
            : "#3f4c42";
    ctx.fill();
    ctx.clip();
    if (block.kind === "park") {
      ctx.strokeStyle = "#9da282";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(minX, cy);
      ctx.lineTo(maxX, cy);
      ctx.moveTo(cx, minY);
      ctx.lineTo(cx, maxY);
      ctx.stroke();
      for (let x = minX + 14; x < maxX; x += 30)
        for (let y = minY + 14; y < maxY; y += 31) {
          if (Math.abs(x - cx) < 16 || Math.abs(y - cy) < 16) continue;
          ctx.fillStyle = "#244a37";
          ctx.beginPath();
          ctx.arc(x + 3, y + 3, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#6b8c61";
          ctx.beginPath();
          ctx.arc(x, y, 9 + (block.seed % 3), 0, Math.PI * 2);
          ctx.fill();
        }
      ctx.fillStyle = "#6f9c97";
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const stepX = block.kind === "industrial" ? 74 : 43 + (block.seed % 13),
        stepY = block.kind === "industrial" ? 65 : 48 + (block.seed % 17);
      for (let x = minX + 7; x < maxX; x += stepX)
        for (let y = minY + 7; y < maxY; y += stepY) {
          const roofWidth = stepX - 10 - (block.seed % 8),
            roofHeight = stepY - 10 - (block.seed % 9);
          ctx.fillStyle = "#25332e";
          ctx.fillRect(x + 4, y + 5, roofWidth, roofHeight);
          ctx.fillStyle =
            block.kind === "civic"
              ? "#a4a48b"
              : block.kind === "industrial"
                ? "#817965"
                : (Math.floor(x + y) + block.seed) % 3
                  ? "#73816e"
                  : "#8a8b72";
          ctx.fillRect(x, y, roofWidth, roofHeight);
          if (!overview) {
            ctx.fillStyle = "#b3b6a0";
            ctx.fillRect(x + 3, y + 3, roofWidth - 6, 3);
            ctx.fillStyle = "#4b5b50";
            ctx.fillRect(x + roofWidth / 2 - 5, y + roofHeight / 2 - 4, 10, 8);
          }
        }
    }
    ctx.restore();
  }
  for (const [a, b] of edges) {
    const n = node(a),
      m = node(b);
    if (!visible([n, m])) continue;
    const meta = road(a, b),
      width = meta.kind === "avenue" ? 45 : meta.kind === "street" ? 26 : 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(m.x, m.y);
    ctx.strokeStyle = meta.kind === "avenue" ? "#9b9f8a" : "#6a7b6b";
    ctx.lineWidth = width + 8;
    ctx.stroke();
    ctx.strokeStyle =
      meta.kind === "avenue"
        ? "#475350"
        : meta.kind === "alley"
          ? "#34433c"
          : "#354a43";
    ctx.lineWidth = width;
    ctx.stroke();
    if (meta.kind === "avenue") {
      ctx.strokeStyle = "#abaf86";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (!overview) {
        ctx.setLineDash([8, 12]);
        ctx.strokeStyle = "#728276";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const dx = m.x - n.x,
          dy = m.y - n.y,
          l = Math.hypot(dx, dy);
        ctx.moveTo(n.x - (dy / l) * 12, n.y + (dx / l) * 12);
        ctx.lineTo(m.x - (dy / l) * 12, m.y + (dx / l) * 12);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (sim?.travelled.has(key(a, b))) {
      ctx.strokeStyle = "#6aa294";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
    }
  }
  function path(p: string[], color: string, width: number, dashed = false) {
    if (!p.length) return;
    ctx.beginPath();
    p.forEach((id, i) => {
      const n = node(id);
      if (i) ctx.lineTo(n.x, n.y);
      else ctx.moveTo(n.x, n.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [10, 6] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  path(sim ? sim.route.slice(sim.index) : route, "#eec773", overview ? 12 : 6);
  if (sim && !sim.finished && sim.offset > 0) {
    const n = node(sim.route[sim.index]);
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(sim.position.x, sim.position.y);
    ctx.strokeStyle = "#68b9a7";
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  if (editing) path(draft, "#63e2cd", overview ? 16 : 9, true);
  if (overview) {
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "center";
    for (const d of districts) {
      ctx.fillStyle = "#c9d2bc77";
      ctx.fillText(d.name, d.x, d.y);
    }
  }
  // Only label route intersections at street level; the whole city has 200 nodes.
  const relevant = new Set([...route, ...draft]);
  if (!overview)
    for (const n of nodes) {
      if (!visible([n], 10)) continue;
      ctx.fillStyle = relevant.has(n.id) ? "#dce3c9" : "#81937c";
      ctx.beginPath();
      ctx.arc(n.x, n.y, relevant.has(n.id) ? 6 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (relevant.has(n.id) && scale > 0.4) {
        ctx.fillStyle = "#dbdfce";
        ctx.font = `${9 / scale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(n.id, n.x, n.y - 13);
      }
    }
  const destination =
    view.destination ??
    (sim as unknown as { mission?: { destination?: string } } | undefined)
      ?.mission?.destination ??
    "I";
  const icons: Record<string, string> = {
    governo: "C",
    igreja: "†",
    empresa: "A",
    jornal: "J",
    praca: "P",
    fabrica: "F",
    universidade: "U",
  };
  for (const poi of pois) {
    const n = node(poi.nodeId);
    if (!visible([n], 60)) continue;
    const selected = poi.nodeId === destination,
      start = poi.nodeId === "A";
    const radius = overview ? 5 / scale : 13;
    ctx.fillStyle = selected ? "#f5ce7c" : start ? "#6ed6be" : "#bdd0ad";
    ctx.beginPath();
    ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#192d2b";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#213632";
    ctx.textAlign = "center";
    ctx.font = `bold ${overview ? 9 / scale : 14}px sans-serif`;
    ctx.fillText(
      start ? "A" : (icons[poi.kind] ?? "•"),
      n.x,
      n.y + (overview ? 3 / scale : 5),
    );
    if (!overview || selected || start) {
      ctx.font = `${overview ? 10 / scale : Math.max(14, 10 / scale)}px sans-serif`;
      const label = selected ? "◎ " + poi.name : poi.name;
      const textY = n.y - radius - (overview ? 15 : 12);
      ctx.lineJoin = "round";
      ctx.lineWidth = 5 / scale;
      ctx.strokeStyle = "#152c2bdd";
      ctx.strokeText(label, n.x, textY);
      ctx.fillStyle = selected ? "#f7dca3" : "#d5dfc7";
      ctx.fillText(label, n.x, textY);
    }
  }
  // Street labels follow road direction and are deliberately subordinate to landmarks.
  if (!overview && scale > 0.45) {
    ctx.textAlign = "center";
    ctx.font = `${Math.max(12, 8 / scale)}px sans-serif`;
    let i = 0;
    for (const [a, b] of edges) {
      const n = node(a),
        m = node(b),
        r = road(a, b);
      if (r.kind !== "avenue" || !visible([n, m]) || i++ % 3) continue;
      ctx.save();
      ctx.translate((n.x + m.x) / 2, (n.y + m.y) / 2);
      let angle = Math.atan2(m.y - n.y, m.x - n.x);
      if (angle > Math.PI / 2) angle -= Math.PI;
      ctx.rotate(angle);
      ctx.fillStyle = "#dce1bc99";
      ctx.fillText(r.name, 0, -8);
      ctx.restore();
    }
  }
  if (sim) {
    const s = sim;
    for (const k of s.blocked) {
      const [a, b] = k.split("-");
      if (!a || !b) continue;
      const n = node(a),
        m = node(b);
      if (!visible([n, m])) continue;
      const x = (n.x + m.x) / 2,
        y = (n.y + m.y) / 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(m.y - n.y, m.x - n.x));
      ctx.fillStyle = "#ed7871";
      ctx.fillRect(-7, -24, 14, 48);
      ctx.fillStyle = "#322c2b";
      for (let j = -22; j < 24; j += 10) ctx.fillRect(-7, j, 14, 4);
      ctx.restore();
    }
    const police =
      (
        s as unknown as {
          police?: {
            nodeId: string;
            strength: number;
            resolved?: boolean;
            encountered?: boolean;
          }[];
        }
      ).police ?? [];
    const encounter = (s as unknown as { policeEncounter?: { nodeId: string } })
      .policeEncounter;
    for (const unit of police) {
      if (unit.resolved) continue;
      const n = node(unit.nodeId);
      if (!visible([n])) continue;
      ctx.strokeStyle =
        encounter?.nodeId === unit.nodeId ? "#ed7871" : "#5ba3cf99";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 35, 0, Math.PI * 2);
      ctx.stroke();
      if (encounter?.nodeId === unit.nodeId) {
        ctx.fillStyle = "#ed787133";
        ctx.beginPath();
        ctx.arc(n.x, n.y, 44, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#5ba3cf";
      for (let i = 0; i < 4; i++)
        ctx.fillRect(n.x - 28 + i * 17, n.y - 27, 11, 15);
      if (!overview) {
        ctx.fillStyle = "#c5e1f1";
        ctx.font = `bold ${Math.max(12, 9 / scale)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`POLÍCIA · ${unit.strength}`, n.x, n.y - 43);
      }
    }
    const count = Math.ceil(s.present / C.peoplePerSprite);
    for (let i = 0; i < count; i++) {
      const behind = (i % 14) * 4;
      let at = s.offset - behind,
        idx = s.index;
      while (at < 0 && idx > 0) {
        idx--;
        at += length(s.route[idx], s.route[idx + 1]);
      }
      const a = node(s.route[idx]),
        b = node(s.route[Math.min(idx + 1, s.route.length - 1)]),
        t = Math.max(0, Math.min(1, at / (length(a.id, b.id) || 1))),
        dx = b.x - a.x,
        dy = b.y - a.y,
        l = Math.hypot(dx, dy) || 1;
      const joined = Math.min(1, (s.distance - s.lastJoinDistance) / 45),
        newGroup = i >= count - Math.ceil(C.recruitment / C.peoplePerSprite),
        side =
          (Math.floor(i / 14) - 2) * 4 +
          (newGroup ? (1 - joined) * (i % 2 ? 35 : -35) : 0),
        x = a.x + dx * t - (dy / l) * side,
        y = a.y + dy * t + (dx / l) * side;
      ctx.fillStyle = ["#f2cf83", "#ede5c9", "#d88c73", "#8fbe9a"][i % 4];
      ctx.beginPath();
      ctx.arc(x, y, overview ? 7 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      if (
        !overview &&
        s.resources.includes("Bandeiras e faixas") &&
        i % 17 === 0
      ) {
        ctx.strokeStyle = "#eee7c5";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 15);
        ctx.stroke();
        ctx.fillStyle = "#ed795e";
        ctx.fillRect(x, y - 15, 10 + Math.sin(time / 200 + i) * 2, 7);
      }
    }
    if (s.used.get(s.street)?.has("faixa") && !overview) {
      const p = s.position;
      ctx.save();
      ctx.translate(p.x, p.y);
      const a = node(s.route[s.index]),
        b = node(s.route[Math.min(s.index + 1, s.route.length - 1)]);
      ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
      ctx.fillStyle = "#eee7c5";
      ctx.fillRect(-24, -10, 48, 20);
      ctx.fillStyle = "#933c36";
      ctx.font = "bold 7px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("VOZ DO POVO", 0, 3);
      ctx.restore();
    }
    if (overview) {
      ctx.fillStyle = "#f6d180";
      ctx.strokeStyle = "#172c2c";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(s.position.x, s.position.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  return { scale, ox, oy };
}
