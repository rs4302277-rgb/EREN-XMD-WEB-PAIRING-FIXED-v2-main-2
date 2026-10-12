import fs from "fs/promises";
import path from "path";
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import config from "../config.js";

const ROOT = path.join(process.cwd(), "data", "tagreply");

function botNumber(conn) {
  return String(conn?.user?.id || conn?.user?.jid || "bot").split(":")[0].split("@")[0];
}
function key() { return `global:setmention`; }
function indexKey(group) { return `mention:index:${group}`; }
function cleanJid(jid) { return String(jid || "").replace(/:\d+/, ""); }
function extFor(mime = "") {
  if (mime.includes("image")) return "jpg";
  if (mime.includes("video")) return "mp4";
  if (mime.includes("audio")) return "mp3";
  if (mime.includes("sticker")) return "webp";
  if (mime.includes("document")) return "bin";
  return "bin";
}

async function saveQuoted(message) {
  const q = message.quoted;
  if (!q) return null;
  const mime = String(q?.msg?.mimetype || q?.mimetype || "");
  const mediaType = mime.split("/")[0];
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dir = path.join(ROOT, botNumber(message.conn));
  await fs.mkdir(dir, { recursive: true });

  if (mediaType === "image" || mediaType === "video" || mediaType === "audio" || /sticker/.test(mime)) {
    if (typeof q.download !== "function") throw new Error("Quoted media cannot be downloaded");
    const data = await q.download();
    const file = path.join(dir, `${id}.${extFor(mime)}`);
    await fs.writeFile(file, data);
    return { type: mediaType === "image" ? "image" : mediaType === "video" ? "video" : mediaType === "audio" ? "audio" : "sticker", file, mime: mime || "application/octet-stream", caption: q.body || "" };
  }

  const text = String(q.body || "").trim();
  if (!text) throw new Error("Reply to a text, image, video, audio or sticker");
  return { type: "text", text };
}

async function formatMention(item) {
  if (!item) return null;
  const preview = config.BOT_PIC_URL ? {
    externalAdReply: {
      title: String(config.BOT_NAME || config.botName || "RAHUL MD").replace(/[*_`]/g, ""),
      body: String(config.ownerName || "Owner").replace(/[*_`]/g, ""),
      mediaType: 1,
      thumbnailUrl: config.BOT_PIC_URL,
      sourceUrl: config.WA_CHANNEL_LINK,
      renderLargerThumbnail: true,
      showAdAttribution: false
    }
  } : {};
  const wrap = (payload) => ({ ...payload, contextInfo: { ...(payload.contextInfo || {}), ...preview } });
  if (item.type === "text") return wrap({ text: item.text });
  if (item.type === "image") return wrap({ image: await fs.readFile(item.file), caption: item.caption || "" });
  if (item.type === "video") return wrap({ video: await fs.readFile(item.file), caption: item.caption || "", mimetype: item.mime || "video/mp4" });
  if (item.type === "audio") return wrap({ audio: await fs.readFile(item.file), mimetype: item.mime || "audio/mpeg", ptt: false });
  if (item.type === "sticker") return wrap({ sticker: await fs.readFile(item.file) });
  return null;
}

Module({ command: "setmention", aliases: ["tagreply"], package: "group", description: "Save replied media/text as a global rotating mention reply" })(async (message) => {
  if (!message.isGroup) return message.send("❌ Group only command.");
  await message.loadGroupInfo?.();
  if (!message.isAdmin && !message.isFromMe && !message.isGroupAdmin && !message.isfromMe) {
    return message.send("╭━━〔 🔒 ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ 〕━━┈⊷\n┃\n┃ ✦ Group admin/owner only.\n╰━━━━━━━━━━━━━━━━━━━━┈⊷");
  }
  if (!message.quoted) return message.send("╭━━〔 💬 sᴇᴛᴍᴇɴᴛɪᴏɴ 〕━━┈⊷\n┃\n┃ ✦ Reply to a text, photo, video, audio or sticker.\n┃ ✦ Each saved item is used one-by-one.\n╰━━━━━━━━━━━━━━━━━━━━┈⊷");
  try {
    const item = await saveQuoted(message);
    const sid = botNumber(message.conn);
    const k = key();
    const current = (await db.getAsync(sid, k, null)) || { items: [], index: 0 };
    current.items = Array.isArray(current.items) ? current.items : [];
    current.items.push(item);
    current.index = 0;
    await db.set(sid, k, current);
    return message.send(`╭━━〔 ✅ sᴇᴛᴍᴇɴᴛɪᴏɴ 〕━━┈⊷\n┃\n┃ ✦ Saved item: #${current.items.length}\n┃ ✦ Type: ${item.type.toUpperCase()}\n┃ ✦ Rotation: ${current.items.length} item(s)\n┃\n┃ ➤ Mention the bot to trigger it.\n╰━━━━━━━━━━━━━━━━━━━━┈⊷`);
  } catch (e) {
    return message.send(`╭━━〔 ❌ sᴇᴛᴍᴇɴᴛɪᴏɴ 〕━━┈⊷\n┃\n┃ ✦ ${e.message}\n╰━━━━━━━━━━━━━━━━━━━━┈⊷`);
  }
});

Module({ command: "delmention", aliases: ["resetmention"], package: "group", description: "Clear saved mention replies" })(async (message) => {
  if (!message.isGroup) return message.send("❌ Group only command.");
  await message.loadGroupInfo?.();
  if (!message.isAdmin && !message.isFromMe) return message.send("╭━━〔 🔒 ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ 〕━━┈⊷\n┃ ✦ Admin/owner only.\n╰━━━━━━━━━━━━━━━━━━━━┈⊷");
  const sid = botNumber(message.conn);
  const cfg = await db.getAsync(sid, key(message.from), null);
  if (!cfg?.items?.length) return message.send("╭━━〔 ℹ️ sᴇᴛᴍᴇɴᴛɪᴏɴ 〕━━┈⊷\n┃ ✦ No saved replies found.\n╰━━━━━━━━━━━━━━━━━━━━┈⊷");
  for (const item of cfg.items) if (item.file) await fs.unlink(item.file).catch(() => {});
  await db.del(sid, key());
  return message.send("╭━━〔 ♻️ sᴇᴛᴍᴇɴᴛɪᴏɴ 〕━━┈⊷\n┃ ✦ All mention replies cleared.\n╰━━━━━━━━━━━━━━━━━━━━┈⊷");
});

Module({ on: "message", name: "rotating-mention-reply" })(async (message) => {
  if (!message.isGroup) return;
  const botJid = String(message?.conn?.user?.id || "").split(":")[0];
  const mentioned = message?.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid
    || message?.raw?.message?.imageMessage?.contextInfo?.mentionedJid
    || message?.raw?.message?.videoMessage?.contextInfo?.mentionedJid
    || [];
  const body = String(message?.body || "");
  const isMentioned = Boolean(
    message?.isMentioned ||
    mentioned.some((j) => String(j).split(":")[0].split("@")[0] === botJid) ||
    (botJid && body.includes(`@${botJid}`))
  );
  if (!isMentioned) return;
  const sid = botNumber(message.conn);
  const cfg = await db.getAsync(sid, key(), null);
  if (!cfg?.items?.length) return;
  const items = cfg.items.filter(Boolean);
  if (!items.length) return;
  const groupKey = indexKey(message.from);
  let index = Number(await db.getAsync(sid, groupKey, 0));
  if (!Number.isInteger(index) || index < 0 || index >= items.length) index = 0;
  const item = items[index];
  await db.set(sid, groupKey, (index + 1) % items.length);
  const payload = await formatMention(item);
  if (!payload) return;
  try { await message.conn.sendMessage(message.from, payload, { quoted: message.raw }); }
  catch (e) { console.error("[mention] send error:", e?.message || e); }
});
