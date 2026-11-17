const router = require("express").Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const { db, publicUser } = require("../db");
const { sendVerification } = require("../mailer");
const { requireAuth } = require("../middleware");

const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));
const hashCode = v => crypto.createHash("sha256").update(String(v)).digest("hex");

router.post("/register", async (req, res) => {
 const name = String(req.body.name || "").trim();
 const email = String(req.body.email || "").trim().toLowerCase();
 const password = String(req.body.password || "");
 if (name.length < 2 || name.length > 80 || !validEmail(email) || password.length < 10 || password.length > 100) {
  return res.status(400).json({ error: "Enter a name, valid email and password of at least 10 characters." });
 }
 if (db.prepare("SELECT id FROM users WHERE email=?").get(email)) return res.status(409).json({ error: "An account with that email already exists." });
 const result = db.prepare("INSERT INTO users(name,email,password_hash,role,status) VALUES(?,?,?,'learner','pending')")
  .run(name, email, await bcrypt.hash(password, 12));
 const code = String(crypto.randomInt(100000, 999999));
 db.prepare("INSERT INTO verification_codes(user_id,code_hash,expires_at) VALUES(?,?,?)")
  .run(result.lastInsertRowid, hashCode(code), Date.now() + 15 * 60 * 1000);
 await sendVerification(email, code);
 res.status(201).json({ message: "Account created. Verify your email, then wait for an administrator to activate your learner account.", verificationSent: true });
});

router.post("/verify-email", (req, res) => {
 const email = String(req.body.email || "").trim().toLowerCase();
 const code = String(req.body.code || "").trim();
 const user = db.prepare("SELECT id FROM users WHERE email=?").get(email);
 if (!user || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Invalid verification details." });
 const record = db.prepare("SELECT * FROM verification_codes WHERE user_id=? AND used=0 ORDER BY id DESC LIMIT 1").get(user.id);
 if (!record || record.expires_at < Date.now() || record.code_hash !== hashCode(code)) return res.status(400).json({ error: "The code is invalid or expired." });
 db.prepare("UPDATE verification_codes SET used=1 WHERE id=?").run(record.id);
 db.prepare("UPDATE users SET email_verified=1 WHERE id=?").run(user.id);
 res.json({ message: "Email verified. Your account will be available after administrator approval." });
});

router.post("/login", async (req, res) => {
 const email = String(req.body.email || "").trim().toLowerCase();
 const password = String(req.body.password || "");
 const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
 if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Email or password is incorrect." });
 if (user.status !== "active") return res.status(403).json({ error: user.email_verified ? "Your account is awaiting administrator approval." : "Verify your email before signing in." });
 if (user.totp_enabled) {
  const token = String(req.body.totp || "");
  if (!authenticator.check(token, user.totp_secret)) return res.status(401).json({ error: "Enter the current code from your authenticator app.", needsTotp: true });
 }
 req.session.regenerate(err => {
  if (err) return res.status(500).json({ error: "Could not create a secure session." });
  req.session.user = { id: user.id };
  req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  res.json({ user: publicUser(user.id), csrfToken: req.session.csrfToken });
 });
});

router.post("/logout", requireAuth, (req, res) => req.session.destroy(() => res.json({ message: "Signed out." })));

router.post("/2fa/setup", requireAuth, async (req, res) => {
 const user = req.user;
 const secret = authenticator.generateSecret();
 const otpauth = authenticator.keyuri(user.email, "CIPHER Code Academy", secret);
 db.prepare("UPDATE users SET totp_secret=? WHERE id=?").run(secret, user.id);
 res.json({ secret, qr: await QRCode.toDataURL(otpauth), message: "Scan the QR code, then confirm with a current six-digit code." });
});
router.post("/2fa/enable", requireAuth, (req, res) => {
 const row = db.prepare("SELECT totp_secret FROM users WHERE id=?").get(req.user.id);
 if (!row.totp_secret || !authenticator.check(String(req.body.code || ""), row.totp_secret)) return res.status(400).json({ error: "That authenticator code is not valid." });
 db.prepare("UPDATE users SET totp_enabled=1 WHERE id=?").run(req.user.id);
 res.json({ message: "Two-factor authentication enabled." });
});
router.post("/2fa/disable", requireAuth, (req, res) => {
 const row = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
 if (!bcrypt.compareSync(String(req.body.password || ""), row.password_hash)) return res.status(400).json({ error: "Password confirmation failed." });
 db.prepare("UPDATE users SET totp_enabled=0,totp_secret=NULL WHERE id=?").run(req.user.id);
 res.json({ message: "Two-factor authentication disabled." });
});

module.exports = router;
