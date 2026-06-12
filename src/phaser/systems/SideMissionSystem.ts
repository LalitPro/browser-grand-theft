import Phaser from "phaser";

interface SideMission {
  id: string;
  name: string;
  type: "rampage" | "delivery";
  x: number;
  y: number;
  reward: number;
  // delivery target
  destX?: number;
  destY?: number;
  destName?: string;
  // rampage
  count?: number;
  timeLimit: number;
}

const SIDE_MISSIONS: SideMission[] = [
  {
    id: "S_NAV_RAMPAGE",
    name: "Gali Rampage",
    type: "rampage",
    x: 700,
    y: 1500,
    reward: 12000,
    count: 5,
    timeLimit: 60,
  },
  {
    id: "S_NAV_DELIVERY",
    name: "Tiffin Express",
    type: "delivery",
    x: 460,
    y: 1300,
    destX: 1100,
    destY: 700,
    destName: "Kisanpur Dhaba",
    reward: 9000,
    timeLimit: 70,
  },
  {
    id: "S_IND_RAMPAGE",
    name: "Downtown Takedown",
    type: "rampage",
    x: 2450,
    y: 1300,
    reward: 25000,
    count: 7,
    timeLimit: 70,
  },
  {
    id: "S_IND_DELIVERY",
    name: "VIP Pickup",
    type: "delivery",
    x: 2650,
    y: 1600,
    destX: 3300,
    destY: 1100,
    destName: "Bandarkhali Gate",
    reward: 18000,
    timeLimit: 80,
  },
  {
    id: "S_BAN_RAMPAGE",
    name: "Dock Clearout",
    type: "rampage",
    x: 3400,
    y: 1300,
    reward: 40000,
    count: 8,
    timeLimit: 75,
  },
];

export class SideMissionSystem {
  private scene: any;
  private markers: Map<string, Phaser.GameObjects.Graphics> = new Map();

  public active: SideMission | null = null;
  public objectiveText = "";
  private timeLeft = 0;
  private enemies: any[] = [];
  private destZone: { x: number; y: number } | null = null;
  private cooldown = 0;

  constructor(scene: any) {
    this.scene = scene;
    this.createMarkers();
  }

  private createMarkers() {
    SIDE_MISSIONS.forEach((m) => {
      const g = this.scene.add.graphics();
      g.setDepth(5);
      g.x = m.x;
      g.y = m.y;
      this.markers.set(m.id, g);
      this.scene.minimapSystem?.minimapCamera?.ignore(g);
      this.scene.minimapSystem?.addLocationBlip(`side_${m.id}`, m.x, m.y, 0x22d3ee, m.name);
    });
  }

  public getActiveTarget(): { x: number; y: number } | null {
    if (!this.active) return null;
    if (this.active.type === "delivery" && this.destZone) return this.destZone;
    return { x: this.active.x, y: this.active.y };
  }

  public update(dt: number) {
    const player = this.scene.player;
    if (!player || player.isWasted) return;
    this.cooldown -= dt;

    if (!this.active) {
      // Pulse idle markers; allow starting with T near one (on foot)
      const time = this.scene.time.now;
      let nearMission: SideMission | null = null;
      SIDE_MISSIONS.forEach((m) => {
        const g = this.markers.get(m.id);
        if (!g) return;
        const pulse = 14 + Math.sin(time / 220) * 4;
        g.clear();
        g.lineStyle(2, 0x22d3ee, 0.9);
        g.strokeCircle(0, 0, pulse);
        g.fillStyle(0x22d3ee, 0.18);
        g.fillCircle(0, 0, pulse - 3);
        const dist = Math.hypot(player.sprite.x - m.x, player.sprite.y - m.y);
        if (dist < 40) nearMission = m;
      });

      if (nearMission && this.cooldown <= 0) {
        const nm: SideMission = nearMission;
        this.scene.showCrimeBanner(`Press T for Side Mission: ${nm.name}`);
        const tKey = this.scene.input.keyboard?.addKey("T");
        if (tKey && tKey.isDown) {
          this.start(nm);
        }
      }
      return;
    }

    // Active mission tick
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.fail("Time's up!");
      return;
    }
    const secs = Math.ceil(this.timeLeft);

    if (this.active.type === "rampage") {
      // enemy AI: shoot at player + take bullet damage
      this.enemies.forEach((e) => {
        if (e.health <= 0) return;
        const dist = Math.hypot(player.sprite.x - e.sprite.x, player.sprite.y - e.sprite.y);
        if (dist < 260) {
          e.shootCd -= dt;
          if (e.shootCd <= 0) {
            e.shootCd = 1.3 + Math.random() * 0.7;
            const angle = Math.atan2(player.sprite.y - e.sprite.y, player.sprite.x - e.sprite.x);
            e.sprite.rotation = angle;
            this.scene.fireBullet(e.sprite.x, e.sprite.y, angle, true);
          }
        }
        this.scene.bullets.getChildren().forEach((b: any) => {
          if (b.active && !b.isHostile) {
            const bDist = Math.hypot(b.x - e.sprite.x, b.y - e.sprite.y);
            if (bDist < 16) {
              b.setActive(false);
              b.setVisible(false);
              e.health -= 25;
              if (e.health <= 0) e.sprite.destroy();
            }
          }
        });
      });
      this.enemies = this.enemies.filter((e) => e.health > 0);
      this.objectiveText = `RAMPAGE: ${this.enemies.length} targets left · ${secs}s`;
      if (this.enemies.length === 0) this.complete();
    } else if (this.active.type === "delivery" && this.destZone) {
      this.objectiveText = `DELIVERY to ${this.active.destName} · ${secs}s`;
      const dist = Math.hypot(player.sprite.x - this.destZone.x, player.sprite.y - this.destZone.y);
      if (dist < 45) this.complete();
    }
  }

  private start(m: SideMission) {
    this.active = m;
    this.timeLeft = m.timeLimit;
    this.cooldown = 1;
    this.scene.showCrimeBanner(`SIDE MISSION: ${m.name}`);

    // hide its marker while active
    this.markers.get(m.id)?.clear();
    this.scene.minimapSystem?.removeLocationBlip(`side_${m.id}`);

    if (m.type === "rampage") {
      this.spawnEnemies(m);
    } else if (m.type === "delivery" && m.destX !== undefined && m.destY !== undefined) {
      this.destZone = { x: m.destX, y: m.destY };
      this.scene.minimapSystem?.addLocationBlip("side_dest", m.destX, m.destY, 0x22d3ee, "Drop-off");
    }
  }

  private spawnEnemies(m: SideMission) {
    const count = m.count || 5;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * 6.28;
      const rx = m.x + Math.cos(ang) * (60 + Math.random() * 50);
      const ry = m.y + Math.sin(ang) * (60 + Math.random() * 50);
      const sprite = this.scene.add.graphics();
      sprite.fillStyle(0x9333ea, 1); // purple rival gang
      sprite.fillCircle(0, 0, 7);
      sprite.fillStyle(0x111111, 1);
      sprite.fillRect(6, -2, 8, 3);
      sprite.x = rx;
      sprite.y = ry;
      this.enemies.push({ sprite, health: 60, shootCd: Math.random() * 1.5 });
    }
  }

  private complete() {
    if (!this.active) return;
    this.scene.cash += this.active.reward;
    this.scene.score += Math.floor(this.active.reward / 10);
    this.scene.showCrimeBanner(`SIDE MISSION PASSED (+₹${this.active.reward})`);
    this.cleanup();
  }

  private fail(reason: string) {
    this.scene.showCrimeBanner(`SIDE MISSION FAILED — ${reason}`);
    this.cleanup();
  }

  private cleanup() {
    this.enemies.forEach((e) => e.sprite?.active && e.sprite.destroy());
    this.enemies = [];
    this.destZone = null;
    this.scene.minimapSystem?.removeLocationBlip("side_dest");
    this.objectiveText = "";
    const finished = this.active;
    this.active = null;
    this.cooldown = 2;
    // restore the marker/blip so it can be replayed
    if (finished) {
      const m = SIDE_MISSIONS.find((x) => x.id === finished.id);
      if (m) this.scene.minimapSystem?.addLocationBlip(`side_${m.id}`, m.x, m.y, 0x22d3ee, m.name);
    }
  }

  public destroy() {
    this.cleanup();
    this.markers.forEach((g) => g.destroy());
    this.markers.clear();
  }
}
