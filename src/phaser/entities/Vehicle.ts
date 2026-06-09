import Phaser from "phaser";
import { ROAD_NODES, RoadNode } from "../data/roads";

export class Vehicle {
  private scene: any;
  public sprite: any;
  public id!: string;
  public type!: string;
  public districtId!: string;
  public x = 0;
  public y = 0;
  
  // Handling metrics
  public speed = 0;
  public maxSpeed = 280;
  public accel = 220;
  public drag = 0.98;
  public turnSpeed = 2.6;

  // Occupancy details
  public driver: any = null;
  public passenger: any = null;
  public isOccupied = false;
  
  // Stats & Wrecks
  public health = 100;
  public isWrecked = false;
  
  // Traffic variables
  public isNpcTraffic = false;
  private currentTargetNode: RoadNode | null = null;
  private checkBlockTimer = 0;
  private ramDamageCd = 0;

  constructor(scene: any, sprite: any, isNpcTraffic = false) {
    this.scene = scene;
    this.sprite = sprite;
    this.isNpcTraffic = isNpcTraffic;
    
    // Store reference to class on the physics game object
    this.sprite.setData("vehicleClass", this);

    if (isNpcTraffic) {
      this.findNearestRoadNode();
    }
  }

  // Set per-vehicle handling configurations
  public configureHandling(type: string) {
    this.type = type;
    if (type === "bike" || type === "scooter") {
      this.maxSpeed = 340;
      this.accel = 280;
      this.drag = 0.96;
      this.turnSpeed = 3.4;
    } else if (type === "auto") {
      this.maxSpeed = 150;
      this.accel = 120;
      this.drag = 0.95;
      this.turnSpeed = 4.0; // highly agile turning
    } else if (type === "truck" || type === "heavy_truck") {
      this.maxSpeed = 200;
      this.accel = 140;
      this.drag = 0.97;
      this.turnSpeed = 1.6; // slow, heavy turning
    } else if (type === "sports_car" || type === "luxury_car") {
      this.maxSpeed = 380;
      this.accel = 320;
      this.drag = 0.985;
      this.turnSpeed = 3.0; // responsive performance
    } else {
      // standard car / suv / van
      this.maxSpeed = 270;
      this.accel = 200;
      this.drag = 0.98;
      this.turnSpeed = 2.5;
    }
  }

  public enter(player: any) {
    if (this.isWrecked) return;
    
    if (this.isNpcTraffic) {
      this.scene.wantedLevel = Math.min(6, this.scene.wantedLevel + 1);
      this.scene.wantedTimer = 0;
      this.scene.showCrimeBanner("Grand Theft Auto! Police Alerted.");
    }

    // Slot player into driver's seat first, otherwise passenger seat
    if (!this.driver) {
      this.driver = player;
      this.isOccupied = true;
      this.isNpcTraffic = false;
      this.sprite.body.setCollideWorldBounds(true);
    } else if (!this.passenger) {
      this.passenger = player;
    }
  }

  public exit(player: any) {
    if (this.driver === player) {
      this.driver = null;
      // Passenger steps up to drive if available
      if (this.passenger) {
        this.driver = this.passenger;
        this.passenger = null;
      } else {
        this.isOccupied = false;
        this.speed = 0;
        this.sprite.body.setVelocity(0, 0);
      }
    } else if (this.passenger === player) {
      this.passenger = null;
    }
  }

  public update(keys: any, dt: number) {
    this.ramDamageCd -= dt;

    if (this.isWrecked) {
      this.speed = 0;
      this.sprite.body.setVelocity(0, 0);
      return;
    }

    // Spawn smoke particles if low health
    if (this.health < 45 && Math.random() < 0.2) {
      const angle = this.sprite.rotation - Math.PI / 2;
      this.scene.add.circle(
        this.sprite.x - Math.cos(angle) * 12,
        this.sprite.y - Math.sin(angle) * 12,
        3.5,
        this.health < 20 ? 0x111111 : 0x777777, // black smoke for critical health
        0.5
      );
    }

    if (this.driver) {
      // Driver controls keys (passed from driving Player entity keys mapping)
      const driveKeys = this.driver.keys;
      this.handlePlayerDriving(driveKeys, dt);
    } else if (this.isNpcTraffic) {
      this.handleNpcTraffic(dt);
    } else {
      // Decelerate empty vehicle
      this.speed *= Math.pow(this.drag, dt * 60);
      this.sprite.body.setVelocity(
        Math.cos(this.sprite.rotation - Math.PI / 2) * this.speed,
        Math.sin(this.sprite.rotation - Math.PI / 2) * this.speed
      );
    }

    // Monitor for wall collisions
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const isColliding = body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down ||
                          body.touching.left || body.touching.right || body.touching.up || body.touching.down;
      
      if (isColliding && Math.abs(this.speed) > 90 && this.ramDamageCd <= 0) {
        this.ramDamageCd = 0.8; // cooldown
        const damage = Math.floor(Math.abs(this.speed) * 0.12);
        this.takeDamage(damage);
        this.speed = -this.speed * 0.4; // bounce off slightly
      }
    }
  }

  private handlePlayerDriving(keys: any, dt: number) {
    const isHandbrake = keys.space.isDown; // SPACE for P1 / RIGHT_SHIFT for P2
    
    // 1. Rotation & Steering
    let currentTurnSpeed = this.turnSpeed;
    if (isHandbrake) {
      // Handbrake reduces speed, but allows tighter, driftier turns
      currentTurnSpeed *= 1.6;
    }
    
    if (keys.left.isDown) {
      this.sprite.rotation -= currentTurnSpeed * dt;
    }
    if (keys.right.isDown) {
      this.sprite.rotation += currentTurnSpeed * dt;
    }

    // 2. Acceleration / Drag
    if (keys.up.isDown && !isHandbrake) {
      this.speed += this.accel * dt;
    } else if (keys.down.isDown) {
      this.speed -= this.accel * 0.6 * dt; // brake/reverse
    } else {
      // Deceleration drag
      const currentDrag = isHandbrake ? (this.drag - 0.06) : this.drag;
      this.speed *= Math.pow(currentDrag, dt * 60);
    }

    // Clamping limits
    this.speed = Phaser.Math.Clamp(this.speed, -60, this.maxSpeed);

    // Apply velocity vector
    const angle = this.sprite.rotation - Math.PI / 2;
    this.sprite.body.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed
    );
  }

  private handleNpcTraffic(dt: number) {
    if (!this.currentTargetNode) {
      this.findNearestRoadNode();
      if (!this.currentTargetNode) return;
    }

    this.checkBlockTimer -= dt;
    if (this.checkBlockTimer <= 0) {
      this.checkBlockTimer = 0.2; // Check path blocks 5 times per sec
      if (this.checkFrontBlocked()) {
        this.speed = 0;
        this.sprite.body.setVelocity(0, 0);
        return;
      }
    }

    const target = this.currentTargetNode;
    const dist = Math.hypot(target.x - this.sprite.x, target.y - this.sprite.y);

    if (dist < 30) {
      const nextId = target.connections[Math.floor(Math.random() * target.connections.length)];
      this.currentTargetNode = ROAD_NODES[nextId] || null;
    } else {
      const targetAngle = Math.atan2(target.y - this.sprite.y, target.x - this.sprite.x);
      
      let diff = targetAngle - (this.sprite.rotation - Math.PI / 2);
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.sprite.rotation += diff * 4 * dt;

      this.speed = 75;
      const angle = this.sprite.rotation - Math.PI / 2;
      this.sprite.body.setVelocity(
        Math.cos(angle) * this.speed,
        Math.sin(angle) * this.speed
      );
    }
  }

  public takeDamage(amount: number) {
    if (this.isWrecked) return;
    this.health = Math.max(0, this.health - amount);

    this.scene.cameras.main.shake(150, 0.006);

    if (this.health <= 0) {
      this.explode();
    }
  }

  private explode() {
    this.isWrecked = true;
    this.speed = 0;

    // Trigger visual explosion explosion
    const flash = this.scene.add.circle(this.sprite.x, this.sprite.y, 45, 0xffaa00, 0.85);
    this.scene.time.delayedCall(120, () => flash.destroy());

    // Burnt appearance: clear graphics and draw a charred charcoal box
    this.sprite.clear();
    this.sprite.fillStyle(0x222222, 1);
    this.sprite.fillRect(-10, -18, 20, 36);
    this.sprite.lineStyle(2, 0x111111, 1);
    this.sprite.strokeRect(-10, -18, 20, 36);

    // Inflict lethal shockwave damage to occupants
    if (this.driver) {
      this.driver.takeDamage(100);
    }
    if (this.passenger) {
      this.passenger.takeDamage(100);
    }
  }

  private checkFrontBlocked(): boolean {
    const lookDist = 90;  // lookahead distance in px
    const angle = this.sprite.rotation - Math.PI / 2;
    const fx = this.sprite.x + Math.cos(angle) * lookDist;
    const fy = this.sprite.y + Math.sin(angle) * lookDist;

    const stopRadius = 55; // stop if anything is within this radius of the lookahead point

    // Check Player 1 (both on foot and in vehicle)
    if (this.scene.player) {
      const p1 = this.scene.player;
      const targetX = (p1.isDriving && p1.currentVehicle) ? p1.currentVehicle.sprite.x : p1.sprite.x;
      const targetY = (p1.isDriving && p1.currentVehicle) ? p1.currentVehicle.sprite.y : p1.sprite.y;
      const distToP1 = Math.hypot(targetX - fx, targetY - fy);
      if (distToP1 < stopRadius) return true;
    }

    // Check Player 2 (both on foot and in vehicle)
    if (this.scene.player2) {
      const p2 = this.scene.player2;
      const targetX = (p2.isDriving && p2.currentVehicle) ? p2.currentVehicle.sprite.x : p2.sprite.x;
      const targetY = (p2.isDriving && p2.currentVehicle) ? p2.currentVehicle.sprite.y : p2.sprite.y;
      const distToP2 = Math.hypot(targetX - fx, targetY - fy);
      if (distToP2 < stopRadius) return true;
    }

    return false;
  }

  private findNearestRoadNode() {
    let closestNode: RoadNode | null = null;
    let minDist = Infinity;

    for (const id in ROAD_NODES) {
      const node = ROAD_NODES[id];
      const dist = Math.hypot(node.x - this.sprite.x, node.y - this.sprite.y);
      if (dist < minDist) {
        minDist = dist;
        closestNode = node;
      }
    }

    this.currentTargetNode = closestNode;
  }
}
