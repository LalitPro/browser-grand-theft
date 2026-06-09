import Phaser from "phaser";

export interface PatrolRoute {
  stationId: string;
  name: string;
  waypoints: { x: number; y: number }[];
}

export class PoliceSystem {
  private scene: any;
  public spawnedCops: any[] = [];
  private spawnCooldown = 0;
  private patrolRoutes: PatrolRoute[] = [
    {
      stationId: "nav_police",
      name: "Navapur Patrol Route",
      waypoints: [
        { x: 150, y: 1375 },
        { x: 300, y: 1000 },
        { x: 900, y: 1000 },
        { x: 900, y: 1850 },
        { x: 300, y: 1850 }
      ]
    },
    {
      stationId: "ind_police_hq",
      name: "Indrapuri Downtown Patrol",
      waypoints: [
        { x: 2300, y: 1125 },
        { x: 2600, y: 1250 },
        { x: 3200, y: 1350 },
        { x: 3000, y: 1750 },
        { x: 2500, y: 1750 }
      ]
    },
    {
      stationId: "ban_police",
      name: "Bandarkhali Harbor Patrol",
      waypoints: [
        { x: 2900, y: 625 },
        { x: 3500, y: 600 },
        { x: 3500, y: 850 },
        { x: 3500, y: 1200 },
        { x: 3800, y: 1200 }
      ]
    }
  ];

  constructor(scene: any) {
    this.scene = scene;
  }

  public update(playerX: number, playerY: number, wantedLevel: number, dt: number) {
    // 1. Maintain regular patrol units if wantedLevel is 0
    if (wantedLevel === 0) {
      this.updatePatrols(dt);
      this.clearPursuitUnits();
      return;
    }

    // 2. Wanted Level Chase Logic
    this.updateChase(wantedLevel, dt);
  }

  private updatePatrols(dt: number) {
    // Spawn 1 patrol unit per route if not already spawned
    this.patrolRoutes.forEach((route) => {
      const activePatrol = this.spawnedCops.find(
        (c) => c.routeId === route.stationId && c.mode === "patrol"
      );

      if (!activePatrol) {
        this.spawnPatrolUnit(route);
      }
    });

    // Move patrol units along waypoints using physics velocities
    this.spawnedCops.forEach((cop) => {
      if (cop.mode !== "patrol") return;

      const target = routeTarget(cop, this.patrolRoutes);
      const dist = Math.hypot(target.x - cop.sprite.x, target.y - cop.sprite.y);
      const body = cop.sprite.body as Phaser.Physics.Arcade.Body;

      if (dist < 20) {
        // Next waypoint
        cop.waypointIndex = (cop.waypointIndex + 1) % target.total;
        if (body) body.setVelocity(0, 0);
      } else {
        // Steer towards waypoint
        const angle = Math.atan2(target.y - cop.sprite.y, target.x - cop.sprite.x);
        cop.sprite.rotation = angle + Math.PI / 2;
        if (body) {
          body.setVelocity(Math.cos(angle) * 110, Math.sin(angle) * 110);
        }
      }
    });
  }

  private spawnPatrolUnit(route: PatrolRoute) {
    const start = route.waypoints[0];
    const sprite = this.scene.add.graphics();
    sprite.fillStyle(0x2d54c8, 1); // police blue
    sprite.fillCircle(0, 0, 7);
    sprite.fillStyle(0xffffff, 1); // cap/badge
    sprite.fillRect(-2, -6, 4, 3);
    
    sprite.x = start.x;
    sprite.y = start.y;

    this.scene.copsPhysicsGroup.add(sprite);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(7, -7, -7);
    }

    this.spawnedCops.push({
      routeId: route.stationId,
      mode: "patrol",
      waypointIndex: 0,
      sprite,
      health: 50
    });
  }

  private updateChase(wanted: number, dt: number) {
    this.spawnCooldown -= dt;

    // Remove any peaceful patrol units
    this.spawnedCops = this.spawnedCops.filter((cop) => {
      if (cop.mode === "patrol") {
        cop.sprite.destroy();
        return false;
      }
      return true;
    });

    const maxCopSpawns = wanted * 2;
    const activeChasers = this.spawnedCops.length;

    const p1 = this.scene.player;
    const p2 = this.scene.player2;

    // If both players are dead/wasted, stop chases
    const allPlayersWasted = p1.isWasted && (!p2 || p2.isWasted);

    // Spawn new units if cooldown is finished and players are active
    if (activeChasers < maxCopSpawns && this.spawnCooldown <= 0 && !allPlayersWasted) {
      this.spawnCooldown = 4.5 - wanted * 0.5; // faster spawns at high levels
      
      // Determine coordinates near the primary active player to spawn
      let spawnTarget = p1;
      if (p2 && !p2.isWasted && (p1.isWasted || Math.random() < 0.5)) {
        spawnTarget = p2;
      }
      this.spawnChaserUnit(spawnTarget.sprite.x, spawnTarget.sprite.y, wanted);
    }

    // Move chase units towards the closest active player
    this.spawnedCops.forEach((cop) => {
      if (allPlayersWasted) {
        const body = cop.sprite.body as Phaser.Physics.Arcade.Body;
        if (body) body.setVelocity(0, 0);
        return;
      }

      // Identify closest active player
      let targetPlayer = p1;
      let minDist = Math.hypot(p1.sprite.x - cop.sprite.x, p1.sprite.y - cop.sprite.y);

      if (p2 && !p2.isWasted) {
        const dist2 = Math.hypot(p2.sprite.x - cop.sprite.x, p2.sprite.y - cop.sprite.y);
        if (p1.isWasted || dist2 < minDist) {
          targetPlayer = p2;
          minDist = dist2;
        }
      }

      const tx = targetPlayer.sprite.x;
      const ty = targetPlayer.sprite.y;
      const dist = minDist;
      const angle = Math.atan2(ty - cop.sprite.y, tx - cop.sprite.x);

      let chaseSpeed = 160 + wanted * 15;
      if (cop.type === "cruiser") chaseSpeed = 240 + wanted * 20;
      if (cop.type === "apc") chaseSpeed = 280 + wanted * 25;

      cop.sprite.rotation = angle + Math.PI / 2;

      // Move via physics velocities
      const body = cop.sprite.body as Phaser.Physics.Arcade.Body;
      if (body) {
        if (dist > 50) {
          body.setVelocity(Math.cos(angle) * chaseSpeed, Math.sin(angle) * chaseSpeed);
        } else {
          body.setVelocity(0, 0);
        }
      }

      // Shoot or Ram
      if (cop.type === "cruiser" || cop.type === "apc") {
        // Ramming deals impact damage, handled in WorldScene collider callback
      } else {
        // Foot officer / SWAT shoots bullets
        cop.shootCd = (cop.shootCd || 0) - dt;
        if (dist < 400 && cop.shootCd <= 0 && !targetPlayer.isWasted) {
          cop.shootCd = wanted >= 4 ? 0.6 : 1.6; // Faster shooting rate for SWAT
          this.scene.fireBullet(cop.sprite.x, cop.sprite.y, angle, true);
        }
      }
    });

    // Cleanup dead or extremely far units
    this.spawnedCops = this.spawnedCops.filter((cop) => {
      // Clean based on closest player
      let minDist = Math.hypot(p1.sprite.x - cop.sprite.x, p1.sprite.y - cop.sprite.y);
      if (p2) {
        minDist = Math.min(minDist, Math.hypot(p2.sprite.x - cop.sprite.x, p2.sprite.y - cop.sprite.y));
      }

      if (minDist > 1800) {
        cop.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  private spawnChaserUnit(px: number, py: number, wanted: number) {
    const ang = Math.random() * 6.28;
    const spawnX = px + Math.cos(ang) * 650;
    const spawnY = py + Math.sin(ang) * 650;

    const sprite = this.scene.add.graphics();
    let type = "officer";

    if (wanted === 6 && Math.random() < 0.5) {
      // Spawn military SWAT APC tank
      type = "apc";
      sprite.fillStyle(0x2f4f4f, 1); // Dark slate grey armor
      sprite.fillRect(-14, -24, 28, 48); // Big heavy box
      sprite.fillStyle(0x111111, 1); // big treads/tires
      sprite.fillRect(-16, -20, 2, 40);
      sprite.fillRect(14, -20, 2, 40);
      sprite.fillStyle(0x1a1a1a, 1); // turret
      sprite.fillCircle(0, 0, 10);
      sprite.fillStyle(0x000000, 1); // cannon barrel
      sprite.fillRect(-3, -18, 6, 10);
      
      // Siren flashing lights
      sprite.fillStyle(0xff0000, 1); // red
      sprite.fillRect(-4, -6, 4, 3);
      sprite.fillStyle(0x0000ff, 1); // blue
      sprite.fillRect(0, -6, 4, 3);
    } else if (wanted >= 3 && Math.random() < 0.6) {
      // Spawn Police Cruiser car
      type = "cruiser";
      sprite.fillStyle(0x111111, 1); // black base
      sprite.fillRect(-10, -18, 20, 36);
      sprite.fillStyle(0xffffff, 1); // white roof
      sprite.fillRect(-8, -8, 16, 16);
      sprite.fillStyle(0xff0000, 1); // red siren
      sprite.fillRect(-3, -3, 3, 4);
      sprite.fillStyle(0x0000ff, 1); // blue siren
      sprite.fillRect(0, -3, 3, 4);
    } else {
      // Spawn standard officer or SWAT trooper
      const isSWAT = wanted >= 4;
      sprite.fillStyle(isSWAT ? 0x1c1c1c : 0x2d54c8, 1); // SWAT black or standard blue
      sprite.fillCircle(0, 0, 7);
      sprite.fillStyle(0xffd39b, 1); // face
      sprite.fillCircle(3, 0, 3);
      sprite.fillStyle(0x111111, 1); // gun
      sprite.fillRect(6, -2, 8, 3);
    }

    sprite.x = spawnX;
    sprite.y = spawnY;

    this.scene.copsPhysicsGroup.add(sprite);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      if (type === "apc") {
        body.setSize(28, 48);
        body.setOffset(-14, -24);
      } else if (type === "cruiser") {
        body.setSize(20, 36);
        body.setOffset(-10, -18);
      } else {
        body.setCircle(7, -7, -7);
      }
      body.setCollideWorldBounds(true);
    }

    this.spawnedCops.push({
      mode: "chase",
      type,
      sprite,
      shootCd: Math.random() * 2,
      health: type === "apc" ? 250 : (wanted >= 4 ? 80 : 50)
    });
  }

  private clearPursuitUnits() {
    this.spawnedCops = this.spawnedCops.filter((cop) => {
      if (cop.mode === "chase") {
        cop.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  public clearAll() {
    this.spawnedCops.forEach((cop) => cop.sprite.destroy());
    this.spawnedCops = [];
  }
}

function routeTarget(cop: any, routes: PatrolRoute[]) {
  const route = routes.find((r) => r.stationId === cop.routeId)!;
  return {
    x: route.waypoints[cop.waypointIndex].x,
    y: route.waypoints[cop.waypointIndex].y,
    total: route.waypoints.length
  };
}
