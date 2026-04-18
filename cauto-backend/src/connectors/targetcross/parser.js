/**
 * Target Cross — Parser
 *
 * Responsibility: fetch raw bytes from the ERP source and return a
 * structured raw dataset (plain JS objects, no canonical mapping yet).
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  STATUS: STUB — Real XML parsing is commented below.           │
 * │                                                                 │
 * │  When Target Cross access is available:                         │
 * │    1. Install fast-xml-parser:  npm install fast-xml-parser     │
 * │    2. Set TARGETCROSS_XML_PATH or TARGETCROSS_API_URL in .env  │
 * │    3. Uncomment the real implementation below                   │
 * │    4. Remove the fixture fallback                               │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Expected output shape:
 * {
 *   vehicles:    Array<Record<string, unknown>>,
 *   operators:   Array<Record<string, unknown>>,
 *   maintenance: Array<Record<string, unknown>>,
 * }
 */

const fs   = require("fs");
const path = require("path");

// ── Real implementation (uncomment when TC access is available) ───────────────
//
// const { XMLParser } = require("fast-xml-parser");
//
// async function parseFromFile(filePath) {
//   const xml    = fs.readFileSync(filePath, "utf8");
//   const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
//   const doc    = parser.parse(xml);
//
//   // Adjust these paths to match the real Target Cross XML structure
//   const root   = doc?.TargetCross || doc?.root || doc;
//   return {
//     vehicles:    toArray(root?.Mezzi?.Mezzo          || root?.vehicles),
//     operators:   toArray(root?.Operatori?.Operatore  || root?.operators),
//     maintenance: toArray(root?.Interventi?.Intervento || root?.maintenance),
//   };
// }
//
// function toArray(v) {
//   if (!v) return [];
//   return Array.isArray(v) ? v : [v];
// }
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Development fixture (active until real TC access is available) ────────────
const FIXTURE_PATH = path.resolve(__dirname, "../../tests/fixtures/targetcross/sample.json");

async function parseFromFixture() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    // Return empty dataset if fixture is missing — connector still runs cleanly
    console.warn("[TargetCross/parser] Fixture not found at", FIXTURE_PATH, "— returning empty dataset");
    return { vehicles: [], operators: [], maintenance: [] };
  }
  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
  return {
    vehicles:    raw.vehicles    || [],
    operators:   raw.operators   || [],
    maintenance: raw.maintenance || [],
  };
}

/**
 * Main parse entry point.
 * Priority: file from TARGETCROSS_XML_PATH → fixture → empty dataset
 *
 * @returns {Promise<RawDataset>}
 */
async function parse() {
  const xmlPath = process.env.TARGETCROSS_XML_PATH;

  if (xmlPath) {
    // Real file provided — uncomment real implementation above and use:
    // return parseFromFile(xmlPath);
    console.warn("[TargetCross/parser] TARGETCROSS_XML_PATH is set but real parser is not yet active — using fixture");
  }

  return parseFromFixture();
}

module.exports = { parse };
