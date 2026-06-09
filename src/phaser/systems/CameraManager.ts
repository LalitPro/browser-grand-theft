import Phaser from "phaser";

export class CameraManager {
  private scene: any;
  public cameraP2: Phaser.Cameras.Scene2D.Camera | null = null;
  public isSplit = false;
  private initialized = false;
  
  private midPoint: Phaser.Math.Vector2;
  private splitThreshold = 750; // split when players are > 750px apart
  private mergeThreshold = 550; // merge when players are < 550px apart
  
  private dividerGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: any) {
    this.scene = scene;
    this.midPoint = new Phaser.Math.Vector2(0, 0);
    this.dividerGraphics = this.scene.add.graphics();
    if (this.dividerGraphics) {
      this.dividerGraphics.setScrollFactor(0);
      this.dividerGraphics.setDepth(1000); // Draw on top
    }
  }

  public update(dt: number) {
    const p1 = this.scene.player;
    const p2 = this.scene.player2;
    const isCoop = this.scene.registry.get("isCoop");

    if (!isCoop || !p2) {
      // Solo mode: Camera always follows P1
      this.isSplit = false;
      this.scene.cameras.main.setViewport(0, 0, this.scene.scale.width, this.scene.scale.height);
      this.scene.cameras.main.setBounds(0, 0, 4000, 2500);
      
      const target = p1.isDriving && p1.currentVehicle ? p1.currentVehicle.sprite : p1.sprite;
      this.scene.cameras.main.startFollow(target, true, 0.08, 0.08);
      
      // Zoom out slightly when driving
      const targetZoom = p1.isDriving ? 0.82 : 1.0;
      this.scene.cameras.main.setZoom(Phaser.Math.Linear(this.scene.cameras.main.zoom, targetZoom, 5 * dt));
      this.clearDivider();

      if (this.cameraP2) {
        this.cameraP2.setVisible(false);
      }
      return;
    }

    const p1Target = p1.isDriving && p1.currentVehicle ? p1.currentVehicle.sprite : p1.sprite;
    const p2Target = p2.isDriving && p2.currentVehicle ? p2.currentVehicle.sprite : p2.sprite;

    const inSameVehicle = p1.isDriving && p2.isDriving && p1.currentVehicle === p2.currentVehicle;

    // Calculate distance
    const dist = Phaser.Math.Distance.Between(p1Target.x, p1Target.y, p2Target.x, p2Target.y);
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // Determine target mode and run initial layout configuration
    if (!this.initialized) {
      this.initialized = true;
      if (inSameVehicle || dist < this.splitThreshold) {
        this.isSplit = false;
        this.setupSharedCamera(width, height);
      } else {
        this.isSplit = true;
        this.setupSplitScreen(p1Target, p2Target, width, height);
      }
    } else if (inSameVehicle) {
      this.isSplit = false;
      this.setupSharedCamera(width, height); // ensure viewport is reset/synced
    } else if (dist > this.splitThreshold && !this.isSplit) {
      this.isSplit = true;
      this.setupSplitScreen(p1Target, p2Target, width, height);
    } else if (dist < this.mergeThreshold && this.isSplit) {
      this.isSplit = false;
      this.setupSharedCamera(width, height);
    }

    // Update camera follow/viewports
    if (this.isSplit) {
      this.updateSplitScreen(p1Target, p2Target, dt);
    } else {
      this.updateSharedCamera(p1Target, p2Target, dist, dt);
    }
  }

  private setupSplitScreen(p1Target: any, p2Target: any, width: number, height: number) {
    const mainCam = this.scene.cameras.main;
    mainCam.stopFollow();
    
    // P1 Viewport: Left Side
    mainCam.setViewport(0, 0, width / 2, height);
    mainCam.setBounds(0, 0, 4000, 2500);
    mainCam.startFollow(p1Target, true, 0.08, 0.08);

    // P2 Viewport: Right Side
    if (!this.cameraP2) {
      this.cameraP2 = this.scene.cameras.add(width / 2, 0, width / 2, height);
      if (this.cameraP2) {
        this.cameraP2.setName("player2_cam");
        this.cameraP2.setBounds(0, 0, 4000, 2500);
        this.cameraP2.setBackgroundColor(0x0c0f17);
      }
    } else {
      this.cameraP2.setViewport(width / 2, 0, width / 2, height);
      this.cameraP2.setVisible(true);
    }
    
    if (this.cameraP2) {
      this.cameraP2.startFollow(p2Target, true, 0.08, 0.08);
    }

    // Sync minimap camera ignores
    if (this.scene.mainCameraIgnoreList) {
      this.scene.mainCameraIgnoreList.forEach((obj: any) => {
        if (obj.active) {
          this.cameraP2?.ignore(obj);
        }
      });
    }
  }

  private setupSharedCamera(width: number, height: number) {
    const mainCam = this.scene.cameras.main;
    mainCam.stopFollow();
    
    // Shared Viewport: Full Screen
    mainCam.setViewport(0, 0, width, height);
    mainCam.setBounds(0, 0, 4000, 2500);
    mainCam.startFollow(this.midPoint, true, 0.08, 0.08);

    // Disable P2 camera view
    if (this.cameraP2) {
      this.cameraP2.setVisible(false);
    }
    
    this.clearDivider();
  }

  private updateSplitScreen(p1Target: any, p2Target: any, dt: number) {
    const mainCam = this.scene.cameras.main;
    const p2Cam = this.cameraP2;

    // Scale zoom slightly based on vehicle status
    const p1Driving = this.scene.player.isDriving;
    const p2Driving = this.scene.player2.isDriving;

    mainCam.setZoom(Phaser.Math.Linear(mainCam.zoom, p1Driving ? 0.82 : 1.0, 5 * dt));
    if (p2Cam) {
      p2Cam.setZoom(Phaser.Math.Linear(p2Cam.zoom, p2Driving ? 0.82 : 1.0, 5 * dt));
    }

    this.drawDivider();
  }

  private updateSharedCamera(p1Target: any, p2Target: any, dist: number, dt: number) {
    const mainCam = this.scene.cameras.main;

    // Calculate midpoint between players
    this.midPoint.x = (p1Target.x + p2Target.x) / 2;
    this.midPoint.y = (p1Target.y + p2Target.y) / 2;

    // Adjust zoom dynamically based on player distance
    // Players close -> Zoom in (1.1). Players far -> Zoom out (0.65).
    const maxZoom = 1.15;
    const minZoom = 0.62;
    const targetZoom = Phaser.Math.Clamp(400 / (dist + 50), minZoom, maxZoom);
    
    // Zoom out further if driving
    const drivingAdjust = (this.scene.player.isDriving || (this.scene.player2 && this.scene.player2.isDriving)) ? 0.85 : 1.0;
    
    mainCam.setZoom(Phaser.Math.Linear(mainCam.zoom, targetZoom * drivingAdjust, 4 * dt));
  }

  private drawDivider() {
    if (!this.dividerGraphics) return;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    this.dividerGraphics.clear();
    this.dividerGraphics.lineStyle(5, 0xffc450, 1.0); // orange split line
    this.dividerGraphics.beginPath();
    this.dividerGraphics.moveTo(width / 2, 0);
    this.dividerGraphics.lineTo(width / 2, height);
    this.dividerGraphics.strokePath();

    // Ignore divider in viewports
    this.scene.cameras.main.ignore(this.dividerGraphics);
    if (this.cameraP2) {
      this.cameraP2.ignore(this.dividerGraphics);
    }
  }

  private clearDivider() {
    if (this.dividerGraphics) {
      this.dividerGraphics.clear();
    }
  }

  public handleResize() {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const isCoop = this.scene.registry.get("isCoop");

    if (this.isSplit && isCoop) {
      this.scene.cameras.main.setViewport(0, 0, width / 2, height);
      if (this.cameraP2) {
        this.cameraP2.setViewport(width / 2, 0, width / 2, height);
      }
    } else {
      this.scene.cameras.main.setViewport(0, 0, width, height);
      if (this.cameraP2) {
        this.cameraP2.setVisible(false);
      }
    }
  }

  public destroy() {
    if (this.dividerGraphics) {
      this.dividerGraphics.destroy();
    }
    if (this.cameraP2) {
      this.scene.cameras.remove(this.cameraP2);
    }
  }
}
