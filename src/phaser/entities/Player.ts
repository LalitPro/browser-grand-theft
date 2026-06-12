import Phaser from "phaser";
import { SHEET_KEYS, CHAR_ROWS, getCharFrame } from "../systems/AssetLoader";


let audioCtx: AudioContext | null = null;
function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSynthFootstep() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(65, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.015, ctx.currentTime); // Soft volume
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch (e) {
    // Autoplay prevention fallback
  }
}

export class Player {
  private scene: any;
  public sprite: any; // Phaser Game Object
  public speed = 200;
  public health = 100;
  public armor = 0;
  public currentVehicle: any = null;
  public isDriving = false;
  public isWasted = false;
  public playerIndex: number;
  
  public weapons = ["pistol", "smg", "shotgun"];
  public weaponIndex = 0;
  private weaponSwapCd = 0;

  // Per-weapon ammo. Pistol starts loaded; SMG/shotgun must be bought at the Gun Shop.
  public ammo: Record<string, number> = { pistol: 120, smg: 0, shotgun: 0 };
  private emptyMsgCd = 0;

  public keys: any;
  private enterKeyCd = 0;

  private walkCycle = 0;
  private footstepTimer = 0;

  public spriteImg: any;  // visible image layered on physics container

  constructor(scene: any, x: number, y: number, playerIndex: number = 1) {
    this.scene = scene;
    this.playerIndex = playerIndex;
    this.setupKeys();
    this.setupSprite(x, y);
  }

  private setupKeys() {
    if (this.playerIndex === 1) {
      this.keys = this.scene.input.keyboard.addKeys({
        up: "W",
        down: "S",
        left: "A",
        right: "D",
        enter: "E",
        shoot: "F",
        space: "SPACE",
        swap: "Q"
      });
    } else {
      this.keys = this.scene.input.keyboard.addKeys({
        up: "UP",
        down: "DOWN",
        left: "LEFT",
        right: "RIGHT",
        enter: "ENTER",
        shoot: "SLASH",
        space: "SHIFT", // handbrake for P2
        swap: "PERIOD"
      });
    }
  }

  private setupSprite(x: number, y: number) {
    // Invisible physics container (a small graphics circle)
    this.sprite = this.scene.add.graphics();
    this.sprite.x = x;
    this.sprite.y = y;

    // Add physics
    this.scene.physics.add.existing(this.sprite);
    
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(8, -8, -8);
      body.setCollideWorldBounds(true);
      body.setDrag(750);
      body.setMaxVelocity(this.speed);
    }

    // Visible image sprite drawn on top using spritesheet
    const charKey = this.playerIndex === 1 ? "player1" : "player2";
    const frameIndex = (CHAR_ROWS[charKey] ?? 0) * 10; // start frame of the row
    const texturesLoaded = this.scene.textures.exists(SHEET_KEYS.CHARACTERS);
    if (texturesLoaded) {
      this.spriteImg = this.scene.add.sprite(x, y, SHEET_KEYS.CHARACTERS, frameIndex);
      this.spriteImg.setScale(0.55);
      this.spriteImg.setDepth(4);
    } else {
      // Fallback: draw procedural circle if texture not loaded
      this.spriteImg = this.scene.add.graphics();
      this.spriteImg.fillStyle(this.playerIndex === 1 ? 0xff4d4d : 0x39b6ff, 1);
      this.spriteImg.fillCircle(0, 0, 8);
      this.spriteImg.setDepth(4);
    }
  }

  private drawPlayer() {
    // Legacy stub — visual is now driven by spriteImg
    // Kept to avoid breaking callers; no-op
  }

  public update(dt: number) {
    this.enterKeyCd -= dt;

    if (this.isWasted) {
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(0, 0);
        body.setAcceleration(0, 0);
      }
      return;
    }

    if (this.isDriving && this.currentVehicle) {
      // Lock player position to vehicle center
      this.sprite.x = this.currentVehicle.sprite.x;
      this.sprite.y = this.currentVehicle.sprite.y;
      
      const isPassenger = this.currentVehicle.passenger === this;
      if (isPassenger) {
        // Passengers are visible and can shoot!
        this.sprite.visible = true;
        
        let ax = 0;
        let ay = 0;
        if (this.keys.up.isDown) ay -= 1;
        if (this.keys.down.isDown) ay += 1;
        if (this.keys.left.isDown) ax -= 1;
        if (this.keys.right.isDown) ax += 1;

        if (Math.hypot(ax, ay) > 0) {
          this.sprite.rotation = Math.atan2(ay, ax);
        } else {
          // Default face forward relative to vehicle
          this.sprite.rotation = this.currentVehicle.sprite.rotation - Math.PI / 2;
        }

        // Firing from vehicle
        const weapon = this.weapons[this.weaponIndex];
        let cd = 250;
        if (weapon === "smg") cd = 90;
        if (weapon === "shotgun") cd = 650;

        if ((this.keys.shoot.isDown || this.keys.space.isDown) && this.scene.time.now - (this.sprite.lastShot || 0) > cd) {
          this.sprite.lastShot = this.scene.time.now;
          
          const angle = this.sprite.rotation;
          if (weapon === "shotgun") {
            for (let i = -2; i <= 2; i++) {
              this.scene.fireBullet(this.sprite.x, this.sprite.y, angle + i * 0.12, false);
            }
          } else if (weapon === "smg") {
            this.scene.fireBullet(this.sprite.x, this.sprite.y, angle + (Math.random() - 0.5) * 0.15, false);
          } else {
            this.scene.fireBullet(this.sprite.x, this.sprite.y, angle, false);
          }
        }
      } else {
        // Driver is hidden inside the vehicle
        this.sprite.visible = false;
      }

      // Check vehicle exit
      if (this.keys.enter.isDown && this.enterKeyCd <= 0) {
        this.exitVehicle();
      }
      return;
    }

    this.sprite.visible = true;

    // Movement using physics acceleration for smooth inertia
    let ax = 0;
    let ay = 0;

    if (this.keys.up.isDown) ay -= 1;
    if (this.keys.down.isDown) ay += 1;
    if (this.keys.left.isDown) ax -= 1;
    if (this.keys.right.isDown) ax += 1;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const len = Math.hypot(ax, ay);
      if (len > 0) {
        // Apply acceleration vector
        ax = (ax / len) * 1100;
        ay = (ay / len) * 1100;
        body.setAcceleration(ax, ay);
        
        // Smooth rotation to make it feel natural
        const velSpeed = Math.hypot(body.velocity.x, body.velocity.y);
        if (velSpeed > 20) {
          const targetAngle = Math.atan2(body.velocity.y, body.velocity.x);
          this.sprite.rotation = Phaser.Math.Angle.RotateTo(this.sprite.rotation, targetAngle, 8 * dt);
        }
        
        // Update leg/shoulder walk cycle animation
        this.walkCycle += dt * (velSpeed / this.speed) * 12;

        // Play synthetic footstep thuds
        const stepInterval = 0.35; // every 350ms
        this.footstepTimer += dt;
        if (this.footstepTimer >= stepInterval) {
          this.footstepTimer = 0;
          playSynthFootstep();
        }
      } else {
        body.setAcceleration(0, 0);
        this.walkCycle = 0;
        this.footstepTimer = 0;
      }
    }

    // Sync visible sprite position, rotation and directional frame
    if (this.spriteImg && this.spriteImg.setFrame) {
      this.spriteImg.x = this.sprite.x;
      this.spriteImg.y = this.sprite.y;
      // Use angle for directional frame selection (don't visually rotate — frame encodes direction)
      const charKey = this.playerIndex === 1 ? "player1" : "player2";
      const frame = getCharFrame(charKey, this.sprite.rotation);
      this.spriteImg.setFrame(frame);
      this.spriteImg.setVisible(this.sprite.visible);
    } else if (this.spriteImg) {
      this.spriteImg.x = this.sprite.x;
      this.spriteImg.y = this.sprite.y;
      this.spriteImg.setVisible(this.sprite.visible);
    }

    // Weapon Swap
    this.weaponSwapCd -= dt;
    if (this.keys.swap.isDown && this.weaponSwapCd <= 0) {
      this.weaponSwapCd = 0.3; // 300ms swap cooldown
      this.weaponIndex = (this.weaponIndex + 1) % this.weapons.length;
      this.scene.showCrimeBanner(`Selected Weapon: ${this.weapons[this.weaponIndex].toUpperCase()}`);
    }

    // Shooting
    const weapon = this.weapons[this.weaponIndex];
    let cd = 250;
    if (weapon === "smg") cd = 90;
    if (weapon === "shotgun") cd = 650;

    if ((this.keys.shoot.isDown || this.keys.space.isDown) && this.scene.time.now - (this.sprite.lastShot || 0) > cd) {
      this.sprite.lastShot = this.scene.time.now;
      
      const angle = this.sprite.rotation;
      if (weapon === "shotgun") {
        for (let i = -2; i <= 2; i++) {
          const spreadAngle = angle + i * 0.12;
          this.scene.fireBullet(this.sprite.x, this.sprite.y, spreadAngle, false);
        }
      } else if (weapon === "smg") {
        const spreadAngle = angle + (Math.random() - 0.5) * 0.15;
        this.scene.fireBullet(this.sprite.x, this.sprite.y, spreadAngle, false);
      } else {
        this.scene.fireBullet(this.sprite.x, this.sprite.y, angle, false);
      }
    }

    // Try enter vehicle
    if (this.keys.enter.isDown && this.enterKeyCd <= 0) {
      this.tryEnterVehicle();
    }
  }

  public tryEnterVehicle() {
    this.enterKeyCd = 0.4;
    
    // Find closest vehicle
    let closestVeh: any = null;
    let minDist = 75;

    this.scene.spawnSystem.spawnedVehicles.forEach((veh: any) => {
      const dist = Math.hypot(veh.sprite.x - this.sprite.x, veh.sprite.y - this.sprite.y);
      if (dist < minDist) {
        minDist = dist;
        closestVeh = veh;
      }
    });

    if (closestVeh) {
      this.enterVehicle(closestVeh);
    }
  }

  private enterVehicle(veh: any) {
    this.currentVehicle = veh;
    this.isDriving = true;
    
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setVelocity(0, 0);
      body.setAcceleration(0, 0);
      body.enable = false;
    }
    this.sprite.visible = false;
    if (this.spriteImg) this.spriteImg.setVisible(false);
    
    veh.enter(this);
  }

  public exitVehicle() {
    if (!this.currentVehicle) return;

    this.enterKeyCd = 0.4;
    this.currentVehicle.exit(this);

    // Place player slightly off the vehicle
    const sideAngle = this.currentVehicle.sprite.rotation + Math.PI / 2;
    this.sprite.x = this.currentVehicle.sprite.x + Math.cos(sideAngle) * 35;
    this.sprite.y = this.currentVehicle.sprite.y + Math.sin(sideAngle) * 35;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true; // Re-enable physics body collisions
      body.setVelocity(0, 0);
      body.setAcceleration(0, 0);
    }

    this.currentVehicle = null;
    this.isDriving = false;
    this.sprite.visible = true;
  }

  public takeDamage(dmg: number) {
    if (this.isWasted) return;

    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, Math.round(dmg * 0.75));
      this.armor -= absorbed;
      dmg -= absorbed;
    }
    this.health = Math.max(0, this.health - dmg);

    if (this.health <= 0) {
      this.scene.handlePlayerWasted(this);
    }
  }

  public respawn() {
    this.health = 100;
    this.armor = 0;
    this.isWasted = false;
    this.sprite.x = 300; 
    this.sprite.y = 1050;
    
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.setVelocity(0, 0);
      body.setAcceleration(0, 0);
    }

    if (this.isDriving && this.currentVehicle) {
      this.currentVehicle.exit(this);
      this.isDriving = false;
      this.currentVehicle = null;
    }
    this.sprite.visible = true;
    if (this.spriteImg) this.spriteImg.setVisible(true);
  }
}
