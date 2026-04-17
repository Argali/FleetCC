require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set");
  process.exit(1);
}

const express   = require("express");
const cors      = require("cors");
const path      = require("path");
const fs        = require("fs");
const rateLimit = require("express-rate-limit");

// Ensure uploads directory exists (Render ephemeral filesystem)
const uploadsDir = path.join(__dirname, "../uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

// Warn if seed credentials are still at their default values
const SEED_DEFAULTS = ["change_me_superadmin", "change_me_officina", "change_me_admin"];
["SEED_SUPERADMIN_PASSWORD", "SEED_OFFICINA_PASSWORD", "SEED_ADMIN_PASSWORD"].forEach(key => {
  const val = process.env[key];
  if (!val || SEED_DEFAULTS.includes(val)) {
    console.warn(`WARNING: ${key} is using a default/insecure value — set a strong password before production use`);
  }
});

const app = express();
app.use(require("./middleware/securityHeaders"));

const allowedOrigins = ["http://localhost:5173"];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// No-store on all API responses — prevents proxy/browser caching of auth'd data
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Strict rate limit on auth endpoints: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Troppi tentativi. Riprova tra 15 minuti." },
});

app.get("/health", (_req, res) => res.json({ status: "ok", uptime: Math.floor(process.uptime()) }));

app.use("/api/auth",        authLimiter, require("./routes/auth"));
app.use("/api/gps",         require("./routes/gps"));
app.use("/api/workshop",    require("./routes/workshop"));
app.use("/api/fuel",        require("./routes/fuel"));
app.use("/api/suppliers",   require("./routes/suppliers"));
app.use("/api/costs",       require("./routes/costs"));
app.use("/api/permissions", require("./routes/permissions"));
app.use("/api/admin",       require("./routes/users-admin"));
app.use("/api/segnalazioni",require("./routes/segnalazioni"));
app.use("/api/segnalazioni-territorio",require("./routes/segnalazioni-territorio"));
app.use("/api/reports",     require("./routes/reports"));
app.use("/api/superadmin",  require("./routes/superadmin"));
app.use("/api/bugs",        require("./routes/bugs"));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Cauto backend running on http://localhost:${PORT}`));
