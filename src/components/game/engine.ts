// Top-down GTA-style co-op engine: on-foot + driving + shooting, split-screen.

export type Mode = "solo" | "coop";

export interface PlayerHud {
  health: number;
  speedKmh: number;
  onFoot: boolean;
  alive: boolean;
  respawnIn: number;
  ammo: number;
}

export interface GameState {
  mode: Mode;
  cash: number;
  wanted: number;
  score: number;
  players: PlayerHud[];
  running: boolean;
  gameOver: boolean;
}

type Listener = (s: GameState) => void;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  roof: string;
}

interface Vehicle {
  x: number;
  y: number;
  angle: number;
  speed: number;
  color: string;
  occupant: number | null;
}

interface Player {
  id: number;
  x: number;
  y: number;
  angle: number; // facing
  vx: number;
  vy: number;
  health: number;
  alive: boolean;
  respawnIn: number;
  vehicle: Vehicle | null;
  shootCd: number;
  enterCd: number;
  color: string;
  ammo: number;
}

interface Enemy {
  x: number;
  y: number;
  angle: number;
  health: number;
  shootCd: number;
  alive: boolean;
  cop: boolean;
}

interface Ped {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hostile: boolean;
}

interface Pickup {
  x: number;
  y: number;
  taken: boolean;
  pulse: number;
  kind: "cash" | "ammo";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

const CELL = 460;
const ROAD = 130;
const GRID = 10;
const WORLD = CELL * GRID;

const BUILDING = [
  ["#2b3550", "#3a466b"],
  ["#33304a", "#46415f"],
  ["#2a3a44", "#3a4f5c"],
  ["#3a3142", "#4f4259"],
  ["#283648", "#374a61"],
];
const P_COLORS = ["#e23b3b", "#39b6ff"];

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private raf = 0;
  private last = 0;
  private keys: Record<string, boolean> = {};
  private listener: Listener;
  private mode: Mode = "solo";

  private buildings: Rect[] = [];
  private vehicles: Vehicle[] = [];
  private players: Player[] = [];
  private enemies: Enemy[] = [];
  private peds: Ped[] = [];
  private bullets: Bullet[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private cams: { x: number; y: number }[] = [];

  private wantedTimer = 0;
  private enemyTimer = 0;

  state: GameState = this.blankState("solo");

  constructor(canvas: HTMLCanvasElement, listener: Listener) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.listener = listener;
  }

  private blankState(mode: Mode): GameState {
    const n = mode === "coop" ? 2 : 1;
    return {
      mode,
      cash: 0,
      wanted: 0,
      score: 0,
      players: Array.from({ length: n }, () => ({
        health: 100,
        speedKmh: 0,
        onFoot: true,
        alive: true,
        respawnIn: 0,
        ammo: 60,
      })),
      running: false,
      gameOver: false,
    };
  }

  private buildWorld() {
    this.buildings = [];
    for (let gx = 0; gx < GRID; gx++) {
      for (let gy = 0; gy < GRID; gy++) {
        if (Math.random() < 0.22) continue; // park / lot
        const pal = BUILDING[(gx * 3 + gy) % BUILDING.length];
        this.buildings.push({
          x: gx * CELL + ROAD / 2,
          y: gy * CELL + ROAD / 2,
          w: CELL - ROAD,
          h: CELL - ROAD,
          color: pal[0],
          roof: pal[1],
        });
      }
    }

    this.pickups = [];
    for (let i = 0; i < 46; i++) {
      const gx = Math.floor(rand(0, GRID));
      const gy = Math.floor(rand(0, GRID));
      this.pickups.push({
        x: gx * CELL + (Math.random() < 0.5 ? 0 : CELL / 2),
        y: gy * CELL + (Math.random() < 0.5 ? 0 : CELL / 2),
        taken: false,
        pulse: rand(0, 6.28),
        kind: Math.random() < 0.7 ? "cash" : "ammo",
      });
    }

    this.peds = [];
    for (let i = 0; i < 70; i++) this.peds.push(this.spawnPed());

    this.vehicles = [];
    const carColors = ["#d6b24a", "#5cc46a", "#bd5cd6", "#46b1c9", "#c9603f", "#8a93a8"];
    for (let i = 0; i < 22; i++) {
      const gx = Math.floor(rand(0, GRID));
      const gy = Math.floor(rand(0, GRID));
      this.vehicles.push({
        x: gx * CELL + rand(-40, 40),
        y: gy * CELL + rand(-40, 40),
        angle: Math.random() < 0.5 ? 0 : Math.PI / 2,
        speed: 0,
        color: carColors[i % carColors.length],
        occupant: null,
      });
    }
  }

  private spawnPed(): Ped {
    const colors = ["#e2c08d", "#d98c5f", "#f0d6c2", "#b5e0c2", "#e0b5d4"];
    return {
      x: rand(0, WORLD),
      y: rand(0, WORLD),
      vx: rand(-22, 22),
      vy: rand(-22, 22),
      color: colors[(Math.random() * colors.length) | 0],
      alive: true,
    };
  }

  start(mode: Mode) {
    this.mode = mode;
    this.state = this.blankState(mode);
    this.buildWorld();
    this.enemies = [];
    this.bullets = [];
    this.particles = [];

    const n = mode === "coop" ? 2 : 1;
    this.players = [];
    this.cams = [];
    for (let i = 0; i < n; i++) {
      const px = CELL + i * 60;
      const py = CELL;
      this.players.push({
        id: i,
        x: px,
        y: py,
        angle: -Math.PI / 2,
        vx: 0,
        vy: 0,
        health: 100,
        alive: true,
        respawnIn: 0,
        vehicle: null,
        shootCd: 0,
        enterCd: 0,
        color: P_COLORS[i],
        ammo: 60,
      });
      this.cams.push({ x: px, y: py });
    }

    this.state.running = true;
    this.emit();
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.loop(this.last);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.state.running = false;
  }

  setKey(code: string, down: boolean) {
    this.keys[code] = down;
  }

  private emit() {
    this.state.players.forEach((h, i) => {
      const p = this.players[i];
      if (!p) return;
      h.health = Math.max(0, Math.round(p.health));
      h.onFoot = !p.vehicle;
      h.alive = p.alive;
      h.respawnIn = Math.ceil(p.respawnIn);
      h.ammo = p.ammo;
      h.speedKmh = p.vehicle ? Math.round(Math.abs(p.vehicle.speed) / 3.2) : 0;
    });
    this.listener({ ...this.state, players: this.state.players.map((p) => ({ ...p })) });
  }

  private loop = (t: number) => {
    const dt = Math.min((t - this.last) / 1000, 0.05);
    this.last = t;
    if (this.state.running) {
      this.update(dt);
      this.render();
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private collidesBuilding(x: number, y: number, r: number) {
    for (const b of this.buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  // ----- input maps per player -----
  private ctrl(i: number) {
    if (i === 0)
      return {
        up: this.keys["KeyW"],
        down: this.keys["KeyS"],
        left: this.keys["KeyA"],
        right: this.keys["KeyD"],
        shoot: this.keys["KeyF"] || this.keys["Space"],
        enter: this.keys["KeyE"],
      };
    return {
      up: this.keys["ArrowUp"],
      down: this.keys["ArrowDown"],
      left: this.keys["ArrowLeft"],
      right: this.keys["ArrowRight"],
      shoot: this.keys["Slash"],
      enter: this.keys["Enter"] || this.keys["NumpadEnter"],
    };
  }

  private update(dt: number) {
    for (const p of this.players) this.updatePlayer(p, dt);

    // peds
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      if (Math.random() < 0.01) {
        ped.vx = rand(-22, 22);
        ped.vy = rand(-22, 22);
      }
      ped.x = (ped.x + ped.vx * dt + WORLD) % WORLD;
      ped.y = (ped.y + ped.vy * dt + WORLD) % WORLD;
      for (const p of this.players) {
        if (p.vehicle && Math.hypot(ped.x - p.vehicle.x, ped.y - p.vehicle.y) < 22 && Math.abs(p.vehicle.speed) > 60) {
          ped.alive = false;
          this.state.score += 50;
          this.blood(ped.x, ped.y);
          this.bumpWanted(1);
          setTimeout(() => Object.assign(ped, this.spawnPed()), 7000);
        }
      }
    }

    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);

    // wanted decay
    if (this.state.wanted > 0) {
      this.wantedTimer -= dt;
      if (this.wantedTimer <= 0) {
        this.state.wanted = Math.max(0, this.state.wanted - 1);
        this.wantedTimer = 12;
      }
    }

    // cameras
    this.players.forEach((p, i) => {
      const tx = p.vehicle ? p.vehicle.x : p.x;
      const ty = p.vehicle ? p.vehicle.y : p.y;
      const c = this.cams[i];
      c.x += (tx - c.x) * Math.min(1, 6 * dt);
      c.y += (ty - c.y) * Math.min(1, 6 * dt);
    });

    // game over
    const anyAlive = this.players.some((p) => p.alive);
    if (!anyAlive) {
      this.state.running = false;
      this.state.gameOver = true;
    }
    this.emit();
  }

  private updatePlayer(p: Player, dt: number) {
    if (!p.alive) {
      p.respawnIn -= dt;
      if (p.respawnIn <= 0) this.respawn(p);
      return;
    }
    const c = this.ctrl(p.id);
    p.shootCd -= dt;
    p.enterCd -= dt;

    if (p.vehicle) {
      const v = p.vehicle;
      const accel = 540,
        reverse = 320,
        maxSpeed = 600,
        turn = 2.7;
      if (c.up) v.speed += accel * dt;
      else if (c.down) v.speed -= reverse * dt;
      else v.speed *= 1 - 1.6 * dt;
      v.speed = Math.max(-240, Math.min(maxSpeed, v.speed));
      if (Math.abs(v.speed) < 3) v.speed = 0;
      const sf = Math.max(-1, Math.min(1, v.speed / 120));
      if (c.left) v.angle -= turn * sf * dt;
      if (c.right) v.angle += turn * sf * dt;
      const nx = v.x + Math.cos(v.angle) * v.speed * dt;
      const ny = v.y + Math.sin(v.angle) * v.speed * dt;
      if (!this.collidesBuilding(nx, v.y, 16)) v.x = nx;
      else v.speed *= 0.3;
      if (!this.collidesBuilding(v.x, ny, 16)) v.y = ny;
      else v.speed *= 0.3;
      v.x = Math.max(20, Math.min(WORLD - 20, v.x));
      v.y = Math.max(20, Math.min(WORLD - 20, v.y));
      p.x = v.x;
      p.y = v.y;
      p.angle = v.angle;
      if (Math.abs(v.speed) > 320 && (c.left || c.right) && Math.random() < 0.5)
        this.particles.push({ x: v.x, y: v.y, vx: 0, vy: 0, life: 3, max: 3, color: "rgba(10,10,14,0.5)", size: 5 });
      if (c.enter && p.enterCd <= 0) {
        p.enterCd = 0.4;
        v.occupant = null;
        p.vehicle = null;
        p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 26;
        p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 26;
      }
    } else {
      const sp = 175;
      let mx = 0,
        my = 0;
      if (c.up) my -= 1;
      if (c.down) my += 1;
      if (c.left) mx -= 1;
      if (c.right) mx += 1;
      const len = Math.hypot(mx, my) || 1;
      mx /= len;
      my /= len;
      if (mx || my) p.angle = Math.atan2(my, mx);
      const nx = p.x + mx * sp * dt;
      const ny = p.y + my * sp * dt;
      if (!this.collidesBuilding(nx, p.y, 9)) p.x = nx;
      if (!this.collidesBuilding(p.x, ny, 9)) p.y = ny;
      p.x = Math.max(10, Math.min(WORLD - 10, p.x));
      p.y = Math.max(10, Math.min(WORLD - 10, p.y));

      if (c.enter && p.enterCd <= 0) {
        p.enterCd = 0.4;
        let best: Vehicle | null = null;
        let bd = 60;
        for (const v of this.vehicles) {
          if (v.occupant !== null) continue;
          const d = Math.hypot(v.x - p.x, v.y - p.y);
          if (d < bd) {
            bd = d;
            best = v;
          }
        }
        if (best) {
          best.occupant = p.id;
          p.vehicle = best;
        }
      }

      if (c.shoot && p.shootCd <= 0 && p.ammo > 0) {
        p.shootCd = 0.16;
        p.ammo--;
        const spread = rand(-0.05, 0.05);
        const a = p.angle + spread;
        this.bullets.push({
          x: p.x + Math.cos(a) * 14,
          y: p.y + Math.sin(a) * 14,
          vx: Math.cos(a) * 760,
          vy: Math.sin(a) * 760,
          life: 0.7,
          hostile: false,
        });
        this.particles.push({
          x: p.x + Math.cos(a) * 16,
          y: p.y + Math.sin(a) * 16,
          vx: 0,
          vy: 0,
          life: 0.06,
          max: 0.06,
          color: "rgba(255,220,120,0.95)",
          size: 10,
        });
      }
    }
  }

  private respawn(p: Player) {
    p.alive = true;
    p.health = 100;
    p.ammo = 60;
    p.vehicle = null;
    const gx = Math.floor(rand(1, GRID - 1));
    const gy = Math.floor(rand(1, GRID - 1));
    p.x = gx * CELL;
    p.y = gy * CELL;
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (this.collidesBuilding(b.x, b.y, 2)) {
        b.life = 0;
        this.spark(b.x, b.y);
        continue;
      }
      if (b.hostile) {
        for (const p of this.players) {
          if (!p.alive) continue;
          const tx = p.vehicle ? p.vehicle.x : p.x;
          const ty = p.vehicle ? p.vehicle.y : p.y;
          if (Math.hypot(b.x - tx, b.y - ty) < (p.vehicle ? 20 : 11)) {
            b.life = 0;
            p.health -= p.vehicle ? 6 : 12;
            this.spark(b.x, b.y);
            if (p.health <= 0) this.downPlayer(p);
          }
        }
      } else {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < 12) {
            b.life = 0;
            e.health -= 25;
            this.spark(b.x, b.y);
            if (e.health <= 0) {
              e.alive = false;
              this.blood(e.x, e.y);
              this.state.cash += e.cop ? 300 : 150;
              this.state.score += e.cop ? 200 : 120;
            }
          }
        }
        for (const ped of this.peds) {
          if (!ped.alive) continue;
          if (Math.hypot(b.x - ped.x, b.y - ped.y) < 8) {
            b.life = 0;
            ped.alive = false;
            this.blood(ped.x, ped.y);
            this.bumpWanted(2);
            setTimeout(() => Object.assign(ped, this.spawnPed()), 7000);
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  private downPlayer(p: Player) {
    p.alive = false;
    p.health = 0;
    this.blood(p.x, p.y);
    if (p.vehicle) {
      p.vehicle.occupant = null;
      p.vehicle = null;
    }
    p.respawnIn = this.mode === "coop" ? 5 : 999;
  }

  private updateEnemies(dt: number) {
    this.enemyTimer -= dt;
    const target = this.state.wanted * 2;
    const live = this.enemies.filter((e) => e.alive).length;
    if (this.state.wanted > 0 && live < target && this.enemyTimer <= 0) {
      this.enemyTimer = 1.4;
      const anchor = this.players.find((p) => p.alive) ?? this.players[0];
      const ang = rand(0, 6.28);
      this.enemies.push({
        x: anchor.x + Math.cos(ang) * 760,
        y: anchor.y + Math.sin(ang) * 760,
        angle: ang,
        health: 40,
        shootCd: rand(0.5, 1.5),
        alive: true,
        cop: true,
      });
    }
    if (this.state.wanted === 0) this.enemies.forEach((e) => (e.alive = false));

    for (const e of this.enemies) {
      if (!e.alive) continue;
      let tx = 0,
        ty = 0,
        bd = Infinity;
      for (const p of this.players) {
        if (!p.alive) continue;
        const px = p.vehicle ? p.vehicle.x : p.x;
        const py = p.vehicle ? p.vehicle.y : p.y;
        const d = Math.hypot(px - e.x, py - e.y);
        if (d < bd) {
          bd = d;
          tx = px;
          ty = py;
        }
      }
      if (bd === Infinity) continue;
      e.angle = Math.atan2(ty - e.y, tx - e.x);
      if (bd > 300) {
        e.x += Math.cos(e.angle) * 200 * dt;
        e.y += Math.sin(e.angle) * 200 * dt;
      }
      e.shootCd -= dt;
      if (bd < 420 && e.shootCd <= 0) {
        e.shootCd = rand(0.9, 1.6);
        const a = e.angle + rand(-0.08, 0.08);
        this.bullets.push({
          x: e.x + Math.cos(a) * 12,
          y: e.y + Math.sin(a) * 12,
          vx: Math.cos(a) * 520,
          vy: Math.sin(a) * 520,
          life: 1,
          hostile: true,
        });
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private updatePickups(dt: number) {
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      pk.pulse += dt * 4;
      for (const p of this.players) {
        if (!p.alive) continue;
        const px = p.vehicle ? p.vehicle.x : p.x;
        const py = p.vehicle ? p.vehicle.y : p.y;
        if (Math.hypot(pk.x - px, pk.y - py) < 26) {
          pk.taken = true;
          if (pk.kind === "cash") {
            this.state.cash += 250;
            this.state.score += 100;
          } else {
            p.ammo = Math.min(180, p.ammo + 40);
          }
          setTimeout(() => {
            pk.x = Math.floor(rand(0, GRID)) * CELL;
            pk.y = Math.floor(rand(0, GRID)) * CELL;
            pk.taken = false;
          }, 5000);
          break;
        }
      }
    }
  }

  private updateParticles(dt: number) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private spark(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      const a = rand(0, 6.28);
      this.particles.push({ x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.2, max: 0.2, color: "rgba(255,210,120,0.9)", size: 3 });
    }
  }

  private blood(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const a = rand(0, 6.28);
      const s = rand(40, 140);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.6), max: 0.6, color: "rgba(190,40,40,0.9)", size: rand(2, 4) });
    }
  }

  private bumpWanted(by: number) {
    this.state.wanted = Math.min(5, this.state.wanted + by);
    this.wantedTimer = 14;
  }

  // ---------- RENDER ----------
  private render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = "#0c0f17";
    ctx.fillRect(0, 0, W, H);

    if (this.mode === "coop") {
      const half = W / 2;
      this.renderView(0, 0, half - 1, H, this.cams[0], 0);
      this.renderView(half + 1, 0, half - 1, H, this.cams[1], 1);
      ctx.fillStyle = "#000";
      ctx.fillRect(half - 1, 0, 2, H);
    } else {
      this.renderView(0, 0, W, H, this.cams[0], 0);
    }
  }

  private renderView(vx: number, vy: number, vw: number, vh: number, cam: { x: number; y: number }, viewIndex: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(vx, vy, vw, vh);
    ctx.clip();
    ctx.fillStyle = "#171c28";
    ctx.fillRect(vx, vy, vw, vh);
    ctx.translate(vx + vw / 2 - cam.x, vy + vh / 2 - cam.y);

    // roads grid markings
    ctx.strokeStyle = "rgba(240,200,120,0.16)";
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
    for (let i = 0; i <= GRID; i++) {
      const p = i * CELL;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, WORLD);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(WORLD, p);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // buildings with drop shadow + roof
    for (const b of this.buildings) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(b.x + 8, b.y + 12, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 14, b.y + 14, b.w - 28, b.h - 28);
      ctx.fillStyle = "rgba(255,235,170,0.10)";
      for (let wx = b.x + 16; wx < b.x + b.w - 12; wx += 46)
        for (let wy = b.y + 16; wy < b.y + b.h - 12; wy += 46) ctx.fillRect(wx, wy, 18, 18);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    // pickups
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const s = 1 + Math.sin(pk.pulse) * 0.15;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.scale(s, s);
      const cash = pk.kind === "cash";
      ctx.shadowColor = cash ? "rgba(120,220,140,0.9)" : "rgba(120,180,255,0.9)";
      ctx.shadowBlur = 16;
      ctx.fillStyle = cash ? "#3fcf6a" : "#4a92ff";
      ctx.fillRect(-12, -8, 24, 16);
      ctx.shadowBlur = 0;
      ctx.fillStyle = cash ? "#0c3a1c" : "#0b1f44";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cash ? "$" : "⁌", 0, 1);
      ctx.restore();
    }

    // peds
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.arc(ped.x + 2, ped.y + 3, 6, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 6, 0, 6.28);
      ctx.fill();
    }

    // parked / driven vehicles
    for (const v of this.vehicles) this.drawCar(ctx, v.x, v.y, v.angle, v.color, false, Math.abs(v.speed) > 30);

    // enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.drawPerson(ctx, e.x, e.y, e.angle, "#2d54c8", true);
    }

    // players (on foot)
    this.players.forEach((p, i) => {
      if (p.vehicle) return;
      if (!p.alive) return;
      this.drawPerson(ctx, p.x, p.y, p.angle, p.color, false);
      // name tag
      ctx.fillStyle = p.color;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`P${i + 1}`, p.x, p.y - 16);
    });
    // players in cars already drawn via vehicles list (occupant), tag them
    this.players.forEach((p, i) => {
      if (!p.vehicle) return;
      this.drawCar(ctx, p.vehicle.x, p.vehicle.y, p.vehicle.angle, p.color, true, Math.abs(p.vehicle.speed) > 30);
      ctx.fillStyle = p.color;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`P${i + 1}`, p.vehicle.x, p.vehicle.y - 24);
    });

    // bullets + particles (glow)
    for (const b of this.bullets) {
      ctx.shadowColor = b.hostile ? "rgba(255,90,90,0.9)" : "rgba(255,230,140,0.95)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.hostile ? "#ff6b6b" : "#ffe28a";
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
      ctx.shadowBlur = 0;
    }
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, 6.28);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // vignette per view
    const g = ctx.createRadialGradient(vx + vw / 2, vy + vh / 2, Math.min(vw, vh) * 0.3, vx + vw / 2, vy + vh / 2, Math.max(vw, vh) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(vx, vy, vw, vh);

    // minimap (in-canvas)
    this.drawMinimap(vx + vw - 124, vy + 12, 112, viewIndex);
  }

  private drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, enemy: boolean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.arc(2, 3, 9, 0, 6.28);
    ctx.fill();
    ctx.rotate(angle);
    // gun
    ctx.fillStyle = "#1a1a22";
    ctx.fillRect(6, -2, 14, 4);
    // body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, 6.28);
    ctx.fill();
    // head
    ctx.fillStyle = enemy ? "#dfe6f5" : "#f0d6c2";
    ctx.beginPath();
    ctx.arc(3, 0, 4, 0, 6.28);
    ctx.fill();
    ctx.restore();
  }

  private drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, player: boolean, moving: boolean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // headlights cone
    if (moving) {
      const lg = ctx.createLinearGradient(20, 0, 120, 0);
      lg.addColorStop(0, "rgba(255,245,200,0.35)");
      lg.addColorStop(1, "rgba(255,245,200,0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(18, -10);
      ctx.lineTo(120, -40);
      ctx.lineTo(120, 40);
      ctx.lineTo(18, 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(-19, -10, 40, 24);
    ctx.fillStyle = color;
    ctx.fillRect(-20, -12, 40, 24);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(-12, -10, 14, 20);
    ctx.fillStyle = "rgba(180,220,255,0.75)";
    ctx.fillRect(4, -9, 8, 18);
    if (player) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(18, -9, 3, 4);
      ctx.fillRect(18, 5, 3, 4);
    }
    ctx.restore();
  }

  private drawMinimap(mx: number, my: number, size: number, viewIndex: number) {
    const ctx = this.ctx;
    const scale = size / WORLD;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#0a0d15";
    ctx.fillRect(mx, my, size, size);
    ctx.strokeStyle = "rgba(240,200,120,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, size, size);
    ctx.fillStyle = "#222a3c";
    for (const b of this.buildings) ctx.fillRect(mx + b.x * scale, my + b.y * scale, b.w * scale, b.h * scale);
    ctx.fillStyle = "#3fcf6a";
    for (const pk of this.pickups) if (!pk.taken && pk.kind === "cash") ctx.fillRect(mx + pk.x * scale - 1, my + pk.y * scale - 1, 2, 2);
    ctx.fillStyle = "#2d54c8";
    for (const e of this.enemies) if (e.alive) ctx.fillRect(mx + e.x * scale - 1, my + e.y * scale - 1, 2, 2);
    this.players.forEach((p, i) => {
      ctx.fillStyle = i === viewIndex ? "#ffffff" : p.color;
      const px = p.vehicle ? p.vehicle.x : p.x;
      const py = p.vehicle ? p.vehicle.y : p.y;
      ctx.beginPath();
      ctx.arc(mx + px * scale, my + py * scale, 3, 0, 6.28);
      ctx.fill();
    });
    ctx.restore();
  }
}

export { WORLD };