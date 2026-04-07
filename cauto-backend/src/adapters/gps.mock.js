const vehicles = [
  { id:"v1",  name:"Camion 01", plate:"FE-123AA", status:"active",   speed_kmh:47, fuel_pct:72, sector:"Zona Nord",  lat:44.848, lng:11.620 },
  { id:"v2",  name:"Camion 02", plate:"FE-456BB", status:"idle",     speed_kmh:0,  fuel_pct:55, sector:"Deposito",   lat:44.831, lng:11.607 },
  { id:"v3",  name:"Camion 03", plate:"FE-789CC", status:"workshop", speed_kmh:0,  fuel_pct:30, sector:"Officina",   lat:44.835, lng:11.612 },
  { id:"v4",  name:"Furgone 01",plate:"FE-321DD", status:"active",   speed_kmh:62, fuel_pct:88, sector:"Zona Sud",   lat:44.817, lng:11.600 },
  { id:"v5",  name:"Furgone 02",plate:"FE-654EE", status:"idle",     speed_kmh:0,  fuel_pct:15, sector:"Zona Est",   lat:44.836, lng:11.638 },
  { id:"v6",  name:"Camion 04", plate:"FE-987FF", status:"active",   speed_kmh:38, fuel_pct:60, sector:"Zona Ovest", lat:44.830, lng:11.585 },
];

let routes = [
  {
    id:"r1", name:"Zona Nord", color:"#4ade80", sector:"nord",
    vehicle:"Camion 01", status:"in_corso", stops:24,
    waypoints:[
      [44.831,11.607],[44.836,11.611],[44.840,11.614],[44.843,11.619],
      [44.847,11.617],[44.851,11.621],[44.854,11.618],[44.856,11.624],
      [44.852,11.628],[44.849,11.632],[44.845,11.627],[44.841,11.623],
      [44.837,11.620],[44.831,11.607],
    ],
  },
  {
    id:"r2", name:"Zona Sud", color:"#60a5fa", sector:"sud",
    vehicle:"Furgone 01", status:"in_corso", stops:18,
    waypoints:[
      [44.831,11.607],[44.827,11.608],[44.823,11.604],[44.819,11.601],
      [44.815,11.598],[44.812,11.603],[44.810,11.610],[44.813,11.616],
      [44.817,11.613],[44.821,11.617],[44.825,11.614],[44.829,11.611],
      [44.831,11.607],
    ],
  },
  {
    id:"r3", name:"Zona Est", color:"#fb923c", sector:"est",
    vehicle:"Furgone 02", status:"pianificato", stops:20,
    waypoints:[
      [44.831,11.607],[44.833,11.614],[44.835,11.621],[44.836,11.628],
      [44.838,11.634],[44.840,11.640],[44.837,11.645],[44.834,11.642],
      [44.831,11.636],[44.828,11.630],[44.830,11.622],[44.831,11.615],
      [44.831,11.607],
    ],
  },
  {
    id:"r4", name:"Zona Ovest", color:"#c084fc", sector:"ovest",
    vehicle:"Camion 04", status:"in_corso", stops:16,
    waypoints:[
      [44.831,11.607],[44.832,11.601],[44.830,11.594],[44.828,11.588],
      [44.826,11.582],[44.829,11.577],[44.833,11.581],[44.836,11.586],
      [44.834,11.593],[44.832,11.599],[44.831,11.607],
    ],
  },
  {
    id:"r5", name:"Centro Storico", color:"#f9a8d4", sector:"centro",
    vehicle:"Camion 02", status:"pianificato", stops:30,
    waypoints:[
      [44.831,11.607],[44.834,11.609],[44.836,11.613],[44.837,11.618],
      [44.836,11.622],[44.834,11.625],[44.831,11.623],[44.829,11.619],
      [44.828,11.614],[44.829,11.609],[44.831,11.607],
    ],
  },
];

let nextRouteId = 6;

module.exports = {
  getVehicles: async () => vehicles.map(v => ({
    ...v,
    speed_kmh: v.status === "active" ? Math.max(0, v.speed_kmh + Math.floor(Math.random()*10-5)) : 0,
  })),

  getRoutes: async () => routes,

  createRoute: async (data) => {
    const r = { id: `r${nextRouteId++}`, ...data };
    routes.push(r);
    return r;
  },

  updateRoute: async (id, data) => {
    const idx = routes.findIndex(r => r.id === id);
    if (idx === -1) return null;
    routes[idx] = { ...routes[idx], ...data };
    return routes[idx];
  },

  deleteRoute: async (id) => {
    const idx = routes.findIndex(r => r.id === id);
    if (idx === -1) return false;
    routes.splice(idx, 1);
    return true;
  },
};
