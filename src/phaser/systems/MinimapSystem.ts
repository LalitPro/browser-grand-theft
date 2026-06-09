export class MinimapSystem {
  private scene: any;
  public minimapCamera: any;
  private blips: Map<string, any> = new Map();

  constructor(scene: any) {
    this.scene = scene;
    this.setupMinimapCamera();
  }

  private setupMinimapCamera() {
    const width = 160;
    const height = 160;
    const padding = 16;
    
    // Position at bottom-left corner
    const x = padding;
    const y = this.scene.scale.height - height - padding;

    // Create secondary camera
    this.minimapCamera = this.scene.cameras.add(x, y, width, height);
    this.minimapCamera.setName("minimap");
    this.minimapCamera.setZoom(0.065); // Zoomed way out
    this.minimapCamera.setBackgroundColor(0x0c0f17);
    this.minimapCamera.setBounds(0, 0, 4000, 2500);

    // Border around minimap (HUD container drawn on main screen)
    const border = this.scene.add.graphics();
    border.lineStyle(3, 0xffc450, 1);
    border.fillStyle(0x000000, 0.3);
    border.strokeRect(x - 2, y - 2, width + 4, height + 4);
    border.fillRect(x - 2, y - 2, width + 4, height + 4);
    
    // Ignore border graphic in the minimap itself
    this.minimapCamera.ignore(border);
    this.scene.mainCameraIgnoreList = this.scene.mainCameraIgnoreList || [];
    this.scene.mainCameraIgnoreList.push(border); // we don't ignore it in main camera

    // Set scroll follow
    this.scene.events.once("postupdate", () => {
      if (this.scene.player) {
        this.minimapCamera.startFollow(this.scene.player.sprite);
      }
    });
  }

  public addLocationBlip(id: string, x: number, y: number, color: number, label: string) {
    const existing = this.blips.get(id);
    if (existing) {
      existing.destroy();
    }

    const blip = this.scene.add.graphics();
    
    // High visibility indicator
    blip.fillStyle(color, 1);
    blip.fillTriangle(0, -12, -8, 4, 8, 4); // pin point pointer
    blip.fillStyle(0xffffff, 1);
    blip.fillCircle(0, 0, 3); // core

    blip.x = x;
    blip.y = y;

    // Scale up blip so it remains visible at 0.06x camera zoom
    blip.setScale(3.5);

    this.blips.set(id, blip);
  }

  public removeLocationBlip(id: string) {
    const blip = this.blips.get(id);
    if (blip) {
      blip.destroy();
      this.blips.delete(id);
    }
  }

  public updateBlips(playerX: number, playerY: number) {
    // We can animate or pulse safehouse/wanted blips if needed
    this.blips.forEach((blip, id) => {
      if (id.includes("safehouse")) {
        const pulse = 1 + Math.sin(this.scene.time.now / 150) * 0.15;
        blip.setScale(3.5 * pulse);
      }
    });
  }

  public handleResize() {
    const height = 160;
    const padding = 16;
    const y = this.scene.scale.height - height - padding;
    this.minimapCamera.setPosition(padding, y);
  }

  public clearAll() {
    this.blips.forEach((blip) => blip.destroy());
    this.blips.clear();
  }
}
