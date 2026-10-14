// plugins/groupprotect.js — Complete Group Protection Suite
// AntiLink, AntiBot, AntiSticker, AntiWord, AntiGhost, Full Warn System

import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBotNum(conn) {
  const raw = conn?.user?.id || conn?.user?.jid || "";
  return String(raw).split("@")[0].split(":")[0].replace(/\D/g, "") || null;
}

function gKey(feature, groupJid) {
  return `${feature}:${groupJid}`;
}

function isOwner(message) {
  return !!(message.isFromMe || message.isfromMe);
}

function isAdminOrOwner(message) {
  return (
    isOwner(message) ||
    !!(message.isAdmin || message.isGroupAdmin || message.isBotAdmin)
  );
}

async function checkAdmin(message) {
  if (!message?.isGroup) {
    await message.send("❌ _This protection command only works in groups_").catch(() => {});
    return false;
  }
  await message.loadGroupInfo?.();
  if (!(isOwner(message) || message.isAdmin || message.isGroupAdmin)) {
    await message.send("❌ _Only group admins can use this command_").catch(() => {});
    return false;
  }
  if (!message.isBotAdmin) {
    await message.send("❌ _Make the bot a group admin first so protection actions can actually run_").catch(() => {});
    return false;
  }
  return true;
}

async function deleteMsg(message) {
  try {
    await message.conn.sendMessage(message.from, { delete: message.key });
  } catch {
    try {
      await message.send({ delete: message.key });
    } catch {}
  }
}

function getSender(message) {
  return (
    message.sender ||
    message.key?.participant ||
    message.quoted?.sender ||
    message.key?.remoteJid ||
    null
  );
}

function dbGet(botNum, key, fallback) {
  const val = db.get(botNum, key);
  return val !== undefined && val !== null ? val : fallback;
}

async function applyAction(message, senderJid, reason, action, botNum) {
  const senderNum = (senderJid || "").split("@")[0];
  const warnKey = gKey(`warn:${senderJid}`, message.from);

  await deleteMsg(message);

  if (action === "delete") {
    await message
      .send(`⚠️ @${senderNum} — ${reason}`, { mentions: [senderJid] })
      .catch(() => {});
    return;
  }

  if (action === "warn") {
    const prev = dbGet(botNum, warnKey, 0);
    const warns = (Number(prev) || 0) + 1;
    db.setHot(botNum, warnKey, warns);

    if (warns >= 3) {
      db.delHot(botNum, warnKey);
      await message
        .send(
          `🚫 @${senderNum} — ${reason}\n*3/3 Warnings reached — Removing!*`,
          { mentions: [senderJid] }
        )
        .catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
      await kickUser(message.conn, message.from, senderJid);
    } else {
      await message
        .send(`⚠️ *Warning ${warns}/3* — @${senderNum}: ${reason}`, {
          mentions: [senderJid],
        })
        .catch(() => {});
    }
    return;
  }

  // kick (default)
  await message
    .send(`🚫 @${senderNum} — ${reason}. *Removing...*`, {
      mentions: [senderJid],
    })
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
  await kickUser(message.conn, message.from, senderJid);
}

async function kickUser(conn, groupJid, jid) {
  try {
    await conn.groupParticipantsUpdate(groupJid, [jid], "remove");
  } catch {}
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ANTILINK ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const LINK_REGEX =
  /(https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[^\s]+|wa\.me\/[^\s]+)/i;

Module({
  command: "antilink",
  package: "group",
  description: "Block links in group. .antilink on/off/kick/warn/delete",
})(async (message, match) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const input = (match || "").trim().toLowerCase();
  const enabledKey = `antilink:${message.from}:enabled`;
  const modeKey = `antilink:${message.from}:mode`;

  if (!input) {
    const on = dbGet(botNum, enabledKey, false) === true;
    const mode = dbGet(botNum, modeKey, "delete");
    return message.send(
      `🔗 *AntiLink*\n> Status: ${on ? "✅ ON" : "❌ OFF"}\n> Mode: ${String(
        mode
      ).toUpperCase()}\n\n` +
        `Use:\n• .antilink on\n• .antilink off\n• .antilink kick\n• .antilink warn\n• .antilink delete`
    );
  }
  if (input === "on") {
    db.setHot(botNum, enabledKey, true);
    if (!db.get(botNum, modeKey)) db.setHot(botNum, modeKey, "delete");
    return message.send("✅ *AntiLink ON*");
  }
  if (input === "off") {
    db.setHot(botNum, enabledKey, false);
    return message.send("✅ *AntiLink OFF*");
  }
  if (["kick", "warn", "delete"].includes(input)) {
    db.setHot(botNum, modeKey, input);
    db.setHot(botNum, enabledKey, true);
    return message.send(`✅ *AntiLink mode: ${input.toUpperCase()}*`);
  }
  return message.send("Usage: .antilink on/off/kick/warn/delete");
});

// AntiLink enforcement
Module({
  on: "text",
  package: "group",
  description: "AntiLink enforcement",
})(async (message) => {
  try {
    if (!message?.isGroup) return;
    await message.loadGroupInfo?.();
    if (isOwner(message)) return;
    if (message.isAdmin || message.isGroupAdmin) return;

    const body = message.body || message.text || "";
    if (!body) return;
    if (!LINK_REGEX.test(body)) return;

    const botNum = getBotNum(message.conn);
    if (!botNum) return;

    const enabledKey = `antilink:${message.from}:enabled`;
    if (dbGet(botNum, enabledKey, false) !== true) return;
    if (!message.isBotAdmin) return;

    const mode = dbGet(botNum, `antilink:${message.from}:mode`, "delete");
    const senderJid = getSender(message);
    if (!senderJid) return;

    await applyAction(
      message,
      senderJid,
      "Links are not allowed here",
      String(mode),
      botNum
    );
  } catch {}
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ANTIBOT ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// AntiBot note:
// WhatsApp does not expose a reliable "this participant is a bot" flag in the
// group-participants.update event. A `:device@...` suffix is a linked device,
// not a bot, so the old implementation could remove normal users incorrectly.
// We therefore support an explicit bot JID/number deny-list and optional
// verified-name heuristic when participant metadata is available.
function normalizeJid(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (s.includes("@")) return s.replace(/:\d+(?=@)/, "");
  const digits = s.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : "";
}

function getConfiguredBotJids(groupJid = "", botNum = "") {
  const raw = process.env.ANTIBOT_NUMBERS || "";
  const fromEnv = raw.split(",").map(normalizeJid).filter(Boolean);
  const saved = groupJid && botNum ? dbGet(botNum, gKey("antibot:ids", groupJid), []) : [];
  const fromDb = Array.isArray(saved) ? saved.map(normalizeJid).filter(Boolean) : [];
  return new Set([...fromEnv, ...fromDb]);
}

function isBotParticipant(participant, configured) {
  const jid = normalizeJid(
    typeof participant === "string"
      ? participant
      : participant?.id || participant?.jid || participant?.participant
  );
  if (!jid) return false;

  if (configured.has(jid)) return true;

  const meta = typeof participant === "object" ? participant : {};
  const label = `${meta.notify || ""} ${meta.verifiedName || ""} ${meta.name || ""}`.toLowerCase();
  return /\b(bot|automated|automation)\b/.test(label);
}

Module({
  command: "antibot",
  package: "group",
  description: "Protect group from configured/identified bot accounts",
})(async (message, match) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const input = (match || "").trim().toLowerCase();
  const enabledKey = gKey("antibot:enabled", message.from);
  const modeKey = gKey("antibot:mode", message.from);

  if (!input) {
    const on = dbGet(botNum, enabledKey, false) === true;
    const mode = dbGet(botNum, modeKey, "kick");
    const ids = [...getConfiguredBotJids(message.from, botNum)].map((jid) => `+${jid.split("@")[0]}`);
    return message.send(
      `╭━━〔 🤖 𝐀𝐍𝐓𝐈𝐁𝐎𝐓 〕━━╮\n` +
      `┃ ✦ Status : ${on ? "🟢 ON" : "🔴 OFF"}\n` +
      `┃ ✦ Mode   : ${String(mode).toUpperCase()}\n` +
      `┃ ✦ IDs    : ${ids.length} configured\n` +
      `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
      `• .antibot on/off/kick/warn/delete\n• .antibot add +91XXXXXXXXXX\n• .antibot remove +91XXXXXXXXXX\n• .antibot list`
    );
  }
  const idAction = input.match(/^(add|remove|list)\b(?:\s+(.+))?$/i);
  if (idAction) {
    const listKey = gKey("antibot:ids", message.from);
    const list = Array.isArray(dbGet(botNum, listKey, [])) ? dbGet(botNum, listKey, []) : [];
    if (idAction[1].toLowerCase() === "list") {
      const ids = [...getConfiguredBotJids(message.from, botNum)].map((jid) => `+${jid.split("@")[0]}`);
      return message.send(ids.length ? `🤖 Configured bot IDs:\n${ids.join("\n")}` : "No bot IDs saved. Use .antibot add +countrycode-number.");
    }
    const rawId = String(idAction[2] || "").trim();
    const digits = rawId.replace(/\D/g, "");
    const jid = normalizeJid(rawId);
    if (!/^\d{7,15}$/.test(digits) || !jid.endsWith("@s.whatsapp.net")) return message.send("Usage: .antibot add/remove +91XXXXXXXXXX");
    const next = new Set(list.map(normalizeJid).filter(Boolean));
    if (idAction[1].toLowerCase() === "add") next.add(jid); else next.delete(jid);
    db.setHot(botNum, listKey, [...next]);
    return message.send(`✅ AntiBot ID ${idAction[1].toLowerCase()}ed: +${jid.split("@")[0]}`);
  }

  if (input === "on") {
    db.setHot(botNum, enabledKey, true);
    if (!db.get(botNum, modeKey)) db.setHot(botNum, modeKey, "kick");
    return message.send("╭━━〔 🤖 𝐀𝐍𝐓𝐈𝐁𝐎𝐓 〕━━╮\n┃ 🟢 Protection enabled\n╰━━━━━━━━━━━━━━━━━━╯");
  }
  if (input === "off") {
    db.setHot(botNum, enabledKey, false);
    return message.send("╭━━〔 🤖 𝐀𝐍𝐓𝐈𝐁𝐎𝐓 〕━━╮\n┃ 🔴 Protection disabled\n╰━━━━━━━━━━━━━━━━━━╯");
  }
  if (["kick", "warn", "delete"].includes(input)) {
    db.setHot(botNum, modeKey, input);
    db.setHot(botNum, enabledKey, true);
    return message.send(`╭━━〔 🤖 𝐀𝐍𝐓𝐈𝐁𝐎𝐓 〕━━╮\n┃ 🟢 Mode: ${input.toUpperCase()}\n╰━━━━━━━━━━━━━━━━━━╯`);
  }
  return message.send("Usage: .antibot on/off/kick/warn/delete");
});

// AntiBot enforcement — group-participants.update
Module({
  on: "group-participants.update",
  package: "group",
  description: "AntiBot enforcement on join",
})(async (_message, event, sock) => {
  try {
    const groupJid = event?.id || event?.groupJid;
    const action = event?.action;
    const parts = event?.participants || [];
    const conn = sock;

    if (action !== "add" || !groupJid || !conn?.user?.id) return;

    const botNum = getBotNum(conn);
    if (!botNum) return;

    const enabledKey = gKey("antibot:enabled", groupJid);
    if (dbGet(botNum, enabledKey, false) !== true) return;

    // The bot must be an admin before it can remove anyone.
    const mode = String(dbGet(botNum, gKey("antibot:mode", groupJid), "kick")).toLowerCase();
    const configured = getConfiguredBotJids(groupJid, botNum);

    for (const participant of parts) {
      const jid = normalizeJid(
        typeof participant === "string"
          ? participant
          : participant?.id || participant?.jid
      );
      if (!jid || !isBotParticipant(participant, configured)) continue;

      const selfJid = normalizeJid(conn.user.id);
      if (jid === selfJid) continue;

      const num = jid.split("@")[0].split(":")[0];

      if (mode === "kick") {
        try {
          await conn.groupParticipantsUpdate(groupJid, [jid], "remove");
          await conn.sendMessage(groupJid, {
            text: `╭━━〔 🤖 𝐀𝐍𝐓𝐈𝐁𝐎𝐓 〕━━╮\n┃ 🚫 @${num} detected\n┃ 🗑️ Removed from group\n╰━━━━━━━━━━━━━━━━━━╯`,
            mentions: [jid],
          });
        } catch (err) {
          await conn.sendMessage(groupJid, {
            text: `⚠️ AntiBot detected @${num}, but I could not remove the account. Make sure I am a group admin.`,
            mentions: [jid],
          }).catch(() => {});
          console.error("[AntiBot] remove failed:", err?.message || err);
        }
      } else if (mode === "delete") {
        await conn.sendMessage(groupJid, {
          text: `⚠️ 🤖 Bot account detected: @${num}`,
          mentions: [jid],
        }).catch(() => {});
      } else {
        await conn.sendMessage(groupJid, {
          text: `⚠️ 🤖 Bot account detected: @${num}. Please review.`,
          mentions: [jid],
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[AntiBot] event error:", err?.message || err);
  }
});

// Detect configured bot accounts when they post messages too (text or media).
// WhatsApp does not expose a universal bot flag, so IDs must be configured or
// the sender metadata must explicitly identify it as an automated account.
Module({ on: "message", package: "group", description: "AntiBot message enforcement" })(async (message) => {
  try {
    if (!message?.isGroup || isOwner(message) || message.isAdmin || message.isGroupAdmin) return;
    const botNum = getBotNum(message.conn);
    if (!botNum || dbGet(botNum, gKey("antibot:enabled", message.from), false) !== true) return;
    if (!message.isBotAdmin) return;
    const jid = getSender(message);
    if (!jid) return;
    const configured = getConfiguredBotJids(message.from, botNum);
    const senderJid = normalizeJid(jid);
    const participant = (message.groupParticipants || []).find((p) => normalizeJid(p?.id || p?.jid || p) === senderJid);
    const label = typeof participant === "object" ? `${participant?.notify || ""} ${participant?.verifiedName || ""} ${participant?.name || ""}`.toLowerCase() : "";
    const detected = configured.has(senderJid) || /\b(bot|automated|automation)\b/.test(label);
    if (!detected || senderJid === normalizeJid(message.conn?.user?.id)) return;
    const mode = String(dbGet(botNum, gKey("antibot:mode", message.from), "kick")).toLowerCase();
    await applyAction(message, jid, "Bot accounts are not allowed here", mode, botNum);
  } catch (error) {
    console.error("[AntiBot] message enforcement failed:", error?.message || error);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ANTISTICKER ──────────────────────────────────════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

Module({
  command: "antisticker",
  package: "group",
  description: "Block stickers in group. .antisticker on/off/kick/warn/delete",
})(async (message, match) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const input = (match || "").trim().toLowerCase();
  const enabledKey = gKey("antisticker:enabled", message.from);
  const modeKey = gKey("antisticker:mode", message.from);

  if (!input) {
    const on = dbGet(botNum, enabledKey, false) === true;
    const mode = dbGet(botNum, modeKey, "delete");
    return message.send(
      `🎭 *AntiSticker*\n> Status: ${on ? "✅ ON" : "❌ OFF"}\n> Mode: ${String(
        mode
      ).toUpperCase()}\n\n` +
        `Use:\n• .antisticker on\n• .antisticker off\n• .antisticker kick\n• .antisticker warn\n• .antisticker delete`
    );
  }
  if (input === "on") {
    db.setHot(botNum, enabledKey, true);
    if (!db.get(botNum, modeKey)) db.setHot(botNum, modeKey, "delete");
    return message.send("✅ *AntiSticker ON*");
  }
  if (input === "off") {
    db.setHot(botNum, enabledKey, false);
    return message.send("✅ *AntiSticker OFF*");
  }
  if (["kick", "warn", "delete"].includes(input)) {
    db.setHot(botNum, modeKey, input);
    db.setHot(botNum, enabledKey, true);
    return message.send(`✅ *AntiSticker mode: ${input.toUpperCase()}*`);
  }
  return message.send("Usage: .antisticker on/off/kick/warn/delete");
});

// AntiSticker enforcement — must use "message" or "sticker" event, NOT "text"
Module({
  on: "message",
  package: "group",
  description: "AntiSticker enforcement",
})(async (message) => {
  try {
    if (!message?.isGroup) return;
    await message.loadGroupInfo?.();
    if (isOwner(message)) return;
    if (message.isAdmin || message.isGroupAdmin) return;

    // Detect sticker by type
    const mtype = message.type || message.mtype || "";
    const isSticker =
      mtype === "stickerMessage" ||
      !!message.raw?.message?.stickerMessage ||
      !!message.message?.stickerMessage;

    if (!isSticker) return;

    const botNum = getBotNum(message.conn);
    if (!botNum) return;

    const enabledKey = gKey("antisticker:enabled", message.from);
    if (dbGet(botNum, enabledKey, false) !== true) return;
    if (!message.isBotAdmin) return;

    const mode = dbGet(
      botNum,
      gKey("antisticker:mode", message.from),
      "delete"
    );
    const senderJid = getSender(message);
    if (!senderJid) return;

    await applyAction(
      message,
      senderJid,
      "Stickers are not allowed here",
      String(mode),
      botNum
    );
  } catch {}
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ANTIWORD ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

Module({
  command: "antiword",
  package: "group",
  description:
    "Block words in group. .antiword add/remove/list/on/off/kick/warn/delete",
})(async (message, match) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const input = (match || "").trim().toLowerCase();
  const enabledKey = gKey("antiword:enabled", message.from);
  const modeKey = gKey("antiword:mode", message.from);
  const wordsKey = gKey("antiword:words", message.from);

  if (!input) {
    const on = dbGet(botNum, enabledKey, false) === true;
    const mode = dbGet(botNum, modeKey, "delete");
    const words = dbGet(botNum, wordsKey, []);
    return message.send(
      `🔤 *AntiWord*\n> Status: ${on ? "✅ ON" : "❌ OFF"}\n> Mode: ${String(
        mode
      ).toUpperCase()}\n` +
        `> Words (${words.length}): ${
          words.length ? words.join(", ") : "none"
        }\n\n` +
        `Use:\n• .antiword add <word>\n• .antiword remove <word>\n• .antiword list\n• .antiword on/off/kick/warn/delete`
    );
  }

  if (input === "on") {
    db.setHot(botNum, enabledKey, true);
    return message.send("✅ *AntiWord ON*");
  }
  if (input === "off") {
    db.setHot(botNum, enabledKey, false);
    return message.send("✅ *AntiWord OFF*");
  }
  if (["kick", "warn", "delete"].includes(input)) {
    db.setHot(botNum, modeKey, input);
    db.setHot(botNum, enabledKey, true);
    return message.send(`✅ *AntiWord mode: ${input.toUpperCase()}*`);
  }
  if (input === "list") {
    const words = dbGet(botNum, wordsKey, []);
    return message.send(
      `📋 *Blocked Words (${words.length}):*\n` +
        (words.length
          ? words.map((w, i) => `${i + 1}. ${w}`).join("\n")
          : "None")
    );
  }

  const spaceIdx = input.indexOf(" ");
  const sub = spaceIdx !== -1 ? input.slice(0, spaceIdx) : input;
  const word =
    spaceIdx !== -1
      ? (match || "")
          .trim()
          .slice(spaceIdx + 1)
          .trim()
          .toLowerCase()
      : "";

  if (sub === "add") {
    if (!word)
      return message.send(
        "❌ _Provide a word to block. Example: .antiword add badword_"
      );
    const words = dbGet(botNum, wordsKey, []);
    if (words.includes(word))
      return message.send(`ℹ️ _"${word}" already blocked_`);
    words.push(word);
    db.setHot(botNum, wordsKey, words);
    db.setHot(botNum, enabledKey, true);
    return message.send(`✅ Word blocked: \`${word}\``);
  }
  if (sub === "remove") {
    if (!word)
      return message.send(
        "❌ _Provide a word to remove. Example: .antiword remove badword_"
      );
    let words = dbGet(botNum, wordsKey, []);
    if (!words.includes(word))
      return message.send(`ℹ️ _"${word}" not in list_`);
    words = words.filter((w) => w !== word);
    db.setHot(botNum, wordsKey, words);
    return message.send(`✅ Word removed: \`${word}\``);
  }

  return message.send(
    "Usage: .antiword add <word> | remove <word> | list | on/off/kick/warn/delete"
  );
});

// AntiWord enforcement
Module({
  on: "text",
  package: "group",
  description: "AntiWord enforcement",
})(async (message) => {
  try {
    if (!message?.isGroup) return;
    await message.loadGroupInfo?.();
    if (isOwner(message)) return;
    if (message.isAdmin || message.isGroupAdmin) return;

    const body = message.body || message.text || "";
    if (!body) return;

    const botNum = getBotNum(message.conn);
    if (!botNum) return;

    const enabledKey = gKey("antiword:enabled", message.from);
    if (dbGet(botNum, enabledKey, false) !== true) return;
    if (!message.isBotAdmin) return;

    const words = dbGet(botNum, gKey("antiword:words", message.from), []);
    if (!words.length) return;

    const lbody = body.toLowerCase();
    const matched = words.find((w) => lbody.includes(w.toLowerCase()));
    if (!matched) return;

    const mode = dbGet(botNum, gKey("antiword:mode", message.from), "delete");
    const senderJid = getSender(message);
    if (!senderJid) return;

    await applyAction(
      message,
      senderJid,
      `Blocked word: "${matched}"`,
      String(mode),
      botNum
    );
  } catch {}
});

// ══════════════════════════════════════════════════════════════════════════════
// ── WARN SYSTEM ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

Module({
  command: "warn",
  package: "group",
  description: "Warn a user (3 warns = kick). .warn @user [reason]",
})(async (message, match) => {
  try {
    if (!(await checkAdmin(message))) return;
    if (!message.isGroup) return message.send("❌ _Groups only_");
    if (!message.isBotAdmin)
      return message.send("❌ _Bot must be admin to warn users_");

    const senderJid =
      message.mentions?.[0] ||
      message.quoted?.sender ||
      message.quoted?.participant ||
      message.quoted?.key?.participant;

    if (!senderJid) return message.send("❌ _Tag or reply to a user to warn_");
    if (
      isOwner({
        key: { participant: senderJid },
        isFromMe: senderJid === message.conn?.user?.id,
      })
    ) {
      return message.send("❌ _Cannot warn the bot owner_");
    }

    const botNum = getBotNum(message.conn);
    if (!botNum) return message.send("❌ Bot number not found.");

    const reason =
      (match || "").replace(/@\d+/g, "").trim() || "Rule violation";
    const warnKey = gKey(`warn:${senderJid}`, message.from);
    const prev = dbGet(botNum, warnKey, 0);
    const warns = (Number(prev) || 0) + 1;
    db.setHot(botNum, warnKey, warns);

    const num = senderJid.split("@")[0];

    if (warns >= 3) {
      db.delHot(botNum, warnKey);
      await message.send(
        `🚫 @${num} — *3/3 Warnings reached!*\nReason: ${reason}\n\n_Removing from group..._`,
        { mentions: [senderJid] }
      );
      await new Promise((r) => setTimeout(r, 600));
      await kickUser(message.conn, message.from, senderJid);
    } else {
      await message.send(
        `⚠️ *Warning ${warns}/3* for @${num}\n📝 Reason: ${reason}`,
        { mentions: [senderJid] }
      );
    }
    await message.react("✅");
  } catch {
    await message.react("❌");
    await message.send("❌ _Failed to warn user_");
  }
});

Module({
  command: "warnreset",
  package: "group",
  aliases: ["resetwarn", "clearwarn"],
  description: "Reset warns for a user. .warnreset @user",
})(async (message) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const senderJid =
    message.mentions?.[0] ||
    message.quoted?.sender ||
    message.quoted?.participant ||
    message.quoted?.key?.participant;

  if (!senderJid) return message.send("❌ _Tag or reply to a user_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  db.delHot(botNum, gKey(`warn:${senderJid}`, message.from));
  await message.react("✅");
  return message.send(`✅ Warnings cleared for @${senderJid.split("@")[0]}`, {
    mentions: [senderJid],
  });
});

Module({
  command: "warncount",
  package: "group",
  aliases: ["warns", "checkwarn"],
  description: "Check warns for a user. .warncount @user",
})(async (message) => {
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const senderJid =
    message.mentions?.[0] ||
    message.quoted?.sender ||
    message.quoted?.participant ||
    message.quoted?.key?.participant;

  if (!senderJid) return message.send("❌ _Tag or reply to a user_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const warns =
    Number(dbGet(botNum, gKey(`warn:${senderJid}`, message.from), 0)) || 0;
  return message.send(
    `⚠️ *Warn Count for @${senderJid.split("@")[0]}:* ${warns}/3`,
    { mentions: [senderJid] }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ANTIGHOST ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

Module({
  command: "antighost",
  package: "group",
  aliases: ["antifake"],
  description: "Enable/disable antighost. .antighost on/off",
})(async (message, match) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const input = (match || "").trim().toLowerCase();
  const key = gKey("antighost:enabled", message.from);

  if (input === "on") {
    db.setHot(botNum, key, true);
    return message.send(
      "✅ *AntiGhost ON*\n_Members who ghost will be warned_"
    );
  }
  if (input === "off") {
    db.setHot(botNum, key, false);
    return message.send("✅ *AntiGhost OFF*");
  }

  const on = dbGet(botNum, key, false) === true;
  return message.send(
    `👻 *AntiGhost*\n> Status: ${
      on ? "✅ ON" : "❌ OFF"
    }\n\nUse: .antighost on/off`
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// ── PROTECTION STATUS ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

Module({
  command: "protection",
  package: "group",
  aliases: ["gpstatus", "groupprotect", "protect"],
  description: "Show all group protection settings",
})(async (message) => {
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");
  const g = message.from;

  const flag = (k) => (dbGet(botNum, k, false) === true ? "✅" : "❌");
  const mode = (k) => dbGet(botNum, k, "—") || "—";

  return message.send(
    `🛡️ *Group Protection Status*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔗 AntiLink:    ${flag(`antilink:${g}:enabled`)} │ Mode: ${mode(
        `antilink:${g}:mode`
      )}\n` +
      `🤖 AntiBot:     ${flag(gKey("antibot:enabled", g))} │ Mode: ${mode(
        gKey("antibot:mode", g)
      )}\n` +
      `🎭 AntiSticker: ${flag(gKey("antisticker:enabled", g))} │ Mode: ${mode(
        gKey("antisticker:mode", g)
      )}\n` +
      `🔤 AntiWord:    ${flag(gKey("antiword:enabled", g))} │ Mode: ${mode(
        gKey("antiword:mode", g)
      )}\n` +
      `👻 AntiGhost:   ${flag(gKey("antighost:enabled", g))}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Commands:*\n` +
      `.antilink | .antibot | .antisticker | .antiword | .antighost | .warn | .protection`
  );
});
