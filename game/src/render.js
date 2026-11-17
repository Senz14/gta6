// Rendering: camera, the city, cars, people, bullets, particles and weather
// of light. Everything is drawn on one 2D canvas, top-down, with a warm
// late-afternoon sun feel.
import { WORLD, ROAD_WIDTH, VIEW_W, VIEW_H, PALETTE } from './config.js';
import { clamp } from './random.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, shake: 0 };
    this.time = 0;
  }
  follow(x, y, dt) {
    const tx = clamp(x - VIEW_W / 2, 0, WORLD - VIEW_W);
    const ty = clamp(y - VIEW_H / 2, 0, WORLD - VIEW_H);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 5);
    if (this.cam.shake > 0) this.cam.shake = Math.max(0, this.cam.shake - dt * 30);
  }
  draw(game, dt) {
    const ctx = this.ctx;
    this.time += dt;
    const shx = this.cam.shake > 0 ? (Math.random() - 0.5) * this.cam.shake : 0;
    const shy = this.cam.shake > 0 ? (Math.random() - 0.5) * this.cam.shake : 0;
    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.translate(-Math.round(this.cam.x + shx), -Math.round(this.cam.y + shy));
    this.drawGround(ctx, game);
    this.drawRoads(ctx, game);
    this.drawParks(ctx, game);
    this.drawBuildings(ctx, game);
    this.drawMarkers(ctx, game);
    this.drawPickups(ctx, game);
    for (const car of game.cars) this.drawCar(ctx, car, game);
    for (const ped of game.peds) this.drawPed(ctx, ped);
    this.drawPlayer(ctx, game);
    for (const b of game.bullets) this.drawBullet(ctx, b);
    for (const p of game.particles) this.drawParticle(ctx, p);
    ctx.restore();
    this.drawVignette(ctx);
  }
  visible(x, y, m = 100) {
    return x > this.cam.x - m && x < this.cam.x + VIEW_W + m && y > this.cam.y - m && y < this.cam.y + VIEW_H + m;
  }
  drawGround(ctx, game) {
    const city = game.city;
    // Base grass.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(this.cam.x - 20, this.cam.y - 20, VIEW_W + 40, VIEW_H + 40);
    // Beach + sea along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(this.cam.x - 20, city.beachY, VIEW_W + 40, VIEW_H + 40);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(this.cam.x - 20, WORLD - 150, VIEW_W + 40, 200);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = 0; x < WORLD; x += 90) {
      const yy = WORLD - 120 + Math.sin(this.time * 0.8 + x * 0.05) * 6;
      ctx.fillRect(x, yy, 46, 3);
    }
    // Harbour water on the west edge.
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, this.cam.y - 20, 46, VIEW_H + 40);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let y = 0; y < WORLD; y += 110) {
      const xx = 14 + Math.sin(this.time * 0.7 + y * 0.04) * 5;
      ctx.fillRect(xx, y, 3, 40);
    }
    // Subtle grass mowing stripes.
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    const stripe = 80;
    const startY = Math.floor(this.cam.y / stripe) * stripe;
    for (let y = startY; y < this.cam.y + VIEW_H; y += stripe * 2) {
      ctx.fillRect(this.cam.x - 20, y, VIEW_W + 40, stripe);
    }
  }
  drawRoads(ctx, game) {
    const city = game.city;
    ctx.fillStyle = PALETTE.sidewalk;
    for (const c of city.centers) {
      ctx.fillRect(c - ROAD_WIDTH / 2 - 10, this.cam.y - 20, ROAD_WIDTH + 20, VIEW_H + 40);
      ctx.fillRect(this.cam.x - 20, c - ROAD_WIDTH / 2 - 10, VIEW_W + 40, ROAD_WIDTH + 20);
    }
    ctx.fillStyle = PALETTE.road;
    for (const c of city.centers) {
      ctx.fillRect(c - ROAD_WIDTH / 2, this.cam.y - 20, ROAD_WIDTH, VIEW_H + 40);
      ctx.fillRect(this.cam.x - 20, c - ROAD_WIDTH / 2, VIEW_W + 40, ROAD_WIDTH);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    const dash = 34, gap = 30;
    for (const c of city.centers) {
      for (let y = Math.floor(this.cam.y / (dash + gap)) * (dash + gap); y < this.cam.y + VIEW_H; y += dash + gap) {
        ctx.fillRect(c - 2, y, 4, dash);
      }
      for (let x = Math.floor(this.cam.x / (dash + gap)) * (dash + gap); x < this.cam.x + VIEW_W; x += dash + gap) {
        ctx.fillRect(x, c - 2, dash, 4);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const cx of city.centers) for (const cy of city.centers) {
      if (!this.visible(cx, cy, 60)) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(cx + i * 9 - 3, cy - ROAD_WIDTH / 2 + 4, 5, 10);
        ctx.fillRect(cx + i * 9 - 3, cy + ROAD_WIDTH / 2 - 14, 5, 10);
        ctx.fillRect(cx - ROAD_WIDTH / 2 + 4, cy + i * 9 - 3, 10, 5);
        ctx.fillRect(cx + ROAD_WIDTH / 2 - 14, cy + i * 9 - 3, 10, 5);
      }
    }
  }
  drawParks(ctx, game) {
    for (const p of game.city.parks) {
      if (!this.visible(p.x + p.w / 2, p.y + p.h / 2, 120)) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#4a8a3a'; ctx.lineWidth = 3;
      ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
    }
    for (const t of game.city.trees) {
      if (!this.visible(t.x, t.y, 40)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = t.palm ? '#4caf50' : PALETTE.tree;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.treeLight;
      ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawBuildings(ctx, game) {
    for (const b of game.city.buildings) {
      if (!this.visible(b.x + b.w / 2, b.y + b.h / 2, 140)) continue;
      // Sun shadow to the south-east.
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // Roof inset + skylights for tall buildings.
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 12 + i * 34, b.y + 12 + j * 34, 14, 14);
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
      }
      ctx.strokeStyle = PALETTE.buildingEdge; ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (b.landmark) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.landmark, b.x + b.w / 2, b.y - 8);
      }
    }
    // Landmark labels.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const lm of game.city.landmarks) {
      if (lm.kind === 'tower') continue;
      if (!this.visible(lm.x, lm.y, 60)) continue;
      ctx.fillText(lm.name, lm.x, lm.y - 10);
    }
  }
  drawMarkers(ctx, game) {
    const m = game.missionMarker();
    if (m) {
      const pulse = 1 + Math.sin(this.time * 5) * 0.15;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
      // A guiding beam so the player can spot the objective from afar.
      ctx.fillStyle = 'rgba(255, 210, 63, 0.10)';
      ctx.fillRect(m.x - 8, m.y - 400, 16, 400);
    }
    // Safehouse marker.
    const sh = game.city.landmarks.find((l) => l.kind === 'safehouse');
    if (sh && this.visible(sh.x, sh.y, 40)) {
      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⌂', sh.x, sh.y + 7);
    }
  }
  drawPickups(ctx, game) {
    for (const pk of game.pickups) {
      if (!this.visible(pk.x, pk.y, 30)) continue;
      const bob = Math.sin(this.time * 4 + pk.x) * 3;
      ctx.save(); ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#2ecc71'; ctx.fillRect(-10, -7, 20, 14);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('$', 0, 4);
      } else if (pk.kind === 'health') {
        ctx.fillStyle = '#fff'; ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(-3, -7, 6, 14); ctx.fillRect(-7, -3, 14, 6);
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#f39c12'; ctx.fillRect(-8, -5, 16, 10);
        ctx.fillStyle = '#7e5100'; ctx.fillRect(-5, -5, 3, 10); ctx.fillRect(2, -5, 3, 10);
      }
      ctx.restore();
    }
  }
  drawCar(ctx, car, game) {
    if (!this.visible(car.x, car.y, 60)) return;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
    // Body.
    ctx.fillStyle = car.kind === 'police' ? '#f5f5f5' : car.color;
    ctx.beginPath();
    ctx.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 6);
    ctx.fill();
    if (car.kind === 'police') {
      ctx.fillStyle = '#1c4fd6';
      ctx.fillRect(-6, -car.h / 2, 12, car.h);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.save(); ctx.rotate(0); ctx.restore();
    }
    // Windshield + roof.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.fillRect(car.w / 2 - 14, -car.h / 2 + 3, 8, car.h - 6);
    ctx.fillStyle = 'rgba(20,30,45,0.55)';
    ctx.fillRect(-8, -car.h / 2 + 3, 14, car.h - 6);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(car.w / 2 - 2, -car.h / 2 + 2, 3, 5);
    ctx.fillRect(car.w / 2 - 2, car.h / 2 - 7, 3, 5);
    // Police light bar, flashing.
    if (car.kind === 'police') {
      const on = Math.floor(car.sirenPhase * 4) % 2 === 0;
      ctx.fillStyle = on ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-4, -car.h / 2 - 2, 8, 5);
      ctx.fillStyle = on ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(-4, car.h / 2 - 3, 8, 5);
      // Light glow.
      ctx.fillStyle = on ? 'rgba(255,45,45,0.18)' : 'rgba(45,107,255,0.18)';
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    }
    // Smoke when wrecked.
    if (car.health < 40) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath(); ctx.arc(-car.w / 4, 0, 6 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Health bar for damaged cars.
    if (car.health < 100 && car.kind !== 'traffic') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(car.x - 20, car.y - 30, 40, 5);
      ctx.fillStyle = car.health > 40 ? '#2ecc71' : '#e74c3c';
      ctx.fillRect(car.x - 20, car.y - 30, 40 * (car.health / 100), 5);
    }
  }
  drawPed(ctx, ped) {
    if (!this.visible(ped.x, ped.y, 30)) return;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 3, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    const bob = Math.sin(ped.walkPhase) * 1.5;
    ctx.rotate(ped.angle);
    // Legs.
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-4, -6 + bob, 8, 4);
    ctx.fillRect(-4, 2 - bob, 8, 4);
    // Body.
    ctx.fillStyle = ped.cop ? '#1c4fd6' : ped.color;
    ctx.beginPath(); ctx.roundRect(-7, -7, 14, 14, 5); ctx.fill();
    if (ped.cop) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-7, -2, 14, 3);
    }
    // Head.
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(10, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(11, -2, 5, Math.PI * 0.6, Math.PI * 1.6); ctx.fill();
    ctx.restore();
    if (ped.health < 100 && ped.health > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(ped.x - 12, ped.y - 20, 24, 4);
      ctx.fillStyle = '#e74c3c'; ctx.fillRect(ped.x - 12, ped.y - 20, 24 * (ped.health / 100), 4);
    }
  }
  drawPlayer(ctx, game) {
    const p = game.player;
    if (p.inCar || p.dead) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 4, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    const bob = p.moving ? Math.sin(this.time * 14) * 1.6 : 0;
    ctx.rotate(p.angle);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-5, -7 + bob, 9, 4);
    ctx.fillRect(-5, 3 - bob, 9, 4);
    // Yellow jacket — Rico Vega.
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath(); ctx.roundRect(-8, -8, 16, 16, 6); ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-8, -2, 16, 3);
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(11, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(12, -2, 5.5, Math.PI * 0.7, Math.PI * 1.7); ctx.fill();
    // Pistol in hand when aiming.
    if (p.aiming) {
      ctx.fillStyle = '#333';
      ctx.fillRect(10, -2, 10, 4);
    }
    ctx.restore();
    // Aim reticle at the mouse.
    if (p.aiming) {
      const m = game.screenToWorld(game.input.mouse.x, game.input.mouse.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - 14, m.y); ctx.lineTo(m.x - 6, m.y);
      ctx.moveTo(m.x + 6, m.y); ctx.lineTo(m.x + 14, m.y);
      ctx.moveTo(m.x, m.y - 14); ctx.lineTo(m.x, m.y - 6);
      ctx.moveTo(m.x, m.y + 6); ctx.lineTo(m.x, m.y + 14);
      ctx.stroke();
    }
  }
  drawBullet(ctx, b) {
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 10, b.y - Math.sin(b.angle) * 10);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  drawParticle(ctx, p) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
  }
  drawVignette(ctx) {
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,10,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
