// Procedural fabric swatches. These are illustrations for learning, not photographs of real cloth.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(hex, k) { const c = rgb(hex).map((v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))))); return "rgb(" + c.join(",") + ")"; }
export function drawSwatch(cv, texture, color, seed = 1) {
  const g = cv.getContext("2d"), W = cv.width, H = cv.height, r = rng(seed * 9973 + texture.length);
  g.clearRect(0, 0, W, H); g.fillStyle = color; g.fillRect(0, 0, W, H);
  const lines = (dx, dy, step, col, w = 1) => { g.strokeStyle = col; g.lineWidth = w; for (let i = -H; i < W + H; i += step) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + dx, dy); g.stroke(); } };
  const dots = (n, col, rad) => { g.fillStyle = col; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(r() * W, r() * H, rad * (0.4 + r()), 0, 7); g.fill(); } };
  const dark = shade(color, -0.25), light = shade(color, 0.3);
  switch (texture) {
    case "plain": case "crepe": { const s = 3; for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) { g.fillStyle = (x / s + y / s) % 2 ? dark : light; g.globalAlpha = 0.16; g.fillRect(x, y, s, s); } g.globalAlpha = 1; if (texture === "crepe") dots(500, dark, 0.8); break; }
    case "twill": case "wool": lines(-H, H, 4, dark, 1.2); break;
    case "denim": lines(-H, H, 3, dark, 1.4); g.globalAlpha = 0.5; for (let y = 0; y < H; y += 3) { g.fillStyle = light; g.fillRect(0, y, W, 1); } g.globalAlpha = 1; dots(250, light, 0.8); break;
    case "jersey": case "knit": { g.strokeStyle = dark; g.lineWidth = 1.2; for (let y = 0; y < H; y += 6) for (let x = 0; x < W; x += 5) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2.5, y + 5); g.lineTo(x + 5, y); g.stroke(); } break; }
    case "rib": for (let x = 0; x < W; x += 6) { g.fillStyle = dark; g.fillRect(x, 0, 2, H); g.fillStyle = light; g.globalAlpha = 0.5; g.fillRect(x + 3, 0, 1, H); g.globalAlpha = 1; } break;
    case "satin": { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, dark); gr.addColorStop(0.35, light); gr.addColorStop(0.55, shade(color, 0.6)); gr.addColorStop(1, dark); g.fillStyle = gr; g.fillRect(0, 0, W, H); break; }
    case "velvet": { const gr = g.createRadialGradient(W * 0.4, H * 0.4, 5, W / 2, H / 2, W * 0.7); gr.addColorStop(0, shade(color, 0.25)); gr.addColorStop(1, shade(color, -0.4)); g.fillStyle = gr; g.fillRect(0, 0, W, H); dots(900, shade(color, 0.18), 0.7); break; }
    case "sheer": g.globalAlpha = 0.55; g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.globalAlpha = 1; for (let y = 0; y < H; y += 4) { g.fillStyle = color; g.globalAlpha = 0.35; g.fillRect(0, y, W, 1); } for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H); g.globalAlpha = 1; break;
    case "mesh": g.fillStyle = shade(color, -0.55); g.fillRect(0, 0, W, H); g.strokeStyle = color; g.lineWidth = 2; for (let y = 0; y < H + 8; y += 8) for (let x = 0; x < W + 8; x += 8) { g.beginPath(); g.arc(x + ((y / 8) % 2) * 4, y, 3.2, 0, 7); g.stroke(); } break;
    case "lace": g.fillStyle = shade(color, -0.5); g.fillRect(0, 0, W, H); g.strokeStyle = color; g.lineWidth = 1.5; for (let y = 6; y < H + 12; y += 12) for (let x = 6; x < W + 12; x += 12) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.moveTo(x - 5, y); g.quadraticCurveTo(x, y - 9, x + 5, y); g.stroke(); } break;
    case "linen": case "slub": for (let i = 0; i < 260; i++) { g.strokeStyle = r() > 0.5 ? dark : light; g.globalAlpha = 0.35; g.lineWidth = 0.6 + r() * 1.6; const y = r() * H, x = r() * W, l = 10 + r() * 40; g.beginPath(); if (r() > 0.5) { g.moveTo(x, y); g.lineTo(x + l, y); } else { g.moveTo(x, y); g.lineTo(x, y + l); } g.stroke(); } g.globalAlpha = 1; break;
    case "fleece": case "felt": dots(1600, light, 0.8); dots(1200, dark, 0.7); break;
    case "suede": dots(2200, light, 0.6); dots(1500, dark, 0.6); break;
    case "leather": case "coated": { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, shade(color, 0.15)); gr.addColorStop(1, shade(color, -0.25)); g.fillStyle = gr; g.fillRect(0, 0, W, H); if (texture === "leather") { g.strokeStyle = dark; g.lineWidth = 1; for (let i = 0; i < 380; i++) { const x = r() * W, y = r() * H; g.beginPath(); g.arc(x, y, 2 + r() * 2, 0, 7); g.stroke(); } } else lines(-H, H, 14, light, 0.6); break; }
    case "rubber": g.fillStyle = dark; g.globalAlpha = 0.3; g.fillRect(0, 0, W, H); g.globalAlpha = 1; dots(300, light, 0.6); break;
    case "boucle": for (let i = 0; i < 520; i++) { g.strokeStyle = r() > 0.5 ? dark : light; g.lineWidth = 1.4; g.beginPath(); g.arc(r() * W, r() * H, 2 + r() * 3, 0, 5.5); g.stroke(); } break;
    case "pique": g.strokeStyle = dark; g.lineWidth = 1; for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) { g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x + 8, y + 4); g.lineTo(x + 4, y + 8); g.lineTo(x, y + 4); g.closePath(); g.stroke(); } break;
    case "jacquard": g.strokeStyle = light; g.fillStyle = dark; for (let y = 0; y < H + 24; y += 24) for (let x = 0; x < W + 24; x += 24) { g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 9, y); g.lineTo(x, y + 9); g.lineTo(x - 9, y); g.closePath(); g.globalAlpha = 0.6; g.fill(); g.globalAlpha = 1; g.stroke(); g.beginPath(); g.arc(x + 12, y + 12, 3, 0, 7); g.stroke(); } break;
    case "sequin": for (let y = 0; y < H + 8; y += 8) for (let x = 0; x < W + 8; x += 8) { const gr = g.createRadialGradient(x - 1, y - 1, 0.5, x, y, 4.5); gr.addColorStop(0, "#fff"); gr.addColorStop(0.4, color); gr.addColorStop(1, dark); g.fillStyle = gr; g.beginPath(); g.arc(x + ((y / 8) % 2) * 4, y, 4.2, 0, 7); g.fill(); } break;
    case "quilt": for (let y = -H; y < H * 2; y += 28) { g.strokeStyle = dark; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + W); g.moveTo(0, y + W); g.lineTo(W, y); g.stroke(); } g.globalAlpha = 0.2; g.fillStyle = light; for (let y = 0; y < H; y += 28) for (let x = 0; x < W; x += 28) { g.beginPath(); g.arc(x + 14, y, 10, 0, 7); g.fill(); } g.globalAlpha = 1; break;
    default: dots(400, dark, 0.8);
  }
}
