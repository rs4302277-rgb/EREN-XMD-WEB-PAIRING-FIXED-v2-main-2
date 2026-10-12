import config from "../config.js";
import { Module } from "../lib/plugins.js";
import { manager, db } from "../lib/client.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanNumber = (value) => String(value || "").replace(/[^0-9]/g, "");

function senderNumber(message) {
  const raw = message?.sender || message?.key?.participant || message?.key?.participantAlt || message?.conn?.user?.id || "";
  return cleanNumber(raw).slice(0, 15);
}

function sessionId(message) {
  return String(message?.conn?.sessionId || message?.conn?.user?.id || "").split("@")[0].split(":")[0];
}

function isOwner(message) {
  const owner = cleanNumber(config.ownerNumber || config.owner || "");
  const sender = senderNumber(message);
  return !!sender && !!owner && sender === owner || !!message?.isFromMe || !!message?.isfromMe;
}

function sudoList(sid) {
  const list = db.get(sid, "sudo_users", []);
  return Array.isArray(list) ? list.map(cleanNumber).filter(Boolean) : [];
}

function isSudo(message) {
  const sid = sessionId(message);
  const sender = senderNumber(message);
  return !!sender && sudoList(sid).includes(sender);
}

function pairingAllowed(message) {
  const sid = sessionId(message);
  const mode = String(db.get(sid, "mode", config.mode || "public") || "public").toLowerCase();
  if (mode !== "private") return true;
  return isOwner(message) || isSudo(message);
}

function targetFrom(message, args) {
  const direct = cleanNumber(args);
  if (direct.length >= 7) return direct.slice(0, 15);
  const mentioned = Array.isArray(message?.mentions) ? message.mentions[0] : null;
  const mentionNumber = cleanNumber(mentioned);
  if (mentionNumber.length >= 7) return mentionNumber.slice(0, 15);
  return "";
}

Module({
  command: "pair",
  aliases: ["pairing"],
  package: "general",
  description: "Generate a WhatsApp pairing code for a number",
})(async (message, args) => {
  try {
    if (!pairingAllowed(message)) {
      return message.send("╭━━〔 🔒 𝐏𝐑𝐈𝐕𝐀𝐓𝐄 〕━━┈⊷\n┃✧ Pairing is private.\n┃✧ Only the bot owner and sudo users can use this command.\n╰━━━━━━━━━━━━━━━━━━⊷");
    }

    const number = targetFrom(message, args);
    if (!/^\d{7,15}$/.test(number) || number.startsWith("0")) {
      return message.send(`╭━━〔 🔗 𝐏𝐀𝐈𝐑 〕━━┈⊷\n┃✧ Usage : ${config.prefix || "."}pair +91XXXXXXXXXX\n┃✧ Example: ${config.prefix || "."}pair +919876543210\n╰━━━━━━━━━━━━━━━━━━⊷`);
    }

    if (number === cleanNumber(message?.conn?.user?.id)) {
      return message.send("❌ You cannot create a new pairing code for the already connected bot number.");
    }

    const existing = manager.sessions.get(number);
    if (existing?.status === "connected") {
      return message.send(`⚠️ *Already Connected*\n\n📱 +${number}\n\nUse the session management command to remove it before pairing again.`);
    }

    await message.react("🔐").catch(() => {});
    const loading = await message.send(`╭━━〔 🔗 𝐏𝐀𝐈𝐑𝐈𝐍𝐆 〕━━┈⊷\n┃✧ Number : +${number}\n┃✧ Status : Generating pair code...\n╰━━━━━━━━━━━━━━━━━━⊷`);

    // Keep V6's SessionManager/socket architecture. A fresh socket is created
    // first, then the pairing code is requested while the socket is connecting.
    const sock = await manager.start(number);
    if (!sock || typeof sock.requestPairingCode !== "function") {
      throw new Error("Pairing code is not supported by the active WhatsApp socket.");
    }

    await sleep(1800);
    const raw = await sock.requestPairingCode(number);
    const code = String(raw || "").replace(/\s+/g, "").toUpperCase();
    if (!code) throw new Error("WhatsApp returned an empty pairing code.");

    await message.react("🔑").catch(() => {});
    return message.send(`╭━━〔 🔐 𝐏𝐀𝐈𝐑 𝐂𝐎𝐃𝐄 〕━━┈⊷\n┃✧ Number : +${number}\n┃✧ Code   : *${code}*\n┃\n┃✧ WhatsApp → Linked Devices\n┃✧ Link a device\n┃✧ Link with phone number\n┃✧ Enter the code above\n╰━━━━━━━━━━━━━━━━━━⊷\n\n⏳ Enter the code immediately before it expires.`);
  } catch (error) {
    await message.react("❌").catch(() => {});
    return message.send(`╭━━〔 ❌ 𝐏𝐀𝐈𝐑 𝐅𝐀𝐈𝐋𝐄𝐃 〕━━┈⊷\n┃✧ ${String(error?.message || error).slice(0, 500)}\n╰━━━━━━━━━━━━━━━━━━⊷`);
  }
});

Module({ command: "sudo", aliases: ["addsudo"], package: "owner", description: "Add a sudo user" })(async (message, args) => {
  if (!isOwner(message)) return message.send("❌ Only the bot owner can manage sudo users.");
  const sid = sessionId(message);
  let number = cleanNumber(args);
  if (!number && message?.mentions?.[0]) number = cleanNumber(message.mentions[0]);
  if (!number && message?.quoted?.sender) number = cleanNumber(message.quoted.sender);
  if (!/^\d{7,15}$/.test(number)) return message.send(`Usage: ${config.prefix || "."}sudo 91XXXXXXXXXX (or reply/mention a user)`);
  const list = sudoList(sid);
  if (!list.includes(number)) list.push(number);
  db.setHot(sid, "sudo_users", list);
  return message.send(`╭━━〔 👑 𝐒𝐔𝐃𝐎 〕━━┈⊷\n┃✧ Added : +${number}\n┃✧ Status: ✅ Active\n╰━━━━━━━━━━━━━━━━━━⊷`);
});

Module({ command: "delsudo", aliases: ["rmsudo"], package: "owner", description: "Remove a sudo user" })(async (message, args) => {
  if (!isOwner(message)) return message.send("❌ Only the bot owner can manage sudo users.");
  const sid = sessionId(message);
  let number = cleanNumber(args);
  if (!number && message?.mentions?.[0]) number = cleanNumber(message.mentions[0]);
  if (!number && message?.quoted?.sender) number = cleanNumber(message.quoted.sender);
  const next = sudoList(sid).filter((x) => x !== number);
  db.setHot(sid, "sudo_users", next);
  return message.send(`╭━━〔 🗑️ 𝐃𝐄𝐋𝐒𝐔𝐃𝐎 〕━━┈⊷\n┃✧ Removed : +${number || "unknown"}\n╰━━━━━━━━━━━━━━━━━━⊷`);
});

Module({ command: "sudolist", aliases: ["listsudo"], package: "owner", description: "Show sudo users" })(async (message) => {
  if (!isOwner(message)) return message.send("❌ Only the bot owner can view sudo users.");
  const list = sudoList(sessionId(message));
  const body = list.length ? list.map((n, i) => `┃${i + 1}. +${n}`).join("\n") : "┃✧ No sudo users";
  return message.send(`╭━━〔 👑 𝐒𝐔𝐃𝐎 𝐋𝐈𝐒𝐓 〕━━┈⊷\n${body}\n╰━━━━━━━━━━━━━━━━━━⊷`);
});
