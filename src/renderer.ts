import { Simulation, nodes, edges, node, key, length } from "./simulation";
import { C } from "./config";
export interface MapView {
  sim?: Simulation;
  route: string[];
  draft: string[];
  editing: boolean;
  zoom: number;
  pan: { x: number; y: number };
  follow: boolean;
}
export function drawMap(
  canvas: HTMLCanvasElement,
  time: number,
  view: MapView,
) {
  const ctx = canvas.getContext("2d")!;
  const { sim, route, draft, editing, zoom, pan, follow } = view;

  const box = canvas.getBoundingClientRect(),
    dpr = devicePixelRatio;
  const w = box.width;
  const h = box.height;
  if (
    canvas.width !== Math.round(w * dpr) ||
    canvas.height !== Math.round(h * dpr)
  ) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#172b2c";
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / 720, Math.max(120, h - 120) / 680) * zoom;
  let ox = (w - 680 * scale) / 2 + pan.x;
  let oy = (h - 680 * scale) / 2 + pan.y;
  if (follow && sim) {
    ox = w / 2 - sim.position.x * scale;
    oy = h / 2 - sim.position.y * scale;
  }
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const colors = ["#384b45", "#34484d", "#45463d", "#3b4846"];
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = colors[j * 2 + i];
      ctx.fillRect(132 + i * 240, 132 + j * 240, 176, 176);
      for (let a = 0; a < 3; a++)
        for (let b = 0; b < 3; b++) {
          ctx.fillStyle = (a + b) % 2 ? "#53605a" : "#606a60";
          ctx.fillRect(145 + i * 240 + a * 52, 146 + j * 240 + b * 52, 39, 37);
          ctx.fillStyle = "#748076";
          ctx.fillRect(149 + i * 240 + a * 52, 149 + j * 240 + b * 52, 31, 3);
        }
    }
  // Parque aberto do bairro Jardins e praça de concentração.
  ctx.fillStyle = "#39594b";
  ctx.fillRect(372, 372, 176, 176);
  ctx.fillStyle = "#83917a";
  ctx.fillRect(450, 372, 18, 176);
  ctx.fillRect(372, 450, 176, 18);
  for (const x of [398, 426, 492, 522]) {
    for (const y of [400, 428, 494, 522]) {
      ctx.fillStyle = "#254237";
      ctx.beginPath();
      ctx.arc(x + 2, y + 3, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#63816a";
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#8b967d";
  ctx.fillRect(55, 55, 28, 28);
  ctx.textAlign = "center";
  ctx.font = `${Math.max(12, 8 / scale)}px sans-serif`;
  ["CENTRO CÍVICO", "BAIRRO INDUSTRIAL", "RIBEIRA", "JARDINS"].forEach(
    (t, i) => {
      ctx.fillStyle = "#a2b0a1";
      ctx.fillText(t, 220 + (i % 2) * 240, 225 + Math.floor(i / 2) * 240);
    },
  );
  for (const [a, b] of edges) {
    const n = node(a),
      m = node(b),
      k = key(a, b);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#6e7770";
    ctx.lineWidth = 44;
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(m.x, m.y);
    ctx.stroke();
    ctx.strokeStyle = "#253739";
    ctx.lineWidth = 30;
    ctx.stroke();
    ctx.setLineDash([5, 10]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#75827b";
    ctx.stroke();
    ctx.setLineDash([]);
    if (sim?.travelled.has(k)) {
      ctx.strokeStyle = "#678e83";
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }
  function path(p: string[], color: string, width = 5) {
    if (!p.length) return;
    ctx.beginPath();
    p.forEach((id, i) => {
      const n = node(id);
      if (i === 0) ctx.moveTo(n.x, n.y);
      else ctx.lineTo(n.x, n.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  path(sim ? sim.route.slice(sim.index) : route, "#eabe66");
  if (editing) path(draft, "#68d8bf", 8);
  nodes.forEach((n) => {
    ctx.fillStyle =
      n.id === "A" ? "#68d8bf" : n.id === "I" ? "#eabe66" : "#d9dfca";
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.id === "A" || n.id === "I" ? 16 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#15282b";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(n.id, n.x, n.y + 4);
  });
  ctx.fillStyle = "#cbd7bf";
  ctx.font = `${Math.max(13, 9 / scale)}px sans-serif`;
  ctx.fillText("PRAÇA DA UNIÃO", 100, 62);
  ctx.fillText("ASSEMBLEIA", 580, 624);
  if (sim) {
    const s = sim;
    for (const k of s.blocked) {
      const [a, b] = k.split("-"),
        n = node(a),
        m = node(b),
        x = (n.x + m.x) / 2,
        y = (n.y + m.y) / 2;
      ctx.fillStyle = "#ed6868";
      ctx.fillRect(x - 22, y - 10, 44, 20);
      ctx.fillStyle = "#172b2c";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("× ×", x, y + 6);
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
        b = node(s.route[Math.min(idx + 1, s.route.length - 1)]);
      const t = Math.max(0, Math.min(1, at / (length(a.id, b.id) || 1))),
        dx = b.x - a.x,
        dy = b.y - a.y,
        l = Math.hypot(dx, dy) || 1;
      const joinProgress = Math.min(1, (s.distance - s.lastJoinDistance) / 45);
      const isNewGroup =
        i >= count - Math.ceil(C.recruitment / C.peoplePerSprite);
      const lateralEntry = isNewGroup
        ? (1 - joinProgress) * (i % 2 ? 35 : -35)
        : 0;
      const side = (Math.floor(i / 14) - 2) * 4 + lateralEntry;
      const x = a.x + dx * t - (dy / l) * side,
        y = a.y + dy * t + (dx / l) * side;
      ctx.fillStyle = ["#f0c674", "#e1e3cd", "#d88971", "#8cbaa5"][i % 4];
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (s.resources.includes("Bandeiras e faixas") && i % 17 === 0) {
        ctx.strokeStyle = "#eee7c5";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 12);
        ctx.stroke();
        ctx.fillStyle = "#e76f52";
        ctx.fillRect(x, y - 12, 9 + Math.sin(time / 200 + i) * 2, 6);
      }
    }
    if (s.used.get(s.street)?.has("faixa")) {
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
      ctx.fillText("VOZ DO POVO", 0, 3);
      ctx.restore();
    }
  }

  return { scale, ox, oy };
}
