let orders = [
  { id:"o1", vehicle:"Camion 01",  plate:"FE-123AA", type:"Tagliando",         status:"in_progress",   mechanic:"Luca B.",  eta:"2026-04-07", notes:"Cambio olio + filtri" },
  { id:"o2", vehicle:"Camion 03",  plate:"FE-789CC", type:"Freni",             status:"waiting_parts", mechanic:"Marco T.", eta:"2026-04-09", notes:"Sostituzione dischi anteriori" },
  { id:"o3", vehicle:"Furgone 02", plate:"FE-654EE", type:"Pneumatici",        status:"waiting_parts", mechanic:null,       eta:null,         notes:"In attesa ricambi da fornitore" },
  { id:"o4", vehicle:"Camion 02",  plate:"FE-456BB", type:"Impianto elettrico",status:"done",          mechanic:"Paolo R.", eta:null,         notes:"Riparazione cablaggio" },
  { id:"o5", vehicle:"Furgone 01", plate:"FE-321DD", type:"Revisione",         status:"done",          mechanic:"Luca B.",  eta:null,         notes:"Revisione annuale superata" },
];

const workshopRepository = {
  findAll() {
    return [...orders];
  },

  findById(id) {
    return orders.find(o => o.id === id) || null;
  },

  update(id, updates) {
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return null;
    // Immutable update
    orders = orders.map(o => o.id === id ? { ...o, ...updates } : o);
    return orders.find(o => o.id === id);
  },
};

module.exports = workshopRepository;
