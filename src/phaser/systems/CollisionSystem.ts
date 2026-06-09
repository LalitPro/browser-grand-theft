import { BUILDINGS, BuildingData } from "../data/buildings";
import { BRIDGES, Bridge } from "../data/roads";

export class CollisionSystem {
  private buildings: BuildingData[] = BUILDINGS;
  private bridges: Bridge[] = BRIDGES;

  // River spine segments to calculate proximity
  private riverSpine = [
    { x1: 300, y1: 0, x2: 500, y2: 500 },
    { x1: 500, y1: 500, x2: 1100, y2: 800 },
    { x1: 1100, y1: 800, x2: 1600, y2: 1200 },
    { x1: 1600, y1: 1200, x2: 1600, y2: 2000 },
    { x1: 1600, y1: 2000, x2: 1700, y2: 2500 }
  ];

  private riverWidth = 75; // River width radius

  /**
   * Checks if a coordinate (x,y) with radius 'r' collides with any solid obstacle.
   */
  public collides(x: number, y: number, r: number): boolean {
    // 1. World boundaries
    if (x - r < 0 || x + r > 4000 || y - r < 0 || y + r > 2500) {
      return true;
    }

    // 2. Bay of Samudra (Sea water at the bottom, below Y=2000)
    // Dipping down around Indrapuri peninsula (X:2150 to 3080, extends to Y=2150)
    const isPeninsula = x > 2150 && x < 3080;
    const seaThreshold = isPeninsula ? 2150 : 2000;
    if (y + r > seaThreshold) {
      return false; // Let player walk on land, but if they go below they hit water:
    }
    if (y > 2000 && !isPeninsula) {
      return true; // hits ocean
    }
    if (y > 2150 && isPeninsula) {
      return true; // hits ocean off peninsula
    }

    // 3. Bridges bypass water collisions
    const isOnBridge = this.checkOnBridge(x, y);
    if (!isOnBridge) {
      // Check Chandani River collision
      if (this.checkRiverCollision(x, y, r)) {
        return true;
      }
    }

    // 4. Buildings collision
    for (const b of this.buildings) {
      if (
        x + r > b.x - b.width / 2 &&
        x - r < b.x + b.width / 2 &&
        y + r > b.y - b.height / 2 &&
        y - r < b.y + b.height / 2
      ) {
        return true; // hits building
      }
    }

    // 5. Forest boundaries (top-middle mountains/forest at Kisanpur, y < 200)
    if (y < 200 && x > 400 && x < 2400) {
      return true; // hits thick forest boundary
    }

    return false;
  }

  private checkOnBridge(x: number, y: number): boolean {
    for (const br of this.bridges) {
      if (
        x >= br.x - br.width / 2 &&
        x <= br.x + br.width / 2 &&
        y >= br.y - br.height / 2 &&
        y <= br.y + br.height / 2
      ) {
        return true;
      }
    }
    return false;
  }

  private checkRiverCollision(x: number, y: number, r: number): boolean {
    for (const seg of this.riverSpine) {
      const dist = this.pointToSegmentDistance(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
      if (dist < this.riverWidth + r) {
        return true;
      }
    }
    return false;
  }

  private pointToSegmentDistance(
    x: number,
    y: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.hypot(dx, dy);
  }
}
