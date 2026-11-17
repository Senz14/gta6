// Story missions for Solmar City. Each mission is a small state machine:
// a title, briefing text, an objective marker, a check that runs every frame,
// and a reward. The chain tells Rico Vega's rise in Solmar City.
import { dist } from './random.js';
import { LANDMARKS } from './config.js';

function at(name) {
  const lm = LANDMARKS.find((l) => l.name === name);
  return { x: lm.x, y: lm.y, label: name };
}

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Donna Marisol',
    brief: 'You need wheels before you can work. Steal any car on the street and bring it to the City Garage.',
    objective: 'Steal a car, then drive to the City Garage',
    marker: at('City Garage'),
    reward: 400,
    setup(game) { game.setHint('Walk up to a parked or passing car and press E to steal it.'); },
    check(game) {
      if (game.player.inCar) {
        game.setObjective('Drive to the City Garage');
        if (dist(game.player.x, game.player.y, this.marker.x, this.marker.y) < 70) return true;
      }
      return false;
    },
  },
  {
    id: 'the-package',
    title: 'The Package',
    giver: 'Donna Marisol',
    brief: 'A crate is waiting at the Old Port Docks. Pick it up on foot, then deliver it to the Neon Strip. Cops hate couriers — stay sharp.',
    objective: 'Pick up the package at the Old Port Docks',
    marker: at('Old Port Docks'),
    reward: 700,
    setup(game) { this.pickedUp = false; },
    check(game) {
      if (!this.pickedUp) {
        if (dist(game.player.x, game.player.y, this.marker.x, this.marker.y) < 60) {
          this.pickedUp = true;
          this.marker = at('The Neon Strip');
          game.setObjective('Deliver the package to the Neon Strip');
          game.sound.pickup();
          game.toast('Package secured — deliver it to the Neon Strip');
        }
        return false;
      }
      return dist(game.player.x, game.player.y, this.marker.x, this.marker.y) < 70;
    },
  },
  {
    id: 'hot-pursuit',
    title: 'Hot Pursuit',
    giver: 'Donna Marisol',
    brief: 'The Barracudas tipped off the police. You are wanted — lose the heat. Outrun the cops until your stars fade, or lay low at the Safehouse.',
    objective: 'Lose the wanted level',
    marker: at('Safehouse'),
    reward: 800,
    setup(game) {
      game.addWanted(2, 'The Barracudas tipped off the cops!');
      game.setObjective('Lose the cops — outrun them or reach the Safehouse');
    },
    check(game) { return game.wanted <= 0; },
  },
  {
    id: 'payback',
    title: 'Payback',
    giver: 'Donna Marisol',
    brief: 'The Barracudas are shaking down Palm Plaza. Go on foot, take out their crew of four, and send a message. Your pistol is ready — aim with the mouse, click to shoot.',
    objective: 'Take out the Barracuda crew at Palm Plaza (0/4)',
    marker: at('Palm Plaza'),
    reward: 1200,
    setup(game) {
      this.kills = 0;
      game.spawnGang(4, this.marker.x, this.marker.y);
      game.player.ammo = Math.max(game.player.ammo, 40);
      game.setHint('Aim with the mouse, click or press F to shoot. R reloads.');
    },
    check(game) {
      game.setObjective(`Take out the Barracuda crew at Palm Plaza (${this.kills}/4)`);
      return this.kills >= 4;
    },
  },
  {
    id: 'the-getaway',
    title: 'The Getaway',
    giver: 'Donna Marisol',
    brief: 'The crew just hit the Marina Bay casino. You drive. Get the getaway car to the Safehouse in 90 seconds — and the cops will be coming.',
    objective: 'Drive the getaway car to the Safehouse',
    marker: at('Safehouse'),
    reward: 1500,
    timeLimit: 90,
    setup(game) {
      game.addWanted(2, 'The casino job went loud!');
      game.spawnGetawayCar(this.marker);
      game.setObjective('Get in the getaway car and reach the Safehouse');
    },
    check(game) {
      if (game.player.inCar && game.player.car && game.player.car.kind === 'player') {
        game.setObjective('Drive to the Safehouse — fast!');
        return dist(game.player.x, game.player.y, this.marker.x, this.marker.y) < 70;
      }
      return false;
    },
  },
  {
    id: 'king-of-solmar',
    title: 'King of Solmar',
    giver: 'Donna Marisol',
    brief: 'One last job. The score is waiting at Sunset Pier. Pick it up, shake the Barracudas off your tail, and bring it home to the Safehouse. Do this and Solmar is yours.',
    objective: 'Pick up the score at Sunset Pier',
    marker: at('Sunset Pier'),
    reward: 3000,
    setup(game) { this.pickedUp = false; game.spawnGang(3, this.marker.x, this.marker.y); },
    check(game) {
      if (!this.pickedUp) {
        if (dist(game.player.x, game.player.y, this.marker.x, this.marker.y) < 60) {
          this.pickedUp = true;
          this.marker = at('Safehouse');
          game.addWanted(3, 'The Barracudas want their score back!');
          game.setObjective('Bring the score to the Safehouse');
          game.toast('Score secured — get to the Safehouse!');
        }
        return false;
      }
      return dist(game.player.x, game.player.y, this.marker.x, this.marker.y) < 70;
    },
  },
];

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.active = null;
    this.timer = 0;
    this.completed = 0;
    this.state = 'idle'; // idle | active | done
  }
  get current() { return MISSIONS[this.index] || null; }
  get allDone() { return this.index >= MISSIONS.length; }
  start() {
    if (this.allDone) return false;
    this.active = this.current;
    this.active.pickedUp = false;
    this.active.kills = 0;
    this.timer = this.active.timeLimit || 0;
    this.state = 'active';
    this.game.setObjective(this.active.objective);
    this.game.toast(`Mission: ${this.active.title} — ${this.active.objective}`);
    if (this.active.setup) this.active.setup.call(this.active, this.game);
    return true;
  }
  update(dt) {
    if (this.state !== 'active' || !this.active) return;
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'idle';
        this.game.toast('Mission failed — out of time. Press M to try again.');
        this.game.sound.busted();
        this.game.missionFailed = true;
        return;
      }
    }
    if (this.active.check.call(this.active, this.game)) this.complete();
  }
  complete() {
    const m = this.active;
    this.game.cash += m.reward;
    this.completed++;
    this.index++;
    this.state = 'done';
    this.active = null;
    this.game.sound.missionDone();
    this.game.sound.cash();
    this.game.showMissionComplete(m);
    this.game.saveGame();
  }
  restart() {
    this.state = 'idle';
    this.active = null;
    this.game.missionFailed = false;
    this.start();
  }
}
