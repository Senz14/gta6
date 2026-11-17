// Solmar City — procedural city generation from a seed.
// A road grid with blocks that hold buildings, parks, a beach strip along the
// south edge and a harbour along the west edge. All geometry is generated here.
import { WORLD, ROAD_SPACING, ROAD_WIDTH, PALETTE, LANDMARKS } from './config.js';
import { mulberry32, pick, range, rangeInt } from './random.js';

export function roadCenters() {
  const centers = [];
  for (let c = ROAD_SPACING / 2; c < WORLD; c += ROAD_SPACING) centers.push(c);
  return centers;
}

export function isOnRoad(x, y) {
  const half = ROAD_WIDTH / 2;
  for (const c of roadCenters()) {
    if (Math.abs(x - c) < half || Math.abs(y - c) < half) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  const centers = roadCenters();
  let bx = x, by = y, best = Infinity;
  for (const c of centers) {
    const d = Math.abs(x - c);
    if (d < best) { best = d; bx = c; by = y; }
    const d2 = Math.abs(y - c);
    if (d2 < best) { best = d2; bx = x; by = c; }
  }
  return { x: bx, y: by, d: best };
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const centers = roadCenters();
  const buildings = [];
  const parks = [];
  const trees = [];
  const beachY = WORLD - 420;

  // Blocks between roads: one building cluster (or a park) per block.
  for (let i = 0; i < centers.length - 1; i++) {
    for (let j = 0; j < centers.length - 1; j++) {
      const x0 = centers[i] + ROAD_WIDTH / 2 + 14;
      const y0 = centers[j] + ROAD_WIDTH / 2 + 14;
      const x1 = centers[i + 1] - ROAD_WIDTH / 2 - 14;
      const y1 = centers[j + 1] - ROAD_WIDTH / 2 - 14;
      const w = x1 - x0, h = y1 - y0;
      if (y0 > beachY - 40) continue; // beach blocks stay open
      if (rng() < 0.16) {
        parks.push({ x: x0, y: y0, w, h });
        const n = rangeInt(rng, 4, 8);
        for (let t = 0; t < n; t++) {
          trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: range(rng, 7, 12) });
        }
        continue;
      }
      // 1-3 buildings per block
      const n = rng() < 0.55 ? 1 : rng() < 0.8 ? 2 : 3;
      for (let b = 0; b < n; b++) {
        const bw = n === 1 ? w * range(rng, 0.55, 0.8) : w * range(rng, 0.3, 0.45);
        const bh = n === 1 ? h * range(rng, 0.55, 0.8) : h * range(rng, 0.3, 0.45);
        const bx = x0 + range(rng, 0, Math.max(1, w - bw));
        const by = y0 + range(rng, 0, Math.max(1, h - bh));
        const floors = rangeInt(rng, 1, 6);
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: pick(rng, PALETTE.buildingRoof),
          floors,
          tall: floors >= 4,
        });
      }
      if (rng() < 0.5) {
        trees.push({ x: range(rng, x0 + 8, x1 - 8), y: range(rng, y0 + 8, y1 - 8), r: range(rng, 6, 10) });
      }
    }
  }

  // Landmark towers get a tall building pinned at their spot.
  for (const lm of LANDMARKS) {
    if (lm.kind === 'tower') {
      buildings.push({ x: lm.x - 55, y: lm.y - 55, w: 110, h: 110, color: '#5d8aa8', floors: 9, tall: true, landmark: lm.name });
    }
  }

  // Beach palm trees along the south strip.
  for (let x = 80; x < WORLD; x += 90) {
    trees.push({ x: x + range(rng, -20, 20), y: beachY + range(rng, 30, 320), r: range(rng, 8, 13), palm: true });
  }

  return { seed, centers, buildings, parks, trees, beachY, landmarks: LANDMARKS };
}

import { DISTRICTS } from './config.js';
export function districtName(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Solmar City';
}
