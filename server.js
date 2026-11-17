require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("./src/db");
const authRoutes = require("./src/routes/auth");
const apiRoutes = require("./src/routes/api");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === "production";
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  if (isProd) throw new Error("SESSION_SECRET must be set to a random value of at least 32 characters.");
  console.warn("WARNING: Set a strong SESSION_SECRET in .env before public deployment.");
  process.env.SESSION_SECRET = crypto.randomBytes(48).toString("hex");
}

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "https://www.youtube-nocookie.com", "https://www.youtube.com", "https://zoom.us", "https://*.zoom.us"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir, concurrentDB: true }),
  name: "cipher.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, sameSite: "strict", secure: isProd, maxAge: 1000 * 60 * 60 * 8 }
}));

// Lightweight synchronizer-token CSRF protection for all state-changing API requests.
app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const token = req.get("x-csrf-token");
  if (!req.session.csrfToken || !token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "Security token expired. Refresh the page and try again." });
  }
  next();
});
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: true, legacyHeaders: false }));

app.get("/api/bootstrap", (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  const user = req.session.user ? db.publicUser(req.session.user.id) : null;
  res.json({ csrfToken: req.session.csrfToken, user });
});

app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.listen(PORT, () => {
  console.log(`CIPHER Code Academy running at http://localhost:${PORT}`);
  console.log("For first login, use the administrator details in your .env file.");
});
