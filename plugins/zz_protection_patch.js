// zz_protection_patch.js
// Final group-protection layer for Rahul MD.
//
// The command controls are admin/owner-only, but enforcement deliberately
// ignores group admins: an admin's own link/sticker/bad-word/spam message is
// never acted on. The bot itself still must be a group admin for kick/delete.

import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

const botNumOf = (m) =>
  String(m?.conn?.user?.id || m?.conn?.user?.jid || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");

const key = (feature, group) => `${feature}:${group}`;
const get = (bot, k, fallback) => {
  const v = db.get(bot, k);
  return v === undefined || v === null ? fallback : v;
};

async function adminCommand(m) {
  if (!m?.isGroup) {
    await m.reply("❌ This command works only in groups.").catch(() => {});
    return false;
  }
  await m.loadGroupInfo?.();
  if (!(m.isAdmin || m.isGroupAdmin || m.isFromMe || m.isfromMe)) {
    await m.reply("❌ Only group admins/owner can change this protection.").catch(() => {});
    return false;
  }
  if (!m.isBotAdmin) {
    await m.reply("❌ Make the bot a group admin first.").catch(() => {});
    return false;
  }
  return true;
}

function sender(m) {
  return m?.sender || m?.key?.participant || m?.quoted?.sender || null;
}

function adminMessage(m) {
  return !!(m?.isFromMe || m?.isfromMe || m?.isAdmin || m?.isGroupAdmin);
}

async function removeMessage(m) {
  try { await m.conn.sendMessage(m.from, { delete: m.key }); return; } catch {}
  try { await m.send({ delete: m.key }); } catch {}
}

async function kick(m, jid) {
  if (!jid || !m?.isBotAdmin) return false;
  try {
    await m.conn.groupParticipantsUpdate(m.from, [jid], "remove");
    return true;
  } catch { return false; }
}

async function act(m, jid, reason, mode, bot) {
  if (!jid || adminMessage(m)) return;
  const n = String(jid).split("@")[0].split(":")[0];
  await removeMessage(m);

  if (mode === "delete") {
    await m.send(`⚠️ @${n} — ${reason}`, { mentions: [jid] }).catch(() => {});
    return;
  }

  if (mode === "warn") {
    const wk = key(`warn:${jid}`, m.from);
    const count = Number(get(bot, wk, 0)) + 1;
    db.setHot(bot, wk, count);
    if (count < 3) {
      await m.send(`⚠️ *Warning ${count}/3* — @${n}: ${reason}`, { mentions: [jid] }).catch(() => {});
      return;
    }
    db.delHot(bot, wk);
    await m.send(`🚫 @${n} — ${reason}\n*3/3 warnings reached — removing.*`, { mentions: [jid] }).catch(() => {});
  }

  if (mode === "kick" || mode === "warn") {
    await new Promise(r => setTimeout(r, 350));
    await kick(m, jid);
  }
}

function protectionCommand(command, feature, label) {
  Module({
    command,
    aliases: command === "antibadword" ? ["antibadwords", "antitoxic"] : [],
    package: "group protection",
    description: `${label} protection`,
  })(async (m, match) => {
    if (!(await adminCommand(m))) return;
    const bot = botNumOf(m);
    if (!bot) return m.reply("❌ Bot number not found.");
    const raw = String(match || "").trim().toLowerCase();
    const enabled = key(`${feature}:enabled`, m.from);
    const modeKey = key(`${feature}:mode`, m.from);
    const mode = String(get(bot, modeKey, "kick")).toLowerCase();

    if (!raw) {
      return m.reply(`🛡️ *${label}*\n> Status: ${get(bot, enabled, false) === true ? "✅ ON" : "❌ OFF"}\n> Mode: ${mode.toUpperCase()}\n\nUse: .${command} on/off/kick/warn/delete`);
    }
    if (raw === "on") {
      db.setHot(bot, enabled, true);
      if (!db.get(bot, modeKey)) db.setHot(bot, modeKey, "kick");
      return m.reply(`✅ *${label} ON*`);
    }
    if (raw === "off") {
      db.setHot(bot, enabled, false);
      return m.reply(`✅ *${label} OFF*`);
    }
    if (["kick", "warn", "delete"].includes(raw)) {
      db.setHot(bot, modeKey, raw);
      db.setHot(bot, enabled, true);
      return m.reply(`✅ *${label} mode: ${raw.toUpperCase()}*`);
    }
    return m.reply(`Usage: .${command} on/off/kick/warn/delete`);
  });
}

// Anti-bad-word is intentionally an alias/control command for the existing
// antiword list. This keeps one word database and avoids two conflicting lists.
Module({
  command: "antibadword",
  aliases: ["antibadwords", "antitoxic"],
  package: "group protection",
  description: "Alias for antiword protection",
})(async (m, match) => {
  const text = String(match || "").trim();
  // Reuse the native antiword command registered earlier.
  const { commands } = await import("../lib/plugins.js");
  const p = commands.get("antiword");
  if (p) return p.exec(m, text);
  return m.reply("❌ AntiWord is unavailable.");
});

// Anti-spam: repeated messages from the same non-admin member in a short
// window are treated as spam. The command is admin-only; admins are exempt
// from enforcement exactly like AntiLink/AntiSticker/AntiWord.
protectionCommand("antispam", "antispam", "AntiSpam");

const spamState = new Map();
const SPAM_WINDOW = 7000;
const SPAM_LIMIT = 5;

Module({
  on: "message",
  package: "group protection",
  description: "AntiSpam enforcement",
})(async (m) => {
  try {
    if (!m?.isGroup) return;
    await m.loadGroupInfo?.();
    if (adminMessage(m)) return;

    const bot = botNumOf(m);
    if (!bot) return;
    if (get(bot, key("antispam:enabled", m.from), false) !== true) return;
    if (!m.isBotAdmin) return;

    const jid = sender(m);
    if (!jid) return;
    const body = String(m.body || "").trim();
    const type = String(m.type || m.mtype || "");
    const signature = `${type}:${body.slice(0, 180)}`;
    const sk = `${bot}:${m.from}:${jid}`;
    const now = Date.now();
    const old = spamState.get(sk) || { start: now, count: 0, last: "" };
    if (now - old.start > SPAM_WINDOW) {
      old.start = now;
      old.count = 0;
      old.last = "";
    }
    old.count += 1;
    const sameBurst = old.last === signature;
    old.last = signature;
    spamState.set(sk, old);

    // Five messages inside the window, or four identical messages, is enough
    // to trigger protection. Normal conversation is not touched.
    if (old.count < SPAM_LIMIT && !sameBurst) return;

    const mode = String(get(bot, key("antispam:mode", m.from), "kick")).toLowerCase();
    await act(m, jid, "Spam is not allowed here", mode, bot);
    spamState.delete(sk);
  } catch {}
});

// Clean stale anti-spam state without keeping timers alive on hosting panels.
setInterval(() => {
  const cutoff = Date.now() - SPAM_WINDOW * 2;
  for (const [k, v] of spamState) if ((v?.start || 0) < cutoff) spamState.delete(k);
}, SPAM_WINDOW * 2).unref?.();
