// Entities: the player, cars (traffic, police, player's), pedestrians,
// bullets and particles. All movement, collisions and AI live here.
import { WORLD, ROAD_WIDTH, TUNING, PALETTE } from './config.js';
import { clamp, dist, angleTo, angleDiff, collideCircleBox, pick } from './random.js';
import { isOnRoad, nearestRoadPoint, roadCenters } from './world.js';

let nextId = 1;

export class Car {
  constructor(x, y, angle, color, kind = 'traffic') {
    this.id = nextId++;
    this.x = x; this.y = y; this.angle = angle;
    this.speed = 0; this.color = color; this.kind = kind; // traffic | police | player
    this.w = 46; this.h = 22;
    this.health = 100;
    this.driver = kind === 'traffic'; // a pedestrian is driving it
    this.steer = 0;
    this.roadDir = Math.random() < 0.5 ? 'h' : 'v'; // traffic axis
    this.turnAt = 0;
    this.sirenPhase = Math.random() * 10;
    this.smoke = 0;
  }
  update(dt, game) {
    if (this.kind === 'player') return; // driven by the player in main.js
    if (this.kind === 'police') { this.updatePolice(dt, game); return; }
    // Traffic: cruise along its road axis, turn at intersections sometimes.
    const target = this.roadDir === 'h' ? 0 : Math.PI / 2;
    const cruise = 130 + (this.id % 5) * 12;
    this.speed += (cruise - this.speed) * dt * 0.8;
    let desired = this.angle;
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    const onH = Math.abs(this.y - Math.round(this.y / 320) * 320) < 4;
    if (this.roadDir === 'h') {
      desired = c >= 0 ? 0 : Math.PI;
      // stay in the right-hand lane
      const lane = nearestRoadPoint(this.x, this.y).y + (c >= 0 ? 14 : -14);
      this.y += (lane - this.y) * dt * 2;
    } else {
      desired = s >= 0 ? Math.PI / 2 : -Math.PI / 2;
      const lane = nearestRoadPoint(this.x, this.y).x + (s >= 0 ? -14 : 14);
      this.x += (lane - this.x) * dt * 2;
    }
    // Random turn at an intersection.
    const nearCenter = Math.min(
      Math.abs(this.x % 320 - 160), Math.abs(this.y % 320 - 160)) < 26;
    if (nearCenter && this.turnAt <= 0 && Math.random() < dt * 0.5) {
      this.roadDir = this.roadDir === 'h' ? 'v' : 'h';
      this.turnAt = 1.5;
    }
    this.turnAt -= dt;
    this.angle += angleDiff(this.angle, desired) * Math.min(1, dt * 4);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.wrapOrRespawn(game);
    this.collideBuildings(game);
  }
  updatePolice(dt, game) {
    const p = game.player;
    const target = p.inCar ? p.car : p;
    const d = dist(this.x, this.y, target.x, target.y);
    const want = angleTo(this.x, this.y, target.x, target.y);
    const diff = angleDiff(this.angle, want);
    this.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const cruise = d > 500 ? 480 : 380;
    this.speed += (cruise - this.speed) * dt * 1.2;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.sirenPhase += dt;
    // Ram the player's car / knock the player down.
    if (d < 40) {
      if (p.inCar && p.car) {
        p.car.health -= 18 * dt;
        const push = angleTo(this.x, this.y, p.car.x, p.car.y);
        p.car.x += Math.cos(push) * 40 * dt;
        p.car.y += Math.sin(push) * 40 * dt;
        if (Math.random() < dt * 2) game.sound.crash();
      } else if (d < 26) {
        p.hurt(12 * dt, game);
      }
    }
    this.collideBuildings(game);
    if (d > 1400) this.dead = true; // too far: despawn, a fresh one spawns closer
  }
  wrapOrRespawn(game) {
    // Traffic that leaves the world (or gets too far from the player) respawns
    // on a road near the player so the streets always feel alive.
    const p = game.player;
    if (this.x < -60 || this.x > WORLD + 60 || this.y < -60 || this.y > WORLD + 60 ||
      dist(this.x, this.y, p.x, p.y) > 1300) {
      const spot = game.spawnTrafficSpot();
      if (spot) { this.x = spot.x; this.y = spot.y; this.angle = spot.angle; this.roadDir = spot.dir; }
    }
  }
  collideBuildings(game) {
    for (const b of game.city.buildings) {
      if (this.x > b.x - 30 && this.x < b.x + b.w + 30 && this.y > b.y - 30 && this.y < b.y + b.h + 30) {
        const fix = collideCircleBox(this.x, this.y, 24, b);
        if (fix) { this.x = fix.x; this.y = fix.y; this.speed *= 0.4; }
      }
    }
    this.x = clamp(this.x, 10, WORLD - 10);
    this.y = clamp(this.y, 10, WORLD - 10);
  }
}

export class Ped {
  constructor(x, y, rng) {
    this.id = nextId++;
    this.x = x; this.y = y;
    this.angle = rng() * Math.PI * 2;
    this.speed = 40 + rng() * 40;
    this.color = pick(rng, ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#9b59b6', '#ecf0f1', '#1abc9c']);
    this.skin = pick(rng, ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']);
    this.walkPhase = rng() * 10;
    this.target = null;
    this.fleeing = 0;
    this.dead = false;
    this.cop = false;
    this.health = 100;
    this.shootCooldown = 0;
  }
  update(dt, game) {
    this.walkPhase += dt * 8;
    if (this.fleeing > 0) this.fleeing -= dt;
    if (this.cop) { this.updateCop(dt, game); return; }
    if (!this.target || dist(this.x, this.y, this.target.x, this.target.y) < 12 || this.fleeing > 0) {
      // Pick a new sidewalk waypoint near the current road.
      const p = nearestRoadPoint(this.x, this.y);
      const off = (Math.random() < 0.5 ? 1 : -1) * (ROAD_WIDTH / 2 + 12);
      const horiz = Math.random() < 0.5;
      this.target = horiz
        ? { x: clamp(this.x + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 200), 30, WORLD - 30), y: clamp(p.y + off, 30, WORLD - 30) }
        : { x: clamp(p.x + off, 30, WORLD - 30), y: clamp(this.y + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 200), 30, WORLD - 30) };
      if (this.fleeing > 0) { // run away from the player
        const a = angleTo(game.player.x, game.player.y, this.x, this.y);
        this.target = { x: clamp(this.x + Math.cos(a) * 260, 30, WORLD - 30), y: clamp(this.y + Math.sin(a) * 260, 30, WORLD - 30) };
      }
    }
    const a = angleTo(this.x, this.y, this.target.x, this.target.y);
    this.angle += angleDiff(this.angle, a) * Math.min(1, dt * 6);
    const sp = this.fleeing > 0 ? this.speed * 2.4 : this.speed;
    this.x += Math.cos(this.angle) * sp * dt;
    this.y += Math.sin(this.angle) * sp * dt;
    for (const b of game.city.buildings) {
      const fix = collideCircleBox(this.x, this.y, 10, b);
      if (fix) { this.x = fix.x; this.y = fix.y; this.target = null; }
    }
  }
  updateCop(dt, game) {
    const p = game.player;
    const d = dist(this.x, this.y, p.x, p.y);
    const a = angleTo(this.x, this.y, p.x, p.y);
    this.angle += angleDiff(this.angle, a) * Math.min(1, dt * 6);
    const sp = d > 60 ? 200 : 0;
    this.x += Math.cos(this.angle) * sp * dt;
    this.y += Math.sin(this.angle) * sp * dt;
    this.shootCooldown -= dt;
    if (d < 320 && d > 40 && this.shootCooldown <= 0) {
      this.shootCooldown = 1.6;
      game.enemyShoot(this.x, this.y, a, 8);
    }
    if (d < 24) p.hurt(10 * dt, game);
  }
}

export class Bullet {
  constructor(x, y, angle, fromPlayer, damage) {
    this.x = x; this.y = y; this.angle = angle;
    this.fromPlayer = fromPlayer;
    this.damage = damage;
    this.life = 0.9;
    this.dead = false;
  }
  update(dt, game) {
    this.x += Math.cos(this.angle) * TUNING.bulletSpeed * dt;
    this.y += Math.sin(this.angle) * TUNING.bulletSpeed * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < 0 || this.x > WORLD || this.y < 0 || this.y > WORLD) { this.dead = true; return; }
    for (const b of game.city.buildings) {
      if (this.x > b.x && this.x < b.x + b.w && this.y > b.y && this.y < b.y + b.h) {
        game.spawnParticles(this.x, this.y, 4, '#cbb98f');
        this.dead = true; return;
      }
    }
    if (this.fromPlayer) {
      for (const ped of game.peds) {
        if (!ped.dead && dist(this.x, this.y, ped.x, ped.y) < 13) {
          ped.health -= this.damage;
          game.spawnParticles(ped.x, ped.y, 6, '#c0392b');
          if (ped.health <= 0) game.killPed(ped, true);
          else if (!ped.cop) ped.fleeing = 3;
          this.dead = true; return;
        }
      }
      for (const car of game.cars) {
        if (car.kind !== 'player' && dist(this.x, this.y, car.x, car.y) < 24) {
          car.health -= this.damage * 0.5;
          if (car.health <= 0) game.explodeCar(car);
          this.dead = true; return;
        }
      }
    } else {
      const p = game.player;
      const px = p.inCar && p.car ? p.car.x : p.x;
      const py = p.inCar && p.car ? p.car.y : p.y;
      if (dist(this.x, this.y, px, py) < (p.inCar ? 26 : 13)) {
        p.hurt(this.damage, game);
        this.dead = true;
      }
    }
  }
}

export class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 160;
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
    this.life = 0.4 + Math.random() * 0.4;
    this.maxLife = this.life;
    this.color = color;
    this.size = 2 + Math.random() * 3;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.94; this.vy *= 0.94;
    this.life -= dt;
  }
}
