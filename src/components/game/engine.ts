// Top-down GTA-style driving game engine (procedurally rendered on canvas).

export interface GameState {
  cash: number;
  wanted: number; // 0-5 stars
  score: number;
  health: number; // 0-100
  speedKmh: number;
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
}

interface Ped {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alive: boolean;
}

interface Cop {
  x: number;
  y: number;
  angle: number;
  speed: number;
}

interface Pickup {
  x: number;
  y: number;
  taken: boolean;
  pulse: number;
}

const CELL = 460; // block size (building + road)
const ROAD = 130; // road width
const GRID = 9; // GRID x GRID blocks
const WORLD = CELL * GRID;

const BUILDING_COLORS = [
  "#2b3550",
  "#33304a",
  "#2a3a44",
  "#3a3142",
  "#283648",
];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private raf = 0;
  private last = 0;
  private keys: Record<string, boolean> = {};
  private listener: Listener;

  private buildings: Rect[] = [];
  private peds: Ped[] = [];
  private cops: Cop[] = [];
  private pickups: Pickup[] = [];

  private car = { x: 0, y: 0, angle: -Math.PI / 2, speed: 0 };
  private cam = { x: 0, y: 0 };

  private wantedTimer = 0;
  private spawnTimer = 0;
  private skid: { x: number; y: number; a: number; life: number }[] = [];

  state: GameState = {
    cash: 0,
    wanted: 0,
    score: 0,
    health: 100,
    speedKmh: 0,
    running: false,
    gameOver: false,
  };

  constructor(canvas: HTMLCanvasElement, listener: Listener) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.listener = listener;
    this.build();
  }

  private build() {
    this.buildings = [];
    for (let gx = 0; gx < GRID; gx++) {
      for (let gy = 0; gy < GRID; gy++) {
        const x = gx * CELL + ROAD / 2;
        const y = gy * CELL + ROAD / 2;
        const w = CELL - ROAD;
        const h = CELL - ROAD;
        // sometimes split a block into smaller buildings
        const color = BUILDING_COLORS[(gx + gy) % BUILDING_COLORS.length];
        if (Math.random() < 0.25) {
          // park / empty lot — skip building
          continue;
        }
        this.buildings.push({ x, y, w, h, color });
      }
    }

    // pickups on road intersections
    this.pickups = [];
    for (let i = 0; i < 40; i++) {
      const gx = Math.floor(rand(0, GRID));
      const gy = Math.floor(rand(0, GRID));
      this.pickups.push({
        x: gx * CELL + (Math.random() < 0.5 ? 0 : CELL / 2),
        y: gy * CELL + (Math.random() < 0.5 ? 0 : CELL / 2),
        taken: false,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    // pedestrians
    this.peds = [];
    for (let i = 0; i < 60; i++) {
      this.peds.push(this.spawnPed());
    }
  }

  private spawnPed(): Ped {
    const colors = ["#e2c08d", "#d98c5f", "#f0d6c2", "#b5e0c2", "#e0b5d4"];
    return {
      x: rand(0, WORLD),
      y: rand(0, WORLD),
      vx: rand(-20, 20),
      vy: rand(-20, 20),
      color: colors[Math.floor(Math.random() * colors.length)],
      alive: true,
    };
  }

  start() {
    // place car on a road
    this.car = { x: CELL, y: CELL, angle: -Math.PI / 2, speed: 0 };
    this.cops = [];
    this.skid = [];
    this.build();
    this.state = {
      cash: 0,
      wanted: 0,
      score: 0,
      health: 100,
      speedKmh: 0,
      running: true,
      gameOver: false,
    };
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
    this.listener({ ...this.state });
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

  private collidesBuilding(x: number, y: number, r: number): boolean {
    for (const b of this.buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
        return true;
      }
    }
    return false;
  }

  private update(dt: number) {
    const k = this.keys;
    const accel = 520;
    const reverse = 300;
    const maxSpeed = 560;
    const turn = 2.6;

    const up = k["ArrowUp"] || k["KeyW"];
    const down = k["ArrowDown"] || k["KeyS"];
    const left = k["ArrowLeft"] || k["KeyA"];
    const right = k["ArrowRight"] || k["KeyD"];

    if (up) this.car.speed += accel * dt;
    else if (down) this.car.speed -= reverse * dt;
    else this.car.speed *= 1 - 1.6 * dt; // engine drag

    this.car.speed = Math.max(-220, Math.min(maxSpeed, this.car.speed));
    if (Math.abs(this.car.speed) < 3) this.car.speed = 0;

    // steering scales with speed
    const steerFactor = Math.max(-1, Math.min(1, this.car.speed / 120));
    if (left) this.car.angle -= turn * steerFactor * dt;
    if (right) this.car.angle += turn * steerFactor * dt;

    const nx = this.car.x + Math.cos(this.car.angle) * this.car.speed * dt;
    const ny = this.car.y + Math.sin(this.car.angle) * this.car.speed * dt;

    // collision: try axis separately so you slide along walls
    if (!this.collidesBuilding(nx, this.car.y, 16)) this.car.x = nx;
    else this.car.speed *= 0.3;
    if (!this.collidesBuilding(this.car.x, ny, 16)) this.car.y = ny;
    else this.car.speed *= 0.3;

    // keep inside world
    this.car.x = Math.max(20, Math.min(WORLD - 20, this.car.x));
    this.car.y = Math.max(20, Math.min(WORLD - 20, this.car.y));

    // skid marks when turning fast
    if (Math.abs(this.car.speed) > 300 && (left || right) && Math.random() < 0.6) {
      this.skid.push({ x: this.car.x, y: this.car.y, a: this.car.angle, life: 1 });
      if (this.skid.length > 120) this.skid.shift();
    }
    for (const s of this.skid) s.life -= dt * 0.3;
    this.skid = this.skid.filter((s) => s.life > 0);

    // camera follows
    this.cam.x += (this.car.x - this.cam.x) * Math.min(1, 6 * dt);
    this.cam.y += (this.car.y - this.cam.y) * Math.min(1, 6 * dt);

    // pedestrians wander + collision with car
    for (const p of this.peds) {
      if (!p.alive) continue;
      if (Math.random() < 0.01) {
        p.vx = rand(-20, 20);
        p.vy = rand(-20, 20);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = (p.x + WORLD) % WORLD;
      p.y = (p.y + WORLD) % WORLD;

      const d = Math.hypot(p.x - this.car.x, p.y - this.car.y);
      if (d < 20 && Math.abs(this.car.speed) > 60) {
        p.alive = false;
        this.state.score += 50;
        this.bumpWanted(1);
        setTimeout(() => Object.assign(p, this.spawnPed()), 6000);
      }
    }

    // pickups
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      pk.pulse += dt * 4;
      if (Math.hypot(pk.x - this.car.x, pk.y - this.car.y) < 26) {
        pk.taken = true;
        this.state.cash += 250;
        this.state.score += 100;
        setTimeout(() => {
          pk.x = Math.floor(rand(0, GRID)) * CELL;
          pk.y = Math.floor(rand(0, GRID)) * CELL;
          pk.taken = false;
        }, 4000);
      }
    }

    // wanted decay
    if (this.state.wanted > 0) {
      this.wantedTimer -= dt;
      if (this.wantedTimer <= 0) {
        this.state.wanted = Math.max(0, this.state.wanted - 1);
        this.wantedTimer = 10;
      }
    }

    // spawn cops based on wanted
    this.spawnTimer -= dt;
    if (this.state.wanted > 0 && this.cops.length < this.state.wanted * 2 && this.spawnTimer <= 0) {
      this.spawnTimer = 1.5;
      const ang = rand(0, Math.PI * 2);
      this.cops.push({
        x: this.car.x + Math.cos(ang) * 700,
        y: this.car.y + Math.sin(ang) * 700,
        angle: ang,
        speed: 0,
      });
    }
    if (this.state.wanted === 0) this.cops = [];

    // cop AI: chase car
    for (const c of this.cops) {
      const ang = Math.atan2(this.car.y - c.y, this.car.x - c.x);
      c.angle = ang;
      c.speed = 320 + this.state.wanted * 40;
      c.x += Math.cos(ang) * c.speed * dt;
      c.y += Math.sin(ang) * c.speed * dt;
      const d = Math.hypot(c.x - this.car.x, c.y - this.car.y);
      if (d < 26) {
        this.state.health -= 24 * dt * this.state.wanted;
      }
    }

    if (this.state.health <= 0) {
      this.state.health = 0;
      this.state.running = false;
      this.state.gameOver = true;
    }

    this.state.speedKmh = Math.round(Math.abs(this.car.speed) / 3.2);
    this.emit();
  }

  private bumpWanted(by: number) {
    this.state.wanted = Math.min(5, this.state.wanted + by);
    this.wantedTimer = 12;
  }

  private render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const ox = W / 2 - this.cam.x;
    const oy = H / 2 - this.cam.y;

    // asphalt ground
    ctx.fillStyle = "#1a1f2b";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(ox, oy);

    // road grid lane markings
    ctx.strokeStyle = "rgba(240,200,120,0.18)";
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

    // skid marks
    for (const s of this.skid) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);
      ctx.fillStyle = `rgba(10,10,15,${s.life * 0.4})`;
      ctx.fillRect(-14, -10, 6, 6);
      ctx.fillRect(-14, 4, 6, 6);
      ctx.restore();
    }

    // buildings
    for (const b of this.buildings) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // windows
      ctx.fillStyle = "rgba(255,235,170,0.12)";
      const step = 46;
      for (let wx = b.x + 16; wx < b.x + b.w - 12; wx += step) {
        for (let wy = b.y + 16; wy < b.y + b.h - 12; wy += step) {
          ctx.fillRect(wx, wy, 20, 20);
        }
      }
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    // pickups (cash)
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const s = 1 + Math.sin(pk.pulse) * 0.15;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.scale(s, s);
      ctx.shadowColor = "rgba(120,220,140,0.9)";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#3fcf6a";
      ctx.fillRect(-12, -8, 24, 16);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0c3a1c";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", 0, 1);
      ctx.restore();
    }

    // pedestrians
    for (const p of this.peds) {
      if (!p.alive) continue;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // cops
    for (const c of this.cops) {
      this.drawCar(ctx, c.x, c.y, c.angle, "#1b3a8c", true);
    }

    // player car
    this.drawCar(ctx, this.car.x, this.car.y, this.car.angle, "#e23b3b", false);

    ctx.restore();
  }

  private drawCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    color: string,
    cop: boolean
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(-18, -11, 38, 24);
    // body
    ctx.fillStyle = color;
    ctx.fillRect(-20, -12, 40, 24);
    // windshield
    ctx.fillStyle = "rgba(180,220,255,0.7)";
    ctx.fillRect(4, -9, 8, 18);
    // roof
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(-10, -9, 12, 18);
    if (cop) {
      ctx.fillStyle = Math.floor(performance.now() / 200) % 2 ? "#ff3b3b" : "#3b6dff";
      ctx.fillRect(-4, -8, 4, 6);
      ctx.fillStyle = Math.floor(performance.now() / 200) % 2 ? "#3b6dff" : "#ff3b3b";
      ctx.fillRect(-4, 2, 4, 6);
    }
    ctx.restore();
  }

  // minimap rendering for the React overlay
  drawMinimap(mctx: CanvasRenderingContext2D, size: number) {
    const scale = size / WORLD;
    mctx.clearRect(0, 0, size, size);
    mctx.fillStyle = "#11151f";
    mctx.fillRect(0, 0, size, size);
    mctx.fillStyle = "#222a3c";
    for (const b of this.buildings) {
      mctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
    }
    mctx.fillStyle = "#3fcf6a";
    for (const pk of this.pickups) {
      if (!pk.taken) mctx.fillRect(pk.x * scale - 1, pk.y * scale - 1, 3, 3);
    }
    mctx.fillStyle = "#3b6dff";
    for (const c of this.cops) {
      mctx.fillRect(c.x * scale - 1, c.y * scale - 1, 3, 3);
    }
    mctx.fillStyle = "#ff4444";
    mctx.beginPath();
    mctx.arc(this.car.x * scale, this.car.y * scale, 3, 0, Math.PI * 2);
    mctx.fill();
  }
}

export { WORLD };