// Solmar City — configuration: world size, palette, tuning.
// Every number here was chosen for this game; the city, names and story are original.
export const WORLD = 2600; // world is WORLD x WORLD pixels
export const ROAD_SPACING = 320; // distance between road centre lines
export const ROAD_WIDTH = 72;
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6f9c4c',
  sand: '#e8d29a',
  water: '#2e7fb8',
  waterDeep: '#256a9c',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  curb: '#8f887a',
  buildingRoof: ['#c96f4a', '#d9a441', '#5d8aa8', '#8a6fb8', '#b8576b', '#4fa08a', '#a8703f', '#7a7f8c'],
  buildingEdge: '#2e2a26',
  park: '#5da24a',
  tree: '#3e7d32',
  treeLight: '#66a84f',
  carColors: ['#d9392b', '#2b7fd9', '#e8e8e8', '#f2c230', '#222222', '#7ac74f', '#9b59b6', '#e67e22', '#16a085', '#c0c0c0'],
  player: '#ffcf3f',
  police: '#1c4fd6',
  hudBg: 'rgba(10, 14, 22, 0.72)',
};

export const TUNING = {
  walkSpeed: 175,
  runSpeed: 265,
  carAccel: 420,
  carBrake: 700,
  carMaxSpeed: 520,
  carReverseMax: 180,
  carTurn: 2.6,
  carDrag: 0.55,
  bulletSpeed: 900,
  pistolDamage: 34,
  pistolAmmoMax: 60,
  playerHealthMax: 100,
  wantedDecayDelay: 9, // seconds out of police sight before stars start falling
  wantedDecayRate: 0.12, // stars per second once decaying
  copSpawnInterval: 2.2,
  maxTraffic: 14,
  maxPeds: 26,
  maxCops: 6,
  missionRewardBase: 500,
};

export const DISTRICTS = [
  { name: 'Old Port', x: 0, y: 0, w: 900, h: 700 },
  { name: 'Downtown', x: 900, y: 500, w: 900, h: 800 },
  { name: 'Neon Strip', x: 1800, y: 300, w: 800, h: 700 },
  { name: 'Palm Heights', x: 500, y: 1400, w: 900, h: 800 },
  { name: 'Sunset Beach', x: 0, y: 2100, w: 2600, h: 500 },
  { name: 'Marina Bay', x: 1800, y: 1400, w: 800, h: 700 },
];

export const LANDMARKS = [
  { name: 'Solmar Tower', x: 1300, y: 820, kind: 'tower' },
  { name: 'Palm Plaza', x: 700, y: 1650, kind: 'plaza' },
  { name: 'The Neon Strip', x: 2100, y: 640, kind: 'strip' },
  { name: 'Old Port Docks', x: 380, y: 380, kind: 'docks' },
  { name: 'Safehouse', x: 640, y: 1900, kind: 'safehouse' },
  { name: 'Sunset Pier', x: 1300, y: 2400, kind: 'pier' },
  { name: 'St. Marisol Hospital', x: 1600, y: 1100, kind: 'hospital' },
  { name: 'City Garage', x: 1000, y: 1300, kind: 'garage' },
];
