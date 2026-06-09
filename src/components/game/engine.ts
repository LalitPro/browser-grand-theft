// ===========================================================================
// Clean MVP top-down GTA-style co-op engine.
// Core loop only: walk -> steal car/bike -> shoot -> 1-star police -> escape.
// Hand-designed small "Indian-style" test city. No gangs / missions / advanced AI.
// ===========================================================================

export type Mode = "solo" | "coop";

export type WeaponId = "pistol" | "smg" | "shotgun";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  cd: number; // seconds between shots
  damage: number;
  pellets: number;
  spread: number;
  speed: number;
  price: number; // cost to buy the gun
  ammoPrice: number; // cost per ammo pack
  ammoPack: number; // rounds per pack
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { id: "pistol", name: "Pistol", cd: 0.28, damage: 24, pellets: 1, spread: 0.05, speed: 820, price: 0, ammoPrice: 80, ammoPack: 36 },
  smg: { id: "smg", name: "SMG", cd: 0.08, damage: 14, pellets: 1, spread: 0.11, speed: 900, price: 1500, ammoPrice: 200, ammoPack: 90 },
  shotgun: { id: "shotgun", name: "Shotgun", cd: 0.62, damage: 13, pellets: 6, spread: 0.32, speed: 720, price: 2800, ammoPrice: 300, ammoPack: 24 },
};

export const WEAPON_ORDER: WeaponId[] = ["pistol", "smg", "shotgun"];

export interface PlayerHud {
  health: number;
  speedKmh: number;
  onFoot: boolean;
  alive: boolean;
  respawnIn: number;
  ammo: number;
  weapon: string;
  weaponId: WeaponId;
  owned: WeaponId[];
  nearShop: boolean;
}

export interface GameState {
  mode: Mode;
  cash: number;
  wanted: number; // 0 or 1 for the MVP
  score: number;
  players: PlayerHud[];
  running: boolean;
  gameOver: boolean;
  pvp: boolean;
}

type Listener = (s: GameState) => void;

type BKind = "house" | "shop" | "office";

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  wall: string;
  roof: string;
  kind: BKind;
}

interface Road {
  x: number;
  y: number;
  w: number;
  h: number;
  horizontal: boolean;
  highway: boolean;
}

interface Park {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Tree {
  x: number;
  y: number;
  r: number;
}

type VType = "car" | "bike";

interface Vehicle {
  x: number;
  y: number;
  angle: number;
  speed: number;
  type: VType;
  color: string;
  occupants: number[]; // player ids; [0] is the driver
  stolen: boolean;
}

interface Player {
  id: number;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  health: number;
  alive: boolean;
  respawnIn: number;
  vehicle: Vehicle | null;
  shootCd: number;
  enterCd: number;
  color: string;
  switchCd: number;
  weapons: WeaponId[];
  weaponIndex: number;
  ammo: Record<WeaponId, number>;
  nearShop: boolean;
  walkPhase: number;
}

interface Cop {
  x: number;
  y: number;
  angle: number;
  health: number;
  shootCd: number;
  alive: boolean;
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
  owner: number; // player id, or -1 for cops
  dmg: number;
}

interface Pickup {
  x: number;
  y: number;
  taken: boolean;
  pulse: number;
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

// ---- world layout --------------------------------------------------------
const ROAD = 120;
const BW = 540;
const BH = 500;
const COLS = 4;
const ROWS = 3;
export const WORLD_W = ROAD + COLS * (BW + ROAD); // 2760
export const WORLD_H = ROAD + ROWS * (BH + ROAD); // 1980
const WORLD = Math.max(WORLD_W, WORLD_H);

type Zone = "residential" | "market" | "office" | "park";
const ZONES: Zone[][] = [
  ["residential", "residential", "market", "office"],
  ["park", "residential", "office", "market"],
  ["office", "market", "residential", "park"],
];

const P_COLORS = ["#ff4d4d", "#39b6ff"];
const SHOP_COLORS = ["#e0a13a", "#cf5b48", "#3f9d8f", "#c463a6", "#5b8dd6"];

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

  private buildings: Building[] = [];
  private roads: Road[] = [];
  private parks: Park[] = [];
  private trees: Tree[] = [];
  private vehicles: Vehicle[] = [];
  private players: Player[] = [];
  private cops: Cop[] = [];
  private peds: Ped[] = [];
  private bullets: Bullet[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private cams: { x: number; y: number; shake: number }[] = [];

  private copSpawnCd = 0;
  private escapeTimer = 0; // seconds out of police sight
  private pvp = false;
  private shop = { x: 0, y: 0, r: 70 };

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
        ammo: WEAPONS.pistol.ammoPack,
        weapon: WEAPONS.pistol.name,
        weaponId: "pistol" as WeaponId,
        owned: ["pistol"] as WeaponId[],
        nearShop: false,
      })),
      running: false,
      gameOver: false,
      pvp: false,
    };
  }

  // ---- world generation --------------------------------------------------
  private block(c: number, r: number) {
    return { x: ROAD + c * (BW + ROAD), y: ROAD + r * (BH + ROAD) };
  }

  private buildWorld() {
    this.buildings = [];
    this.roads = [];
    this.parks = [];
    this.trees = [];

    // roads: a clean grid. The middle horizontal road is a wide "highway".
    for (let c = 0; c <= COLS; c++) {
      const x = c * (BW + ROAD);
      this.roads.push({ x, y: 0, w: ROAD, h: WORLD_H, horizontal: false, highway: false });
    }
    for (let r = 0; r <= ROWS; r++) {
      const highway = r === 1;
      const h = highway ? ROAD + 70 : ROAD;
      const y = r * (BH + ROAD) - (highway ? 35 : 0);
      this.roads.push({ x: 0, y, w: WORLD_W, h, horizontal: true, highway });
    }

    // blocks -> zones
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const { x, y } = this.block(c, r);
        this.fillBlock(x, y, ZONES[r][c]);
      }
    }

    // pickups (cash) for the money loop
    this.pickups = [];
    for (let i = 0; i < 14; i++) {
      this.pickups.push({ x: rand(ROAD, WORLD_W - ROAD), y: rand(ROAD, WORLD_H - ROAD), taken: false, pulse: rand(0, 6.28) });
    }

    // gun shop (Ammu-Nation) sits on a road corner near the spawn block
    const shopBlk = this.block(1, 0);
    this.shop = { x: shopBlk.x - ROAD / 2, y: shopBlk.y + BH / 2, r: 72 };

    // dummy pedestrians
    this.peds = [];
    for (let i = 0; i < 26; i++) this.peds.push(this.spawnPed());

    // vehicles: 1 car near spawn (shareable), 1 bike, + a couple parked cars
    this.vehicles = [];
    const spawn = this.block(0, 0);
    this.vehicles.push(this.mkVehicle(spawn.x + BW + 30, spawn.y + BH / 2, "car", "#d8c24a"));
    this.vehicles.push(this.mkVehicle(spawn.x + BW / 2, spawn.y + BH + 30, "bike", "#46b1c9"));
    this.vehicles.push(this.mkVehicle(this.block(2, 1).x - 30, this.block(2, 1).y + 60, "car", "#5cc46a"));
    this.vehicles.push(this.mkVehicle(this.block(3, 2).x + 60, this.block(3, 2).y - 30, "car", "#c9603f"));
  }

  private mkVehicle(x: number, y: number, type: VType, color: string): Vehicle {
    return { x, y, angle: 0, speed: 0, type, color, occupants: [], stolen: false };
  }

  private fillBlock(x0: number, y0: number, zone: Zone) {
    if (zone === "park") {
      this.parks.push({ x: x0, y: y0, w: BW, h: BH });
      for (let i = 0; i < 7; i++) this.trees.push({ x: rand(x0 + 30, x0 + BW - 30), y: rand(y0 + 30, y0 + BH - 30), r: rand(16, 26) });
      return;
    }
    if (zone === "office") {
      // 1-2 tall buildings filling most of the block
      this.buildings.push({ x: x0 + 30, y: y0 + 30, w: BW - 60, h: BH * 0.55 - 20, wall: "#566379", roof: "#404a5e", kind: "office" });
      this.buildings.push({ x: x0 + 30, y: y0 + BH * 0.55 + 20, w: BW * 0.55, h: BH * 0.45 - 30, wall: "#5d6b82", roof: "#48526a", kind: "office" });
      return;
    }
    if (zone === "market") {
      // two rows of small shops with colorful awnings
      const rows = 2;
      const cols = 3;
      const gap = 24;
      const sw = (BW - gap * (cols + 1)) / cols;
      const sh = (BH - gap * (rows + 1)) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this.buildings.push({
            x: x0 + gap + c * (sw + gap),
            y: y0 + gap + r * (sh + gap),
            w: sw,
            h: sh,
            wall: "#c9b79a",
            roof: SHOP_COLORS[(r * cols + c) % SHOP_COLORS.length],
            kind: "shop",
          });
        }
      }
      return;
    }
    // residential: a 2x2 grid of houses with yards
    const gap = 40;
    const hw = (BW - gap * 3) / 2;
    const hh = (BH - gap * 3) / 2;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        this.buildings.push({
          x: x0 + gap + c * (hw + gap),
          y: y0 + gap + r * (hh + gap),
          w: hw,
          h: hh,
          wall: "#d9b48c",
          roof: "#b5532f",
          kind: "house",
        });
      }
    }
  }

  private spawnPed(): Ped {
    const colors = ["#e2c08d", "#d98c5f", "#f0d6c2", "#b5e0c2", "#e0b5d4", "#c9a0e0"];
    return {
      x: rand(ROAD, WORLD_W - ROAD),
      y: rand(ROAD, WORLD_H - ROAD),
      vx: rand(-26, 26),
      vy: rand(-26, 26),
      color: colors[(Math.random() * colors.length) | 0],
      alive: true,
    };
  }

  // ---- lifecycle ---------------------------------------------------------
  start(mode: Mode, pvp = false) {
    this.mode = mode;
    this.pvp = mode === "coop" ? pvp : false;
    this.state = this.blankState(mode);
    this.state.pvp = this.pvp;
    this.buildWorld();
    this.cops = [];
    this.bullets = [];
    this.particles = [];
    this.copSpawnCd = 0;
    this.escapeTimer = 0;

    const n = mode === "coop" ? 2 : 1;
    this.players = [];
    this.cams = [];
    const spawn = this.block(0, 0);
    for (let i = 0; i < n; i++) {
      const px = spawn.x + BW / 2 + i * 40;
      const py = spawn.y + BH / 2;
      this.players.push({
        id: i,
        x: px,
        y: py,
        angle: 0,
        vx: 0,
        vy: 0,
        health: 100,
        alive: true,
        respawnIn: 0,
        vehicle: null,
        shootCd: 0,
        enterCd: 0,
        color: P_COLORS[i],
        switchCd: 0,
        weapons: ["pistol"],
        weaponIndex: 0,
        ammo: { pistol: WEAPONS.pistol.ammoPack, smg: 0, shotgun: 0 },
        nearShop: false,
        walkPhase: 0,
      });
      this.cams.push({ x: px, y: py, shake: 0 });
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

  // ---- shop (buy guns / ammo) -------------------------------------------
  // playerIndex defaults to the first player currently standing at the shop.
  private shopPlayer(playerIndex?: number): Player | null {
    if (playerIndex != null) {
      const p = this.players[playerIndex];
      return p && p.alive && p.nearShop ? p : null;
    }
    return this.players.find((p) => p.alive && p.nearShop) ?? null;
  }

  buyWeapon(id: WeaponId, playerIndex?: number): boolean {
    const p = this.shopPlayer(playerIndex);
    if (!p) return false;
    const w = WEAPONS[id];
    if (p.weapons.includes(id)) return false;
    if (this.state.cash < w.price) return false;
    this.state.cash -= w.price;
    p.weapons.push(id);
    p.ammo[id] = Math.max(p.ammo[id], w.ammoPack);
    p.weaponIndex = p.weapons.indexOf(id);
    this.emit();
    return true;
  }

  buyAmmo(id: WeaponId, playerIndex?: number): boolean {
    const p = this.shopPlayer(playerIndex);
    if (!p) return false;
    const w = WEAPONS[id];
    if (!p.weapons.includes(id)) return false;
    if (this.state.cash < w.ammoPrice) return false;
    this.state.cash -= w.ammoPrice;
    p.ammo[id] += w.ammoPack;
    this.emit();
    return true;
  }

  private curWeaponId(p: Player): WeaponId {
    return p.weapons[p.weaponIndex] ?? "pistol";
  }

  private curWeapon(p: Player): WeaponDef {
    return WEAPONS[this.curWeaponId(p)];
  }

  private emit() {
    this.state.players.forEach((h, i) => {
      const p = this.players[i];
      if (!p) return;
      h.health = Math.max(0, Math.round(p.health));
      h.onFoot = !p.vehicle;
      h.alive = p.alive;
      h.respawnIn = Math.ceil(p.respawnIn);
      const wid = this.curWeaponId(p);
      h.ammo = p.ammo[wid];
      h.weapon = WEAPONS[wid].name;
      h.weaponId = wid;
      h.owned = [...p.weapons];
      h.nearShop = p.nearShop;
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

  // ---- collision ---------------------------------------------------------
  private collides(x: number, y: number, r: number) {
    for (const b of this.buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  private ctrl(i: number) {
    if (i === 0)
      return {
        up: this.keys["KeyW"],
        down: this.keys["KeyS"],
        left: this.keys["KeyA"],
        right: this.keys["KeyD"],
        shoot: this.keys["KeyF"] || this.keys["Space"],
        enter: this.keys["KeyE"],
        swap: this.keys["KeyQ"],
      };
    return {
      up: this.keys["ArrowUp"],
      down: this.keys["ArrowDown"],
      left: this.keys["ArrowLeft"],
      right: this.keys["ArrowRight"],
      shoot: this.keys["Slash"],
      enter: this.keys["Enter"] || this.keys["NumpadEnter"],
      swap: this.keys["ShiftRight"] || this.keys["Period"],
    };
  }

  // ---- update ------------------------------------------------------------
  private update(dt: number) {
    for (const p of this.players) this.updatePlayer(p, dt);
    this.updatePeds(dt);
    this.updateBullets(dt);
    this.updatePolice(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);

    // cameras (smooth follow + shake decay)
    this.players.forEach((p, i) => {
      const tx = p.vehicle ? p.vehicle.x : p.x;
      const ty = p.vehicle ? p.vehicle.y : p.y;
      const c = this.cams[i];
      c.x += (tx - c.x) * Math.min(1, 5 * dt);
      c.y += (ty - c.y) * Math.min(1, 5 * dt);
      c.shake = Math.max(0, c.shake - dt * 18);
    });

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
      this.updateInVehicle(p, c, dt);
      return;
    }

    // ---- on foot: smooth acceleration / friction ----
    let tx = 0;
    let ty = 0;
    if (c.up) ty -= 1;
    if (c.down) ty += 1;
    if (c.left) tx -= 1;
    if (c.right) tx += 1;
    const len = Math.hypot(tx, ty) || 1;
    const SP = 195;
    const tvx = (tx / len) * (tx || ty ? SP : 0);
    const tvy = (ty / len) * (tx || ty ? SP : 0);
    const k = Math.min(1, 11 * dt);
    p.vx += (tvx - p.vx) * k;
    p.vy += (tvy - p.vy) * k;

    const nx = p.x + p.vx * dt;
    const ny = p.y + p.vy * dt;
    if (!this.collides(nx, p.y, 9)) p.x = nx;
    else p.vx = 0;
    if (!this.collides(p.x, ny, 9)) p.y = ny;
    else p.vy = 0;
    p.x = Math.max(10, Math.min(WORLD_W - 10, p.x));
    p.y = Math.max(10, Math.min(WORLD_H - 10, p.y));

    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 6) p.angle = Math.atan2(p.vy, p.vx);
    p.walkPhase += sp * dt * 0.05;

    // near the gun shop?
    p.nearShop = Math.hypot(p.x - this.shop.x, p.y - this.shop.y) < this.shop.r;

    // cycle weapon
    p.switchCd -= dt;
    if (c.swap && p.switchCd <= 0 && p.weapons.length > 1) {
      p.switchCd = 0.3;
      p.weaponIndex = (p.weaponIndex + 1) % p.weapons.length;
    }

    if (c.enter && p.enterCd <= 0) {
      p.enterCd = 0.45;
      this.tryEnter(p);
    }

    const w = this.curWeapon(p);
    const wid = this.curWeaponId(p);
    if (c.shoot && p.shootCd <= 0 && p.ammo[wid] > 0) {
      p.shootCd = w.cd;
      p.ammo[wid]--;
      this.fire(p, w);
    }
  }

  private updateInVehicle(p: Player, c: ReturnType<Game["ctrl"]>, dt: number) {
    const v = p.vehicle!;
    const driver = v.occupants[0] === p.id;

    if (driver) {
      const bike = v.type === "bike";
      const accel = bike ? 620 : 540;
      const maxSpeed = bike ? 640 : 580;
      const turn = bike ? 3.1 : 2.6;
      if (c.up) v.speed += accel * dt;
      else if (c.down) v.speed -= 320 * dt;
      else v.speed *= 1 - 1.5 * dt; // engine drag / friction
      v.speed = Math.max(-220, Math.min(maxSpeed, v.speed));
      if (Math.abs(v.speed) < 3 && !c.up && !c.down) v.speed = 0;

      // smooth turning scaled by speed -> slight drift feel
      const sf = Math.max(-1, Math.min(1, v.speed / 130));
      if (c.left) v.angle -= turn * sf * dt;
      if (c.right) v.angle += turn * sf * dt;

      const nx = v.x + Math.cos(v.angle) * v.speed * dt;
      const ny = v.y + Math.sin(v.angle) * v.speed * dt;
      const rad = bike ? 12 : 17;
      if (!this.collides(nx, v.y, rad)) v.x = nx;
      else v.speed *= 0.25;
      if (!this.collides(v.x, ny, rad)) v.y = ny;
      else v.speed *= 0.25;
      v.x = Math.max(20, Math.min(WORLD_W - 20, v.x));
      v.y = Math.max(20, Math.min(WORLD_H - 20, v.y));

      // tyre marks when turning fast
      if (Math.abs(v.speed) > 340 && (c.left || c.right) && Math.random() < 0.5)
        this.particles.push({ x: v.x, y: v.y, vx: 0, vy: 0, life: 2.5, max: 2.5, color: "rgba(15,15,20,0.45)", size: 4 });

      // run over peds
      if (Math.abs(v.speed) > 90) {
        for (const ped of this.peds) {
          if (ped.alive && Math.hypot(ped.x - v.x, ped.y - v.y) < 22) {
            ped.alive = false;
            this.state.score += 30;
            this.blood(ped.x, ped.y);
            this.commitCrime();
            setTimeout(() => Object.assign(ped, this.spawnPed()), 6000);
          }
        }
      }
    }

    // all occupants ride along
    p.x = v.x;
    p.y = v.y;
    p.angle = v.angle;

    if (c.enter && p.enterCd <= 0) {
      p.enterCd = 0.45;
      this.exitVehicle(p);
    }
  }

  private tryEnter(p: Player) {
    let best: Vehicle | null = null;
    let bd = 64;
    for (const v of this.vehicles) {
      const cap = v.type === "bike" ? 1 : 2;
      if (v.occupants.length >= cap) continue;
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (!best) return;
    const firstSteal = best.occupants.length === 0;
    best.occupants.push(p.id);
    p.vehicle = best;
    // entering an unoccupied car/bike = grand theft auto -> police
    if (firstSteal && !best.stolen) {
      best.stolen = true;
      this.commitCrime();
    }
  }

  private exitVehicle(p: Player) {
    const v = p.vehicle!;
    v.occupants = v.occupants.filter((id) => id !== p.id);
    p.vehicle = null;
    p.vx = 0;
    p.vy = 0;
    p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 30;
    p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 30;
  }

  private fire(p: Player, w: WeaponDef) {
    for (let i = 0; i < w.pellets; i++) {
      const a = p.angle + rand(-w.spread, w.spread);
      this.bullets.push({
        x: p.x + Math.cos(a) * 14,
        y: p.y + Math.sin(a) * 14,
        vx: Math.cos(a) * w.speed,
        vy: Math.sin(a) * w.speed,
        life: 0.7,
        hostile: false,
        owner: p.id,
        dmg: w.damage,
      });
    }
    this.particles.push({ x: p.x + Math.cos(p.angle) * 16, y: p.y + Math.sin(p.angle) * 16, vx: 0, vy: 0, life: 0.05, max: 0.05, color: "rgba(255,220,120,0.95)", size: 9 });
    this.cams[p.id] && (this.cams[p.id].shake = Math.min(8, this.cams[p.id].shake + 4));
    this.commitCrime();
  }

  private respawn(p: Player) {
    p.alive = true;
    p.health = 100;
    p.ammo[this.curWeaponId(p)] = Math.max(p.ammo[this.curWeaponId(p)], WEAPONS.pistol.ammoPack);
    p.vehicle = null;
    p.vx = 0;
    p.vy = 0;
    const spawn = this.block(0, 0);
    p.x = spawn.x + BW / 2;
    p.y = spawn.y + BH / 2;
  }

  private updatePeds(dt: number) {
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      if (Math.random() < 0.012) {
        ped.vx = rand(-26, 26);
        ped.vy = rand(-26, 26);
      }
      let nx = ped.x + ped.vx * dt;
      let ny = ped.y + ped.vy * dt;
      if (nx < ROAD * 0.5 || nx > WORLD_W - ROAD * 0.5) ped.vx *= -1, (nx = ped.x);
      if (ny < ROAD * 0.5 || ny > WORLD_H - ROAD * 0.5) ped.vy *= -1, (ny = ped.y);
      if (this.collides(nx, ny, 6)) {
        ped.vx *= -1;
        ped.vy *= -1;
      } else {
        ped.x = nx;
        ped.y = ny;
      }
    }
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (this.collides(b.x, b.y, 2)) {
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
            p.health -= p.vehicle ? 5 : 11;
            this.spark(b.x, b.y);
            this.cams[p.id] && (this.cams[p.id].shake = 5);
            if (p.health <= 0) this.downPlayer(p);
          }
        }
      } else {
        for (const e of this.cops) {
          if (!e.alive) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < 12) {
            b.life = 0;
            e.health -= b.dmg;
            this.blood(e.x, e.y);
            if (e.health <= 0) {
              e.alive = false;
              this.state.cash += 200;
              this.state.score += 150;
            }
          }
        }
        // PvP: a player's bullet can hit the OTHER player in co-op
        if (this.pvp && b.life > 0) {
          for (const p of this.players) {
            if (!p.alive || p.id === b.owner) continue;
            const tx = p.vehicle ? p.vehicle.x : p.x;
            const ty = p.vehicle ? p.vehicle.y : p.y;
            if (Math.hypot(b.x - tx, b.y - ty) < (p.vehicle ? 20 : 11)) {
              b.life = 0;
              p.health -= p.vehicle ? b.dmg * 0.4 : b.dmg;
              this.blood(b.x, b.y);
              this.cams[p.id] && (this.cams[p.id].shake = 5);
              if (p.health <= 0) {
                this.downPlayer(p);
                this.state.score += 100;
              }
            }
          }
        }
        for (const ped of this.peds) {
          if (!ped.alive) continue;
          if (Math.hypot(b.x - ped.x, b.y - ped.y) < 8) {
            b.life = 0;
            ped.alive = false;
            this.blood(ped.x, ped.y);
            this.state.score += 20;
            this.commitCrime();
            setTimeout(() => Object.assign(ped, this.spawnPed()), 6000);
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
      p.vehicle.occupants = p.vehicle.occupants.filter((id) => id !== p.id);
      p.vehicle = null;
    }
    p.respawnIn = this.mode === "coop" ? 6 : 999;
  }

  private commitCrime() {
    this.state.wanted = 1;
    this.escapeTimer = 0;
    if (this.copSpawnCd <= 0) this.copSpawnCd = rand(2, 4); // delayed first response = tension
  }

  // VERY simple 1-star police: spawn after a delay, follow nearest player,
  // shoot occasionally. Escape by staying out of their sight for ~13s.
  private updatePolice(dt: number) {
    if (this.state.wanted === 0) {
      this.cops = [];
      return;
    }

    this.copSpawnCd -= dt;
    const alive = this.cops.filter((c) => c.alive).length;
    if (alive < 2 && this.copSpawnCd <= 0) {
      this.copSpawnCd = rand(3, 5);
      const anchor = this.players.find((p) => p.alive) ?? this.players[0];
      const ang = rand(0, 6.28);
      this.cops.push({ x: anchor.x + Math.cos(ang) * 720, y: anchor.y + Math.sin(ang) * 720, angle: ang, health: 50, shootCd: rand(0.8, 1.6), alive: true });
    }

    const VISION = 560;
    let seen = false;
    for (const e of this.cops) {
      if (!e.alive) continue;
      let tx = 0;
      let ty = 0;
      let bd = Infinity;
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
      if (bd < VISION) seen = true;
      e.angle = Math.atan2(ty - e.y, tx - e.x);
      if (bd > 200) {
        // move toward the target but slide along building walls (no clipping through)
        const step = 210 * dt;
        const nx = e.x + Math.cos(e.angle) * step;
        const ny = e.y + Math.sin(e.angle) * step;
        if (!this.collides(nx, e.y, 11)) e.x = nx;
        else {
          // try sliding perpendicular to get around the building
          const sy = e.y + Math.sin(e.angle + Math.PI / 2) * step;
          if (!this.collides(e.x, sy, 11)) e.y = sy;
        }
        if (!this.collides(e.x, ny, 11)) e.y = ny;
        else {
          const sx = e.x + Math.cos(e.angle + Math.PI / 2) * step;
          if (!this.collides(sx, e.y, 11)) e.x = sx;
        }
      }
      e.shootCd -= dt;
      if (bd < 460 && e.shootCd <= 0) {
        e.shootCd = rand(1, 1.8);
        const a = e.angle + rand(-0.08, 0.08);
        this.bullets.push({ x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 12, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, life: 1, hostile: true, owner: -1, dmg: 11 });
      }
    }
    this.cops = this.cops.filter((c) => c.alive);

    // escape logic
    if (seen) this.escapeTimer = 0;
    else this.escapeTimer += dt;
    if (this.escapeTimer > 13) {
      this.state.wanted = 0;
      this.cops = [];
      this.escapeTimer = 0;
    }
  }

  private updatePickups(dt: number) {
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      pk.pulse += dt * 4;
      for (const p of this.players) {
        if (!p.alive) continue;
        const px = p.vehicle ? p.vehicle.x : p.x;
        const py = p.vehicle ? p.vehicle.y : p.y;
        if (Math.hypot(pk.x - px, pk.y - py) < 28) {
          pk.taken = true;
          this.state.cash += 150;
          this.state.score += 50;
          setTimeout(() => {
            pk.x = rand(ROAD, WORLD_W - ROAD);
            pk.y = rand(ROAD, WORLD_H - ROAD);
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

  // ---- render ------------------------------------------------------------
  private render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = "#0c0f17";
    ctx.fillRect(0, 0, W, H);

    // both players in the SAME vehicle -> single shared full-screen view
    const shared =
      this.mode === "coop" &&
      this.players[0]?.vehicle &&
      this.players[0].vehicle === this.players[1]?.vehicle;

    if (this.mode === "coop" && !shared) {
      const half = W / 2;
      this.renderView(0, 0, half - 1, H, this.cams[0], 0);
      this.renderView(half + 1, 0, half - 1, H, this.cams[1], 1);
      ctx.fillStyle = "#000";
      ctx.fillRect(half - 1, 0, 2, H);
    } else {
      this.renderView(0, 0, W, H, this.cams[0], 0);
    }
  }

  private renderView(vx: number, vy: number, vw: number, vh: number, cam: { x: number; y: number; shake: number }, viewIndex: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(vx, vy, vw, vh);
    ctx.clip();
    // base ground (dusty earth)
    ctx.fillStyle = "#6f6a4f";
    ctx.fillRect(vx, vy, vw, vh);

    const sx = cam.shake ? rand(-cam.shake, cam.shake) : 0;
    const sy = cam.shake ? rand(-cam.shake, cam.shake) : 0;
    ctx.translate(vx + vw / 2 - cam.x + sx, vy + vh / 2 - cam.y + sy);

    // parks (grass) under roads
    for (const pk of this.parks) {
      ctx.fillStyle = "#5f8d4e";
      ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.strokeRect(pk.x, pk.y, pk.w, pk.h);
    }

    // roads
    for (const r of this.roads) {
      ctx.fillStyle = r.highway ? "#3c3f47" : "#43464e";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // road centre markings
    ctx.strokeStyle = "rgba(240,210,120,0.55)";
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 24]);
    for (const r of this.roads) {
      ctx.beginPath();
      if (r.horizontal) {
        ctx.moveTo(r.x, r.y + r.h / 2);
        ctx.lineTo(r.x + r.w, r.y + r.h / 2);
      } else {
        ctx.moveTo(r.x + r.w / 2, r.y);
        ctx.lineTo(r.x + r.w / 2, r.y + r.h);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // gun shop marker (Ammu-Nation): glowing pad + a small kiosk + label
    {
      const s = this.shop;
      ctx.save();
      ctx.translate(s.x, s.y);
      const pulse = 0.6 + Math.sin(performance.now() / 300) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = "rgba(255,196,80,0.18)";
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, 6.28);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,196,80,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, 6.28);
      ctx.stroke();
      // kiosk
      ctx.fillStyle = "#23262e";
      ctx.fillRect(-22, -22, 44, 44);
      ctx.fillStyle = "#3a3f4a";
      ctx.fillRect(-22, -22, 44, 12);
      ctx.fillStyle = "#ffc450";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔫", 0, 4);
      ctx.fillStyle = "#ffc450";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("GUN SHOP", 0, -34);
      ctx.restore();
    }

    // trees
    for (const t of this.trees) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.arc(t.x + 3, t.y + 4, t.r, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = "#3c6b34";
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = "#4d8341";
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.6, 0, 6.28);
      ctx.fill();
    }

    // buildings
    for (const b of this.buildings) this.drawBuilding(ctx, b);

    // pickups
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const s = 1 + Math.sin(pk.pulse) * 0.15;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.scale(s, s);
      ctx.shadowColor = "rgba(120,220,140,0.9)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#3fcf6a";
      ctx.fillRect(-12, -8, 24, 16);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0c3a1c";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("₹", 0, 1);
      ctx.restore();
    }

    // peds
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.arc(ped.x + 2, ped.y + 3, 6, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 6, 0, 6.28);
      ctx.fill();
    }

    // parked / empty vehicles
    for (const v of this.vehicles) if (v.occupants.length === 0) this.drawVehicle(ctx, v, false);

    // cops
    for (const e of this.cops) {
      if (!e.alive) continue;
      this.drawPerson(ctx, e.x, e.y, e.angle, "#2d54c8", true);
    }

    // players on foot
    this.players.forEach((p, i) => {
      if (p.vehicle || !p.alive) return;
      this.drawPerson(ctx, p.x, p.y, p.angle, p.color, false);
      ctx.fillStyle = p.color;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      if (this.mode === "coop") ctx.fillText(`P${i + 1}`, p.x, p.y - 18);
    });
    // occupied vehicles (drawn in the driver's colour)
    for (const v of this.vehicles) {
      if (v.occupants.length === 0) continue;
      const driver = this.players[v.occupants[0]];
      this.drawVehicle(ctx, v, true, driver?.color);
      if (this.mode === "coop") {
        ctx.fillStyle = driver?.color ?? "#fff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(v.occupants.map((id) => `P${id + 1}`).join("+"), v.x, v.y - 26);
      }
    }

    // bullets + particles
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

    // vignette
    const g = ctx.createRadialGradient(vx + vw / 2, vy + vh / 2, Math.min(vw, vh) * 0.35, vx + vw / 2, vy + vh / 2, Math.max(vw, vh) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = g;
    ctx.fillRect(vx, vy, vw, vh);

    // minimap bottom-left (solo / view0) or bottom-right (coop view1)
    const size = 132;
    const mmRight = this.mode === "coop" && viewIndex === 1;
    const mmx = mmRight ? vx + vw - size - 14 : vx + 14;
    const mmy = vy + vh - size - 14;
    this.drawMinimap(mmx, mmy, size, viewIndex);
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, b: Building) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(b.x + 7, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    if (b.kind === "house") {
      // terracotta roof inset
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(b.x + b.w / 2 - 1, b.y + 6, 2, b.h - 12);
    } else if (b.kind === "shop") {
      // colourful awning strip along the front
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y + b.h - 16, b.w, 16);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      for (let sx = b.x; sx < b.x + b.w; sx += 18) ctx.fillRect(sx, b.y + b.h - 16, 9, 16);
      ctx.fillStyle = "rgba(255,235,170,0.18)";
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 30);
    } else {
      // office windows grid
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = "rgba(180,220,255,0.16)";
      for (let wx = b.x + 14; wx < b.x + b.w - 14; wx += 34)
        for (let wy = b.y + 14; wy < b.y + b.h - 14; wy += 40) ctx.fillRect(wx, wy, 18, 24);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }

  private drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, enemy: boolean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.arc(2, 3, 9, 0, 6.28);
    ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = "#1a1a22";
    ctx.fillRect(6, -2, 14, 4); // gun
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = enemy ? "#dfe6f5" : "#f0d6c2";
    ctx.beginPath();
    ctx.arc(3, 0, 4, 0, 6.28);
    ctx.fill();
    ctx.restore();
  }

  private drawVehicle(ctx: CanvasRenderingContext2D, v: Vehicle, occupied: boolean, tint?: string) {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    const moving = Math.abs(v.speed) > 30;
    if (moving) {
      const lg = ctx.createLinearGradient(20, 0, 120, 0);
      lg.addColorStop(0, "rgba(255,245,200,0.3)");
      lg.addColorStop(1, "rgba(255,245,200,0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(16, -8);
      ctx.lineTo(120, -34);
      ctx.lineTo(120, 34);
      ctx.lineTo(16, 8);
      ctx.closePath();
      ctx.fill();
    }
    if (v.type === "bike") {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(-13, -5, 26, 11);
      ctx.fillStyle = occupied && tint ? tint : v.color;
      ctx.fillRect(-14, -6, 26, 11);
      ctx.fillStyle = "#101015";
      ctx.fillRect(-15, -7, 5, 14); // back wheel
      ctx.fillRect(11, -7, 5, 14); // front wheel
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(-19, -11, 40, 24);
      ctx.fillStyle = occupied && tint ? tint : v.color;
      ctx.fillRect(-20, -12, 40, 24);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(-12, -10, 14, 20);
      ctx.fillStyle = "rgba(180,220,255,0.75)";
      ctx.fillRect(4, -9, 8, 18);
    }
    ctx.restore();
  }

  private drawMinimap(mx: number, my: number, size: number, viewIndex: number) {
    const ctx = this.ctx;
    const scale = size / WORLD;
    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = "#10131c";
    ctx.fillRect(mx, my, size, size);
    // roads
    ctx.fillStyle = "#3a3d45";
    for (const r of this.roads) ctx.fillRect(mx + r.x * scale, my + r.y * scale, Math.max(1, r.w * scale), Math.max(1, r.h * scale));
    // buildings
    ctx.fillStyle = "#2a3040";
    for (const b of this.buildings) ctx.fillRect(mx + b.x * scale, my + b.y * scale, b.w * scale, b.h * scale);
    // parks
    ctx.fillStyle = "#3f5e34";
    for (const pk of this.parks) ctx.fillRect(mx + pk.x * scale, my + pk.y * scale, pk.w * scale, pk.h * scale);
    // cash
    ctx.fillStyle = "#3fcf6a";
    for (const pk of this.pickups) if (!pk.taken) ctx.fillRect(mx + pk.x * scale - 1, my + pk.y * scale - 1, 2, 2);
    // gun shop
    ctx.fillStyle = "#ffc450";
    ctx.fillRect(mx + this.shop.x * scale - 2, my + this.shop.y * scale - 2, 4, 4);
    // cops
    ctx.fillStyle = "#3a6bff";
    for (const e of this.cops) if (e.alive) ctx.fillRect(mx + e.x * scale - 1, my + e.y * scale - 1, 3, 3);
    // players
    this.players.forEach((p, i) => {
      ctx.fillStyle = i === viewIndex ? "#ffffff" : p.color;
      const px = p.vehicle ? p.vehicle.x : p.x;
      const py = p.vehicle ? p.vehicle.y : p.y;
      ctx.beginPath();
      ctx.arc(mx + px * scale, my + py * scale, 3, 0, 6.28);
      ctx.fill();
    });
    ctx.strokeStyle = "rgba(240,200,120,0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, size, size);
    ctx.restore();
  }
}

export { WORLD };