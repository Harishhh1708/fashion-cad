import { requireAuth, showMsg } from "./auth.js";
import { getProject, saveProjectData } from "./account.js";
import { dist, area, bbox, rectPts, ellipsePts, quad, distSeg, inPoly, offsetPoly } from "./geometry.js";

const $ = (id) => document.getElementById(id);
const UNITS = { cm: { k: 10, d: 1, snap: 5 }, in: { k: 25.4, d: 2, snap: 6.35 }, mm: { k: 1, d: 1, snap: 1 } };
let unit = "cm"; try { unit = localStorage.getItem("fc-units") || "cm"; } catch (e) {}
if (!UNITS[unit]) unit = "cm";
const fmt = (mm) => (mm / UNITS[unit].k).toFixed(UNITS[unit].d) + " " + unit;
const num = (mm, extra = 1) => (mm / UNITS[unit].k).toFixed(UNITS[unit].d + extra);
const toMM = (v) => parseFloat(v) * UNITS[unit].k;

const TOOLS = [["select","Select","V"],["pan","Pan","H"],["line","Line","L"],["rect","Rectangle","R"],["ellipse","Ellipse","E"],["poly","Polygon","P"],["curve","Curve","C"],["measure","Measure","M"],["text","Text","T"]];
const HINT = {
  select: "Click a shape to select. Drag to move. Drag a point to reshape. Delete removes.",
  pan: "Drag to pan. Scroll to zoom. You can also pan with the middle mouse button.",
  line: "Click the start, then the end. Hold Shift for 15° angles. Esc cancels.",
  rect: "Click one corner, then the opposite corner.",
  ellipse: "Click the centre, then a point on the edge box.",
  poly: "Click each corner. Click the first point, press Enter, or double-click to close.",
  curve: "Click the start, then the bend control point, then the end.",
  measure: "Click two points to leave a dimension on the pattern.",
  text: "Click where the note should go."
};
const TITLE = { line: "Line", rect: "Rectangle", ellipse: "Ellipse", poly: "Polygon", curve: "Curve", dim: "Dimension", text: "Text" };

let doc = { v: 1, seam: 15, shapes: [] }, hist = [], hi = -1, dirty = false, uid = null, pid = null, nextId = 1;
let tool = "select", sel = null, drawing = [], cur = [0, 0], drag = null, snapOn = true, gridOn = true, shiftDown = false;
const view = { s: 2, ox: 60, oy: 60 };
const cv = $("cv"), ctx = cv.getContext("2d"); let W = 800, H = 600;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const w2s = (p) => [p[0] * view.s + view.ox, p[1] * view.s + view.oy];
const s2w = (p) => [(p[0] - view.ox) / view.s, (p[1] - view.oy) / view.s];
const shape = (id) => doc.shapes.find((s) => s.id === id);
const clone = (x) => JSON.parse(JSON.stringify(x));
const sn = (p) => { if (!snapOn) return p; const st = UNITS[unit].snap; return [Math.round(p[0] / st) * st, Math.round(p[1] / st) * st]; };

// ---------- geometry per shape ----------
const closedTypes = ["rect", "ellipse", "poly"];
const polyOf = (s) => s.type === "rect" ? rectPts(s.pts) : s.type === "ellipse" ? ellipsePts(s.pts, 64) : s.pts;
const seamOf = (s) => s.type === "ellipse" ? ellipsePts(s.pts, 64, doc.seam) : offsetPoly(polyOf(s), doc.seam);
const curveOf = (s) => quad(s.pts[0], s.pts[1], s.pts[2], 40);
const textW = (s) => s.text.length * s.size * 0.6;
function extent(s) {
  if (s.type === "text") return [s.pts[0], [s.pts[0][0] + textW(s), s.pts[0][1] - s.size]];
  if (s.type === "curve") return curveOf(s);
  if (closedTypes.includes(s.type)) return s.seam ? seamOf(s) : polyOf(s);
  return s.pts;
}
function hitTest(p) {
  const tol = 7 / view.s;
  for (let i = doc.shapes.length - 1; i >= 0; i--) {
    const s = doc.shapes[i];
    if (s.type === "line" || s.type === "dim") { if (distSeg(p, s.pts[0], s.pts[1]) < tol) return s; }
    else if (s.type === "curve") { const c = curveOf(s); for (let j = 0; j < c.length - 1; j++) if (distSeg(p, c[j], c[j + 1]) < tol) return s; }
    else if (s.type === "text") { const [a, b] = extent(s); if (p[0] >= a[0] - tol && p[0] <= b[0] + tol && p[1] <= a[1] + tol && p[1] >= b[1] - tol) return s; }
    else { const pl = polyOf(s); if (inPoly(p, pl)) return s; for (let j = 0; j < pl.length; j++) if (distSeg(p, pl[j], pl[(j + 1) % pl.length]) < tol) return s; }
  }
  return null;
}

// ---------- history ----------
function setDirty(d) { dirty = d; $("status").textContent = d ? "Unsaved changes" : $("status").textContent; }
function commit() {
  hist = hist.slice(0, hi + 1); hist.push(JSON.stringify(doc)); if (hist.length > 150) hist.shift(); hi = hist.length - 1;
  setDirty(true); renderPanel(); renderList(); draw();
}
function restore(i) { if (i < 0 || i >= hist.length) return; doc = JSON.parse(hist[i]); hi = i; if (!shape(sel)) sel = null; setDirty(true); renderPanel(); renderList(); draw(); }
function addShape(o) { o.id = nextId++; doc.shapes.push(o); sel = o.id; setTool("select"); commit(); }

// ---------- drawing ----------
function resize() {
  const r = cv.parentElement.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; cv.style.width = W + "px"; cv.style.height = H + "px";
  ctx.setTransform(d, 0, 0, d, 0, 0); draw();
}
function drawGrid(col) {
  let step = UNITS[unit].k * (unit === "mm" ? 10 : 1); while (step * view.s < 8) step *= 5;
  const a = s2w([0, 0]), b = s2w([W, H]); ctx.strokeStyle = col; ctx.lineWidth = 1;
  for (let x = Math.floor(a[0] / step) * step; x <= b[0]; x += step) { const m = Math.round(x / step) % 5 === 0; ctx.globalAlpha = m ? 1 : 0.45; const sx = Math.round(x * view.s + view.ox) + 0.5; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke(); }
  for (let y = Math.floor(a[1] / step) * step; y <= b[1]; y += step) { const m = Math.round(y / step) % 5 === 0; ctx.globalAlpha = m ? 1 : 0.45; const sy = Math.round(y * view.s + view.oy) + 0.5; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function path(pts, close) { ctx.beginPath(); pts.forEach((q, i) => { const p = w2s(q); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); if (close) ctx.closePath(); }
function label(txt, q, col, size = 13, dy = 0) { const p = w2s(q); ctx.fillStyle = col; ctx.font = "600 " + size + "px DM Sans, sans-serif"; ctx.textAlign = "center"; ctx.fillText(txt, p[0], p[1] + dy); ctx.textAlign = "left"; }
function drawShape(s, selected, c, preview) {
  const col = selected ? c.pink : s.type === "dim" ? c.tape : c.chalk;
  ctx.strokeStyle = col; ctx.lineWidth = selected ? 2.5 : 2; ctx.setLineDash(preview ? [5, 4] : []);
  if (s.type === "line" || s.type === "dim") {
    path(s.pts, false); ctx.stroke();
    if (s.type === "dim") { const m = [(s.pts[0][0] + s.pts[1][0]) / 2, (s.pts[0][1] + s.pts[1][1]) / 2]; label(fmt(dist(s.pts[0], s.pts[1])), m, c.tape, 13, -7); s.pts.forEach((q) => { const p = w2s(q); ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fillStyle = c.tape; ctx.fill(); }); }
  } else if (s.type === "curve") { path(curveOf(s), false); ctx.stroke(); }
  else if (s.type === "polyline") { path(s.pts, false); ctx.stroke(); }
  else if (s.type === "text") { const p = w2s(s.pts[0]); ctx.fillStyle = col; ctx.font = "600 " + Math.max(8, s.size * view.s) + "px DM Sans, sans-serif"; ctx.fillText(s.text, p[0], p[1]); }
  else {
    if (s.seam && !preview) { ctx.setLineDash([7, 5]); ctx.strokeStyle = selected ? c.pink : c.tape; ctx.lineWidth = 1.5; path(seamOf(s), true); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = col; ctx.lineWidth = selected ? 2.5 : 2; }
    path(polyOf(s), true); ctx.globalAlpha = 0.07; ctx.fillStyle = c.chalk; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    if (s.label && !preview) { const b = bbox(polyOf(s)); label(s.label, [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2], c.chalk, 14, 5); }
  }
  ctx.setLineDash([]);
  if (selected && !preview) s.pts.forEach((q) => { const p = w2s(q); ctx.fillStyle = c.pink; ctx.fillRect(p[0] - 4, p[1] - 4, 8, 8); });
}
function draw() {
  const c = { chalk: css("--chalk"), pink: css("--pink"), tape: css("--tape") };
  ctx.fillStyle = css("--mat"); ctx.fillRect(0, 0, W, H);
  if (gridOn) drawGrid(css("--grid"));
  const o = w2s([0, 0]); ctx.strokeStyle = c.tape; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(o[0] - 8, o[1]); ctx.lineTo(o[0] + 8, o[1]); ctx.moveTo(o[0], o[1] - 8); ctx.lineTo(o[0], o[1] + 8); ctx.stroke(); ctx.globalAlpha = 1;
  doc.shapes.forEach((s) => drawShape(s, s.id === sel, c, false));
  const pv = previewShape(); if (pv) drawShape(pv, true, c, true);
}
function previewShape() {
  if (!drawing.length) return null; const pts = [...drawing, cur];
  if (tool === "poly") return { type: "polyline", pts };
  if (tool === "curve") return pts.length === 2 ? { type: "line", pts } : { type: "curve", pts };
  const t = tool === "measure" ? "dim" : tool; return ["line", "rect", "ellipse", "dim"].includes(t) ? { type: t, pts } : null;
}
function liveLen() {
  if (!drawing.length) return "";
  const a = drawing[drawing.length - 1];
  if (tool === "rect" || tool === "ellipse") { const f = tool === "ellipse" ? 2 : 1; return fmt(Math.abs(cur[0] - drawing[0][0]) * f) + " × " + fmt(Math.abs(cur[1] - drawing[0][1]) * f); }
  return "Length " + fmt(dist(a, cur));
}

// ---------- tools / input ----------
function setTool(t) {
  tool = t; drawing = [];
  document.querySelectorAll("#tools button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.t === t));
  $("st-hint").textContent = HINT[t]; cv.style.cursor = t === "pan" ? "grab" : t === "select" ? "default" : "crosshair"; draw();
}
function constrain(p) {
  if (!shiftDown || !drawing.length || !["line", "measure", "poly"].includes(tool)) return p;
  const a = drawing[drawing.length - 1], ang = Math.round(Math.atan2(p[1] - a[1], p[0] - a[0]) / (Math.PI / 12)) * (Math.PI / 12), L = dist(a, p);
  return [a[0] + L * Math.cos(ang), a[1] + L * Math.sin(ang)];
}
const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
function finishTool() {
  const d = drawing; drawing = []; if (d.length < 2 || dist(d[0], d[1]) < 0.5) { draw(); return; }
  if (tool === "line") addShape({ type: "line", pts: d });
  else if (tool === "measure") addShape({ type: "dim", pts: d });
  else if (tool === "rect") addShape({ type: "rect", pts: d, seam: false, label: "" });
  else if (tool === "ellipse") addShape({ type: "ellipse", pts: d, seam: false, label: "" });
  else if (tool === "curve") addShape({ type: "curve", pts: d });
}
function finishPoly() { const d = drawing; drawing = []; if (d.length >= 3) addShape({ type: "poly", pts: d, seam: false, label: "" }); else draw(); }

cv.addEventListener("pointerdown", (e) => {
  cv.focus(); cv.setPointerCapture(e.pointerId);
  const sp = pos(e), raw = s2w(sp);
  if (e.button === 1 || e.button === 2 || tool === "pan") { drag = { mode: "pan", sx: sp[0], sy: sp[1], ox: view.ox, oy: view.oy }; return; }
  if (tool === "select") {
    const s = shape(sel);
    if (s) { const i = s.pts.findIndex((q) => dist(w2s(q), sp) < 9); if (i >= 0) { drag = { mode: "vertex", idx: i, moved: false }; return; } }
    const h = hitTest(raw); sel = h ? h.id : null;
    if (h) drag = { mode: "move", start: sn(raw), orig: clone(h.pts), moved: false };
    renderPanel(); renderList(); draw(); return;
  }
  const p = constrain(sn(raw));
  if (tool === "text") { const t = prompt("Text note"); if (t && t.trim()) addShape({ type: "text", pts: [p], text: t.trim().slice(0, 80), size: 20 }); return; }
  if (tool === "poly") { if (drawing.length >= 3 && dist(w2s(drawing[0]), sp) < 10) { finishPoly(); return; } drawing.push(p); draw(); return; }
  drawing.push(p);
  if (drawing.length === (tool === "curve" ? 3 : 2)) finishTool(); else draw();
});
cv.addEventListener("pointermove", (e) => {
  const sp = pos(e), raw = s2w(sp); cur = constrain(sn(raw));
  $("st-pos").textContent = num(raw[0], 0) + ", " + num(raw[1], 0) + " " + unit; $("st-len").textContent = liveLen();
  if (drag) {
    if (drag.mode === "pan") { view.ox = drag.ox + sp[0] - drag.sx; view.oy = drag.oy + sp[1] - drag.sy; }
    else { const s = shape(sel); if (!s) return;
      if (drag.mode === "move") { const q = sn(raw), dx = q[0] - drag.start[0], dy = q[1] - drag.start[1]; s.pts = drag.orig.map((v) => [v[0] + dx, v[1] + dy]); drag.moved = true; }
      else if (drag.mode === "vertex") { s.pts[drag.idx] = sn(raw); drag.moved = true; } }
  }
  draw();
});
const endDrag = () => { if (drag && drag.moved) commit(); drag = null; };
cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
cv.addEventListener("contextmenu", (e) => e.preventDefault());
cv.addEventListener("dblclick", () => { if (tool === "poly" && drawing.length >= 3) { drawing.pop(); finishPoly(); } });
cv.addEventListener("wheel", (e) => {
  e.preventDefault(); const sp = pos(e), w = s2w(sp), f = Math.exp(-e.deltaY * 0.0015);
  view.s = Math.min(40, Math.max(0.2, view.s * f)); view.ox = sp[0] - w[0] * view.s; view.oy = sp[1] - w[1] * view.s; draw();
}, { passive: false });
function fitView() {
  const pts = doc.shapes.flatMap(extent); if (!pts.length) { view.s = 2; view.ox = 60; view.oy = 60; draw(); return; }
  const b = bbox(pts), pad = 60, w = b.maxX - b.minX || 1, h = b.maxY - b.minY || 1;
  view.s = Math.min(40, Math.max(0.2, Math.min((W - pad * 2) / w, (H - pad * 2) / h)));
  view.ox = (W - w * view.s) / 2 - b.minX * view.s; view.oy = (H - h * view.s) / 2 - b.minY * view.s; draw();
}
window.addEventListener("keydown", (e) => {
  if (e.key === "Shift") shiftDown = true;
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); restore(e.shiftKey ? hi + 1 : hi - 1); return; }
  if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); restore(hi + 1); return; }
  if ((e.ctrlKey || e.metaKey) && k === "s") { e.preventDefault(); save(); return; }
  if ((e.ctrlKey || e.metaKey) && k === "d") { e.preventDefault(); duplicate(); return; }
  if (k === "escape") { drawing = []; sel = null; renderPanel(); renderList(); draw(); return; }
  if (k === "enter" && tool === "poly") { finishPoly(); return; }
  if ((k === "delete" || k === "backspace") && sel) { e.preventDefault(); removeSel(); return; }
  const t = TOOLS.find((x) => x[2].toLowerCase() === k); if (t && !e.ctrlKey && !e.metaKey) setTool(t[0]);
});
window.addEventListener("keyup", (e) => { if (e.key === "Shift") shiftDown = false; });

// ---------- actions ----------
function removeSel() { if (!sel) return; doc.shapes = doc.shapes.filter((s) => s.id !== sel); sel = null; commit(); }
function duplicate() { const s = shape(sel); if (!s) return; const c = clone(s); c.id = nextId++; c.pts = c.pts.map((p) => [p[0] + 20, p[1] + 20]); doc.shapes.push(c); sel = c.id; commit(); }
function mirror() { const s = shape(sel); if (!s) return; const b = bbox(extent(s)), cx = (b.minX + b.maxX) / 2; s.pts = s.pts.map((p) => [2 * cx - p[0], p[1]]); commit(); }

// ---------- side panel ----------
function field(parent, text, val, fn, type) {
  const l = document.createElement("label"); l.textContent = text; const i = document.createElement("input"); if (type) i.type = type;
  if (type === "checkbox") i.checked = val; else i.value = val; l.append(i); parent.append(l);
  i.addEventListener("change", () => fn(type === "checkbox" ? i.checked : i.value)); return i;
}
function note(parent, t) { const p = document.createElement("p"); p.className = "ro"; p.textContent = t; parent.append(p); }
function btn(parent, t, fn, cls) { const b = document.createElement("button"); b.className = "mini " + (cls || ""); b.textContent = t; b.onclick = fn; parent.append(b); return b; }
function renderPanel() {
  const p = $("props"); p.textContent = ""; const s = shape(sel), h = document.createElement("h3"); h.textContent = s ? TITLE[s.type] : "Pattern settings"; p.append(h);
  if (!s) {
    field(p, "Seam allowance (" + unit + ")", num(doc.seam), (v) => { const m = toMM(v); if (m >= 0 && m <= 100) { doc.seam = m; commit(); } else showMsg($("msg"), "Seam allowance must be between 0 and 100 mm."); });
    note(p, "Applies to every shape that has seam allowance switched on. Select a shape to edit its size by typing exact values."); return;
  }
  const a = s.pts[0], b = s.pts[1];
  if (s.type === "line" || s.type === "dim") field(p, "Length (" + unit + ")", num(dist(a, b)), (v) => { const m = toMM(v), L = dist(a, b) || 1; if (m > 0) { s.pts[1] = [a[0] + (b[0] - a[0]) / L * m, a[1] + (b[1] - a[1]) / L * m]; commit(); } });
  if (s.type === "rect") {
    field(p, "Width (" + unit + ")", num(Math.abs(b[0] - a[0])), (v) => { const m = toMM(v); if (m > 0) { s.pts[1] = [a[0] + (Math.sign(b[0] - a[0]) || 1) * m, b[1]]; commit(); } });
    field(p, "Height (" + unit + ")", num(Math.abs(b[1] - a[1])), (v) => { const m = toMM(v); if (m > 0) { s.pts[1] = [b[0], a[1] + (Math.sign(b[1] - a[1]) || 1) * m]; commit(); } });
  }
  if (s.type === "ellipse") {
    field(p, "Width (" + unit + ")", num(Math.abs(b[0] - a[0]) * 2), (v) => { const m = toMM(v); if (m > 0) { s.pts[1] = [a[0] + (Math.sign(b[0] - a[0]) || 1) * m / 2, b[1]]; commit(); } });
    field(p, "Height (" + unit + ")", num(Math.abs(b[1] - a[1]) * 2), (v) => { const m = toMM(v); if (m > 0) { s.pts[1] = [b[0], a[1] + (Math.sign(b[1] - a[1]) || 1) * m / 2]; commit(); } });
  }
  if (s.type === "curve") { const c = curveOf(s); let L = 0; for (let i = 0; i < c.length - 1; i++) L += dist(c[i], c[i + 1]); note(p, "Curve length: " + fmt(L)); }
  if (s.type === "text") field(p, "Text", s.text, (v) => { if (v.trim()) { s.text = v.trim().slice(0, 80); commit(); } });
  if (closedTypes.includes(s.type)) {
    field(p, "Piece name", s.label || "", (v) => { s.label = v.trim().slice(0, 30); commit(); });
    field(p, "Add seam allowance", !!s.seam, (v) => { s.seam = v; commit(); }, "checkbox");
    const ar = Math.abs(area(polyOf(s))) / (UNITS[unit].k * UNITS[unit].k); note(p, "Area: " + ar.toFixed(2) + " " + unit + "²");
  }
  const r = document.createElement("div"); r.className = "row"; p.append(r);
  btn(r, "Duplicate", duplicate); btn(r, "Mirror", mirror); btn(r, "Delete", removeSel);
}
function renderList() {
  const ul = $("list"); ul.textContent = "";
  if (!doc.shapes.length) { const li = document.createElement("li"); li.className = "ro"; li.textContent = "Nothing drawn yet."; ul.append(li); return; }
  doc.shapes.forEach((s, i) => { const li = document.createElement("li"), b = document.createElement("button");
    b.textContent = TITLE[s.type] + " " + (i + 1) + (s.label ? " · " + s.label : s.text ? " · " + s.text.slice(0, 14) : ""); if (s.id === sel) b.setAttribute("aria-current", "true");
    b.onclick = () => { sel = s.id; setTool("select"); renderPanel(); renderList(); draw(); }; li.append(b); ul.append(li); });
}

// ---------- export ----------
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pts2 = (a) => a.map((p) => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ");
function buildSvg() {
  const all = doc.shapes.flatMap(extent); const b = bbox(all.length ? all : [[0, 0], [100, 100]]), pad = 20;
  const x = b.minX - pad, y = b.minY - pad, w = b.maxX - b.minX + pad * 2, h = b.maxY - b.minY + pad * 2; let o = "";
  doc.shapes.forEach((s) => {
    if (s.type === "line") o += '<line x1="' + s.pts[0][0] + '" y1="' + s.pts[0][1] + '" x2="' + s.pts[1][0] + '" y2="' + s.pts[1][1] + '" stroke="#111" stroke-width="0.6"/>';
    else if (s.type === "dim") { const m = [(s.pts[0][0] + s.pts[1][0]) / 2, (s.pts[0][1] + s.pts[1][1]) / 2];
      o += '<line x1="' + s.pts[0][0] + '" y1="' + s.pts[0][1] + '" x2="' + s.pts[1][0] + '" y2="' + s.pts[1][1] + '" stroke="#555" stroke-width="0.3"/><text x="' + m[0] + '" y="' + (m[1] - 2) + '" font-size="5" text-anchor="middle" fill="#555" font-family="sans-serif">' + fmt(dist(s.pts[0], s.pts[1])) + "</text>"; }
    else if (s.type === "curve") o += '<path d="M' + s.pts[0].join(" ") + " Q" + s.pts[1].join(" ") + " " + s.pts[2].join(" ") + '" fill="none" stroke="#111" stroke-width="0.6"/>';
    else if (s.type === "text") o += '<text x="' + s.pts[0][0] + '" y="' + s.pts[0][1] + '" font-size="' + s.size + '" fill="#111" font-family="sans-serif">' + esc(s.text) + "</text>";
    else { if (s.seam) o += '<polygon points="' + pts2(seamOf(s)) + '" fill="none" stroke="#b8860b" stroke-width="0.4" stroke-dasharray="3 2"/>';
      o += '<polygon points="' + pts2(polyOf(s)) + '" fill="none" stroke="#111" stroke-width="0.6"/>';
      if (s.label) { const bb = bbox(polyOf(s)); o += '<text x="' + (bb.minX + bb.maxX) / 2 + '" y="' + (bb.minY + bb.maxY) / 2 + '" font-size="6" text-anchor="middle" fill="#111" font-family="sans-serif">' + esc(s.label) + "</text>"; } }
  });
  return { w, h, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + w.toFixed(2) + 'mm" height="' + h.toFixed(2) + 'mm" viewBox="' + [x, y, w, h].map((v) => v.toFixed(2)).join(" ") + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#fff"/>' + o + "</svg>" };
}
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const fname = (ext) => ($("pname").textContent || "pattern").replace(/[^\w\-]+/g, "_") + "." + ext;
$("svgb").onclick = () => { if (!doc.shapes.length) return showMsg($("msg"), "Draw something first."); download(new Blob([buildSvg().svg], { type: "image/svg+xml" }), fname("svg")); };
$("pngb").onclick = () => {
  if (!doc.shapes.length) return showMsg($("msg"), "Draw something first.");
  const { w, h, svg } = buildSvg(), k = Math.min(4, 8000 / Math.max(w, h)), img = new Image();
  img.onload = () => { const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => download(b, fname("png")), "image/png"); };
  img.onerror = () => showMsg($("msg"), "Couldn't create the PNG. Try SVG instead.");
  img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
};
$("prnb").onclick = () => {
  if (!doc.shapes.length) return showMsg($("msg"), "Draw something first.");
  const w = window.open("", "_blank"); if (!w) return showMsg($("msg"), "Your browser blocked the print window. Allow pop-ups for this site and try again.");
  w.document.write("<!doctype html><title>Pattern</title><style>@page{margin:8mm}body{margin:0}</style>" + buildSvg().svg); w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
};

// ---------- save / load ----------
async function save() {
  if (!pid) return; const b = $("save"); b.disabled = true; b.textContent = "Saving…";
  try { await saveProjectData(uid, pid, { patternJson: JSON.stringify(doc) }); dirty = false; $("status").textContent = "Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); showMsg($("msg"), ""); }
  catch (e) { showMsg($("msg"), "Couldn't save. Check your connection and Firestore rules, then try again."); }
  b.disabled = false; b.textContent = "Save";
}
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

// ---------- init ----------
TOOLS.forEach(([id, name, key]) => { const b = document.createElement("button"); b.dataset.t = id; b.innerHTML = "<span></span><kbd>" + key + "</kbd>"; b.firstChild.textContent = name; b.onclick = () => setTool(id); $("tools").append(b); });
$("unit").value = unit; $("unit").onchange = (e) => { unit = e.target.value; try { localStorage.setItem("fc-units", unit); } catch (x) {} renderPanel(); draw(); };
$("undo").onclick = () => restore(hi - 1); $("redo").onclick = () => restore(hi + 1); $("fit").onclick = fitView; $("save").onclick = save;
$("snap").onchange = (e) => { snapOn = e.target.checked; }; $("gridchk").onchange = (e) => { gridOn = e.target.checked; draw(); };
new ResizeObserver(resize).observe(cv.parentElement); setTool("select"); renderPanel(); renderList();

requireAuth(async (u) => {
  uid = u.uid; pid = new URLSearchParams(location.search).get("id");
  if (!pid) { location.replace("dashboard.html"); return; }
  let p = null; try { p = await getProject(uid, pid); } catch (e) { showMsg($("msg"), "Couldn't load the project."); return; }
  if (!p) { showMsg($("msg"), "Project not found. Go back to the dashboard."); $("pname").textContent = "Not found"; return; }
  $("pname").textContent = p.name || "Untitled";
  if (p.patternJson) { try { const d = JSON.parse(p.patternJson); if (d && Array.isArray(d.shapes)) doc = d; } catch (e) { showMsg($("msg"), "This project's saved pattern couldn't be read, so it opened empty."); } }
  nextId = Math.max(0, ...doc.shapes.map((s) => s.id || 0)) + 1; hist = [JSON.stringify(doc)]; hi = 0; dirty = false;
  $("status").textContent = p.patternJson ? "Loaded" : "New pattern"; renderPanel(); renderList(); fitView();
});
