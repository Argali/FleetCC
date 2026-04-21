const provider = process.env.GPS_PROVIDER || "mock";

const adapters = {
  mock:    require("./gps.mock"),
  visirun: require("./gps.visirun"),
};

if (!adapters[provider]) {
  console.warn(`[GPS] Provider '${provider}' not found — falling back to mock`);
}

module.exports = adapters[provider] || adapters.mock;
