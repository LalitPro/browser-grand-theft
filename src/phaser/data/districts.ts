export interface District {
  id: string;
  name: string;
  city: string;
  color: number; // hex color for minimap / debug
  bounds: { x: number; y: number; width: number; height: number };
  density: { npc: number; vehicle: number };
  allowedVehicles: string[];
  allowedNPCs: string[];
}

export const DISTRICTS: Record<string, District> = {
  // --- NAVAPUR (Starter City) ---
  puranaBasti: {
    id: "puranaBasti",
    name: "Purana Basti",
    city: "Navapur",
    color: 0xffa500,
    bounds: { x: 50, y: 750, width: 550, height: 500 },
    density: { npc: 0.8, vehicle: 0.5 },
    allowedVehicles: ["bike", "auto", "small_car"],
    allowedNPCs: ["market_vendor", "resident", "worker"]
  },
  mandiBazaar: {
    id: "mandiBazaar",
    name: "Mandi Bazaar",
    city: "Navapur",
    color: 0xff8c00,
    bounds: { x: 600, y: 750, width: 600, height: 500 },
    density: { npc: 0.9, vehicle: 0.7 },
    allowedVehicles: ["bike", "auto", "small_car", "van"],
    allowedNPCs: ["market_vendor", "tourist", "shopper"]
  },
  chawls: {
    id: "chawls",
    name: "Chawls",
    city: "Navapur",
    color: 0xd2691e,
    bounds: { x: 600, y: 1250, width: 600, height: 750 },
    density: { npc: 0.9, vehicle: 0.4 },
    allowedVehicles: ["bike", "auto", "small_car"],
    allowedNPCs: ["resident", "worker", "child"]
  },
  shantiNagar: {
    id: "shantiNagar",
    name: "Shanti Nagar",
    city: "Navapur",
    color: 0xffb6c1,
    bounds: { x: 50, y: 1250, width: 550, height: 750 },
    density: { npc: 0.6, vehicle: 0.5 },
    allowedVehicles: ["bike", "auto", "small_car"],
    allowedNPCs: ["resident", "elder"]
  },

  // --- KISANPUR (Rural Area) ---
  kisanpur: {
    id: "kisanpur",
    name: "Kisanpur Village",
    city: "Kisanpur",
    color: 0x8fbc8f,
    bounds: { x: 1200, y: 250, width: 1200, height: 800 },
    density: { npc: 0.3, vehicle: 0.3 },
    allowedVehicles: ["tractor", "bike", "small_car", "truck"],
    allowedNPCs: ["farmer", "villager", "student"]
  },

  // --- INDRAPURI (Commercial City) ---
  downtown: {
    id: "downtown",
    name: "Downtown",
    city: "Indrapuri",
    color: 0x4682b4,
    bounds: { x: 2400, y: 1000, width: 650, height: 500 },
    density: { npc: 0.9, vehicle: 0.9 },
    allowedVehicles: ["luxury_car", "suv", "taxi", "police_car"],
    allowedNPCs: ["office_worker", "business_person", "security_guard"]
  },
  universityDistrict: {
    id: "universityDistrict",
    name: "University District",
    city: "Indrapuri",
    color: 0x6a5acd,
    bounds: { x: 2400, y: 1500, width: 350, height: 500 },
    density: { npc: 0.8, vehicle: 0.6 },
    allowedVehicles: ["bike", "small_car", "scooter"],
    allowedNPCs: ["student", "professor", "delivery_driver"]
  },
  vasantKunj: {
    id: "vasantKunj",
    name: "Vasant Kunj",
    city: "Indrapuri",
    color: 0x48d1cc,
    bounds: { x: 3050, y: 1250, width: 350, height: 250 },
    density: { npc: 0.4, vehicle: 0.7 },
    allowedVehicles: ["luxury_car", "suv", "sports_car"],
    allowedNPCs: ["resident", "tourist", "jogger"]
  },
  cityCentre: {
    id: "cityCentre",
    name: "City Centre",
    city: "Indrapuri",
    color: 0x20b2aa,
    bounds: { x: 2750, y: 1500, width: 650, height: 500 },
    density: { npc: 0.9, vehicle: 0.8 },
    allowedVehicles: ["luxury_car", "suv", "taxi", "sports_car"],
    allowedNPCs: ["shopper", "tourist", "office_worker"]
  },

  // --- BANDARKHALI (Industrial Port City) ---
  azadNagar: {
    id: "azadNagar",
    name: "Azad Nagar",
    city: "Bandarkhali",
    color: 0xcd5c5c,
    bounds: { x: 3400, y: 500, width: 550, height: 250 },
    density: { npc: 0.7, vehicle: 0.5 },
    allowedVehicles: ["van", "truck", "small_car", "bike"],
    allowedNPCs: ["worker", "resident", "truck_driver"]
  },
  factoryZone: {
    id: "factoryZone",
    name: "Factory Zone",
    city: "Bandarkhali",
    color: 0x708090,
    bounds: { x: 3400, y: 750, width: 550, height: 500 },
    density: { npc: 0.6, vehicle: 0.8 },
    allowedVehicles: ["truck", "heavy_truck", "van", "forklift"],
    allowedNPCs: ["factory_worker", "supervisor", "truck_driver"]
  },
  harbor: {
    id: "harbor",
    name: "Harbor & Port Area",
    city: "Bandarkhali",
    color: 0x2f4f4f,
    bounds: { x: 3950, y: 750, width: 550, height: 1000 },
    density: { npc: 0.5, vehicle: 0.6 },
    allowedVehicles: ["heavy_truck", "forklift", "security_van"],
    allowedNPCs: ["dock_worker", "sailor", "customs_officer"]
  }
};
