// Screenshot presets: ?shot=start|play|chase|end arranges a real, playable
// scene so a headless browser can photograph the game at its best.
// The game keeps running normally afterwards — these are just starting states.
import { PALETTE } from './config.js';
import { Car } from './entities.js';
import { nearestRoadPoint } from './world.js';

export function applyShotPreset(game, shot) {
  const p = game.player;
  if (shot === 'start') {
    game.state = 'title';
    return;
  }
  game.state = 'playing';
  game.sound.ensure();
  if (shot === 'play') {
    // Rico driving south down a Downtown avenue in traffic, mission active.
    const car = new Car(1120, 700, Math.PI / 2, '#d9392b', 'player');
    game.cars.push(car);
    game.enterCar(car);
    car.speed = 320;
    game.autoDrive = true;
    p.x = car.x; p.y = car.y;
    game.cash = 1840;
    game.missions.index = 1;
    game.missions.start();
  } else if (shot === 'chase') {
    // Wanted level 3, police cars in pursuit, Rico speeding east through Downtown.
    const car = new Car(1000, 800, 0, '#f2c230', 'player');
    game.cars.push(car);
    game.enterCar(car);
    car.speed = 430;
    game.autoDrive = true;
    game.cash = 3250;
    game.missions.index = 2;
    game.missions.start();
    game.wanted = 3; // set after start: the mission setup already adds heat
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const pt = nearestRoadPoint(p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320);
      const cop = new Car(pt.x, pt.y, 0, '#f5f5f5', 'police');
      cop.speed = 380;
      game.cars.push(cop);
    }
    game.toast('WANTED — lose the cops!');
  } else if (shot === 'end') {
    // Mission-complete moment: payout screen over a sunny Palm Heights street.
    const car = new Car(800, 1650, -Math.PI / 2, '#2b7fd9', 'player');
    game.cars.push(car);
    game.enterCar(car);
    car.speed = 0;
    game.cash = 5400;
    game.missions.index = 4;
    game.missions.completed = 4;
    game.missions.state = 'done';
    game.missionCompleteInfo = { title: 'Payback', reward: 1200 };
    game.state = 'complete'; // stays on the payout screen for the camera
  }
}
