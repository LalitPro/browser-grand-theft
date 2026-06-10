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
  armor: number;
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
  wanted: number; // 0 to 5
  score: number;
  players: PlayerHud[];
  running: boolean;
  gameOver: boolean;
  pvp: boolean;
  policeSearching: boolean;
  radioStation: string;
  radioSong: string;
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

type VType = "car" | "bike" | "police";

interface Vehicle {
  x: number;
  y: number;
  angle: number;
  speed: number;
  type: VType;
  color: string;
  occupants: number[]; // player ids; [0] is the driver
  stolen: boolean;
  npcDriver?: boolean;
  sirenTimer?: number;
  radioStation?: string;
  radioSong?: string;
  radioSongTimer?: number;
  isPoliceCruiser?: boolean;
}

interface Player {
  id: number;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  health: number;
  armor: number;
  alive: boolean;
  respawnIn: number;
  vehicle: Vehicle | null;
  shootCd: number;
  enterCd: number;
  color: string;
  switchCd: number;
  radioCd?: number;
  seatCd?: number;
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
  isDriver?: boolean;
}

interface Ped {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alive: boolean;
  panicTimer?: number;
  panicFromX?: number;
  panicFromY?: number;
  // advanced AI
  armed?: boolean;       // a thug who can fight back
  hostile?: boolean;     // currently attacking a player
  targetId?: number;     // which player the thug is attacking
  shootCd?: number;
  health?: number;
  state?: "wander" | "panic" | "flee" | "attack";
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

interface Loot {
  x: number;
  y: number;
  type: "cash" | "health" | "armor" | "ammo_pistol" | "ammo_smg" | "ammo_shotgun";
  amount: number;
  life: number;
  pulse: number;
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

const RADIO_STATIONS = [
  { name: "Radio Los Santos", songs: ["N.W.A - Express Yourself", "Dr. Dre - Nuthin' But A G Thang", "2Pac - California Love", "Snoop Dogg - Gin And Juice"] },
  { name: "K-DST", songs: ["America - A Horse With No Name", "Boston - More Than A Feeling", "Tom Petty - Free Fallin'", "CCR - Fortunate Son"] },
  { name: "Bounce FM", songs: ["Ohio Players - Love Rollercoaster", "Kool & The Gang - Hollywood Swinging", "Rick James - Give It To Me Baby", "Chic - Good Times"] },
  { name: "Radio Off", songs: ["None"] }
];

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
  private loots: Loot[] = [];
  private cams: { x: number; y: number; shake: number }[] = [];

  private copSpawnCd = 0;
  private copKills = 0;
  private pedKills = 0;
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
        armor: 0,
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
      policeSearching: false,
      radioStation: "",
      radioSong: "",
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

    // Spawn 4 NPC-driven ambient traffic vehicles
    this.vehicles.push(this.mkVehicle(this.block(1, 1).x + BW / 2, this.block(1, 1).y - 30, "car", "#4287f5", true));
    this.vehicles.push(this.mkVehicle(this.block(2, 2).x - 30, this.block(2, 2).y + BH / 2, "car", "#a83232", true));
    this.vehicles.push(this.mkVehicle(this.block(0, 2).x + BW / 2, this.block(0, 2).y + BH + 30, "car", "#1ba135", true));
    this.vehicles.push(this.mkVehicle(this.block(3, 0).x - 30, this.block(3, 0).y + BH / 2, "car", "#7832a8", true));
  }

  private initRadio(v: Vehicle) {
    const idx = (Math.random() * (RADIO_STATIONS.length - 1)) | 0; // random music station
    v.radioStation = RADIO_STATIONS[idx].name;
    const songs = RADIO_STATIONS[idx].songs;
    v.radioSong = songs[(Math.random() * songs.length) | 0];
    v.radioSongTimer = 5;
  }

  private mkVehicle(x: number, y: number, type: VType, color: string, npcDriver = false): Vehicle {
    const v: Vehicle = {
      x,
      y,
      angle: 0,
      speed: 0,
      type,
      color,
      occupants: [],
      stolen: false,
      npcDriver
    };
    this.initRadio(v);
    if (npcDriver) {
      v.angle = Math.random() < 0.5 ? 0 : Math.PI;
      v.speed = 120;
    }
    return v;
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
    // ~22% of pedestrians are armed thugs who fight back when provoked
    const armed = Math.random() < 0.22;
    return {
      x: rand(ROAD, WORLD_W - ROAD),
      y: rand(ROAD, WORLD_H - ROAD),
      vx: rand(-26, 26),
      vy: rand(-26, 26),
      color: armed ? "#3a3f4a" : colors[(Math.random() * colors.length) | 0],
      alive: true,
      armed,
      hostile: false,
      shootCd: rand(0.6, 1.6),
      health: armed ? 45 : 20,
      state: "wander",
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
    this.loots = [];
    this.copSpawnCd = 0;
    this.escapeTimer = 0;
    this.copKills = 0;
    this.pedKills = 0;

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
        armor: 0,
        alive: true,
        respawnIn: 0,
        vehicle: null,
        shootCd: 0,
        enterCd: 0,
        color: P_COLORS[i],
        switchCd: 0,
        radioCd: 0,
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

  buyArmor(playerIndex?: number): boolean {
    const p = this.shopPlayer(playerIndex);
    if (!p) return false;
    const price = 1000;
    if (this.state.cash < price) return false;
    if (p.armor >= 100) return false;
    this.state.cash -= price;
    p.armor = 100;
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
      h.armor = Math.max(0, Math.round(p.armor));
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

    // copy active vehicle's radio details to the HUD state
    const activeVehicle = this.players.find((p) => p.alive && p.vehicle)?.vehicle;
    if (activeVehicle) {
      this.state.radioStation = activeVehicle.radioStation || "Radio Off";
      this.state.radioSong = activeVehicle.radioSongTimer && activeVehicle.radioSongTimer > 0 ? activeVehicle.radioSong || "" : "";
    } else {
      this.state.radioStation = "";
      this.state.radioSong = "";
    }

    // search flashing is active if wanted level is up but player is out of police sight
    this.state.policeSearching = this.state.wanted > 0 && this.escapeTimer > 0;

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
        radio: this.keys["KeyR"],
        seat: this.keys["KeyC"],
      };
    return {
      up: this.keys["ArrowUp"],
      down: this.keys["ArrowDown"],
      left: this.keys["ArrowLeft"],
      right: this.keys["ArrowRight"],
      shoot: this.keys["Slash"],
      enter: this.keys["Enter"] || this.keys["NumpadEnter"],
      swap: this.keys["ShiftRight"] || this.keys["Period"],
      radio: false,
      seat: this.keys["Comma"],
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
    this.updateLoots(dt);
    this.updateTraffic(dt);

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

    if (v.radioSongTimer && v.radioSongTimer > 0) {
      v.radioSongTimer -= dt;
    }
    if (p.radioCd && p.radioCd > 0) {
      p.radioCd -= dt;
    }

    if (c.radio && (!p.radioCd || p.radioCd <= 0)) {
      p.radioCd = 0.45;
      const curIdx = RADIO_STATIONS.findIndex((s) => s.name === v.radioStation);
      const nextIdx = (curIdx + 1) % RADIO_STATIONS.length;
      v.radioStation = RADIO_STATIONS[nextIdx].name;
      const songs = RADIO_STATIONS[nextIdx].songs;
      v.radioSong = songs[(Math.random() * songs.length) | 0];
      v.radioSongTimer = 5;
      this.emit();
    }

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
            this.commitCrime(1);
            this.pedKills = (this.pedKills || 0) + 1;
            if (this.pedKills % 3 === 0) {
              this.state.wanted = Math.min(5, this.state.wanted + 1);
            }
            this.loots.push({
              x: ped.x,
              y: ped.y,
              type: Math.random() < 0.25 ? "health" : "cash",
              amount: Math.random() < 0.5 ? 50 : 100,
              life: 15,
              pulse: rand(0, 6.28),
            });
            setTimeout(() => Object.assign(ped, this.spawnPed()), 6000);
          }
        }
      }

      // ---- DRIVE-BY: the driver can shoot straight ahead while driving ----
      p.shootCd -= dt;
      const dw = this.curWeapon(p);
      const dwid = this.curWeaponId(p);
      if (c.shoot && p.shootCd <= 0 && p.ammo[dwid] > 0) {
        p.shootCd = dw.cd * 1.25; // slightly slower while driving
        p.ammo[dwid]--;
        const savedAngle = p.angle;
        p.angle = v.angle; // fire in the direction the car points
        this.fire(p, dw);
        p.angle = savedAngle;
      }
    } else {
      // passenger controls aiming & shooting
      let tx = 0;
      let ty = 0;
      if (c.up) ty -= 1;
      if (c.down) ty += 1;
      if (c.left) tx -= 1;
      if (c.right) tx += 1;
      if (tx !== 0 || ty !== 0) {
        p.angle = Math.atan2(ty, tx);
      }

      p.switchCd -= dt;
      if (c.swap && p.switchCd <= 0 && p.weapons.length > 1) {
        p.switchCd = 0.3;
        p.weaponIndex = (p.weaponIndex + 1) % p.weapons.length;
      }

      p.shootCd -= dt;
      const w = this.curWeapon(p);
      const wid = this.curWeaponId(p);
      if (c.shoot && p.shootCd <= 0 && p.ammo[wid] > 0) {
        p.shootCd = w.cd;
        p.ammo[wid]--;
        this.fire(p, w);
      }
    }

    // ---- SEAT SWAP: when both share a car, swap who drives / who shoots ----
    p.seatCd = (p.seatCd ?? 0) - dt;
    if (c.seat && (p.seatCd ?? 0) <= 0 && v.occupants.length > 1) {
      p.seatCd = 0.5;
      // rotate occupants so a different player becomes the driver
      const idx = v.occupants.indexOf(p.id);
      if (idx === 0) {
        // driver hands the wheel to the next occupant
        const next = v.occupants.shift()!;
        v.occupants.push(next);
      } else {
        // a passenger grabs the wheel
        v.occupants.splice(idx, 1);
        v.occupants.unshift(p.id);
      }
      this.emit();
    }

    // all occupants ride along
    p.x = v.x;
    p.y = v.y;
    if (driver) {
      p.angle = v.angle;
    }

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

    // if vehicle has an NPC driver, eject them!
    if (best.npcDriver) {
      best.npcDriver = false;
      best.speed = 0;
      const colors = ["#e2c08d", "#d98c5f", "#f0d6c2", "#b5e0c2", "#e0b5d4", "#c9a0e0"];
      const col = colors[(Math.random() * colors.length) | 0];
      this.peds.push({
        x: best.x + Math.cos(best.angle + Math.PI / 2) * 25,
        y: best.y + Math.sin(best.angle + Math.PI / 2) * 25,
        vx: Math.cos(best.angle + Math.PI / 2) * 150,
        vy: Math.sin(best.angle + Math.PI / 2) * 150,
        color: col,
        alive: true,
        panicTimer: 6.0,
        panicFromX: p.x,
        panicFromY: p.y
      });
      best.stolen = true;
      this.commitCrime(1);
      this.state.score += 50;
    }

    best.occupants.push(p.id);
    p.vehicle = best;
    // entering an unoccupied car/bike = grand theft auto -> police
    if (firstSteal && !best.stolen) {
      best.stolen = true;
      this.commitCrime(1);
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

    // trigger panic in nearby pedestrians when a shot is fired
    for (const ped of this.peds) {
      if (ped.alive && Math.hypot(ped.x - p.x, ped.y - p.y) < 320) {
        ped.panicTimer = 5.0;
        ped.panicFromX = p.x;
        ped.panicFromY = p.y;
      }
    }

    this.commitCrime(1);
  }

  private respawn(p: Player) {
    p.alive = true;
    p.health = 100;
    p.armor = 0;
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

      // ---------- 1. ARMED THUG that has turned hostile: hunt & shoot ----------
      if (ped.armed && ped.hostile) {
        ped.state = "attack";
        // pick the closest living player as a target
        let tx = 0;
        let ty = 0;
        let bd = Infinity;
        for (const p of this.players) {
          if (!p.alive) continue;
          const px = p.vehicle ? p.vehicle.x : p.x;
          const py = p.vehicle ? p.vehicle.y : p.y;
          const d = Math.hypot(px - ped.x, py - ped.y);
          if (d < bd) {
            bd = d;
            tx = px;
            ty = py;
            ped.targetId = p.id;
          }
        }
        if (bd !== Infinity) {
          const ang = Math.atan2(ty - ped.y, tx - ped.x);
          // close in but keep some distance to shoot
          const speed = bd > 220 ? 150 : bd < 120 ? -90 : 0;
          ped.vx = Math.cos(ang) * speed;
          ped.vy = Math.sin(ang) * speed;

          ped.shootCd = (ped.shootCd ?? 0) - dt;
          if (bd < 420 && (ped.shootCd ?? 0) <= 0) {
            ped.shootCd = rand(0.7, 1.4);
            const a = ang + rand(-0.1, 0.1);
            this.bullets.push({
              x: ped.x + Math.cos(a) * 12,
              y: ped.y + Math.sin(a) * 12,
              vx: Math.cos(a) * 560,
              vy: Math.sin(a) * 560,
              life: 1.0,
              hostile: true,
              owner: -2, // armed thug
              dmg: 9,
            });
            this.particles.push({ x: ped.x + Math.cos(a) * 14, y: ped.y + Math.sin(a) * 14, vx: 0, vy: 0, life: 0.05, max: 0.05, color: "rgba(255,200,90,0.9)", size: 7 });
          }
        }
      }
      // ---------- 2. PANIC / FLEE ----------
      else if (ped.panicTimer && ped.panicTimer > 0) {
        ped.panicTimer -= dt;
        ped.state = "panic";
        if (ped.panicFromX != null && ped.panicFromY != null) {
          const ang = Math.atan2(ped.y - ped.panicFromY, ped.x - ped.panicFromX);
          ped.vx = Math.cos(ang) * 150;
          ped.vy = Math.sin(ang) * 150;
        }
        // panic spreads to nearby calm pedestrians (crowd reaction)
        for (const o of this.peds) {
          if (o === ped || !o.alive || (o.panicTimer && o.panicTimer > 0)) continue;
          if (Math.hypot(o.x - ped.x, o.y - ped.y) < 90) {
            o.panicTimer = 3.0;
            o.panicFromX = ped.panicFromX;
            o.panicFromY = ped.panicFromY;
          }
        }
      }
      // ---------- 3. NORMAL WANDER (with vehicle-dodge instinct) ----------
      else {
        ped.state = "wander";
        // dive out of the way of nearby fast-moving vehicles
        let dodged = false;
        for (const v of this.vehicles) {
          if (Math.abs(v.speed) < 120) continue;
          const d = Math.hypot(v.x - ped.x, v.y - ped.y);
          if (d < 80) {
            const ang = Math.atan2(ped.y - v.y, ped.x - v.x);
            ped.vx = Math.cos(ang) * 170;
            ped.vy = Math.sin(ang) * 170;
            dodged = true;
            break;
          }
        }
        if (!dodged && Math.random() < 0.012) {
          ped.vx = rand(-30, 30);
          ped.vy = rand(-30, 30);
        }
      }

      let nx = ped.x + ped.vx * dt;
      let ny = ped.y + ped.vy * dt;
      if (nx < ROAD * 0.5 || nx > WORLD_W - ROAD * 0.5) {
        ped.vx *= -1;
        nx = ped.x;
      }
      if (ny < ROAD * 0.5 || ny > WORLD_H - ROAD * 0.5) {
        ped.vy *= -1;
        ny = ped.y;
      }
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
            let dmg = p.vehicle ? 5 : 11;
            if (p.armor > 0) {
              const toArmor = Math.min(p.armor, Math.round(dmg * 0.75));
              p.armor -= toArmor;
              dmg -= toArmor;
            }
            p.health -= dmg;
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
              this.copKills = (this.copKills || 0) + 1;
              this.state.wanted = Math.min(5, this.state.wanted + 1);
              this.escapeTimer = 0;

              // Spawn loot!
              const rnd = Math.random();
              let lootType: Loot["type"] = "cash";
              let amount = 200;
              if (rnd < 0.25) {
                lootType = "ammo_smg";
                amount = 45;
              } else if (rnd < 0.45) {
                lootType = "armor";
                amount = 50;
              } else if (rnd < 0.6) {
                lootType = "health";
                amount = 40;
              }
              this.loots.push({
                x: e.x,
                y: e.y,
                type: lootType,
                amount,
                life: 15.0,
                pulse: rand(0, 6.28),
              });
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
              let dmg = p.vehicle ? b.dmg * 0.4 : b.dmg;
              if (p.armor > 0) {
                const toArmor = Math.min(p.armor, Math.round(dmg * 0.75));
                p.armor -= toArmor;
                dmg -= toArmor;
              }
              p.health -= dmg;
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
          if (Math.hypot(b.x - ped.x, b.y - ped.y) < 9) {
            b.life = 0;
            ped.health = (ped.health ?? 20) - b.dmg;
            this.blood(ped.x, ped.y);
            // armed thugs fight back instead of going down in one hit
            if (ped.armed && (ped.health ?? 0) > 0) {
              ped.hostile = true;
              ped.targetId = b.owner >= 0 ? b.owner : ped.targetId;
              break;
            }
            if ((ped.health ?? 0) <= 0) {
              ped.alive = false;
              this.state.score += ped.armed ? 80 : 20;
              this.commitCrime(1);
              this.pedKills = (this.pedKills || 0) + 1;
              if (this.pedKills % 3 === 0) {
                this.state.wanted = Math.min(5, this.state.wanted + 1);
              }
              this.loots.push({
                x: ped.x,
                y: ped.y,
                type: ped.armed ? (Math.random() < 0.5 ? "ammo_pistol" : "cash") : Math.random() < 0.2 ? "health" : "cash",
                amount: ped.armed ? 150 : Math.random() < 0.5 ? 50 : 100,
                life: 15,
                pulse: rand(0, 6.28),
              });
              setTimeout(() => Object.assign(ped, this.spawnPed()), 6000);
            }
            break;
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

  private commitCrime(minStars = 1) {
    this.state.wanted = Math.max(this.state.wanted, minStars);
    this.escapeTimer = 0;
    if (this.copSpawnCd <= 0) this.copSpawnCd = rand(1, 3);
  }

  private updatePolice(dt: number) {
    if (this.state.wanted === 0) {
      this.cops = [];
      // remove cop cruisers when wanted level drops to 0
      this.vehicles = this.vehicles.filter((v) => v.type !== "police" || v.occupants.length > 0);
      return;
    }

    this.copSpawnCd -= dt;

    // determine forces and parameters based on Wanted stars
    let maxFootCops = 2;
    let maxCruisers = 0;
    let copSpeed = 210;
    let spawnMin = 3.0;
    let spawnMax = 5.0;

    if (this.state.wanted === 2) {
      maxFootCops = 3;
      copSpeed = 240;
      spawnMin = 2.5;
      spawnMax = 4.5;
    } else if (this.state.wanted === 3) {
      maxFootCops = 2;
      maxCruisers = 1;
      copSpeed = 240;
      spawnMin = 2.5;
      spawnMax = 4.0;
    } else if (this.state.wanted === 4) {
      maxFootCops = 2;
      maxCruisers = 2;
      copSpeed = 260;
      spawnMin = 2.0;
      spawnMax = 3.5;
    } else if (this.state.wanted === 5) {
      maxFootCops = 1;
      maxCruisers = 3;
      copSpeed = 280;
      spawnMin = 1.5;
      spawnMax = 3.0;
    }

    const aliveFootCops = this.cops.filter((c) => c.alive).length;
    const aliveCruisers = this.vehicles.filter((v) => v.type === "police" && v.isPoliceCruiser).length;

    // spawn forces
    if (this.copSpawnCd <= 0) {
      const anchor = this.players.find((p) => p.alive) ?? this.players[0];
      const ang = rand(0, 6.28);

      if (aliveCruisers < maxCruisers && Math.random() < 0.6) {
        // spawn police cruiser
        this.copSpawnCd = rand(spawnMin, spawnMax);
        const cx = anchor.x + Math.cos(ang) * 750;
        const cy = anchor.y + Math.sin(ang) * 750;
        const v = this.mkVehicle(cx, cy, "police", "#ffffff");
        v.isPoliceCruiser = true;
        v.angle = ang + Math.PI; // facing target
        v.speed = 220;
        this.vehicles.push(v);
      } else if (aliveFootCops < maxFootCops) {
        // spawn foot patrol cop
        this.copSpawnCd = rand(spawnMin, spawnMax);
        this.cops.push({
          x: anchor.x + Math.cos(ang) * 720,
          y: anchor.y + Math.sin(ang) * 720,
          angle: ang,
          health: 50 + (this.state.wanted >= 4 ? 30 : 0),
          shootCd: rand(0.5, 1.5),
          alive: true
        });
      }
    }

    const VISION = 580;
    let seen = false;

    // 1. Update foot cops
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

      if (bd > 160) {
        const step = copSpeed * dt;
        const nx = e.x + Math.cos(e.angle) * step;
        const ny = e.y + Math.sin(e.angle) * step;
        if (!this.collides(nx, e.y, 11)) e.x = nx;
        else {
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
        if (this.state.wanted === 5 && Math.random() < 0.35) {
          // SWAT shotguns
          e.shootCd = rand(1.2, 2.0);
          for (let pellet = 0; pellet < 4; pellet++) {
            const a = e.angle + rand(-0.25, 0.25);
            this.bullets.push({
              x: e.x + Math.cos(a) * 12,
              y: e.y + Math.sin(a) * 12,
              vx: Math.cos(a) * 580,
              vy: Math.sin(a) * 580,
              life: 0.8,
              hostile: true,
              owner: -1,
              dmg: 7
            });
          }
          this.particles.push({ x: e.x + Math.cos(e.angle) * 16, y: e.y + Math.sin(e.angle) * 16, vx: 0, vy: 0, life: 0.05, max: 0.05, color: "rgba(255,180,80,0.9)", size: 8 });
        } else {
          // pistol or SMG
          const isSMG = this.state.wanted >= 4;
          e.shootCd = isSMG ? rand(0.35, 0.75) : rand(1.0, 1.8);
          const a = e.angle + rand(-0.08, 0.08);
          this.bullets.push({
            x: e.x + Math.cos(a) * 12,
            y: e.y + Math.sin(a) * 12,
            vx: Math.cos(a) * 540,
            vy: Math.sin(a) * 540,
            life: 1.0,
            hostile: true,
            owner: -1,
            dmg: isSMG ? 8 : 11
          });
        }
      }
    }
    this.cops = this.cops.filter((c) => c.alive);

    // 2. Update police cruisers
    for (const v of this.vehicles) {
      if (v.type === "police" && v.isPoliceCruiser) {
        v.sirenTimer = (v.sirenTimer || 0) + dt;

        let tx = 0;
        let ty = 0;
        let bd = Infinity;
        let targetPlayer: Player | null = null;

        for (const p of this.players) {
          if (!p.alive) continue;
          const px = p.vehicle ? p.vehicle.x : p.x;
          const py = p.vehicle ? p.vehicle.y : p.y;
          const d = Math.hypot(px - v.x, py - v.y);
          if (d < bd) {
            bd = d;
            tx = px;
            ty = py;
            targetPlayer = p;
          }
        }

        if (bd === Infinity || !targetPlayer) continue;
        if (bd < VISION) seen = true;

        // steer cruiser towards player
        const targetAngle = Math.atan2(ty - v.y, tx - v.x);
        let diff = targetAngle - v.angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        v.angle += Math.sign(diff) * Math.min(Math.abs(diff), 2.2 * dt);

        const targetSpeed = this.state.wanted >= 4 ? 430 : 360;
        v.speed += (targetSpeed - v.speed) * Math.min(1, 2.0 * dt);

        const step = v.speed * dt;
        const nx = v.x + Math.cos(v.angle) * step;
        const ny = v.y + Math.sin(v.angle) * step;
        const rad = 17;

        if (!this.collides(nx, v.y, rad)) v.x = nx;
        else {
          v.speed *= -0.5;
          v.angle += rand(-0.8, 0.8);
        }

        if (!this.collides(v.x, ny, rad)) v.y = ny;
        else {
          v.speed *= -0.5;
          v.angle += rand(-0.8, 0.8);
        }

        // Ramming checks
        if (targetPlayer.vehicle) {
          if (Math.hypot(targetPlayer.vehicle.x - v.x, targetPlayer.vehicle.y - v.y) < 32) {
            v.speed *= 0.25;
            targetPlayer.vehicle.speed *= 0.6;
            this.spark(v.x, v.y);
            // deal damage to occupants of player vehicle
            for (const pid of targetPlayer.vehicle.occupants) {
              const occ = this.players[pid];
              if (occ && occ.alive) {
                let dmg = 8;
                if (occ.armor > 0) {
                  const toArmor = Math.min(occ.armor, Math.round(dmg * 0.75));
                  occ.armor -= toArmor;
                  dmg -= toArmor;
                }
                occ.health -= dmg;
                if (occ.health <= 0) this.downPlayer(occ);
              }
            }
          }
        } else {
          if (Math.hypot(targetPlayer.x - v.x, targetPlayer.y - v.y) < 25) {
            v.speed *= 0.15;
            this.blood(targetPlayer.x, targetPlayer.y);
            let dmg = 22; // high impact ram
            if (targetPlayer.armor > 0) {
              const toArmor = Math.min(targetPlayer.armor, Math.round(dmg * 0.75));
              targetPlayer.armor -= toArmor;
              dmg -= toArmor;
            }
            targetPlayer.health -= dmg;
            this.cams[targetPlayer.id] && (this.cams[targetPlayer.id].shake = 10);
            if (targetPlayer.health <= 0) this.downPlayer(targetPlayer);
          }
        }

        // shoot from passenger seat of cruiser
        if (bd < 380 && Math.random() < 0.02) {
          const a = v.angle + rand(-0.15, 0.15);
          this.bullets.push({
            x: v.x + Math.cos(a) * 20,
            y: v.y + Math.sin(a) * 20,
            vx: Math.cos(a) * 540,
            vy: Math.sin(a) * 540,
            life: 1.0,
            hostile: true,
            owner: -1,
            dmg: this.state.wanted >= 4 ? 8 : 11
          });
        }
      }
    }

    // escape logic
    if (seen) this.escapeTimer = 0;
    else this.escapeTimer += dt;

    const escapeRequired = 10 + this.state.wanted * 3; // 13s to 25s
    if (this.escapeTimer > escapeRequired) {
      this.state.wanted = 0;
      this.cops = [];
      this.vehicles = this.vehicles.filter((v) => v.type !== "police");
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

  private updateLoots(dt: number) {
    for (const loot of this.loots) {
      loot.life -= dt;
      loot.pulse += dt * 5;

      for (const p of this.players) {
        if (!p.alive) continue;
        const px = p.vehicle ? p.vehicle.x : p.x;
        const py = p.vehicle ? p.vehicle.y : p.y;
        if (Math.hypot(loot.x - px, loot.y - py) < 25) {
          loot.life = 0; // collect
          this.spark(loot.x, loot.y);

          if (loot.type === "cash") {
            this.state.cash += loot.amount;
            this.state.score += 50;
          } else if (loot.type === "health") {
            p.health = Math.min(100, p.health + loot.amount);
          } else if (loot.type === "armor") {
            p.armor = Math.min(100, p.armor + loot.amount);
          } else if (loot.type === "ammo_smg") {
            p.ammo.smg += loot.amount;
          } else if (loot.type === "ammo_shotgun") {
            p.ammo.shotgun += loot.amount;
          }
          this.emit();
          break;
        }
      }
    }
    this.loots = this.loots.filter((l) => l.life > 0);
  }

  private updateTraffic(dt: number) {
    // 1. Update existing traffic cars
    for (const v of this.vehicles) {
      if (!v.npcDriver) continue;

      // check if blocked by another vehicle or player in front
      const lookDist = 60;
      const fx = v.x + Math.cos(v.angle) * lookDist;
      const fy = v.y + Math.sin(v.angle) * lookDist;
      let blocked = false;

      // check players
      for (const p of this.players) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - fx, p.y - fy) < 40) blocked = true;
      }
      // check other vehicles
      for (const other of this.vehicles) {
        if (other === v) continue;
        if (Math.hypot(other.x - fx, other.y - fy) < 45) blocked = true;
      }

      if (blocked) {
        v.speed *= 1 - 4 * dt; // brake quickly
        if (Math.abs(v.speed) < 5) v.speed = 0;
        // spawn steam/honk particles occasionally
        if (Math.random() < 0.01) {
          this.particles.push({ x: fx, y: fy, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.3, max: 0.3, color: "rgba(255,255,255,0.3)", size: 4 });
        }
      } else {
        // accelerate to traffic speed
        v.speed += (120 - v.speed) * Math.min(1, 2 * dt);
      }

      // move and slide/bounce on buildings
      const step = v.speed * dt;
      const nx = v.x + Math.cos(v.angle) * step;
      const ny = v.y + Math.sin(v.angle) * step;
      const rad = 17;

      if (!this.collides(nx, v.y, rad)) v.x = nx;
      else {
        v.speed *= -0.25;
        v.angle = Math.random() < 0.5 ? v.angle + Math.PI / 2 : v.angle - Math.PI / 2;
      }

      if (!this.collides(v.x, ny, rad)) v.y = ny;
      else {
        v.speed *= -0.25;
        v.angle = Math.random() < 0.5 ? v.angle + Math.PI / 2 : v.angle - Math.PI / 2;
      }

      // keep within bounds
      v.x = Math.max(20, Math.min(WORLD_W - 20, v.x));
      v.y = Math.max(20, Math.min(WORLD_H - 20, v.y));

      // random turning at intersections to make traffic dynamic
      if (Math.random() < 0.008 && Math.abs(v.speed) > 50) {
        // check if currently on a road crossing/intersection
        const isNearIntersection = this.roads.filter(r => r.horizontal).some(hr => 
          this.roads.filter(r => !r.horizontal).some(vr => 
            Math.hypot(v.x - (vr.x + vr.w/2), v.y - (hr.y + hr.h/2)) < 30
          )
        );
        if (isNearIntersection) {
          v.angle = Math.random() < 0.5 ? v.angle + Math.PI / 2 : v.angle - Math.PI / 2;
        }
      }
    }

    // 2. Spawn ambient traffic off-screen if count is low
    const npcCount = this.vehicles.filter((v) => v.npcDriver).length;
    if (npcCount < 6 && Math.random() < 0.005) {
      const anchor = this.players.find((p) => p.alive) ?? this.players[0];
      const r = this.roads[Math.floor(Math.random() * this.roads.length)];
      const rx = r.horizontal ? rand(r.x + 50, r.x + r.w - 50) : rand(r.x + 20, r.x + r.w - 20);
      const ry = r.horizontal ? rand(r.y + 20, r.y + r.h - 20) : rand(r.y + 50, r.y + r.h - 50);

      // check off-screen from anchor
      if (Math.hypot(rx - anchor.x, ry - anchor.y) > 540) {
        const colors = ["#4287f5", "#a83232", "#1ba135", "#7832a8", "#d8c24a", "#46b1c9", "#5cc46a", "#c9603f"];
        const col = colors[Math.floor(Math.random() * colors.length)];
        const type = Math.random() < 0.2 ? "bike" : "car";
        this.vehicles.push(this.mkVehicle(rx, ry, type, col, true));
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

    // loots
    for (const loot of this.loots) {
      if (loot.life <= 0) continue;
      const s = 1 + Math.sin(loot.pulse) * 0.12;
      ctx.save();
      ctx.translate(loot.x, loot.y);
      ctx.scale(s, s);
      if (loot.type === "cash") {
        ctx.shadowColor = "rgba(120,220,140,0.9)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#3fcf6a";
        ctx.fillRect(-10, -7, 20, 14);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0c3a1c";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("₹", 0, 1);
      } else if (loot.type === "health") {
        ctx.shadowColor = "rgba(255,100,100,0.8)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, 6.28);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#e23b3b";
        ctx.fillRect(-6, -2, 12, 4);
        ctx.fillRect(-2, -6, 4, 12);
      } else if (loot.type === "armor") {
        ctx.shadowColor = "rgba(100,180,255,0.8)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#39b6ff";
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(8, -5);
        ctx.lineTo(6, 3);
        ctx.lineTo(0, 9);
        ctx.lineTo(-6, 3);
        ctx.lineTo(-8, -5);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("A", 0, 0);
      } else {
        ctx.shadowColor = "rgba(240,210,120,0.8)";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#bfa75c";
        ctx.fillRect(-8, -6, 16, 12);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#222222";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("AM", 0, 0);
      }
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
    for (const v of this.vehicles) {
      if (v.occupants.length === 0 && !v.isPoliceCruiser) {
        this.drawVehicle(ctx, v, false);
      }
    }

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

    // occupied vehicles (or police cruisers)
    for (const v of this.vehicles) {
      if (v.occupants.length === 0 && !v.isPoliceCruiser) continue;
      if (v.isPoliceCruiser) {
        // Draw police cruiser driven by cops
        this.drawVehicle(ctx, v, true, "#ffffff");
        // Draw driver cop
        this.drawPerson(ctx, v.x - Math.cos(v.angle + Math.PI / 2) * 5, v.y - Math.sin(v.angle + Math.PI / 2) * 5, v.angle, "#2d54c8", true);
        // Draw passenger cop
        this.drawPerson(ctx, v.x + Math.cos(v.angle + Math.PI / 2) * 5, v.y + Math.sin(v.angle + Math.PI / 2) * 5, v.angle, "#2d54c8", true);
      } else {
        const driver = this.players[v.occupants[0]];
        this.drawVehicle(ctx, v, true, driver?.color);
        
        // draw passenger leaning out (drive-by style)
        for (let idx = 1; idx < v.occupants.length; idx++) {
          const pass = this.players[v.occupants[idx]];
          if (pass && pass.alive) {
            const sideAngle = v.angle + Math.PI / 2;
            const px = v.x + Math.cos(sideAngle) * 7;
            const py = v.y + Math.sin(sideAngle) * 7;
            this.drawPerson(ctx, px, py, pass.angle, pass.color, false);
          }
        }

        if (this.mode === "coop") {
          ctx.fillStyle = driver?.color ?? "#fff";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(v.occupants.map((id) => `P${id + 1}`).join("+"), v.x, v.y - 26);
        }
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
      if (v.type === "police") {
        // police cruiser: black and white
        ctx.fillStyle = "#111111"; // black base
        ctx.fillRect(-20, -12, 40, 24);
        ctx.fillStyle = "#ffffff"; // white doors/roof
        ctx.fillRect(-8, -12, 16, 24);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(-10, -9, 11, 18);
        ctx.fillStyle = "rgba(180,220,255,0.75)";
        ctx.fillRect(3, -8, 8, 16);
        
        // blinking sirens on top
        const sirenState = Math.floor((v.sirenTimer || 0) * 10) % 2 === 0;
        ctx.fillStyle = sirenState ? "#ff3333" : "#3333ff";
        ctx.fillRect(-2, -8, 4, 6);
        ctx.fillStyle = sirenState ? "#3333ff" : "#ff3333";
        ctx.fillRect(-2, 2, 4, 6);

        // draw translucent siren light beams projecting out
        ctx.save();
        ctx.rotate(Math.PI / 2);
        const lgSirenL = ctx.createLinearGradient(0, 0, 0, 100);
        lgSirenL.addColorStop(0, sirenState ? "rgba(255,50,50,0.4)" : "rgba(50,50,255,0.4)");
        lgSirenL.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = lgSirenL;
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.lineTo(-35, 100);
        ctx.lineTo(35, 100);
        ctx.closePath();
        ctx.fill();

        const lgSirenR = ctx.createLinearGradient(0, 0, 0, -100);
        lgSirenR.addColorStop(0, sirenState ? "rgba(50,50,255,0.4)" : "rgba(255,50,50,0.4)");
        lgSirenR.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = lgSirenR;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(-35, -100);
        ctx.lineTo(35, -100);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = occupied && tint ? tint : v.color;
        ctx.fillRect(-20, -12, 40, 24);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(-12, -10, 14, 20);
        ctx.fillStyle = "rgba(180,220,255,0.75)";
        ctx.fillRect(4, -9, 8, 18);
      }
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