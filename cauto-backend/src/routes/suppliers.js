const express = require("express");
const { requireAuth, requirePerm } = require("../middleware/auth");

const router = express.Router();

const suppliers = [
  { id:"s1", name:"ENI Ferrara",       category:"Carburante",   contact:"0532-123456", email:"ferrara@eni.it",        notes:"Contratto annuale — sconto 3%" },
  { id:"s2", name:"Ricambi Rossi",     category:"Ricambi",      contact:"0532-234567", email:"info@ricambirossi.it",  notes:"Fornitore principale motori" },
  { id:"s3", name:"Pneumatici Bianchi",category:"Pneumatici",   contact:"0532-345678", email:"ordini@pneubianci.it",  notes:null },
  { id:"s4", name:"Lubrificanti Verdi",category:"Lubrificanti", contact:"0532-456789", email:"vendite@lubriverdi.it", notes:"Consegna in 48h" },
  { id:"s5", name:"Q8 Distribuzione",  category:"Carburante",   contact:"02-567890",   email:"flotte@q8.it",          notes:"Tessera fleet attiva" },
  { id:"s6", name:"AutoRicambi Est",   category:"Ricambi",      contact:"0532-678901", email:"info@autoricambiest.it",notes:"Ricambi elettrici specializzati" },
];

router.get("/", requireAuth, requirePerm("suppliers", "view"), (req, res) => {
  res.json({ ok: true, data: suppliers });
});

module.exports = router;
