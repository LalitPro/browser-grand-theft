export interface RoadNode {
  id: string;
  x: number;
  y: number;
  connections: string[]; // ids of connected nodes
  type: "highway" | "city" | "village" | "bridge";
}

export interface TollPlaza {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  highway: string;
}

export interface Bridge {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  river: string;
}

export const ROAD_NODES: Record<string, RoadNode> = {
  // --- NH-01 (Horizontal Highway from Navapur to Indrapuri Entrance) ---
  nh_start: { id: "nh_start", x: 0, y: 1450, connections: ["nh_1"], type: "highway" },
  nh_1: { id: "nh_1", x: 600, y: 1450, connections: ["nh_start", "nh_2", "nav_mandi_junction"], type: "highway" },
  nh_2: { id: "nh_2", x: 1200, y: 1450, connections: ["nh_1", "nh_bridge_west"], type: "highway" },
  nh_bridge_west: { id: "nh_bridge_west", x: 1500, y: 1450, connections: ["nh_2", "nh_bridge_east"], type: "bridge" },
  nh_bridge_east: { id: "nh_bridge_east", x: 1700, y: 1450, connections: ["nh_bridge_west", "nh_3"], type: "bridge" },
  nh_3: { id: "nh_3", x: 1950, y: 1450, connections: ["nh_bridge_east", "nh_4", "toll_indrapuri"], type: "highway" },
  nh_4: { id: "nh_4", x: 2350, y: 1450, connections: ["nh_3", "ind_downtown_junction"], type: "highway" },

  // --- MH-01 (Highway linking Kisanpur, Toll Plaza, and Bandarkhali) ---
  mh_kisanpur: { id: "mh_kisanpur", x: 1500, y: 700, connections: ["mh_1"], type: "highway" },
  mh_1: { id: "mh_1", x: 1800, y: 700, connections: ["mh_kisanpur", "toll_kisanpur"], type: "highway" },
  toll_kisanpur: { id: "toll_kisanpur", x: 2000, y: 700, connections: ["mh_1", "mh_2"], type: "highway" },
  mh_2: { id: "mh_2", x: 2200, y: 700, connections: ["toll_kisanpur", "mh_3"], type: "highway" },
  mh_3: { id: "mh_3", x: 2800, y: 700, connections: ["mh_2", "mh_4"], type: "highway" },
  mh_4: { id: "mh_4", x: 3300, y: 700, connections: ["mh_3", "ban_factory_junction"], type: "highway" },
  mh_end: { id: "mh_end", x: 3800, y: 700, connections: ["mh_4", "ban_harbor_junction"], type: "highway" },

  // --- Connecting Highway (Vertical link between NH-01 and MH-01) ---
  conn_highway_south: { id: "conn_highway_south", x: 1950, y: 1450, connections: ["nh_3", "conn_highway_mid"], type: "highway" },
  conn_highway_mid: { id: "conn_highway_mid", x: 1950, y: 1050, connections: ["conn_highway_south", "conn_highway_north"], type: "highway" },
  conn_highway_north: { id: "conn_highway_north", x: 1950, y: 700, connections: ["conn_highway_mid", "toll_kisanpur"], type: "highway" },

  // --- Navapur Grid Nodes ---
  nav_mandi_junction: { id: "nav_mandi_junction", x: 900, y: 1000, connections: ["nh_1", "nav_mandi_1", "nav_basti_1"], type: "city" },
  nav_basti_1: { id: "nav_basti_1", x: 300, y: 1000, connections: ["nav_mandi_junction", "nav_basti_2"], type: "city" },
  nav_basti_2: { id: "nav_basti_2", x: 300, y: 1600, connections: ["nav_basti_1", "nav_shanti_1"], type: "city" },
  nav_shanti_1: { id: "nav_shanti_1", x: 300, y: 1850, connections: ["nav_basti_2", "nav_chawl_1"], type: "city" },
  nav_chawl_1: { id: "nav_chawl_1", x: 900, y: 1850, connections: ["nav_shanti_1", "nav_mandi_1"], type: "city" },
  nav_mandi_1: { id: "nav_mandi_1", x: 900, y: 1000, connections: ["nav_chawl_1", "nav_mandi_junction"], type: "city" },

  // --- Indrapuri Grid Nodes ---
  toll_indrapuri: { id: "toll_indrapuri", x: 2350, y: 1250, connections: ["nh_3", "ind_downtown_1"], type: "highway" },
  ind_downtown_junction: { id: "ind_downtown_junction", x: 2500, y: 1450, connections: ["nh_4", "ind_downtown_1", "ind_uni_1"], type: "city" },
  ind_downtown_1: { id: "ind_downtown_1", x: 2600, y: 1250, connections: ["toll_indrapuri", "ind_downtown_junction", "ind_vasant_1"], type: "city" },
  ind_vasant_1: { id: "ind_vasant_1", x: 3200, y: 1350, connections: ["ind_downtown_1", "ind_centre_1"], type: "city" },
  ind_centre_1: { id: "ind_centre_1", x: 3000, y: 1750, connections: ["ind_vasant_1", "ind_uni_1"], type: "city" },
  ind_uni_1: { id: "ind_uni_1", x: 2500, y: 1750, connections: ["ind_centre_1", "ind_downtown_junction"], type: "city" },

  // --- Bandarkhali Grid Nodes ---
  ban_factory_junction: { id: "ban_factory_junction", x: 3500, y: 850, connections: ["mh_4", "ban_azad_1", "ban_factory_1"], type: "city" },
  ban_azad_1: { id: "ban_azad_1", x: 3500, y: 600, connections: ["ban_factory_junction", "ban_lighthouse_path"], type: "city" },
  ban_lighthouse_path: { id: "ban_lighthouse_path", x: 3900, y: 600, connections: ["ban_azad_1"], type: "city" },
  ban_factory_1: { id: "ban_factory_1", x: 3500, y: 1200, connections: ["ban_factory_junction", "ban_harbor_junction"], type: "city" },
  ban_harbor_junction: { id: "ban_harbor_junction", x: 3800, y: 1200, connections: ["mh_end", "ban_factory_1"], type: "city" }
};

export const TOLL_PLAZAS: TollPlaza[] = [
  { id: "toll_kisan", name: "Kisanpur Toll Plaza", x: 2000, y: 700, width: 40, height: 100, highway: "MH-01" },
  { id: "toll_indrapuri", name: "Indrapuri Toll Plaza", x: 2350, y: 1250, width: 40, height: 80, highway: "Indrapuri Link" },
  { id: "toll_conn", name: "Kisanpur South Toll Plaza", x: 1950, y: 1050, width: 100, height: 40, highway: "NH/MH Connector" }
];

export const BRIDGES: Bridge[] = [
  { id: "bridge_kisan", name: "Kisanpur River Bridge", x: 1400, y: 500, width: 120, height: 40, river: "Chandani River" },
  { id: "bridge_nh01", name: "NH-01 River Bridge", x: 1600, y: 1450, width: 200, height: 50, river: "Chandani River" },
  { id: "bridge_railway", name: "Chandani Rail Bridge", x: 1600, y: 950, width: 150, height: 30, river: "Chandani River" }
];
