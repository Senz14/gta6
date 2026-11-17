// Solmar City — main game: state machine, player control, wanted system,
// spawning, collisions and the game loop. An original open-world crime game.
import { WORLD, VIEW_W, VIEW_H, TUNING, PALETTE, LANDMARKS } from './config.js';
import { mulberry32, clamp, dist, angleTo, angleDiff, collideCircleBox, pick } from './random.js';
import { buildCity, isOnRoad, nearestRoadPoint, roadCenters } from './world.js';
import { Renderer } from './render.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { Car, Ped, Bullet, Particle } from './entities.js';
import { MissionManager } from './missions.js';
import { saveGameData, loadGameData, clearSaveData } from './save.js';
import { applyShotPreset } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

class Player {
  constructor() {
    this.x = 0; this.y = 0; this.angle = 0;
    this.health = TUNING.playerHealthMax;
    this.ammo = 30;
    this.inCar = false;
    this.car = null;
    this.moving = false;
    this.aiming = false;
    this.dead = false;
    this.shootCooldown = 0;
    this.punchCooldown = 0;
  }
  hurt(amount, game) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      game.onPlayerDown();
    }
  }
}

class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.seed = Number(params.get('seed') || 20261118);
    this.rng = mulberry32(this.seed);
    this.city = buildCity(this.seed);
    this.input = new Input(canvas);
    this.sound = new SoundBank();
    this.renderer = new Renderer(canvas);
    this.hud = new HUD();
    this.missions = new MissionManager(this);
    this.state = 'title'; // title | playing | paused | busted | wasted | complete
    this.player = new Player();
    this.cars = [];
    this.peds = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.cash = 250;
    this.wanted = 0;
    this.wantedSeenTimer = 0;
    this.copSpawnTimer = 0;
    this.sirenTimer = 0;
    this.time = 0; // in-game clock seconds (starts 17:40, golden hour)
    this.clock = 17 * 3600 + 40 * 60;
    this.objectiveText = 'Press M to start the first mission';
    this.missionFailed = false;
    this.missionCompleteInfo = null;
    this.stats = { carsStolen: 0, pedsDown: 0, missionsDone: 0, cashEarned: 0 };
    this.hasSave = !!loadGameData();
    this.shot = params.get('shot') || null;
    this.spawnWorld();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ----- setup -------------------------------------------------------------
  spawnWorld() {
    const p = this.player;
    // Start on foot near the Safehouse.
    p.x = 640; p.y = 1840; p.angle = -Math.PI / 2;
    for (let i = 0; i < TUNING.maxTraffic; i++) this.spawnTrafficCar(true);
    for (let i = 0; i < TUNING.maxPeds; i++) this.spawnPed(true);
    // A few parked cars near the start for the first mission.
    this.spawnParkedCar(700, 1900, '#d9392b');
    this.spawnParkedCar(760, 1900, '#2b7fd9');
    this.spawnParkedCar(820, 1900, '#f2c230');
    // Pickups around the city.
    this.pickups.push({ x: 1600, y: 1100, kind: 'health' });
    this.pickups.push({ x: 1000, y: 1300, kind: 'ammo' });
    this.pickups.push({ x: 2100, y: 640, kind: 'cash' });
    this.pickups.push({ x: 380, y: 380, kind: 'cash' });
    this.pickups.push({ x: 1300, y: 2400, kind: 'health' });
    this.pickups.push({ x: 700, y: 1650, kind: 'cash' });
  }
  spawnTrafficSpot() {
    const centers = roadCenters();
    const horiz = this.rng() < 0.5;
    const c = pick(this.rng, centers);
    const along = this.rng() * WORLD;
    const near = { x: this.player.x, y: this.player.y };
    // Prefer spots 300-800px from the player so streets stay populated.
    let x = horiz ? along : c;
    let y = horiz ? c : along;
    if (dist(x, y, near.x, near.y) < 250 || dist(x, y, near.x, near.y) > 1100) {
      const a = this.rng() * Math.PI * 2;
      const r = 350 + this.rng() * 450;
      const pt = nearestRoadPoint(near.x + Math.cos(a) * r, near.y + Math.sin(a) * r);
      x = pt.x; y = pt.y;
    }
    return { x, y, angle: horiz ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2), dir: horiz ? 'h' : 'v' };
  }
  spawnTrafficCar(anywhere = false) {
    const spot = this.spawnTrafficSpot();
    const car = new Car(spot.x, spot.y, spot.angle, pick(this.rng, PALETTE.carColors), 'traffic');
    this.cars.push(car);
    return car;
  }
  spawnParkedCar(x, y, color) {
    const car = new Car(x, y, Math.PI / 2, color, 'traffic');
    car.speed = 0;
    car.parked = true;
    this.cars.push(car);
    return car;
  }
  spawnPed(anywhere = false) {
    const a = this.rng() * Math.PI * 2;
    const r = anywhere ? this.rng() * 1000 : 350 + this.rng() * 450;
    const pt = nearestRoadPoint(this.player.x + Math.cos(a) * r, this.player.y + Math.sin(a) * r);
    const ped = new Ped(clamp(pt.x, 30, WORLD - 30), clamp(pt.y, 30, WORLD - 30), this.rng);
    this.peds.push(ped);
    return ped;
  }
  spawnGang(n, x, y) {
    for (let i = 0; i < n; i++) {
      const ped = new Ped(x + (this.rng() - 0.5) * 160, y + (this.rng() - 0.5) * 160, this.rng);
      ped.cop = false;
      ped.gang = true;
      ped.color = '#8e44ad';
      ped.health = 100;
      ped.shootCooldown = 1 + this.rng();
      this.peds.push(ped);
    }
  }
  spawnGetawayCar(marker) {
    const car = new Car(1780, 1500, Math.PI, '#111111', 'player');
    car.getaway = true;
    this.cars.push(car);
    this.toast('The getaway car is waiting at Marina Bay — marked on your map');
    this.getawayMarker = { x: 1780, y: 1500, label: 'Getaway car' };
  }

  // ----- helpers used by entities / missions -------------------------------
  setObjective(text) { this.objectiveText = text; }
  setHint(text) { this.toast(text, 6); }
  toast(text, dur) { this.hud.toast(text, dur); }
  missionMarker() {
    if (this.getawayMarker && this.missions.active && this.missions.active.id === 'the-getaway' && !this.player.inCar) {
      return this.getawayMarker;
    }
    const m = this.missions.active;
    return m ? m.marker : null;
  }
  screenToWorld(sx, sy) {
    return { x: sx + this.renderer.cam.x, y: sy + this.renderer.cam.y };
  }
  spawnParticles(x, y, n, color) {
    for (let i = 0; i < n; i++) this.particles.push(new Particle(x, y, color));
  }
  addWanted(stars, reason) {
    this.wanted = clamp(this.wanted + stars, 0, 5);
    if (reason) this.toast(reason, 5);
    this.sound.siren();
  }
  clockString() {
    const h = Math.floor(this.clock / 3600) % 24;
    const m = Math.floor((this.clock % 3600) / 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  enemyShoot(x, y, angle, damage) {
    this.bullets.push(new Bullet(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, angle, false, damage));
    this.sound.shot();
  }

  // ----- crime + police -----------------------------------------------------
  killPed(ped, byPlayer) {
    ped.dead = true;
    this.spawnParticles(ped.x, ped.y, 12, '#c0392b');
    if (byPlayer) {
      this.stats.pedsDown++;
      if (!ped.gang && !ped.cop) this.addWanted(1, 'A bystander went down — the cops were called!');
      if (ped.gang && this.missions.active && this.missions.active.id === 'payback') {
        this.missions.active.kills++;
      }
      if (ped.gang && this.missions.active && this.missions.active.id === 'king-of-solmar') {
        // gang members guarding the score
      }
      if (ped.cop) this.addWanted(1, 'You shot a cop!');
    }
  }
  explodeCar(car) {
    car.dead = true;
    this.spawnParticles(car.x, car.y, 26, '#ff7b00');
    this.spawnParticles(car.x, car.y, 14, '#555');
    this.sound.crash();
    this.renderer.cam.shake = 14;
    if (this.player.car === car) this.exitCar(true);
    if (dist(car.x, car.y, this.player.x, this.player.y) < 90) this.player.hurt(25, this);
    this.addWanted(1, 'A car just exploded!');
  }
  updateWanted(dt) {
    const p = this.player;
    const seen = this.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, p.x, p.y) < 500) ||
      this.peds.some((pd) => pd.cop && dist(pd.x, pd.y, p.x, p.y) < 380);
    if (this.wanted > 0) {
      if (seen) { this.wantedSeenTimer = 0; }
      else {
        this.wantedSeenTimer += dt;
        if (this.wantedSeenTimer > TUNING.wantedDecayDelay) {
          this.wanted = Math.max(0, this.wanted - TUNING.wantedDecayRate * dt);
          if (this.wanted <= 0) {
            this.wanted = 0;
            this.toast('You lost the cops. Stay clean, Rico.');
            this.cars = this.cars.filter((c) => c.kind !== 'police');
            this.peds = this.peds.filter((pd) => !pd.cop);
          }
        }
      }
      // Spawn police while wanted.
      this.copSpawnTimer -= dt;
      const wantCops = Math.min(TUNING.maxCops, Math.ceil(this.wanted) + 1);
      const cops = this.cars.filter((c) => c.kind === 'police').length + this.peds.filter((pd) => pd.cop).length;
      if (this.copSpawnTimer <= 0 && cops < wantCops) {
        this.copSpawnTimer = TUNING.copSpawnInterval;
        this.spawnCop();
      }
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) { this.sirenTimer = 2.4; this.sound.siren(); }
    }
  }
  spawnCop() {
    const p = this.player;
    const a = this.rng() * Math.PI * 2;
    const r = 420 + this.rng() * 200;
    const pt = nearestRoadPoint(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    if (this.wanted >= 2 && this.rng() < 0.65) {
      const car = new Car(pt.x, pt.y, angleTo(pt.x, pt.y, p.x, p.y), '#f5f5f5', 'police');
      this.cars.push(car);
    } else {
      const cop = new Ped(pt.x, pt.y, this.rng);
      cop.cop = true;
      cop.color = '#1c4fd6';
      this.peds.push(cop);
    }
  }

  // ----- entering / exiting cars --------------------------------------------
  nearestCar(maxD = 60) {
    let best = null, bd = maxD;
    for (const car of this.cars) {
      if (car.dead) continue;
      const d = dist(this.player.x, this.player.y, car.x, car.y);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }
  enterCar(car) {
    if (car.driver) {
      // Yank the driver out onto the sidewalk.
      const driver = new Ped(car.x - 30, car.y + 10, this.rng);
      driver.fleeing = 4;
      this.peds.push(driver);
      car.driver = false;
      this.stats.carsStolen++;
      this.addWanted(1, 'Car stolen — someone called the cops!');
      this.toast('Car stolen! Lose the heat or lay low.');
    }
    car.kind = 'player';
    this.player.inCar = true;
    this.player.car = car;
    this.player.x = car.x; this.player.y = car.y;
    this.sound.pickup();
    this.saveGame();
  }
  exitCar(forced = false) {
    const car = this.player.car;
    if (!car) return;
    car.kind = 'traffic';
    car.driver = false;
    car.speed = 0;
    this.player.inCar = false;
    this.player.car = null;
    // Step out to the side of the car.
    const side = car.angle + Math.PI / 2;
    this.player.x = car.x + Math.cos(side) * 34;
    this.player.y = car.y + Math.sin(side) * 34;
    this.player.angle = car.angle;
    if (!forced) this.saveGame();
  }

  // ----- missions / game over ------------------------------------------------
  showMissionComplete(m) {
    this.missionCompleteInfo = m;
    this.state = 'complete';
    this.stats.missionsDone++;
    this.stats.cashEarned += m.reward;
    setTimeout(() => { if (this.state === 'complete') this.state = 'playing'; }, 4200);
  }
  onPlayerDown() {
    if (this.wanted > 0 && this.peds.some((pd) => pd.cop && dist(pd.x, pd.y, this.player.x, this.player.y) < 200)) {
      this.state = 'busted';
      this.sound.busted();
    } else {
      this.state = 'wasted';
      this.sound.busted();
    }
    this.saveGame();
  }
  respawn() {
    const p = this.player;
    p.dead = false;
    p.health = TUNING.playerHealthMax;
    p.ammo = Math.max(p.ammo, 30);
    p.x = 640; p.y = 1840;
    p.inCar = false; p.car = null;
    this.wanted = 0;
    this.cash = Math.max(0, this.cash - 150);
    this.cars = this.cars.filter((c) => c.kind !== 'police');
    this.peds = this.peds.filter((pd) => !pd.cop);
    this.state = 'playing';
    this.toast('You woke up at the Safehouse. $150 hospital fee. Stay sharp.');
  }
  saveGame() {
    const p = this.player;
    saveGameData({
      cash: this.cash,
      missionIndex: this.missions.index,
      missionsDone: this.missions.completed,
      x: p.x, y: p.y,
      health: p.health, ammo: p.ammo,
      stats: this.stats,
    });
  }
  loadSave() {
    const s = loadGameData();
    if (!s) return false;
    this.cash = s.cash ?? 250;
    this.missions.index = s.missionIndex ?? 0;
    this.missions.completed = s.missionsDone ?? 0;
    this.stats = s.stats ?? this.stats;
    this.player.x = s.x ?? 640;
    this.player.y = s.y ?? 1840;
    this.player.health = s.health ?? 100;
    this.player.ammo = s.ammo ?? 30;
    this.state = 'playing';
    this.toast('Welcome back, Rico. Progress loaded.');
    return true;
  }
  newGame() {
    clearSaveData();
    this.cash = 250;
    this.missions.index = 0;
    this.missions.completed = 0;
    this.missions.state = 'idle';
    this.missions.active = null;
    this.stats = { carsStolen: 0, pedsDown: 0, missionsDone: 0, cashEarned: 0 };
    this.wanted = 0;
    const p = this.player;
    p.x = 640; p.y = 1840; p.health = 100; p.ammo = 30; p.dead = false;
    p.inCar = false; p.car = null;
    this.state = 'playing';
    this.sound.ensure();
    this.toast('Solmar City, 17:40. Donna Marisol is waiting — press M for work.');
    this.missions.start();
  }

  // ----- per-frame update -----------------------------------------------------
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.state === 'playing' || this.state === 'complete') this.update(dt);
    this.render(dt);
    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }
  update(dt) {
    this.time += dt;
    this.clock = (this.clock + dt * 12) % 86400; // 12x time: a day in 2 hours
    this.sound.update(dt, this.player.inCar);
    this.missions.update(dt);
    this.updatePlayer(dt);
    this.updateWanted(dt);
    for (const car of this.cars) car.update(dt, this);
    for (const ped of this.peds) ped.update(dt, this);
    for (const b of this.bullets) b.update(dt, this);
    for (const pt of this.particles) pt.update(dt);
    this.cars = this.cars.filter((c) => !c.dead);
    this.peds = this.peds.filter((p) => !p.dead);
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => p.life > 0);
    // Keep the streets populated.
    if (this.cars.filter((c) => c.kind === 'traffic').length < TUNING.maxTraffic) this.spawnTrafficCar();
    if (this.peds.filter((p) => !p.cop && !p.gang).length < TUNING.maxPeds) this.spawnPed();
    // Pickups.
    const p = this.player;
    for (const pk of this.pickups) {
      if (dist(p.x, p.y, pk.x, pk.y) < 30) {
        if (pk.kind === 'cash') { this.cash += 150; this.toast('+$150 street cash'); this.sound.cash(); }
        if (pk.kind === 'health') { p.health = Math.min(100, p.health + 40); this.toast('Health +40'); this.sound.pickup(); }
        if (pk.kind === 'ammo') { p.ammo = Math.min(TUNING.pistolAmmoMax, p.ammo + 30); this.toast('Ammo +30'); this.sound.pickup(); }
        pk.taken = true;
      }
    }
    this.pickups = this.pickups.filter((pk) => !pk.taken);
    // Safehouse clears wanted.
    const sh = LANDMARKS.find((l) => l.kind === 'safehouse');
    if (this.wanted > 0 && dist(p.x, p.y, sh.x, sh.y) < 90) {
      this.wanted = 0;
      this.toast('Laid low at the Safehouse — the heat is off.');
    }
    // Global keys.
    if (this.input.justPressed('m')) {
      if (this.missionFailed) this.missions.restart();
      else if (!this.missions.active) this.missions.start();
    }
    if (this.input.justPressed('escape') || this.input.justPressed('p')) {
      this.state = 'paused';
      this.saveGame();
    }
    if (this.input.justPressed('n')) this.sound.toggleMute();
    // Toasts tick.
    for (const t of this.hud.toasts) t.t -= dt;
    this.hud.toasts = this.hud.toasts.filter((t) => t.t > 0);
  }
  updatePlayer(dt) {
    const p = this.player;
    const input = this.input;
    p.shootCooldown -= dt;
    p.punchCooldown -= dt;
    if (p.inCar && p.car) { this.updateDriving(dt); return; }
    // On foot.
    const ax = input.axis();
    const running = input.down('shift');
    const speed = running ? TUNING.runSpeed : TUNING.walkSpeed;
    p.moving = ax.x !== 0 || ax.y !== 0;
    if (p.moving) {
      const len = Math.hypot(ax.x, ax.y) || 1;
      p.x += (ax.x / len) * speed * dt;
      p.y += (ax.y / len) * speed * dt;
      p.angle = Math.atan2(ax.y, ax.x);
    }
    // Aim with the mouse; face the cursor when aiming.
    const mouse = this.screenToWorld(input.mouse.x, input.mouse.y);
    p.aiming = input.mouse.down || input.down('f') || dist(mouse.x, mouse.y, p.x, p.y) > 40;
    if (input.mouse.down || input.down('f')) {
      p.angle = angleTo(p.x, p.y, mouse.x, mouse.y);
    }
    // Shoot.
    if ((input.mouse.clicked || input.justPressed('f')) && p.shootCooldown <= 0) {
      if (p.ammo > 0) {
        p.ammo--;
        p.shootCooldown = 0.28;
        const a = angleTo(p.x, p.y, mouse.x, mouse.y) + (Math.random() - 0.5) * 0.06;
        this.bullets.push(new Bullet(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, a, true, TUNING.pistolDamage));
        this.sound.shot();
        this.renderer.cam.shake = Math.max(this.renderer.cam.shake, 2);
        this.addWanted(0.25, null);
      } else {
        this.toast('Out of ammo — find an ammo pickup (orange box).');
        p.shootCooldown = 0.5;
      }
    }
    // Punch.
    if (input.justPressed(' ') && p.punchCooldown <= 0) {
      p.punchCooldown = 0.4;
      this.sound.punch();
      for (const ped of this.peds) {
        if (!ped.dead && dist(p.x, p.y, ped.x, ped.y) < 34) {
          ped.health -= 20;
          this.spawnParticles(ped.x, ped.y, 4, '#fff');
          if (ped.health <= 0) this.killPed(ped, true);
          else ped.fleeing = 2;
        }
      }
    }
    // Reload.
    if (input.justPressed('r')) {
      if (p.ammo < TUNING.pistolAmmoMax) { p.ammo = Math.min(TUNING.pistolAmmoMax, p.ammo + 12); this.toast('Reloaded +12'); }
    }
    // Enter a car.
    if (input.justPressed('e')) {
      const car = this.nearestCar();
      if (car) this.enterCar(car);
      else this.toast('No car close enough — walk up to one and press E.');
    }
    // Collide with buildings.
    for (const b of this.city.buildings) {
      const fix = collideCircleBox(p.x, p.y, 12, b);
      if (fix) { p.x = fix.x; p.y = fix.y; }
    }
    p.x = clamp(p.x, 14, WORLD - 14);
    p.y = clamp(p.y, 14, WORLD - 14);
    // Beach / sea: don't swim.
    if (p.y > WORLD - 130) p.y = WORLD - 130;
  }
  updateDriving(dt) {
    const p = this.player;
    const car = p.car;
    const input = this.input;
    const forward = input.down('w') || input.down('arrowup') || this.autoDrive;
    const back = input.down('s') || input.down('arrowdown');
    const left = input.down('a') || input.down('arrowleft');
    const right = input.down('d') || input.down('arrowright');
    const handbrake = input.down(' ');
    if (forward) car.speed += TUNING.carAccel * dt;
    if (back) car.speed -= (car.speed > 0 ? TUNING.carBrake : TUNING.carAccel * 0.6) * dt;
    if (!forward && !back) car.speed -= car.speed * TUNING.carDrag * dt;
    if (handbrake) car.speed -= car.speed * 2.2 * dt;
    car.speed = clamp(car.speed, -TUNING.carReverseMax, TUNING.carMaxSpeed);
    const steerDir = car.speed >= 0 ? 1 : -1;
    if (left) car.angle -= TUNING.carTurn * steerDir * dt * (0.5 + Math.min(1, Math.abs(car.speed) / 300));
    if (right) car.angle += TUNING.carTurn * steerDir * dt * (0.5 + Math.min(1, Math.abs(car.speed) / 300));
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // Building collision: slide along walls, lose speed on impact.
    let hit = false;
    for (const b of this.city.buildings) {
      const fix = collideCircleBox(nx, ny, 22, b);
      if (fix) { hit = true; }
    }
    if (hit) {
      if (Math.abs(car.speed) > 220) {
        this.sound.crash();
        this.renderer.cam.shake = Math.max(this.renderer.cam.shake, 6);
        car.health -= 8;
        this.spawnParticles(car.x, car.y, 8, '#aaa');
        if (car.health <= 0) this.explodeCar(car);
      }
      car.speed *= 0.55;
    } else {
      car.x = nx; car.y = ny;
    }
    car.x = clamp(car.x, 14, WORLD - 14);
    car.y = clamp(car.y, 14, WORLD - 14);
    if (car.y > WORLD - 130) { car.y = WORLD - 130; car.speed *= 0.5; }
    // Bump traffic cars.
    for (const other of this.cars) {
      if (other === car || other.dead) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 46 && d > 0.01) {
        const push = angleTo(other.x, other.y, car.x, car.y);
        car.x += Math.cos(push) * (46 - d) * 0.5;
        car.y += Math.sin(push) * (46 - d) * 0.5;
        other.x -= Math.cos(push) * (46 - d) * 0.5;
        other.y -= Math.sin(push) * (46 - d) * 0.5;
        if (Math.abs(car.speed) > 200) {
          this.sound.crash();
          this.renderer.cam.shake = Math.max(this.renderer.cam.shake, 4);
          car.health -= 4;
          other.health -= 6;
          if (other.health <= 0) this.explodeCar(other);
          if (car.health <= 0) this.explodeCar(car);
        }
        car.speed *= 0.92;
      }
    }
    // Run over pedestrians (a crime — the cops notice).
    for (const ped of this.peds) {
      if (!ped.dead && dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 60) {
        this.killPed(ped, true);
        this.addWanted(1, 'You ran someone over!');
        car.speed *= 0.85;
      }
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (Math.abs(car.speed) > 40 && Math.random() < dt * 8) this.sound.engine(Math.abs(car.speed) / TUNING.carMaxSpeed);
    if (input.justPressed('e')) this.exitCar();
  }

  // ----- rendering ------------------------------------------------------------
  render(dt) {
    const p = this.player;
    this.renderer.follow(p.x, p.y, dt);
    if (this.state === 'title') {
      this.drawTitle();
      return;
    }
    this.renderer.draw(this, dt);
    this.hud.draw(ctx, this);
    if (this.state === 'paused') this.drawOverlay('PAUSED', 'Press Esc to keep playing · progress saved', ['Esc — Resume', 'Q — Quit to title']);
    if (this.state === 'busted') this.drawOverlay('BUSTED', 'The Solmar PD caught up with you. $150 bail.', ['Enter — Wake up at the Safehouse']);
    if (this.state === 'wasted') this.drawOverlay('WASTED', 'Rico Vega went down. The city moves on.', ['Enter — Wake up at the Safehouse']);
    if (this.state === 'complete' && this.missionCompleteInfo) {
      const m = this.missionCompleteInfo;
      ctx.fillStyle = 'rgba(10,14,22,0.78)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 54px system-ui, sans-serif';
      ctx.fillText('MISSION COMPLETE', VIEW_W / 2, VIEW_H / 2 - 60);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillText(m.title + '  ·  +$' + m.reward.toLocaleString('en-US'), VIEW_W / 2, VIEW_H / 2 - 10);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = '#cfe3ff';
      ctx.fillText(this.missions.allDone ? 'You are the King of Solmar. The story is complete — free roam is yours.' : 'Donna Marisol has more work for you. Press M when ready.', VIEW_W / 2, VIEW_H / 2 + 30);
      ctx.textAlign = 'left';
    }
  }
  drawOverlay(title, sub, lines) {
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = title === 'BUSTED' ? '#3b82ff' : title === 'WASTED' ? '#ff5a5a' : '#fff';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(sub, VIEW_W / 2, VIEW_H / 2 + 4);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3ff';
    lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, VIEW_H / 2 + 44 + i * 26));
    ctx.textAlign = 'left';
  }
  drawTitle() {
    // Sun-soaked title backdrop: the city from above, slowly panning.
    this.time += 0.016;
    this.renderer.cam.x = 500 + Math.sin(this.time * 0.05) * 200;
    this.renderer.cam.y = 500 + Math.cos(this.time * 0.04) * 150;
    this.renderer.draw(this, 0.016);
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, 'rgba(20,8,30,0.25)');
    g.addColorStop(0.55, 'rgba(20,8,30,0.45)');
    g.addColorStop(1, 'rgba(20,8,30,0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('WELCOME TO', VIEW_W / 2, 150);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 96px system-ui, sans-serif';
    ctx.fillText('SOLMAR CITY', VIEW_W / 2, 250);
    ctx.fillStyle = '#ffb3c1';
    ctx.font = 'italic 22px system-ui, sans-serif';
    ctx.fillText('An open-world crime story — sun, speed and second chances.', VIEW_W / 2, 292);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Rico Vega just got out. Donna Marisol has work. The Barracudas want the city.', VIEW_W / 2, 330);
    ctx.fillText('Steal cars. Lose the cops. Run six missions. Own Solmar.', VIEW_W / 2, 356);
    // Buttons.
    const btns = this.hasSave
      ? ['▶  CONTINUE  —  pick up where you left off', '✦  NEW GAME  —  start Rico\'s story over']
      : ['✦  NEW GAME  —  start Rico\'s story'];
    btns.forEach((label, i) => {
      const y = 420 + i * 56;
      ctx.fillStyle = i === 0 ? '#ffd23f' : 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - 260, y, 520, 44, 10); ctx.fill();
      ctx.fillStyle = i === 0 ? '#1a1a1a' : '#fff';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText(label, VIEW_W / 2, y + 29);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('WASD move / drive  ·  E steal & enter cars  ·  Mouse aim, click to shoot  ·  M mission  ·  Esc pause  ·  N mute', VIEW_W / 2, 570);
    ctx.fillText('Best with sound on. Progress autosaves after every mission.', VIEW_W / 2, 596);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('An original game. Solmar City, Rico Vega and every name in it are invented — no Rockstar Games content.', VIEW_W / 2, 640);
    ctx.textAlign = 'left';
    // Title-screen clicks / keys.
    const m = this.input.mouse;
    if (m.clicked) {
      const y0 = 420, y1 = 476;
      if (this.hasSave && m.y >= y1 && m.y <= y1 + 44) { this.newGame(); return; }
      if (m.y >= y0 && m.y <= y0 + 44) {
        if (this.hasSave) this.loadSave(); else this.newGame();
        this.sound.ensure();
        return;
      }
    }
    if (this.input.justPressed('enter')) {
      if (this.hasSave) this.loadSave(); else this.newGame();
      this.sound.ensure();
    }
  }
}

const game = new Game();

// Screenshot presets (?shot=...) set the scene up for the camera.
if (game.shot) applyShotPreset(game, game.shot);

// Title / overlay keys handled globally (they also work from the loop states).
window.addEventListener('keydown', (e) => {
  if (game.state === 'paused' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) game.state = 'playing';
  else if (game.state === 'paused' && (e.key === 'q' || e.key === 'Q')) { game.state = 'title'; game.hasSave = !!loadGameData(); }
  else if ((game.state === 'busted' || game.state === 'wasted') && e.key === 'Enter') game.respawn();
});
