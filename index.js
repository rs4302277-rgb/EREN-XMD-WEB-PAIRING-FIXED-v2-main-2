import "./config.js";
import express from "express";
import path from "path";
import fs from "fs-extra";
import { fileURLToPath } from "url";
import { manager, main, db, pluginQueueStats } from "./lib/client.js";
import { getPluginInfo } from "./lib/plugins.js";
import config from "./config.js";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));
const SESSIONS_DIR = path.join(process.cwd(), "sessions");
const DATA_DIR = path.join(process.cwd(), "data");
const STATS_FILE = path.join(DATA_DIR, "site-stats.json");
const PUBLIC_DIR = path.join(__dirname, "public");
await fs.mkdirp(SESSIONS_DIR);
await fs.mkdirp(DATA_DIR);

let stats = { visits: 0, startedAt: Date.now() };
try { stats = { ...stats, ...(await fs.readJson(STATS_FILE)) }; } catch {}
let statsWrite = Promise.resolve();
function saveStats() {
  statsWrite = statsWrite.then(() => fs.writeJson(STATS_FILE, stats, { spaces: 2 })).catch((e) => console.error("[stats] save failed:", e.message));
  return statsWrite;
}
function fmtCode(raw) { return String(raw || "").replace(/\s+/g, "").match(/.{1,4}/g)?.join("-") || ""; }
function normalizePhone(value) { return String(value || "").replace(/\D/g, ""); }
function validPhone(phone) { return /^[1-9][0-9]{7,14}$/.test(phone); }
function sessionCounts() {
  const all = manager.list();
  const active = all.filter((s) => s.status === "connected" && s.alive).length;
  return { total: all.length, active };
}
const ipWindows = new Map();
const phoneCooldown = new Map();
function rateLimit({ limit = 8, windowMs = 10 * 60_000 } = {}) {
  return (req, res, next) => {
    const ip = String(req.ip || req.socket.remoteAddress || "unknown");
    const now = Date.now();
    let entry = ipWindows.get(ip);
    if (!entry || now - entry.start > windowMs) entry = { start: now, count: 0 };
    entry.count++;
    ipWindows.set(ip, entry);
    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - entry.count)));
    if (entry.count > limit) return res.status(429).json({ ok: false, error: "Too many attempts. Please wait a few minutes and try again." });
    next();
  };
}
function adminOnly(req, res, next) {
  const secret = process.env.ADMIN_API_KEY;
  if (!secret) return res.status(503).json({ ok: false, error: "Admin endpoints are disabled. Set ADMIN_API_KEY to enable them." });
  const supplied = String(req.get("x-admin-key") || "");
  if (supplied.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.get("/", async (_req, res) => {
  stats.visits = Math.min(Number(stats.visits || 0) + 1, Number.MAX_SAFE_INTEGER);
  await saveStats();
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});
app.use(express.static(PUBLIC_DIR, { index: false, maxAge: "1h" }));
app.get("/api/stats", (_req, res) => {
  const counts = sessionCounts();
  res.json({ ok: true, visits: stats.visits, activeSessions: counts.active, totalSessions: counts.total, plugins: getPluginInfo().total, uptimeSeconds: Math.floor(process.uptime()), queue: pluginQueueStats() });
});
app.get("/api/health", (_req, res) => res.json({ ok: true, status: "online", timestamp: new Date().toISOString() }));

// Pair only numbers explicitly submitted by the user. WhatsApp requires country code + digits, without punctuation.
app.post("/api/pair", rateLimit({ limit: 6, windowMs: 10 * 60_000 }), async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!validPhone(phone)) return res.status(400).json({ ok: false, error: "Enter a valid number including country calling code (8–15 digits, digits only after formatting)." });
  const now = Date.now();
  const previous = phoneCooldown.get(phone) || 0;
  if (now - previous < 90_000) return res.status(429).json({ ok: false, error: "A code was requested for this number recently. Wait 90 seconds before trying again." });
  phoneCooldown.set(phone, now);
  try {
    let sock = manager.sessions.get(phone)?.sock;
    if (manager.isRunning(phone) && sock?.authState?.creds?.registered) {
      return res.status(409).json({ ok: false, error: "This number already has a saved linked session on this service." });
    }
    sock = await manager.start(phone);
    if (!sock) sock = manager.sessions.get(phone)?.sock;
    if (!sock) throw new Error("WhatsApp socket could not be initialized. Please retry.");
    if (sock.authState?.creds?.registered) return res.status(409).json({ ok: false, error: "This number is already paired. Use the linked session or remove its saved credentials first." });
    // Wait for Baileys handshake/QR readiness instead of requesting too early.
    if (sock.pairingReady) await Promise.race([sock.pairingReady, new Promise((resolve) => setTimeout(resolve, 10000))]);
    if (sock.authState?.creds?.registered) return res.status(409).json({ ok: false, error: "This number is already paired." });
    if (typeof sock.requestPairingCode !== "function") throw new Error("This Baileys build does not support pairing codes.");
    const raw = await sock.requestPairingCode(phone);
    if (!raw) throw new Error("WhatsApp did not return a pairing code. Wait and retry.");
    res.json({ ok: true, phone, code: fmtCode(raw), instructions: "On WhatsApp, open Settings → Linked devices → Link a device → Link with phone number instead, then enter this code." });
  } catch (error) {
    console.error("[pair] failed:", error?.message || error);
    return res.status(502).json({ ok: false, error: String(error?.message || error).slice(0, 220) });
  }
});

// Operational endpoints are private; never expose session credentials or logout controls publicly.
app.get("/api/admin/sessions", adminOnly, (_req, res) => res.json({ ok: true, sessions: manager.list() }));
app.post("/api/admin/stop/:sessionId", adminOnly, async (req, res) => {
  const sid = String(req.params.sessionId || "").replace(/[^0-9]/g, "");
  if (!sid) return res.status(400).json({ ok: false, error: "Invalid session id" });
  try { res.json({ ok: await manager.stop(sid), sessionId: sid }); }
  catch (e) { res.status(500).json({ ok: false, error: e?.message || String(e) }); }
});
app.post("/api/admin/logout/:sessionId", adminOnly, async (req, res) => {
  const sid = String(req.params.sessionId || "").replace(/[^0-9]/g, "");
  if (!sid) return res.status(400).json({ ok: false, error: "Invalid session id" });
  try { res.json({ ok: await manager.logout(sid), sessionId: sid }); }
  catch (e) { res.status(500).json({ ok: false, error: e?.message || String(e) }); }
});

const PORT = Number(process.env.PORT) || 3000;
let server;
async function shutdown(signal) {
  console.log(`[app] ${signal}: graceful shutdown`);
  if (server) await new Promise((resolve) => server.close(resolve));
  try { await manager.stopAll(); await db.flush(); await db.close(); await saveStats(); }
  catch (e) { console.error("[app] shutdown error:", e?.message || e); }
  process.exit(0);
}
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
try {
  console.log("[app] Initializing WhatsApp bot...");
  // Load DB/plugins first, then expose the website immediately. Session reconnects
  // happen in the background so slow WhatsApp handshakes do not block Railway health checks.
  await main({ autoStartAll: false });
  server = app.listen(PORT, "0.0.0.0", () => console.log(`[app] Website and API listening on ${PORT}`));
  server.on("error", (err) => { console.error("[app] server error:", err.message); process.exit(1); });
  manager.startAll().catch((err) => console.error("[app] session auto-start failed:", err?.message || err));
} catch (err) {
  console.error("[app] Fatal startup error:", err?.stack || err);
  process.exit(1);
}
