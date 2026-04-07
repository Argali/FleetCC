require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app = express();
const allowedOrigins = ["http://localhost:5173"];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth",        require("./routes/auth"));
app.use("/api/gps",         require("./routes/gps"));
app.use("/api/workshop",    require("./routes/workshop"));
app.use("/api/fuel",        require("./routes/fuel"));
app.use("/api/suppliers",   require("./routes/suppliers"));
app.use("/api/costs",       require("./routes/costs"));
app.use("/api/permissions", require("./routes/permissions"));
app.use("/api/admin",       require("./routes/users-admin"));
app.use("/api/segnalazioni",require("./routes/segnalazioni"));
app.use("/api/reports",     require("./routes/reports"));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Cauto backend running on http://localhost:${PORT}`));
