import Phaser from "phaser";
import { DISTRICTS, District } from "../data/districts";
import { CollisionSystem } from "./CollisionSystem";
import { NPC } from "../entities/NPC";
import { Vehicle } from "../entities/Vehicle";
import { SHEET_KEYS, CHAR_ROWS, getCharFrame, getVehicleFrame } from "./AssetLoader";

export class SpawnSystem {
  private scene: any;
  private collisionSystem: CollisionSystem;
  public spawnedNPCs: Map<string, NPC> = new Map();
  public spawnedVehicles: Map<string, Vehicle> = new Map();
  private lastUpdate = 0;
  private updateInterval = 1000; // spawn checks every second

  constructor(scene: any, collisionSystem: CollisionSystem) {
    this.scene = scene;
    this.collisionSystem = collisionSystem;
  }

  public update(playerX: number, playerY: number, time: number) {
    if (time - this.lastUpdate < this.updateInterval) return;
    this.lastUpdate = time;

    // 1. Despawn far entities
    this.despawnFarEntities(playerX, playerY);

    // 2. Perform spawn ticks for each district
    for (const districtId in DISTRICTS) {
      const dist = DISTRICTS[districtId];
      
      // Calculate player distance to district center
      const centerX = dist.bounds.x + dist.bounds.width / 2;
      const centerY = dist.bounds.y + dist.bounds.height / 2;
      const distToPlayer = Math.hypot(playerX - centerX, playerY - centerY);

      // Only spawn inside or near active districts (within 1200px)
      if (distToPlayer < 1200) {
        this.spawnTickForDistrict(dist);
      }
    }
  }

  private spawnTickForDistrict(dist: District) {
    // Count active spawns in this district
    let npcCount = 0;
    let vehicleCount = 0;

    this.spawnedNPCs.forEach((n) => { if (n.districtId === dist.id) npcCount++; });
    this.spawnedVehicles.forEach((v) => { if (v.districtId === dist.id) vehicleCount++; });

    // Maximum limits scaled by district bounds and densities
    const areaFactor = (dist.bounds.width * dist.bounds.height) / 100000; // area in 100k px units
    const maxNPCs = Math.floor(areaFactor * dist.density.npc * 4);
    const maxVehicles = Math.floor(areaFactor * dist.density.vehicle * 2);

    // Spawn NPCs
    if (npcCount < maxNPCs) {
      this.spawnNPCInDistrict(dist);
    }

    // Spawn Vehicles
    if (vehicleCount < maxVehicles) {
      this.spawnVehicleInDistrict(dist);
    }
  }

  private spawnNPCInDistrict(dist: District) {
    const rx = dist.bounds.x + Math.random() * dist.bounds.width;
    const ry = dist.bounds.y + Math.random() * dist.bounds.height;

    if (this.collisionSystem.collides(rx, ry, 8)) return;

    const npcType = dist.allowedNPCs[Math.floor(Math.random() * dist.allowedNPCs.length)];
    const id = `npc_${dist.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Invisible physics container
    const graphics = this.scene.add.graphics();
    graphics.x = rx;
    graphics.y = ry;

    this.scene.npcsPhysicsGroup.add(graphics);
    const body = graphics.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(7, -7, -7);
      body.setCollideWorldBounds(true);
    }

    // Visible spritesheet image on top
    const texturesLoaded = this.scene.textures.exists(SHEET_KEYS.CHARACTERS);
    if (texturesLoaded) {
      // Pick starting frame for this NPC type (south-facing, col 0)
      const frameIndex = (CHAR_ROWS[npcType] ?? CHAR_ROWS["resident"]) * 10;
      const img = this.scene.add.sprite(rx, ry, SHEET_KEYS.CHARACTERS, frameIndex);
      img.setScale(0.5);
      img.setDepth(3);
      graphics.setData("visualSprite", img);
      graphics.setData("charType", npcType); // store for directional frame update
    } else {
      // Fallback procedural
      const colors: Record<string, number> = {
        market_vendor: 0xffaa00, resident: 0xe2c08d, worker: 0xcd853f,
        tourist: 0x00bfff, shopper: 0xff69b4, student: 0x98fb98,
        office_worker: 0x3a4f6a, factory_worker: 0x708090,
        dock_worker: 0xff7f24, truck_driver: 0x8b6508
      };
      graphics.fillStyle(colors[npcType] || 0xffffff, 1);
      graphics.fillCircle(0, 0, 7);
    }

    const npc = new NPC(this.scene, graphics, npcType);
    graphics.setData('npcClass', npc);
    npc.id = id;
    npc.districtId = dist.id;
    npc.x = rx;
    npc.y = ry;

    this.spawnedNPCs.set(id, npc);
  }

  private spawnVehicleInDistrict(dist: District) {
    const rx = dist.bounds.x + Math.random() * dist.bounds.width;
    const ry = dist.bounds.y + Math.random() * dist.bounds.height;

    if (this.collisionSystem.collides(rx, ry, 16)) return;

    const vehicleType = dist.allowedVehicles[Math.floor(Math.random() * dist.allowedVehicles.length)];
    const id = `veh_${dist.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Invisible physics container
    const graphics = this.scene.add.graphics();
    graphics.x = rx;
    graphics.y = ry;

    this.scene.vehiclesPhysicsGroup.add(graphics);
    const body = graphics.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setSize(24, 40);
      body.setCollideWorldBounds(true);
    }

    // Visible spritesheet image on top
    const texturesLoaded = this.scene.textures.exists(SHEET_KEYS.VEHICLES);
    if (texturesLoaded) {
      const frameIndex = getVehicleFrame(vehicleType, 2); // col 2 = front-on look
      const img = this.scene.add.sprite(rx, ry, SHEET_KEYS.VEHICLES, frameIndex);
      img.setScale(0.38);
      img.setDepth(2);
      graphics.setData("visualSprite", img);
      graphics.setData("vehicleType", vehicleType);
    } else {
      // Fallback procedural
      const colors = [0xd8c24a, 0x46b1c9, 0x5cc46a, 0xc9603f, 0x3355ff, 0xff3355, 0x222222, 0xeeeeee];
      const color = colors[Math.floor(Math.random() * colors.length)];
      graphics.fillStyle(color, 1);
      if (vehicleType === "bike" || vehicleType === "scooter") {
        graphics.fillRect(-4, -12, 8, 24);
      } else if (vehicleType === "auto") {
        graphics.fillStyle(0xffd700, 1);
        graphics.fillRect(-8, -10, 16, 20);
      } else {
        graphics.fillRect(-10, -18, 20, 36);
      }
    }

    const vehicle = new Vehicle(this.scene, graphics, true);
    vehicle.id = id;
    vehicle.configureHandling(vehicleType);
    vehicle.districtId = dist.id;
    vehicle.x = rx;
    vehicle.y = ry;

    this.spawnedVehicles.set(id, vehicle);
  }

  private despawnFarEntities(playerX: number, playerY: number) {
    const despawnRange = 1500;

    this.spawnedNPCs.forEach((npc, id) => {
      const dist = Math.hypot(playerX - npc.sprite.x, playerY - npc.sprite.y);
      if (dist > despawnRange) {
        const vis = npc.sprite.getData("visualSprite");
        if (vis) vis.destroy();
        npc.sprite.destroy();
        this.spawnedNPCs.delete(id);
      }
    });

    this.spawnedVehicles.forEach((veh, id) => {
      const dist = Math.hypot(playerX - veh.sprite.x, playerY - veh.sprite.y);
      if (dist > despawnRange) {
        const vis = veh.sprite.getData("visualSprite");
        if (vis) vis.destroy();
        veh.sprite.destroy();
        this.spawnedVehicles.delete(id);
      }
    });
  }

  public clearAll() {
    this.spawnedNPCs.forEach((n) => n.sprite.destroy());
    this.spawnedNPCs.clear();
    this.spawnedVehicles.forEach((v) => v.sprite.destroy());
    this.spawnedVehicles.clear();
  }
}
