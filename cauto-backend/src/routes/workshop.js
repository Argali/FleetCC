const express = require("express");
const { requireAuth, requirePerm } = require("../middleware/auth");

const router = express.Router();

let orders = [
  { id:"o1", vehicle:"Camion 01", plate:"FE-123AA", type:"Tagliando",        status:"in_progress",  mechanic:"Luca B.",  eta:"2026-04-07", notes:"Cambio olio + filtri" },
  { id:"o2", vehicle:"Camion 03", plate:"FE-789CC", type:"Freni",            status:"waiting_parts", mechanic:"Marco T.", eta:"2026-04-09", notes:"Sostituzione dischi anteriori" },
  { id:"o3", vehicle:"Furgone 02",plate:"FE-654EE", type:"Pneumatici",       status:"waiting_parts", mechanic:null,       eta:null,         notes:"In attesa ricambi da fornitore" },
  { id:"o4", vehicle:"Camion 02", plate:"FE-456BB", type:"Impianto elettrico",status:"done",         mechanic:"Paolo R.", eta:null,         notes:"Riparazione cablaggio" },
  { id:"o5", vehicle:"Furgone 01",plate:"FE-321DD", type:"Revisione",        status:"done",         mechanic:"Luca B.",  eta:null,         notes:"Revisione annuale superata" },
];

router.get("/orders", requireAuth, requirePerm("workshop", "view"), (req, res) => {
  res.json({ ok: true, data: orders });
});

router.patch("/orders/:id", requireAuth, requirePerm("workshop", "edit"), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: "Ordine non trovato" });
  const { status, mechanic, eta, notes } = req.body;
  if (status)   order.status   = status;
  if (mechanic) order.mechanic = mechanic;
  if (eta)      order.eta      = eta;
  if (notes)    order.notes    = notes;
  res.json({ ok: true, data: order });
});

module.exports = router;
module.exports.getData = () => orders;
