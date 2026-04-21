/**
 * VisiRun SOAP client
 *
 * Handles envelope construction, posting, XML parsing, and per-endpoint
 * rate-limit guarding.  All callers go through `callVisiRun()`.
 *
 * Environment:
 *   VISIRUN_API_KEY  — required when GPS_PROVIDER=visirun
 *
 * Rate limits (per API doc):
 *   getFleetCurrentPosition        1 000 / day   min 1 s
 *   getRoute                       1 000 / day   min 1 s
 *   getStops                         100 / veh   min 5 min same vehicle
 *   getFleetKpi                    1 000 / day   min 1 s
 *   getFleetOdometer               1 000 / day   min 1 s
 *   getNewEventsV2                 1 000 / day   min 1 s
 */

const xml2js = require("xml2js");

const ENDPOINT    = "https://app.visirun.com/public/Server.php";
const NAMESPACE   = "urn:Tracking";
const TIMEOUT_MS  = 15_000;

// ── Per-method last-call timestamps for rate-limit guarding ──────────────────
const _lastCall = {};

/**
 * Minimum delay (ms) between calls to the same method.
 * Uses the most conservative limit from the API docs.
 */
const MIN_DELAY_MS = {
  getFleetCurrentPosition:             1_000,
  getFleetCurrentPositionWithAddressV2:1_000,
  getRoute:                            1_000,
  getPartialRoute:                     1_000,
  getStops:                          300_000,  // 5 min same vehicle
  getNewRawTrackingDatasV2:          300_000,
  getFleetKpi:                         1_000,
  getFleetOdometer:                    1_000,
  getNewEventsV2:                      1_000,
  sendPlan:                           30_000,
  getPlanStatus:                       1_000,
  getNewFleetOperationsStatusV2:      60_000,
  addPoi:                              1_000,
  getPoiList:                          1_000,
};

function getApiKey() {
  const key = process.env.VISIRUN_API_KEY;
  if (!key) {
    throw new Error(
      "[VisiRun] VISIRUN_API_KEY is not set. " +
      "Add it to your environment variables before using GPS_PROVIDER=visirun."
    );
  }
  return key;
}

/**
 * Build a SOAP envelope for the given method + params object.
 * Every value is serialised as xsd:string (VisiRun only uses strings).
 */
function buildEnvelope(method, params, apiKey) {
  const paramXml = Object.entries(params)
    .map(([k, v]) => `      <${k} xsi:type="xsd:string">${v}</${k}>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/">
  <SOAP-ENV:Body>
    <ns1:${method} xmlns:ns1="${NAMESPACE}">
      <key xsi:type="xsd:string">${apiKey}</key>
${paramXml}
    </ns1:${method}>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

/**
 * Parse the raw XML text returned by VisiRun.
 * Returns the inner response object (below the SOAP Body wrapper).
 */
async function parseResponse(xmlText) {
  const parser = new xml2js.Parser({
    explicitArray:  false,
    ignoreAttrs:    true,
    explicitRoot:   false,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });
  const result = await parser.parseStringPromise(xmlText);

  // result is the Envelope; navigate to Body → first key
  const body = result?.Body;
  if (!body) {
    throw new Error(`[VisiRun] Unexpected SOAP response (no Body):\n${xmlText.slice(0, 400)}`);
  }
  const responseKey = Object.keys(body)[0];
  return body[responseKey]; // e.g. getFleetCurrentPositionResponse
}

/**
 * Core call — builds envelope, enforces rate-limit delay, posts, parses.
 *
 * @param {string} method   VisiRun SOAP method name
 * @param {object} params   Key-value pairs (all serialised as strings)
 * @returns {Promise<object>} Parsed inner response object
 */
async function callVisiRun(method, params = {}) {
  const apiKey = getApiKey();

  // Enforce minimum delay
  const minDelay = MIN_DELAY_MS[method] ?? 1_000;
  const now      = Date.now();
  const last     = _lastCall[method] ?? 0;
  const wait     = minDelay - (now - last);
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
  _lastCall[method] = Date.now();

  const envelope   = buildEnvelope(method, params, apiKey);
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let xmlText;
  try {
    const res = await fetch(ENDPOINT, {
      method:  "POST",
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        "SOAPAction":   `${NAMESPACE}#${method}`,
      },
      body:   envelope,
      signal: controller.signal,
    });
    xmlText = await res.text();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`[VisiRun] ${method} timed out after ${TIMEOUT_MS}ms`);
    }
    throw new Error(`[VisiRun] Network error calling ${method}: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  // VisiRun returns error 100 as a normal HTTP 200 with an XML fault
  if (xmlText.includes("<faultcode>") || xmlText.includes("<faultstring>")) {
    throw new Error(`[VisiRun] SOAP fault on ${method}:\n${xmlText.slice(0, 600)}`);
  }

  try {
    return await parseResponse(xmlText);
  } catch (err) {
    throw new Error(`[VisiRun] XML parse error on ${method}: ${err.message}\nRaw: ${xmlText.slice(0, 400)}`);
  }
}

/**
 * Normalise a VisiRun response value that may be a string, array, or object
 * into an array.  VisiRun wraps single elements as plain objects (xml2js
 * `explicitArray:false`), so this helper always returns an array.
 */
function toArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

module.exports = { callVisiRun, toArray };
