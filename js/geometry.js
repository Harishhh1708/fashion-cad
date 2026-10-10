// Pure geometry helpers. All coordinates are in millimetres.
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
export function bbox(p) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const q of p) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); }
  return { minX, minY, maxX, maxY };
}
export function rectPts(pts) { const [a, b] = pts; return [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]]; }
export function ellipsePts(pts, n = 64, grow = 0) {
  const [c, e] = pts, rx = Math.abs(e[0] - c[0]) + grow, ry = Math.abs(e[1] - c[1]) + grow, out = [];
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; out.push([c[0] + rx * Math.cos(t), c[1] + ry * Math.sin(t)]); }
  return out;
}
export function quad(a, c, b, n = 32) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
  return out;
}
export function distSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
export function inPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
// Offset a closed polygon outward by d (seam allowance). Sharp corners are mitred, with a limit.
export function offsetPoly(p, d) {
  const n = p.length; if (n < 3) return p;
  const sgn = area(p) > 0 ? 1 : -1, lines = [];
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    lines.push({ x: a[0] + (sgn * dy / L) * d, y: a[1] + (-sgn * dx / L) * d, dx, dy });
  }
  return p.map((v, i) => {
    const l1 = lines[(i - 1 + n) % n], l2 = lines[i], cross = l1.dx * l2.dy - l1.dy * l2.dx;
    if (Math.abs(cross) < 1e-9) return [l2.x, l2.y];
    const t = ((l2.x - l1.x) * l2.dy - (l2.y - l1.y) * l2.dx) / cross;
    const q = [l1.x + l1.dx * t, l1.y + l1.dy * t];
    return Math.hypot(q[0] - v[0], q[1] - v[1]) > 4 * Math.abs(d) ? [l2.x, l2.y] : q;
  });
}
