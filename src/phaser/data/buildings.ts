export type BuildingType = "residential" | "commercial" | "government" | "industrial" | "landmark";

export interface BuildingData {
  id: string;
  name: string;
  districtId: string;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: number; // visual color override
}

export const BUILDINGS: BuildingData[] = [
  // === NAVAPUR ===
  { id: "nav_old_fort", name: "Navapur Old Fort", districtId: "shantiNagar", type: "landmark", x: 460, y: 1625, width: 150, height: 150, color: 0x8b8b83 },
  { id: "nav_gun_shop", name: "Ammu-Nation Gun Shop", districtId: "shantiNagar", type: "commercial", x: 100, y: 1500, width: 50, height: 50, color: 0xff4d4d },
  { id: "nav_police", name: "Navapur Local Police", districtId: "shantiNagar", type: "government", x: 150, y: 1375, width: 80, height: 60, color: 0x2d54c8 },
  { id: "nav_hospital", name: "Navapur Community Hospital", districtId: "chawls", type: "government", x: 770, y: 1625, width: 100, height: 80, color: 0xffffff },
  { id: "nav_safehouse", name: "Navapur Safehouse", districtId: "puranaBasti", type: "residential", x: 460, y: 1125, width: 60, height: 60, color: 0x5cacee },
  { id: "nav_garage", name: "Navapur Mechanic Garage", districtId: "chawls", type: "commercial", x: 1080, y: 1375, width: 70, height: 60, color: 0xcd853f },
  
  // Food stalls & markets in Navapur
  { id: "nav_food_1", name: "Chaat Stalls", districtId: "puranaBasti", type: "commercial", x: 400, y: 1125, width: 40, height: 30, color: 0xeead0e },
  { id: "nav_market_1", name: "Basti Vegetable Market", districtId: "puranaBasti", type: "commercial", x: 200, y: 900, width: 120, height: 60, color: 0xcdb79a },
  { id: "nav_market_2", name: "Mandi Cloth Market", districtId: "mandiBazaar", type: "commercial", x: 800, y: 900, width: 150, height: 70, color: 0xc463a6 },

  // Residential Blocks in Navapur
  { id: "nav_chawl_block_1", name: "Navapur Chawl Block A", districtId: "chawls", type: "residential", x: 700, y: 1400, width: 100, height: 120, color: 0xd9b48c },
  { id: "nav_chawl_block_2", name: "Navapur Chawl Block B", districtId: "chawls", type: "residential", x: 820, y: 1400, width: 100, height: 120, color: 0xd9b48c },

  // === KISANPUR ===
  { id: "kis_school", name: "Kisanpur Secondary School", districtId: "kisanpur", type: "government", x: 1700, y: 625, width: 110, height: 70, color: 0xee9a49 },
  { id: "kis_dhaba_1", name: "Sher-e-Punjab Dhaba", districtId: "kisanpur", type: "commercial", x: 1380, y: 625, width: 70, height: 50, color: 0xcd5b45 },
  { id: "kis_dhaba_2", name: "Sher-e-Punjab NH-01 Dhaba", districtId: "kisanpur", type: "commercial", x: 1700, y: 1125, width: 80, height: 60, color: 0xcd5b45 },
  { id: "kis_dhaba_3", name: "Roadside Punjabi Dhaba", districtId: "kisanpur", type: "commercial", x: 1080, y: 1500, width: 60, height: 50, color: 0xb5733f },
  { id: "kis_fuel", name: "Kisanpur Fuel Station", districtId: "kisanpur", type: "commercial", x: 1700, y: 1375, width: 50, height: 50, color: 0x00ff7f },

  // === INDRAPURI ===
  { id: "ind_police_hq", name: "Central Police HQ", districtId: "downtown", type: "government", x: 2300, y: 1125, width: 140, height: 90, color: 0x1874cd },
  { id: "ind_hospital", name: "Indrapuri General Hospital", districtId: "downtown", type: "government", x: 2600, y: 1125, width: 150, height: 100, color: 0xfffafa },
  { id: "ind_fire", name: "Indrapuri Fire Station", districtId: "universityDistrict", type: "government", x: 2300, y: 1875, width: 90, height: 70, color: 0xff3030 },
  { id: "ind_clock_tower", name: "Indrapuri Clock Tower", districtId: "downtown", type: "landmark", x: 2600, y: 1375, width: 40, height: 40, color: 0xcd9b1d },
  { id: "ind_mall", name: "Reliance Mall & Multiplex", districtId: "universityDistrict", type: "commercial", x: 2300, y: 1625, width: 160, height: 110, color: 0xff6103 },
  { id: "ind_park_1", name: "Indrapuri Central Park", districtId: "cityCentre", type: "landmark", x: 2600, y: 1875, width: 180, height: 120, color: 0x458b00 },
  { id: "ind_parking_1", name: "City Centre Multi-level Parking", districtId: "cityCentre", type: "commercial", x: 2900, y: 1875, width: 100, height: 80, color: 0x7a7a7a },

  // Offices & University
  { id: "ind_office_block_1", name: "Bharat Bhavan Towers", districtId: "downtown", type: "commercial", x: 2850, y: 1125, width: 120, height: 140, color: 0x3a4f6a },
  { id: "ind_university_admin", name: "Indrapuri University Admin", districtId: "universityDistrict", type: "landmark", x: 2150, y: 1700, width: 100, height: 80, color: 0x8b3e2f },

  // === BANDARKHALI ===
  { id: "ban_lighthouse", name: "Bandarkhali Lighthouse", districtId: "azadNagar", type: "landmark", x: 3540, y: 625, width: 40, height: 40, color: 0xff3030 },
  { id: "ban_warehouse_1", name: "Harbor Warehouse A", districtId: "harbor", type: "industrial", x: 3230, y: 875, width: 130, height: 80, color: 0xcd96cd },
  { id: "ban_warehouse_2", name: "Harbor Warehouse B", districtId: "harbor", type: "industrial", x: 3230, y: 975, width: 130, height: 80, color: 0xcd96cd },
  { id: "ban_factory_1", name: "Azad Iron Works", districtId: "factoryZone", type: "industrial", x: 2900, y: 875, width: 110, height: 110, color: 0x8b7b8b },
  { id: "ban_dock_1", name: "Harbor Dock Terminal 1", districtId: "harbor", type: "industrial", x: 3230, y: 1125, width: 160, height: 90, color: 0x8b8b83 },
  { id: "ban_police", name: "Port Police Precinct", districtId: "azadNagar", type: "government", x: 2900, y: 625, width: 80, height: 60, color: 0x2d54c8 },
  { id: "ban_truck_terminal", name: "Bandarkhali Truck Terminal", districtId: "factoryZone", type: "industrial", x: 2900, y: 1125, width: 120, height: 90, color: 0xcd853f },
  { id: "ban_hospital", name: "Bandarkhali Port Hospital", districtId: "azadNagar", type: "government", x: 3230, y: 1625, width: 90, height: 80, color: 0xffffff }
];
