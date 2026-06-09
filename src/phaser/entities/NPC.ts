export class NPC {
  private scene: any;
  public sprite: any;
  public type: string;
  public id!: string;
  public districtId!: string;
  public x = 0;
  public y = 0;
  public speed = 40;
  
  private changeDirTimer = 0;
  private vx = 0;
  private vy = 0;

  // Panic states
  public panicTimer = 0;
  private panicFromX = 0;
  private panicFromY = 0;

  constructor(scene: any, sprite: any, type: string) {
    this.scene = scene;
    this.sprite = sprite;
    this.type = type;

    this.pickNewDirection();
  }

  public update(dt: number) {
    if (this.panicTimer > 0) {
      this.panicTimer -= dt;
      this.handlePanicRun(dt);
    } else {
      this.handleWandering(dt);
    }
  }

  private handleWandering(dt: number) {
    this.changeDirTimer -= dt;
    if (this.changeDirTimer <= 0) {
      this.pickNewDirection();
    }

    this.sprite.body.setVelocity(this.vx, this.vy);
    if (Math.hypot(this.vx, this.vy) > 0) {
      this.sprite.rotation = Math.atan2(this.vy, this.vx);
    }
  }

  private handlePanicRun(dt: number) {
    const angle = Math.atan2(this.sprite.y - this.panicFromY, this.sprite.x - this.panicFromX);
    const runSpeed = this.speed * 3.2; // sprint away
    
    this.vx = Math.cos(angle) * runSpeed;
    this.vy = Math.sin(angle) * runSpeed;

    this.sprite.body.setVelocity(this.vx, this.vy);
    this.sprite.rotation = angle;
    
    // Spawn sweat/sprint particles
    if (Math.random() < 0.25) {
      this.scene.spawnSystem.scene.add.circle(
        this.sprite.x, 
        this.sprite.y + 6, 
        2, 
        0xffffff, 
        0.3
      );
    }
  }

  public triggerPanic(fromX: number, fromY: number) {
    this.panicTimer = 6.0; // panic for 6 seconds
    this.panicFromX = fromX;
    this.panicFromY = fromY;
  }

  private pickNewDirection() {
    this.changeDirTimer = 2.0 + Math.random() * 4.0;
    
    const angle = Math.random() * 6.28;
    const isWandering = Math.random() < 0.7; // 30% chance to stand idle
    
    if (isWandering) {
      this.vx = Math.cos(angle) * this.speed;
      this.vy = Math.sin(angle) * this.speed;
    } else {
      this.vx = 0;
      this.vy = 0;
    }
  }
}
