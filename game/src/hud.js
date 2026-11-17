// HUD: health, cash, wanted stars, mission tracker, speed, clock, toasts,
// and the circular minimap in the corner.
import { WORLD, VIEW_W, VIEW_H, PALETTE } from './config.js';
import { districtName } from './world.js';

function star(cx, cy, r, filled, ctx) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd23f' : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
}

export class HUD {
  constructor() { this.toasts = []; }
  toast(text, dur = 4) { this.toasts.push({ text, t: dur }); }
  draw(ctx, game) {
    const p = game.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Top-right: wanted stars.
    const stars = Math.ceil(game.wanted);
    const sx = VIEW_W - 24 - stars * 30;
    ctx.fillStyle = PALETTE.hudBg;
    ctx.beginPath(); ctx.roundRect(VIEW_W - 190, 12, 178, 40, 10); ctx.fill();
    for (let i = 0; i < 5; i++) star(VIEW_W - 168 + i * 30, 32, 12, i < stars, ctx);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(game.wanted > 0 ? 'WANTED' : 'CLEAN', VIEW_W - 24, 66);
    ctx.textAlign = 'left';

    // Top-left: cash + district + clock.
    ctx.fillStyle = PALETTE.hudBg;
    ctx.beginPath(); ctx.roundRect(12, 12, 250, 64, 10); ctx.fill();
    ctx.fillStyle = '#7be495';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('$' + Math.floor(game.cash).toLocaleString('en-US'), 24, 42);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(districtName(p.x, p.y) + '  ·  ' + game.clockString(), 24, 62);

    // Health + armour bar under the cash.
    ctx.fillStyle = PALETTE.hudBg;
    ctx.beginPath(); ctx.roundRect(12, 84, 250, 34, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(24, 95, 150, 10);
    ctx.fillStyle = p.health > 40 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(24, 95, 150 * (p.health / 100), 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('HP ' + Math.ceil(p.health), 182, 104);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('◈ ' + p.ammo, 226, 104);

    // Mission tracker.
    const m = game.missions.active;
    if (m) {
      ctx.fillStyle = PALETTE.hudBg;
      ctx.beginPath(); ctx.roundRect(12, 126, 330, 58, 10); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('★ ' + m.title, 24, 148);
      ctx.fillStyle = '#fff';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(game.objectiveText, 24, 168);
      if (game.missions.timer > 0) {
        ctx.fillStyle = game.missions.timer < 15 ? '#ff5a5a' : '#7be495';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText('⏱ ' + Math.ceil(game.missions.timer) + 's', 24, 186 - 6);
      }
    } else if (game.missions.allDone) {
      ctx.fillStyle = PALETTE.hudBg;
      ctx.beginPath(); ctx.roundRect(12, 126, 330, 40, 10); ctx.fill();
      ctx.fillStyle = '#7be495';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('👑 King of Solmar — story complete!', 24, 152);
    } else {
      ctx.fillStyle = PALETTE.hudBg;
      ctx.beginPath(); ctx.roundRect(12, 126, 330, 40, 10); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('Press M to start the next mission', 24, 152);
    }

    // Speed + gear when driving.
    if (p.inCar && p.car) {
      const kmh = Math.abs(Math.round(p.car.speed * 0.36));
      ctx.fillStyle = PALETTE.hudBg;
      ctx.beginPath(); ctx.roundRect(VIEW_W - 150, VIEW_H - 76, 138, 64, 10); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(kmh), VIEW_W - 52, VIEW_H - 34);
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('km/h', VIEW_W - 24, VIEW_H - 34);
      ctx.textAlign = 'left';
      if (p.car.health < 100) {
        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText('CAR ' + Math.max(0, Math.ceil(p.car.health)) + '%', VIEW_W - 138, VIEW_H - 52);
      }
    }

    // Controls hint.
    ctx.fillStyle = 'rgba(10,14,22,0.55)';
    ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - 250, VIEW_H - 30, 500, 22, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.inCar ? 'W/S drive · A/D steer · Space handbrake · E exit car' : 'WASD move · Shift run · E steal car · Mouse aim · Click / F shoot · R reload', VIEW_W / 2, VIEW_H - 15);
    ctx.textAlign = 'left';

    // Toasts (truncated so long lines never run off the screen).
    let ty = 210;
    for (const t of this.toasts) {
      const text = t.text.length > 72 ? t.text.slice(0, 69) + '…' : t.text;
      ctx.globalAlpha = Math.min(1, t.t);
      ctx.fillStyle = PALETTE.hudBg;
      const w = ctx.measureText(text).width + 28;
      ctx.beginPath(); ctx.roundRect(12, ty, Math.min(w, 520), 30, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(text, 26, ty + 20);
      ty += 36;
    }
    ctx.globalAlpha = 1;

    this.drawMinimap(ctx, game);
  }
  drawMinimap(ctx, game) {
    const size = 190;
    const mx = VIEW_W - size - 14;
    const my = VIEW_H - size - 14 - (game.player.inCar ? 70 : 0);
    const scale = size / WORLD;
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx + size / 2, my + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#22401e';
    ctx.fillRect(mx, my, size, size);
    // Sea + beach.
    ctx.fillStyle = '#2e7fb8';
    ctx.fillRect(mx, my + (WORLD - 150) * scale, size, 150 * scale);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(mx, my + game.city.beachY * scale, size, (WORLD - game.city.beachY) * scale);
    // Roads.
    ctx.strokeStyle = '#9aa0ab'; ctx.lineWidth = 3;
    for (const c of game.city.centers) {
      ctx.beginPath(); ctx.moveTo(mx + c * scale, my); ctx.lineTo(mx + c * scale, my + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my + c * scale); ctx.lineTo(mx + size, my + c * scale); ctx.stroke();
    }
    // Parks.
    ctx.fillStyle = '#5da24a';
    for (const pk of game.city.parks) ctx.fillRect(mx + pk.x * scale, my + pk.y * scale, pk.w * scale, pk.h * scale);
    // Mission marker.
    const mm = game.missionMarker();
    if (mm) {
      const pulse = 5 + Math.sin(game.time * 6) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(mx + mm.x * scale, my + mm.y * scale, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Police blips.
    ctx.fillStyle = '#3b82ff';
    for (const car of game.cars) {
      if (car.kind === 'police') {
        ctx.beginPath(); ctx.arc(mx + car.x * scale, my + car.y * scale, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const ped of game.peds) {
      if (ped.cop) {
        ctx.beginPath(); ctx.arc(mx + ped.x * scale, my + ped.y * scale, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Player arrow.
    const p = game.player;
    ctx.save();
    ctx.translate(mx + p.x * scale, my + p.y * scale);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', mx + size / 2, my + 14);
    ctx.textAlign = 'left';
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mx + size / 2, my + size / 2, size / 2, 0, Math.PI * 2); ctx.stroke();
  }
}
