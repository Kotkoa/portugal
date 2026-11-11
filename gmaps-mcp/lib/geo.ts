// Google encoded polyline + простая геометрия на сфере.

export type Pt = { lat: number; lng: number };

export function decodePolyline(str: string): Pt[] {
  const pts: Pt[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d; else lng += d;
    }
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pts;
}

export function encodePolyline(pts: Pt[]): string {
  let out = "", pLat = 0, pLng = 0;
  const enc = (v: number) => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63);
  };
  for (const p of pts) {
    const lat = Math.round(p.lat * 1e5), lng = Math.round(p.lng * 1e5);
    out += enc(lat - pLat) + enc(lng - pLng);
    pLat = lat; pLng = lng;
  }
  return out;
}

const R = 6371; // km
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: Pt, b: Pt) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Накопленное расстояние (км) до каждой вершины. */
export function cumulative(pts: Pt[]): number[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + haversineKm(pts[i - 1], pts[i]));
  return c;
}

/** Проекция точки на линию: позиция вдоль линии (км) и боковое удаление (км). */
export function project(p: Pt, pts: Pt[], cum: number[]) {
  let best = { along: 0, offset: Infinity };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    // локальная равнопромежуточная проекция вокруг a
    const kx = Math.cos(rad(a.lat)) * 111.32, ky = 110.57;
    const bx = (b.lng - a.lng) * kx, by = (b.lat - a.lat) * ky;
    const px = (p.lng - a.lng) * kx, py = (p.lat - a.lat) * ky;
    const len2 = bx * bx + by * by;
    const t = len2 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
    const dx = px - t * bx, dy = py - t * by;
    const off = Math.hypot(dx, dy);
    if (off < best.offset) best = { along: cum[i - 1] + t * (cum[i] - cum[i - 1]), offset: off };
  }
  return best;
}

/** Режет линию на куски примерно по chunkKm, с небольшим перекрытием. */
export function chunks(pts: Pt[], cum: number[], chunkKm: number): Pt[][] {
  const out: Pt[][] = [];
  let start = 0;
  while (start < pts.length - 1) {
    let end = start;
    while (end < pts.length - 1 && cum[end] - cum[start] < chunkKm) end++;
    out.push(pts.slice(Math.max(0, start - 1), end + 1));
    start = end;
  }
  return out;
}

/** Строка "lat,lng" → точка, иначе null. */
export function parseLatLng(s: string): Pt | null {
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
