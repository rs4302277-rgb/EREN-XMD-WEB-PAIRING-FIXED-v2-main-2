import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} from "@whiskeysockets/baileys";
import pino from "pino";
import path from "path";
import fs from "fs/promises";

/**
 * Create a Baileys WhatsApp socket for a given session.
 *
 * @param {string} sessionId   - Filesystem-safe session ID (already sanitized by SessionManager)
 * @param {object} [opts]
 * @param {function} [opts.onQR]  - Called with (qrString) whenever a QR code is generated
 * @returns {Promise<WASocket>}
 */
export async function createSocket(sessionId, opts = {}) {
  const { onQR } = opts;

  const sessionsDir = path.join(process.cwd(), "sessions");
  await fs.mkdir(sessionsDir, { recursive: true });

  const sessionPath = path.join(sessionsDir, sessionId);
  await fs.mkdir(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  let version;
  try {
    if (typeof fetchLatestWaWebVersion === "function") {
      const latest = await fetchLatestWaWebVersion();
      version = latest.version;
    }
  } catch (e) {
    console.warn(`[${sessionId}] latest WA Web version lookup failed: ${e?.message || e}`);
  }
  if (!version) {
    const latest = await fetchLatestBaileysVersion();
    version = latest.version;
  }

  console.log(
    `[${sessionId}] Creating socket with Baileys v${version.join(".")}`
  );

  const silentLogger = pino({ level: "silent" });

  const sock = makeWASocket({
    version,
    logger: silentLogger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
    },
    browser: Browsers.macOS("Safari"),
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 30_000,
    markOnlineOnConnect: true,
    syncFullHistory: false,
  });

  // Tag socket with sessionId (used by lib/index.js and plugins)
  sock.sessionId = sessionId;

  // Persist credentials whenever they change.
  sock.ev.on("creds.update", saveCreds);

  // Expose a one-shot readiness promise for the web pairing route. Baileys
  // emits its initial QR update when the socket is ready to request a code.
  sock.pairingReady = new Promise((resolve) => {
    let settled = false;
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };
    sock.ev.on("connection.update", ({ qr, connection }) => {
      if (qr || connection === "open") done(true);
      if (connection === "close") done(false);
    });
    setTimeout(() => done(false), 12000).unref?.();
  });

  // Surface QR code to caller — do NOT handle reconnect logic here.
  // SessionManager owns all connection.update reconnect logic via _handleConnectionUpdate.
  sock.ev.on("connection.update", ({ qr }) => {
    if (qr) {
      console.log(`[${sessionId}] QR code ready`);
      if (typeof onQR === "function") {
        try {
          onQR(qr);
        } catch (e) {
          /* never let onQR crash socket creation */
        }
      }
    }
  });

  return sock;
}
