const entries = [
  { date:"2026-04-01", vehicle:"Camion 01",  liters:120, cost_eur:"186.00",  km:87450, station:"ENI Ferrara Nord" },
  { date:"2026-04-01", vehicle:"Furgone 01", liters:65,  cost_eur:"100.75",  km:34210, station:"Q8 Via Modena" },
  { date:"2026-03-29", vehicle:"Camion 02",  liters:135, cost_eur:"209.25",  km:92100, station:"ENI Ferrara Nord" },
  { date:"2026-03-28", vehicle:"Camion 04",  liters:110, cost_eur:"170.50",  km:61300, station:"IP Autostrada A13" },
  { date:"2026-03-27", vehicle:"Furgone 02", liters:58,  cost_eur:"89.90",   km:28900, station:"Q8 Via Modena" },
  { date:"2026-03-25", vehicle:"Camion 01",  liters:125, cost_eur:"193.75",  km:87200, station:"ENI Ferrara Nord" },
  { date:"2026-03-24", vehicle:"Camion 03",  liters:140, cost_eur:"217.00",  km:55600, station:"IP Autostrada A13" },
];

const summary = {
  total_liters:          753,
  total_cost_eur:        1167.15,
  total_km:              62850,
  avg_consumption_l100:  11.97,
};

const fuelRepository = {
  findAllEntries: () => [...entries],
  getSummary:     () => ({ ...summary }),
};

module.exports = fuelRepository;
