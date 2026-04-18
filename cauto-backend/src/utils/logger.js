/**
 * Structured logger — lightweight pino-compatible interface.
 * Outputs JSON lines in production, readable format in development.
 *
 * Usage:
 *   const log = require("../utils/logger");
 *   log.info({ run_id, tenant: "cauto", rows: 42 }, "Ingestion complete");
 *   log.error({ err }, "Parser failed");
 */

const isProd = process.env.NODE_ENV === "production";

function format(level, obj, msg) {
  const base = {
    time:  new Date().toISOString(),
    level,
    msg:   msg || (typeof obj === "string" ? obj : ""),
    ...(typeof obj === "object" && obj !== null && typeof msg === "string" ? obj : {}),
  };

  if (isProd) return JSON.stringify(base);

  const { time, level: lvl, msg: m, ...rest } = base;
  const color = { info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m", debug: "\x1b[90m" };
  const reset = "\x1b[0m";
  const prefix = `${color[lvl] || ""}[${lvl.toUpperCase()}]${reset}`;
  const meta   = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
  return `${prefix} ${m}${meta}`;
}

function write(level, obj, msg) {
  const line = format(level, obj, msg);
  if (level === "error") console.error(line);
  else                   console.log(line);
}

const logger = {
  info:  (obj, msg) => write("info",  obj, msg),
  warn:  (obj, msg) => write("warn",  obj, msg),
  error: (obj, msg) => write("error", obj, msg),
  debug: (obj, msg) => { if (process.env.LOG_LEVEL === "debug") write("debug", obj, msg); },

  /** Create a child logger with fixed context fields */
  child(context) {
    return {
      info:  (obj, msg) => write("info",  { ...context, ...(typeof obj === "object" ? obj : {msg:obj}) }, msg),
      warn:  (obj, msg) => write("warn",  { ...context, ...(typeof obj === "object" ? obj : {msg:obj}) }, msg),
      error: (obj, msg) => write("error", { ...context, ...(typeof obj === "object" ? obj : {msg:obj}) }, msg),
      debug: (obj, msg) => { if (process.env.LOG_LEVEL === "debug") write("debug", { ...context, ...(typeof obj === "object" ? obj : {msg:obj}) }, msg); },
    };
  },
};

module.exports = logger;
