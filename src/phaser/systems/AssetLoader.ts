import Phaser from "phaser";

/**
 * AssetLoader v2 — maps real spritesheet layouts to named Phaser keys.
 *
 * Spritesheet geometry (all sheets are 1024×1024):
 *
 *  characters_sheet  — 10 cols × 9 rows, frame = 102×113 px
 *    Each row = one character type.
 *    Each column = one viewing angle (0°→324° in 36° steps, clockwise from south).
 *    Angle mapping:  col = round((angleDeg / 360) * 10) % 10
 *
 *  vehicles_sheet    — 5 cols × 10 rows, frame = 204×102 px  (side-view, wide)
 *    Each row = one vehicle variant.
 *    Phaser sprite.rotation handles the turning — no directional frames needed.
 *
 *  weapons_effects_sheet — keep as-is (UI / HUD items)
 *  hud_ui_sheet          — keep as-is
 */

// ─── Sheet keys ──────────────────────────────────────────────────────────────
export const SHEET_KEYS = {
  CHARACTERS: "characters_sheet",
  VEHICLES:   "vehicles_sheet",
  BUILDINGS:  "buildings_sheet",
  ENVIRONMENT:"environment_sheet",
  WEAPONS:    "weapons_effects_sheet",
  HUD:        "hud_ui_sheet",
} as const;

// ─── Character frame config ───────────────────────────────────────────────────
// 10 directional frames per row, 9 rows total
export const CHAR_COLS = 10;
export const CHAR_FRAME_W = 102;   // 1024 / 10 ≈ 102
export const CHAR_FRAME_H = 113;   // 1024 / 9  ≈ 113

// Row index per character type (row 0 = top row)
export const CHAR_ROWS: Record<string, number> = {
  player1:         0,   // grey shirt, blue jeans
  player2:         1,   // orange jacket
  police_khaki:    2,   // khaki Indian police
  traffic_police:  3,   // yellow-vest traffic police
  police_swat:     4,   // SWAT / black tactical
  female_civilian: 5,   // sari women
  market_vendor:   6,   // market vendors / civilians
  worker:          7,   // auto-rickshaw / delivery workers
  office_worker:   8,   // office / suit workers

  // Aliases for SpawnSystem NPC type strings
  resident:        5,
  tourist:         8,
  shopper:         5,
  student:         8,
  factory_worker:  7,
  dock_worker:     7,
  truck_driver:    7,

  // Police aliases
  police:          2,
  police_traffic:  3,
  swat:            4,
};

// ─── Vehicle frame config ─────────────────────────────────────────────────────
// 5 cols × 10 rows, each frame is wide (side-view)
export const VEH_COLS = 5;
export const VEH_FRAME_W = 204;   // 1024 / 5 ≈ 204
export const VEH_FRAME_H = 102;   // 1024 / 10 = 102.4 ≈ 102

// Row index per vehicle type (pick col 0 = col with most detail)
export const VEH_ROWS: Record<string, number> = {
  hatchback:    0,
  sedan:        1,
  suv:          2,
  taxi:         3,   // yellow-black taxi row
  auto:         4,   // auto-rickshaw
  scooter:      5,
  bike:         6,
  truck:        7,
  heavy_truck:  7,
  delivery_van: 8,
  police_car:   9,
  ambulance:    9,
  fire_truck:   9,
  car:          0,   // fallback
  van:          8,
};

/**
 * getCharFrame — returns the flat frame index for a character at a given
 * world rotation angle (radians).
 *
 * The 10 directional columns represent angles 0°→324° in 36° steps.
 * Column 0 = character facing south (toward camera, angle = π/2 in Phaser).
 * We rotate the angle so south = column 0.
 */
export function getCharFrame(charType: string, angleRad: number): number {
  const row = CHAR_ROWS[charType] ?? CHAR_ROWS["resident"];

  // Normalise angle to [0, 2π)
  let a = angleRad % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;

  // Offset: Phaser right (0 rad) → we want south (π/2) to be col 0
  // Rotate so south points to col 0
  const southOffset = Math.PI / 2;
  a = (a - southOffset + 2 * Math.PI) % (2 * Math.PI);

  // Map to one of 10 columns
  const col = Math.round((a / (2 * Math.PI)) * CHAR_COLS) % CHAR_COLS;

  return row * CHAR_COLS + col;
}

/**
 * getVehicleFrame — returns the flat frame index for a vehicle type.
 * Vehicles are side-view; Phaser rotation handles facing. We just pick
 * the best-looking column (col 2 = front-on view for most rows).
 */
export function getVehicleFrame(vehicleType: string, col = 2): number {
  const row = VEH_ROWS[vehicleType] ?? 0;
  return row * VEH_COLS + Math.min(col, VEH_COLS - 1);
}

// ─── Preload ──────────────────────────────────────────────────────────────────
export function preloadAssets(scene: Phaser.Scene) {
  scene.load.spritesheet(SHEET_KEYS.CHARACTERS, "assets/images/characters_sheet.png",
    { frameWidth: CHAR_FRAME_W, frameHeight: CHAR_FRAME_H });

  scene.load.spritesheet(SHEET_KEYS.VEHICLES, "assets/images/vehicles_sheet.png",
    { frameWidth: VEH_FRAME_W, frameHeight: VEH_FRAME_H });

  scene.load.image(SHEET_KEYS.BUILDINGS,  "assets/images/buildings_sheet.png");
  scene.load.image(SHEET_KEYS.ENVIRONMENT,"assets/images/environment_sheet.png");
  scene.load.image(SHEET_KEYS.WEAPONS,    "assets/images/weapons_effects_sheet.png");
  scene.load.image(SHEET_KEYS.HUD,        "assets/images/hud_ui_sheet.png");
}

// ─── Black-background stripper ────────────────────────────────────────────────
/**
 * processTexturesBlackToAlpha
 * The character and vehicle sheets have a pure black (0,0,0) background.
 * Strip those pixels so sprites render with transparent backgrounds on the world.
 * Call at the TOP of WorldScene.create() before any sprites are instantiated.
 */
export function processTexturesBlackToAlpha(scene: Phaser.Scene): void {
  const sheets: Array<{ key: string; fw: number; fh: number }> = [
    { key: SHEET_KEYS.CHARACTERS, fw: CHAR_FRAME_W, fh: CHAR_FRAME_H },
    { key: SHEET_KEYS.VEHICLES,   fw: VEH_FRAME_W,  fh: VEH_FRAME_H  },
  ];

  sheets.forEach(({ key, fw, fh }) => {
    if (!scene.textures.exists(key)) return;

    const texture = scene.textures.get(key);
    const src = texture.source[0];
    if (!src || !src.image) return;

    const cnv = document.createElement("canvas");
    cnv.width  = src.width;
    cnv.height = src.height;
    const ctx = cnv.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(src.image as CanvasImageSource, 0, 0);

    const imgData = ctx.getImageData(0, 0, cnv.width, cnv.height);
    const d = imgData.data;

    // Remove near-black pixels (background) — threshold 40
    const BLACK_THRESHOLD = 40;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < BLACK_THRESHOLD && d[i + 1] < BLACK_THRESHOLD && d[i + 2] < BLACK_THRESHOLD) {
        d[i + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Re-register as spritesheet with correct frame config
    scene.textures.remove(key);
    scene.textures.addSpriteSheet(key, cnv as unknown as HTMLImageElement, { frameWidth: fw, frameHeight: fh });
  });
}

// ─── Legacy alias so old code doesn't break ───────────────────────────────────
export const processTexturesWhiteToAlpha = processTexturesBlackToAlpha;
