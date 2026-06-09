export class OptimizationSystem {
  private scene: any;
  private culledObjects: any[] = [];
  private chunkSize = 500;
  private chunks: Map<string, any[]> = new Map();
  private activeChunks: Set<string> = new Set();

  constructor(scene: any) {
    this.scene = scene;
  }

  /**
   * Registers a static visual object (e.g., building, tree, road segment) for culling.
   */
  public registerStaticObject(x: number, y: number, width: number, height: number, gameObject: any) {
    const minChunkX = Math.floor((x - width / 2) / this.chunkSize);
    const maxChunkX = Math.floor((x + width / 2) / this.chunkSize);
    const minChunkY = Math.floor((y - height / 2) / this.chunkSize);
    const maxChunkY = Math.floor((y + height / 2) / this.chunkSize);

    // Add object to all overlapping chunks
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      for (let cy = minChunkY; cy <= maxChunkY; cy++) {
        const chunkKey = `${cx}_${cy}`;
        if (!this.chunks.has(chunkKey)) {
          this.chunks.set(chunkKey, []);
        }
        this.chunks.get(chunkKey)!.push(gameObject);
      }
    }

    // Default to invisible until first culling tick
    gameObject.visible = false;
    this.culledObjects.push(gameObject);
  }

  /**
   * Updates object visibility based on the player position and main camera viewport.
   */
  public update(playerX: number, playerY: number) {
    const camera = this.scene.cameras.main;
    const viewWidth = camera.width;
    const viewHeight = camera.height;
    
    // Bounds of the camera in world coordinates
    const viewX = camera.scrollX;
    const viewY = camera.scrollY;

    const pad = 100; // padding to spawn objects just before they slide into view
    
    const minCx = Math.floor((viewX - pad) / this.chunkSize);
    const maxCx = Math.floor((viewX + viewWidth + pad) / this.chunkSize);
    const minCy = Math.floor((viewY - pad) / this.chunkSize);
    const maxCy = Math.floor((viewY + viewHeight + pad) / this.chunkSize);

    const newActiveChunks: Set<string> = new Set();
    
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        newActiveChunks.add(`${cx}_${cy}`);
      }
    }

    // Determine chunks that became active or inactive
    const toActivate = [...newActiveChunks].filter(c => !this.activeChunks.has(c));
    const toDeactivate = [...this.activeChunks].filter(c => !newActiveChunks.add(c)); // wait, let's write it cleaner

    // Set visibility
    // First, make all currently active chunks visible
    this.activeChunks.clear();
    newActiveChunks.forEach(chunkKey => {
      this.activeChunks.add(chunkKey);
      const objects = this.chunks.get(chunkKey);
      if (objects) {
        for (const obj of objects) {
          obj.visible = true;
        }
      }
    });

    // Now, scan all culled objects and disable visibility if they don't belong to any active chunk
    // (a simple lookup in the active chunks set)
    this.culledObjects.forEach(obj => {
      // Find the object's chunk coordinates
      const cx = Math.floor(obj.x / this.chunkSize);
      const cy = Math.floor(obj.y / this.chunkSize);
      const key = `${cx}_${cy}`;

      if (!this.activeChunks.has(key)) {
        obj.visible = false;
      }
    });
  }

  public clearAll() {
    this.culledObjects = [];
    this.chunks.clear();
    this.activeChunks.clear();
  }
}
