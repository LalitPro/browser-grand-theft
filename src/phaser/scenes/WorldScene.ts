import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Vehicle } from "../entities/Vehicle";
import { NPC } from "../entities/NPC";
import { DISTRICTS } from "../data/districts";
import { BUILDINGS, BuildingData } from "../data/buildings";
import { ROAD_NODES, TOLL_PLAZAS, BRIDGES } from "../data/roads";
import { CollisionSystem } from "../systems/CollisionSystem";
import { SpawnSystem } from "../systems/SpawnSystem";
import { PoliceSystem } from "../systems/PoliceSystem";
import { MinimapSystem } from "../systems/MinimapSystem";
import { OptimizationSystem } from "../systems/OptimizationSystem";
import { CameraManager } from "../systems/CameraManager";
import { StoryManager } from "../systems/StoryManager";
import { SideMissionSystem } from "../systems/SideMissionSystem";
import { preloadAssets, processTexturesBlackToAlpha, getCharFrame } from "../systems/AssetLoader";

export class WorldScene extends Phaser.Scene {
  public player!: Player;
  public player2?: Player;
  public cameraManager!: CameraManager;
  public spawnSystem!: SpawnSystem;
  public policeSystem!: PoliceSystem;
  public minimapSystem!: MinimapSystem;
  public optimizationSystem!: OptimizationSystem;
  public collisionSystem!: CollisionSystem;

  public buildingsGroup!: Phaser.Physics.Arcade.Group;
  public vehiclesPhysicsGroup!: Phaser.Physics.Arcade.Group;
  public copsPhysicsGroup!: Phaser.Physics.Arcade.Group;
  public npcsPhysicsGroup!: Phaser.Physics.Arcade.Group;

  public mainCameraIgnoreList: any[] = [];
  
  // Game states
  public wantedLevel = 0;
  public wantedTimer = 0;
  public score = 0;
  public cash = 1000;

  // Story campaign states
  public activeSubtitle = "";
  public activeSubtitleSub = "";
  public activeObjective = "";
  public storyManager?: StoryManager;

  // Side missions
  public sideMissionSystem?: SideMissionSystem;
  public activeSideObjective = "";

  // GPS route line graphics
  private gpsGraphics?: Phaser.GameObjects.Graphics;

  // Gun shop state (read by the React HUD)
  public shopState: {
    open: boolean;
    cash: number;
    owned: string[];
    ammo: Record<string, number>;
  } = { open: false, cash: 0, owned: [], ammo: {} };
  private shopZones: { x: number; y: number; r: number }[] = [];

  // Groups
  public bullets!: Phaser.Physics.Arcade.Group;

  constructor() {
    super("WorldScene");
  }

  public init() {
    this.collisionSystem = new CollisionSystem();
    this.optimizationSystem = new OptimizationSystem(this);
    this.spawnSystem = new SpawnSystem(this, this.collisionSystem);
    this.policeSystem = new PoliceSystem(this);
  }

  public preload() {
    // Load the dynamic world structure definition file
    this.load.json('worldMapData', 'assets/data/world_map.json');
    // Load all game spritesheets
    preloadAssets(this);
  }

  public create() {
    // Strip black backgrounds from all spritesheets
    processTexturesBlackToAlpha(this);

    this.physics.world.setBounds(0, 0, 4000, 2500);

    // 1. Draw Ground Landscape & Districts
    this.drawTerrain();

    // 2. Draw Road Infrastructure & Tracks
    this.drawRoadNetwork();

    // 3. Draw Buildings (static physics group)
    this.drawCityBuildings();

    // 4. Setup Groups
    this.bullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 100
    });

    this.vehiclesPhysicsGroup = this.physics.add.group();
    this.copsPhysicsGroup = this.physics.add.group();
    this.npcsPhysicsGroup = this.physics.add.group();

    // 5. Spawn Player(s) & Setup CameraManager
    const isCoop = this.registry.get("isCoop");
    this.player = new Player(this, 300, 1050, 1);
    if (isCoop) {
      this.player2 = new Player(this, 350, 1050, 2);
    }

    if (!isCoop) {
      this.storyManager = new StoryManager(this);
      this.events.once("shutdown", () => {
        if (this.storyManager) {
          this.storyManager.destroy();
          this.storyManager = undefined;
        }
      });
    }

    this.cameras.main.setBounds(0, 0, 4000, 2500);
    this.cameras.main.setZoom(1.0);

    this.cameraManager = new CameraManager(this);
    this.scale.on("resize", () => {
      this.cameraManager.handleResize();
    });

    // 6. Setup Systems
    this.minimapSystem = new MinimapSystem(this);
    this.setupMinimapLocations();
    this.setupDynamicJsonTriggers();

    // Side missions (available in solo & co-op, tracks Player 1)
    this.sideMissionSystem = new SideMissionSystem(this);
    this.setupGunShops();

    // GPS route line graphic (world space — shows on main + minimap)
    this.gpsGraphics = this.add.graphics();
    this.gpsGraphics.setDepth(3);

    this.events.once("shutdown", () => {
      this.sideMissionSystem?.destroy();
      this.sideMissionSystem = undefined;
    });

    // Bullet overlaps — hostile bullets hurt players, player bullets hurt NPCs
    // In co-op: player bullets can also hurt the OTHER player (friendly fire)
    this.physics.add.overlap(this.bullets, this.player.sprite, this.handleBulletHitPlayer, undefined, this);
    if (this.player2) {
      this.physics.add.overlap(this.bullets, this.player2.sprite, this.handleBulletHitPlayer, undefined, this);
    }
    this.physics.add.overlap(this.bullets, this.npcsPhysicsGroup, this.handleBulletHitNPC, undefined, this);
    // Cops hit by player bullets
    this.physics.add.overlap(this.bullets, this.copsPhysicsGroup, this.handleBulletHitCop, undefined, this);

    // Static buildings collisions
    this.physics.add.collider(this.player.sprite, this.buildingsGroup);
    if (this.player2) {
      this.physics.add.collider(this.player2.sprite, this.buildingsGroup);
    }
    this.physics.add.collider(this.vehiclesPhysicsGroup, this.buildingsGroup);
    this.physics.add.collider(this.copsPhysicsGroup, this.buildingsGroup);
    this.physics.add.collider(this.npcsPhysicsGroup, this.buildingsGroup);

    // Player vs Vehicle collisions (impact damage)
    this.physics.add.collider(this.player.sprite, this.vehiclesPhysicsGroup, this.handlePlayerVehicleCollision, undefined, this);
    if (this.player2) {
      this.physics.add.collider(this.player2.sprite, this.vehiclesPhysicsGroup, this.handlePlayerVehicleCollision, undefined, this);
    }

    // Vehicle vs Vehicle collisions
    this.physics.add.collider(this.vehiclesPhysicsGroup, this.vehiclesPhysicsGroup);

    // Player vs Cop collisions
    this.physics.add.collider(this.player.sprite, this.copsPhysicsGroup);
    if (this.player2) {
      this.physics.add.collider(this.player2.sprite, this.copsPhysicsGroup);
    }

    // Player vs NPC collisions
    this.physics.add.collider(this.player.sprite, this.npcsPhysicsGroup);
    if (this.player2) {
      this.physics.add.collider(this.player2.sprite, this.npcsPhysicsGroup);
    }

    // NPC vs Vehicle collisions
    this.physics.add.collider(this.npcsPhysicsGroup, this.vehiclesPhysicsGroup);

    // Player 1 vs Player 2 collision (gentle push, no damage on body collision)
    if (this.player2) {
      this.physics.add.collider(this.player.sprite, this.player2.sprite);
    }

    // Vehicle ramming NPC pedestrians and other players
    // NPC runover handled in update loop; player-car-vs-player handled via collider below
    if (this.player2) {
      this.physics.add.overlap(
        this.vehiclesPhysicsGroup,
        this.player2.sprite,
        this.handleVehicleRamPlayer,
        undefined,
        this
      );
    }
    this.physics.add.overlap(
      this.vehiclesPhysicsGroup,
      this.player.sprite,
      this.handleVehicleRamPlayer,
      undefined,
      this
    );
    // Vehicle vs NPC pedestrian overlap (kill NPC)
    this.physics.add.overlap(
      this.vehiclesPhysicsGroup,
      this.npcsPhysicsGroup,
      this.handleVehicleRamNPC,
      undefined,
      this
    );

    // Vehicle runs over a cop at speed (kill cop)
    this.physics.add.overlap(
      this.vehiclesPhysicsGroup,
      this.copsPhysicsGroup,
      this.handleVehicleRamCop,
      undefined,
      this
    );
    
    // Key press for resetting wanted level for convenience
    if (this.input.keyboard) {
      this.input.keyboard.on("keydown-K", () => {
        this.wantedLevel = Math.min(6, this.wantedLevel + 1); // Up to 6 stars
        this.wantedTimer = 0;
        this.showCrimeBanner(`Wanted Level Increased to ${this.wantedLevel} Stars!`);
      });

      this.input.keyboard.on("keydown-L", () => {
        this.wantedLevel = 0;
        this.showCrimeBanner("Wanted Level Cleared!");
      });
    }
  }

  public update(time: number, delta: number) {
    const dt = delta / 1000;

    if (this.storyManager) {
      this.storyManager.update(dt);
    }

    // 1. Update entities
    this.player.update(dt);
    if (this.player2) {
      this.player2.update(dt);
    }

    // Determine target center for optimizations and chases (average between players)
    let targetX = this.player.sprite.x;
    let targetY = this.player.sprite.y;
    if (this.player2 && !this.player.isWasted && !this.player2.isWasted) {
      targetX = (this.player.sprite.x + this.player2.sprite.x) / 2;
      targetY = (this.player.sprite.y + this.player2.sprite.y) / 2;
    } else if (this.player.isWasted && this.player2) {
      targetX = this.player2.sprite.x;
      targetY = this.player2.sprite.y;
    }

    // Update active vehicles
    this.spawnSystem.spawnedVehicles.forEach((v: any) => {
      // Driver keys control the vehicle
      if (v.driver) {
        v.update(v.driver.keys, dt);
      } else {
        v.update(null, dt);
      }
      
      v.x = v.sprite.x;
      v.y = v.sprite.y;
    });

    // Update active NPCs
    this.spawnSystem.spawnedNPCs.forEach((n: any) => {
      n.update(dt);
      n.x = n.sprite.x;
      n.y = n.sprite.y;

      // Check pedestrian proximity to player-driven vehicles — kill NPC if too close and fast
      const pArray = [this.player, this.player2];
      pArray.forEach((p) => {
        if (p && p.isDriving && p.currentVehicle) {
          const speed = Math.abs(p.currentVehicle.speed);
          if (speed > 80) {
            const dist = Math.hypot(n.sprite.x - p.currentVehicle.sprite.x, n.sprite.y - p.currentVehicle.sprite.y);
            if (dist < 28) {
              const vis = n.sprite.getData("visualSprite");
              if (vis) vis.destroy();
              n.sprite.destroy();
              this.spawnSystem.spawnedNPCs.delete(n.id);
              this.handlePedestrianRunOver();
            }
          }
        }
      });
    });

    // Sync visual sprite images with their physics container positions + directional frames
    this.spawnSystem.spawnedNPCs.forEach((n: any) => {
      const vis = n.sprite.getData("visualSprite");
      if (vis && vis.active) {
        vis.x = n.sprite.x;
        vis.y = n.sprite.y;
        // Update directional frame based on NPC movement angle
        if (vis.setFrame) {
          const charType = n.sprite.getData("charType") || "resident";
          vis.setFrame(getCharFrame(charType, n.sprite.rotation));
        }
        vis.setVisible(n.sprite.visible);
      }
    });
    this.spawnSystem.spawnedVehicles.forEach((v: any) => {
      const vis = v.sprite.getData("visualSprite");
      if (vis && vis.active) {
        vis.x = v.sprite.x;
        vis.y = v.sprite.y;
        // Vehicles use Phaser rotation — sprite sheet is side-view so we just rotate
        vis.rotation = v.sprite.rotation;
        vis.setVisible(v.sprite.visible);
      }
    });

    // Update police pursuits
    this.policeSystem.update(targetX, targetY, this.wantedLevel, dt);

    // Check cop-player collisions / damage for both players
    const players = [this.player, this.player2];
    players.forEach((p) => {
      if (p && !p.isWasted) {
        this.policeSystem.spawnedCops.forEach((cop: any) => {
          const dist = Math.hypot(cop.sprite.x - p.sprite.x, cop.sprite.y - p.sprite.y);
          const isCruiser = cop.type === "cruiser" || cop.type === "apc";
          const threshold = isCruiser ? 32 : 15;
          
          if (dist < threshold) {
            if (isCruiser) {
              cop.ramCd = (cop.ramCd || 0) - dt;
              if (cop.ramCd <= 0) {
                cop.ramCd = 1.5; // Cooldown
                const dmg = cop.type === "apc" ? 40 : 25; // APC ram is lethal
                p.takeDamage(dmg);
                this.cameras.main.shake(150, 0.007);
              }
            } else {
              cop.meleeCd = (cop.meleeCd || 0) - dt;
              if (cop.meleeCd <= 0) {
                cop.meleeCd = 1.0; 
                p.takeDamage(10); 
                this.cameras.main.shake(100, 0.003);
              }
            }
          }
        });
      }
    });

    // 2. Wanted Level Decay
    if (this.wantedLevel > 0) {
      this.wantedTimer += dt;
      const decayTime = 12 + this.wantedLevel * 4;
      if (this.wantedTimer > decayTime) {
        this.wantedLevel--;
        this.wantedTimer = 0;
        if (this.wantedLevel === 0) {
          this.showCrimeBanner("Escaped the Cops!");
        }
      }
    }

    // Update CameraManager viewport calculations
    this.cameraManager.update(dt);

    // 3. Run culling & spawning optimizations
    this.optimizationSystem.update(targetX, targetY);
    this.spawnSystem.update(targetX, targetY, this.time.now);
    this.minimapSystem.updateBlips(targetX, targetY);

    // 4. Clean active bullets
    this.bullets.getChildren().forEach((b: any) => {
      if (b.active) {
        const dist = Math.hypot(targetX - b.x, targetY - b.y);
        if (dist > 800) {
          b.setActive(false);
          b.setVisible(false);
        }
      }
    });
  }

  // --- Drawing Terrain, Roads, and Buildings ---

  private drawTerrain() {
    // ── Tiled grass base using RenderTexture ──────────────────────────
    // Build a small 128x128 grass tile with variation, then tile it across the world
    const tileSize = 128;
    const tileTex = this.add.renderTexture(0, 0, tileSize, tileSize);
    const tileG = this.make.graphics();

    // Base grass green
    tileG.fillStyle(0x4e8c5a, 1);
    tileG.fillRect(0, 0, tileSize, tileSize);

    // Darker green patches for variation
    tileG.fillStyle(0x3d7347, 0.55);
    tileG.fillRect(8, 12, 30, 22);
    tileG.fillRect(60, 5, 40, 18);
    tileG.fillRect(20, 70, 50, 25);
    tileG.fillRect(85, 55, 38, 30);

    // Light grass highlights
    tileG.fillStyle(0x6aaa72, 0.35);
    tileG.fillRect(40, 30, 20, 12);
    tileG.fillRect(90, 20, 28, 10);
    tileG.fillRect(5, 90, 35, 15);

    tileTex.draw(tileG, 0, 0);
    tileG.destroy();
    tileTex.saveTexture('grass_tile');
    tileTex.destroy();

    // Tile the grass texture across the full world
    this.add.tileSprite(0, 0, 4000, 2500, 'grass_tile').setOrigin(0, 0).setDepth(0);

    // ── Zone overlays and features ────────────────────────────────────
    const graphics = this.add.graphics();
    graphics.setDepth(1);

    // Navapur city zone — warm sandy concrete
    graphics.fillStyle(0xd4a96a, 0.28);
    graphics.fillRect(50, 750, 1150, 1250);

    // Urban concrete pavement overlay (city sidewalk feel)
    graphics.fillStyle(0xb8a88a, 0.18);
    graphics.fillRect(80, 800, 200, 1150);
    graphics.fillRect(350, 850, 180, 1100);
    graphics.fillRect(600, 900, 200, 950);
    graphics.fillRect(850, 850, 220, 900);

    // Indrapuri blue commercial zone
    graphics.fillStyle(0xbcd7e0, 0.35);
    graphics.fillRect(2150, 1000, 930, 1000);

    // Bandarkhali industrial grey
    graphics.fillStyle(0xc8c0b4, 0.4);
    graphics.fillRect(3080, 500, 920, 1500);
    // Concrete pads (docks)
    graphics.fillStyle(0xa8a090, 0.5);
    graphics.fillRect(3100, 550, 880, 400);
    graphics.fillRect(3200, 1200, 750, 600);

    // Kisanpur — brown agricultural fields
    graphics.fillStyle(0x8b6a3a, 0.45);
    graphics.fillRect(800, 250, 400, 400);
    graphics.fillRect(1300, 250, 500, 400);
    // Field rows pattern
    graphics.lineStyle(3, 0x6b4e24, 0.4);
    for (let row = 0; row < 6; row++) {
      graphics.beginPath();
      graphics.moveTo(800, 270 + row * 60);
      graphics.lineTo(1200, 270 + row * 60);
      graphics.strokePath();
      graphics.beginPath();
      graphics.moveTo(1300, 270 + row * 60);
      graphics.lineTo(1800, 270 + row * 60);
      graphics.strokePath();
    }

    // Chandani River
    graphics.lineStyle(150, 0x1a6fa3, 1);
    graphics.beginPath();
    graphics.moveTo(300, 0);
    graphics.lineTo(500, 500);
    graphics.lineTo(1100, 800);
    graphics.lineTo(1600, 1200);
    graphics.lineTo(1600, 2000);
    graphics.lineTo(1700, 2500);
    graphics.strokePath();

    // River highlight (lighter shimmer)
    graphics.lineStyle(50, 0x3399cc, 0.35);
    graphics.beginPath();
    graphics.moveTo(310, 0);
    graphics.lineTo(510, 500);
    graphics.lineTo(1110, 800);
    graphics.lineTo(1610, 1200);
    graphics.lineTo(1610, 2000);
    graphics.lineTo(1710, 2500);
    graphics.strokePath();

    // Bay of Samudra ocean
    graphics.fillStyle(0x0d4e82, 1);
    graphics.beginPath();
    graphics.moveTo(0, 2000);
    graphics.lineTo(2150, 2000);
    graphics.lineTo(2150, 2150);
    graphics.lineTo(3080, 2150);
    graphics.lineTo(3080, 2000);
    graphics.lineTo(4000, 2000);
    graphics.lineTo(4000, 2500);
    graphics.lineTo(0, 2500);
    graphics.closePath();
    graphics.fill();

    // Ocean wave highlights
    graphics.lineStyle(3, 0x2288cc, 0.25);
    for (let wy = 2020; wy < 2480; wy += 40) {
      graphics.beginPath();
      graphics.moveTo(0, wy);
      graphics.lineTo(4000, wy + 15);
      graphics.strokePath();
    }
  }

  private drawRoadNetwork() {
    const graphics = this.add.graphics();
    graphics.setDepth(2);

    // Road shoulder/kerb — slightly wider than the road itself
    graphics.lineStyle(44, 0x888070, 1);
    for (const id in ROAD_NODES) {
      const node = ROAD_NODES[id];
      node.connections.forEach((connId) => {
        const next = ROAD_NODES[connId];
        if (next && node.type !== "highway" && next.type !== "highway") {
          graphics.beginPath();
          graphics.moveTo(node.x, node.y);
          graphics.lineTo(next.x, next.y);
          graphics.strokePath();
        }
      });
    }

    // Road tarmac — dark asphalt
    graphics.lineStyle(36, 0x2e2e2e, 1);
    for (const id in ROAD_NODES) {
      const node = ROAD_NODES[id];
      node.connections.forEach((connId) => {
        const next = ROAD_NODES[connId];
        if (next && node.type !== "highway" && next.type !== "highway") {
          graphics.beginPath();
          graphics.moveTo(node.x, node.y);
          graphics.lineTo(next.x, next.y);
          graphics.strokePath();
        }
      });
    }

    // Road centre dashes — white dashed lines
    graphics.lineStyle(2, 0xffffff, 0.45);
    for (const id in ROAD_NODES) {
      const node = ROAD_NODES[id];
      node.connections.forEach((connId) => {
        const next = ROAD_NODES[connId];
        if (next && node.type !== "highway" && next.type !== "highway") {
          // Draw dashes along the road
          const dx = next.x - node.x;
          const dy = next.y - node.y;
          const len = Math.hypot(dx, dy);
          const steps = Math.floor(len / 28);
          for (let s = 0; s < steps; s += 2) {
            const t0 = s / steps;
            const t1 = Math.min((s + 1) / steps, 1);
            graphics.beginPath();
            graphics.moveTo(node.x + dx * t0, node.y + dy * t0);
            graphics.lineTo(node.x + dx * t1, node.y + dy * t1);
            graphics.strokePath();
          }
        }
      });
    }

    // Highways — wide yellow surface
    graphics.lineStyle(52, 0xc49a10, 1);
    for (const id in ROAD_NODES) {
      const node = ROAD_NODES[id];
      node.connections.forEach((connId) => {
        const next = ROAD_NODES[connId];
        if (next && (node.type === "highway" || next.type === "highway")) {
          graphics.beginPath();
          graphics.moveTo(node.x, node.y);
          graphics.lineTo(next.x, next.y);
          graphics.strokePath();
        }
      });
    }
    // Highway tarmac
    graphics.lineStyle(44, 0x3a3a3a, 1);
    for (const id in ROAD_NODES) {
      const node = ROAD_NODES[id];
      node.connections.forEach((connId) => {
        const next = ROAD_NODES[connId];
        if (next && (node.type === "highway" || next.type === "highway")) {
          graphics.beginPath();
          graphics.moveTo(node.x, node.y);
          graphics.lineTo(next.x, next.y);
          graphics.strokePath();
        }
      });
    }

    // Bridges
    BRIDGES.forEach((b) => {
      graphics.fillStyle(0x6a6252, 1);
      graphics.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
      graphics.lineStyle(3, 0xdddddd, 0.7);
      graphics.strokeRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
      // Bridge railings
      graphics.lineStyle(2, 0xaaaaaa, 0.5);
      graphics.beginPath();
      graphics.moveTo(b.x - b.width / 2, b.y - b.height / 2 + 4);
      graphics.lineTo(b.x + b.width / 2, b.y - b.height / 2 + 4);
      graphics.strokePath();
      graphics.beginPath();
      graphics.moveTo(b.x - b.width / 2, b.y + b.height / 2 - 4);
      graphics.lineTo(b.x + b.width / 2, b.y + b.height / 2 - 4);
      graphics.strokePath();
    });

    // Toll plazas
    TOLL_PLAZAS.forEach((t) => {
      graphics.fillStyle(0x8b7e66, 1);
      graphics.fillRect(t.x - t.width / 2, t.y - t.height / 2, t.width, t.height);
      graphics.fillStyle(0xff4444, 1);
      graphics.fillCircle(t.x - t.width / 4, t.y, 4);
      graphics.fillStyle(0x44cc44, 1);
      graphics.fillCircle(t.x + t.width / 4, t.y, 4);
    });

    // Railway tracks
    graphics.lineStyle(8, 0x3a3028, 1);
    graphics.beginPath();
    graphics.moveTo(0, 800);
    graphics.lineTo(1200, 800);
    graphics.lineTo(1600, 950);
    graphics.lineTo(2400, 1150);
    graphics.lineTo(3300, 1000);
    graphics.strokePath();
    // Rail surface
    graphics.lineStyle(3, 0xcccccc, 1);
    graphics.beginPath();
    graphics.moveTo(0, 800);
    graphics.lineTo(1200, 800);
    graphics.lineTo(1600, 950);
    graphics.lineTo(2400, 1150);
    graphics.lineTo(3300, 1000);
    graphics.strokePath();
  }

  private drawCityBuildings() {
    this.buildingsGroup = this.physics.add.group();
    BUILDINGS.forEach((b) => {
      const g = this.add.graphics();
      const wallColor = b.color || 0x778899;

      g.fillStyle(wallColor, 1);
      g.fillRect(-b.width / 2, -b.height / 2, b.width, b.height);
      g.lineStyle(2, 0x000000, 0.6);
      g.strokeRect(-b.width / 2, -b.height / 2, b.width, b.height);

      g.x = b.x;
      g.y = b.y;

      // Add to group as immovable dynamic body
      this.buildingsGroup.add(g);
      const body = g.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setSize(b.width, b.height);
        body.setOffset(-b.width / 2, -b.height / 2);
        body.setImmovable(true);
      }

      this.optimizationSystem.registerStaticObject(b.x, b.y, b.width, b.height, g);
    });
  }

  // ─── Vehicle rams a PLAYER ──────────────────────────────────────────────────
  // Called by the vehiclesPhysicsGroup ↔ playerSprite overlap.
  // • If the player IS the driver of THAT vehicle → no damage.
  // • If this is an NPC traffic vehicle → cap damage so player can't be one-shot.
  // • If a PLAYER is driving this vehicle and hits the OTHER player → partial damage.
  private handleVehicleRamPlayer(vehicleSprite: any, playerSprite: any) {
    const vehicle = vehicleSprite.getData("vehicleClass") as Vehicle;
    if (!vehicle || vehicle.isWrecked) return;

    // Determine which player was hit
    let hitPlayer = this.player;
    if (this.player2 && playerSprite === this.player2.sprite) hitPlayer = this.player2;

    // Don't hurt the player who is driving/riding THIS vehicle
    if (hitPlayer.isDriving && hitPlayer.currentVehicle === vehicle) return;
    if (hitPlayer.isDriving) return; // protected inside their own car

    const speed = Math.abs(vehicle.speed);
    if (speed < 60) return; // too slow to do damage

    // Cooldown per vehicle so it can't spam damage
    const now = this.time.now;
    const lastHit = vehicleSprite.getData("lastPlayerHit") || 0;
    if (now - lastHit < 1200) return;
    vehicleSprite.setData("lastPlayerHit", now);

    if (vehicle.isNpcTraffic) {
      // NPC car: cap at 20 hp so player can survive several hits
      const dmg = Math.min(20, Math.floor(speed * 0.12));
      hitPlayer.takeDamage(dmg);
      this.cameras.main.shake(120, 0.005);
      this.showCrimeBanner(`NPC car hit you! -${dmg} HP`);
    } else {
      // Player-driven vehicle rams the other player: partial damage
      const dmg = Math.min(25, Math.floor(speed * 0.1));
      hitPlayer.takeDamage(dmg);
      this.cameras.main.shake(150, 0.007);
      this.showCrimeBanner(`Ram! -${dmg} HP`);
    }
  }

  // ─── Vehicle runs over an NPC pedestrian ─────────────────────────────────────
  private handleVehicleRamNPC(vehicleSprite: any, npcSprite: any) {
    const vehicle = vehicleSprite.getData("vehicleClass") as Vehicle;
    if (!vehicle || vehicle.isWrecked) return;
    if (Math.abs(vehicle.speed) < 70) return;

    const npc = npcSprite.getData("npcClass");
    if (!npc) return;

    // Kill the NPC
    const vis = npcSprite.getData("visualSprite");
    if (vis && vis.active) vis.destroy();
    npcSprite.destroy();
    this.spawnSystem.spawnedNPCs.delete(npc.id);
    this.handlePedestrianRunOver();
  }

  private handlePlayerVehicleCollision(playerSprite: any, vehicleSprite: any) {
    // Legacy — now handled by handleVehicleRamPlayer overlap above
  }

  private setupMinimapLocations() {
    this.minimapSystem.addLocationBlip("nav_safehouse", 460, 1125, 0x39b6ff, "Safehouse");
    this.minimapSystem.addLocationBlip("nav_gun", 100, 1500, 0xff4d4d, "Gun Shop");
    this.minimapSystem.addLocationBlip("nav_police_station", 150, 1375, 0x0000ff, "Police");
    this.minimapSystem.addLocationBlip("ind_police_hq", 2300, 1125, 0x0000ff, "Police HQ");
    this.minimapSystem.addLocationBlip("ban_lighthouse", 3540, 625, 0xffd700, "Lighthouse");
  }

  // --- Bullet actions ---

  public fireBullet(x: number, y: number, angle: number, isHostile: boolean) {
    const bullet = this.bullets.get(x, y);

    if (bullet) {
      bullet.setActive(true);
      bullet.setVisible(true);
      
      const graphics = this.add.graphics();
      graphics.fillStyle(isHostile ? 0xff3333 : 0xffd700, 1);
      graphics.fillCircle(0, 0, 3);
      bullet.setTexture(graphics.generateTexture(`b_${Date.now()}`, 6, 6) as any);
      graphics.destroy();

      bullet.body.reset(x, y);
      
      const speed = 600;
      bullet.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      bullet.isHostile = isHostile;

      // Trigger panic for nearby NPCs
      this.spawnSystem.spawnedNPCs.forEach((npc: any) => {
        const dist = Math.hypot(npc.sprite.x - x, npc.sprite.y - y);
        if (dist < 300) {
          npc.triggerPanic(x, y);
        }
      });
    }
  }

  // --- Collisions callbacks ---

  private handleBulletHitPlayer(bullet: any, playerSprite: any) {
    if (!bullet.active) return;

    const isCoop = this.registry.get("isCoop");
    const hitPlayer = (this.player2 && playerSprite === this.player2.sprite) ? this.player2 : this.player;

    // Hostile bullets (from cops) always hurt players
    if (bullet.isHostile) {
      bullet.setActive(false);
      bullet.setVisible(false);
      hitPlayer.takeDamage(12);
      this.cameras.main.shake(100, 0.005);
      return;
    }

    // Player bullets: in co-op, friendly fire is allowed (hurts the OTHER player)
    if (isCoop) {
      // Don't self-damage — only hit the other player
      const shootingPlayer = (hitPlayer === this.player) ? this.player2 : this.player;
      if (shootingPlayer && !hitPlayer.isWasted) {
        bullet.setActive(false);
        bullet.setVisible(false);
        hitPlayer.takeDamage(15);
        this.cameras.main.shake(80, 0.004);
        this.showCrimeBanner(`Friendly Fire! -15 HP`);
      }
    }
  }

  private handleBulletHitNPC(bullet: any, npcSprite: any) {
    if (!bullet.active || bullet.isHostile) return;

    bullet.setActive(false);
    bullet.setVisible(false);

    const npc = npcSprite.getData("npcClass");
    if (npc) {
      const vis = npcSprite.getData("visualSprite");
      if (vis && vis.active) vis.destroy();
      npcSprite.destroy();
      this.spawnSystem.spawnedNPCs.delete(npc.id);

      this.wantedLevel = Math.min(6, this.wantedLevel + 1);
      this.wantedTimer = 0;
      this.score += 100;
      this.cash += 50;
      this.showCrimeBanner("Pedestrian Shot! Wanted Level Increased.");
    }
  }

  private handleBulletHitCop(bullet: any, copSprite: any) {
    if (!bullet.active || bullet.isHostile) return;

    bullet.setActive(false);
    bullet.setVisible(false);

    // Find the cop object
    const cop = this.policeSystem.spawnedCops.find((c: any) => c.sprite === copSprite);
    if (cop) {
      cop.health -= 20;
      if (cop.health <= 0) {
        const vis = copSprite.getData("visualSprite");
        if (vis && vis.active) vis.destroy();
        copSprite.destroy();
        this.policeSystem.spawnedCops = this.policeSystem.spawnedCops.filter((c: any) => c !== cop);
        this.wantedLevel = Math.min(6, this.wantedLevel + 2);
        this.wantedTimer = 0;
        this.showCrimeBanner("Officer Down! Maximum Alert!");
      }
    }
  }

  private handlePedestrianRunOver() {
    this.score += 50;
    this.cash += 50;
    this.wantedLevel = Math.min(6, this.wantedLevel + 1);
    this.wantedTimer = 0;
    
    this.showCrimeBanner("Wasted Civilian! Police Alerted.");
    this.cameras.main.shake(200, 0.008);
  }

  private showCrimeBanner(text: string) {
    const banner = this.add.text(this.scale.width / 2, 80, text, {
      fontFamily: "Rajdhani, sans-serif",
      fontSize: "24px",
      color: "#ffc450",
      backgroundColor: "rgba(0,0,0,0.85)",
      padding: { x: 20, y: 10 }
    });
    banner.setOrigin(0.5);
    banner.setScrollFactor(0); // Lock to HUD layer
    
    // Ignore in minimap
    this.minimapSystem.minimapCamera.ignore(banner);

    this.time.delayedCall(3000, () => {
      banner.destroy();
    });
  }

  public handlePlayerWasted(wastedPlayer: Player) {
    if (wastedPlayer.isWasted) return;
    wastedPlayer.isWasted = true;

    if (this.storyManager) {
      this.storyManager.failMission();
    }

    // Freeze player velocities
    const body = wastedPlayer.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setVelocity(0, 0);
      body.setAcceleration(0, 0);
    }

    // Camera feedback: red flash and heavy shake
    this.cameras.main.shake(600, 0.015);
    this.cameras.main.flash(800, 200, 0, 0, false);

    // Render red "PLAYER X WASTED" banner across the viewport
    const bannerText = wastedPlayer.playerIndex === 1 ? "PLAYER 1 WASTED" : "PLAYER 2 WASTED";
    const wastedBg = this.add.graphics();
    wastedBg.fillStyle(0x000000, 0.75);
    wastedBg.fillRect(0, this.scale.height / 2 - 60, this.scale.width, 120);
    wastedBg.setScrollFactor(0);
    this.minimapSystem.minimapCamera.ignore(wastedBg);

    const wastedText = this.add.text(this.scale.width / 2, this.scale.height / 2, bannerText, {
      fontFamily: "Anton, Arial Black, sans-serif",
      fontSize: "52px",
      color: "#ff3333",
      stroke: "#000000",
      strokeThickness: 8
    });
    wastedText.setOrigin(0.5);
    wastedText.setScrollFactor(0);
    this.minimapSystem.minimapCamera.ignore(wastedText);

    // Clear police alerts if both players are wasted
    const bothWasted = this.player.isWasted && (!this.player2 || this.player2.isWasted);
    if (bothWasted) {
      this.wantedLevel = 0;
      this.policeSystem.clearAll();
    }

    // Trigger fade out to black and teleport to closest hospital
    const px = wastedPlayer.sprite.x;
    const py = wastedPlayer.sprite.y;

    this.time.delayedCall(2200, () => {
      this.cameras.main.fade(800, 0, 0, 0, false, (camera: any, progress: number) => {
        if (progress === 1) {
          // Identify closest hospital for respawn
          const hospitals = [
            { x: 770, y: 1700 },   // Navapur Community Hospital
            { x: 2600, y: 1200 },  // Indrapuri General Hospital
            { x: 3230, y: 1700 }   // Bandarkhali Port Hospital
          ];
          
          let closestHospital = hospitals[0];
          let minDist = Infinity;
          hospitals.forEach((h) => {
            const dist = Math.hypot(h.x - px, h.y - py);
            if (dist < minDist) {
              minDist = dist;
              closestHospital = h;
            }
          });

          // Force-exit any vehicle before respawn so player is on foot
          if (wastedPlayer.isDriving && wastedPlayer.currentVehicle) {
            wastedPlayer.currentVehicle.exit(wastedPlayer);
            wastedPlayer.isDriving = false;
            wastedPlayer.currentVehicle = null;
          }

          // Teleport player & restore parameters
          wastedPlayer.respawn();
          wastedPlayer.sprite.x = closestHospital.x;
          wastedPlayer.sprite.y = closestHospital.y;
          if (wastedPlayer.spriteImg) {
            wastedPlayer.spriteImg.x = closestHospital.x;
            wastedPlayer.spriteImg.y = closestHospital.y;
          }

          // Clean up wasted elements
          wastedBg.destroy();
          wastedText.destroy();

          // Fade viewport back in
          this.cameras.main.fadeIn(800);
        }
      });
    });
  }

  private setupDynamicJsonTriggers() {
    const mapData = this.cache.json.get('worldMapData');
    if (!mapData) return;

    // Parse dynamic map zones
    mapData.regions?.forEach((region: any) => {
      console.log(`Initialized Region: ${region.name} [ID: ${region.id}]`);
    });

    // Generate static locations trigger interaction volumes (scaled from 20000x10000 JSON to 4000x2500 physics world)
    mapData.static_locations?.forEach((loc: any) => {
      const sx = loc.coordinates.x / 5;
      const sy = loc.coordinates.y / 4;
      const radius = loc.interaction_radius / 4;
      
      const zone = this.add.zone(sx, sy, radius * 2, radius * 2);
      this.physics.add.existing(zone, true);
      zone.setData('location_id', loc.id);
      zone.setData('name', loc.name);
      zone.setData('type', loc.type);

      this.physics.add.overlap(this.player.sprite, zone, () => {
        const timeNow = this.time.now;
        const lastAlert = zone.getData('lastAlert') || 0;
        if (!this.player.isWasted && timeNow - lastAlert > 4000) {
          zone.setData('lastAlert', timeNow);
          this.showCrimeBanner(`Entering: ${loc.name}`);
        }
      }, undefined, this);
    });

    // Generate mission activation triggers (scaled from 20000x10000 JSON to 4000x2500 physics world)
    mapData.mission_triggers?.forEach((trigger: any) => {
      const sx = trigger.activation_coordinates.x / 5;
      const sy = trigger.activation_coordinates.y / 4;
      const radius = trigger.activation_radius / 4;
      
      const zone = this.add.zone(sx, sy, radius * 2, radius * 2);
      this.physics.add.existing(zone, true);
      zone.setData('mission_id', trigger.mission_id);
      zone.setData('name', trigger.mission_name);

      this.physics.add.overlap(this.player.sprite, zone, () => {
        const timeNow = this.time.now;
        const lastAlert = zone.getData('lastAlert') || 0;
        if (!this.player.isWasted && timeNow - lastAlert > 4000) {
          zone.setData('lastAlert', timeNow);
          this.showCrimeBanner(`Mission Point: ${trigger.mission_name}`);
        }
      }, undefined, this);
    });
  }
}
