// plugins/welcome-goodbye.js
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import axios from "axios";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

const DEFAULT_GOODBYE = `&mention 𝐠𝐚𝐫 𝐦𝐚𝐫𝐚𝐨 🤡💔`;
const DEFAULT_WELCOME = `&mention⁩ _❥᭄🇼‌𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐎𝐔𝐑 𝐆𝐑𝐎𝐔𝐏»̶̶͓͓͓̽̽̽✨_

&name
⎯͢⎯⃝🥂⎯͢𓆰𝄣« 𝀚•🌚🍷💦⟵͓̽།།

—͟͟͞͞★এটা আড্ডা মারার গ্রুপ⎯⃝🥹🍃💘𓂋⃝⃟⃟⃝⃪⃔*_

—͟͟͞͞★ɢʀᴏᴜᴩ ᴀ ꜱᴛꜱᴛᴜꜱ ᴍᴇɴᴛɪᴏɴ ɴᴏᴛ 🚫❌ ᴀʟʟᴏᴡᴇᴅ ⚠️🚨_

_🤍⎯͢⎯⃝  ʟᴇꜰᴛ হবে না☝️🥹🍒🤌_

⎯͢⎯⃝💞," গ্রুপে কোনো প্রবলেম হলে অবশ্যই এডমিনদের জানাও ⎯꯭̽🫵🥹💖🦚🫂।।_

—͟͟͞͞★ᴀᴅᴅ‎ হওয়ার জন্য 𝐓𝗛𝗔𝗡𝗞𝗦❤‍🩹🌺_

—͟͟͞͞★𝗚𝗶𝘃𝗲 𝗺𝗲 𝘆𝗼𝘂𝗿 𝗶𝗻𝘁𝗿𝗼 𝗮𝗻𝗱 𝗼𝗻𝗲 𝘁𝗶𝗺𝗲 𝗽𝗶𝗰 🐼🌚👀💫*≛⃝◕‿◕⃝*🎸_

⎯꯭𓆩𐏓꯭𝐄𝐫𝐄𝐧⟭꯭⎯꯭𐏓
𝐌𝐞𝐦𝐛𝐞𝐫 :   &count🫵🌷`;
const WELCOME_VIDEO_URLS = [
  "https://files.catbox.moe/0wgiyc.mp4","https://files.catbox.moe/ak0q4j.mp4","https://files.catbox.moe/8hwaoq.mp4",
  "https://files.catbox.moe/s85ljg.mp4","https://files.catbox.moe/jdos44.mp4","https://files.catbox.moe/61lduh.mp4",
  "https://files.catbox.moe/l5ibh6.mp4","https://files.catbox.moe/u2vfs7.mp4","https://files.catbox.moe/9a2qks.mp4",
  "https://files.catbox.moe/31mhpm.mp4","https://files.catbox.moe/tpa4nh.mp4","https://files.catbox.moe/pantdn.mp4",
  "https://files.catbox.moe/rt7zfy.mp4","https://files.catbox.moe/8dv7yg.mp4","https://files.catbox.moe/k3sp0v.mp4",
  "https://files.catbox.moe/e35oz0.mp4","https://files.catbox.moe/d7n3jv.mp4","https://files.catbox.moe/mk5glb.mp4",
  "https://files.catbox.moe/shuxrf.mp4","https://files.catbox.moe/hbp4pa.mp4","https://files.catbox.moe/snxu1w.mp4",
  "https://files.catbox.moe/7n3zf9.mp4","https://files.catbox.moe/4p9vrq.mp4","https://files.catbox.moe/fvjlbj.mp4",
  "https://files.catbox.moe/caqr7p.mp4","https://files.catbox.moe/tgyl27.mp4"
];

/* ---------------- helpers ---------------- */
function toBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string")
    return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return Boolean(v);
}

function buildText(template = "", replacements = {}) {
  let text = String(template || "");
  const wantsPp = /&pp\b/i.test(text);
  const tags = {
    "&mention": replacements.mentionText || "",
    "&name": replacements.name || "",
    "&size": String(replacements.size ?? ""),
    "&number": replacements.number || "",
    "&user": replacements.number || "",
    "&group": replacements.group || replacements.name || "",
    "&count": String(replacements.size ?? ""),
    "&bot": replacements.botName || "",
    "&owner": replacements.ownerName || "",
  };
  for (const [tag, value] of Object.entries(tags)) text = text.replaceAll(tag, value);
  text = text.replace(/&pp\b/gi, "").trim();
  return { text, wantsPp };
}

function getGroupConfigKey(groupJid, kind) {
  return `group:${groupJid}:${kind}`;
}

function renderTemplate(template, data) {
  return buildText(template, data).text;
}

async function fetchProfileBuffer(conn, jid) {
  try {
    const getUrl =
      typeof conn.profilePictureUrl === "function"
        ? () => conn.profilePictureUrl(jid, "image").catch(() => null)
        : () => Promise.resolve(null);
    const url = await getUrl();
    if (!url) return null;
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 20000,
    });
    return Buffer.from(res.data);
  } catch (e) {
    console.error(
      "[welcome-goodbye] fetchProfileBuffer error:",
      e?.message || e
    );
    return null;
  }
}

async function sendWelcomeMsg(
  conn, groupJid, text, mentions = [], imgBuffer = null, videoUrl = null
) {
  try {
    if (videoUrl) {
      await conn.sendMessage(groupJid, {
        video: { url: videoUrl }, mimetype: "video/mp4", caption: text, mentions,
      });
    } else if (imgBuffer) {
      await conn.sendMessage(groupJid, { image: imgBuffer, caption: text, mentions });
    } else {
      await conn.sendMessage(groupJid, { text, mentions });
    }
  } catch (err) {
    console.error("[welcome-goodbye] sendWelcomeMsg primary error:", err?.message || err);
    try {
      if (imgBuffer) await conn.sendMessage(groupJid, { image: imgBuffer, caption: text });
      else await conn.sendMessage(groupJid, { text, mentions });
    } catch (e) {
      console.error("[welcome-goodbye] sendWelcomeMsg fallback error:", e?.message || e);
    }
  }
}

/* ---------------- COMMANDS (group-level on/off only) ---------------- */
/*
  Usage (must be sent inside the group):
    .welcome on
    .welcome off
    .goodbye on
    .goodbye off
*/
Module({
  command: "welcome",
  package: "group",
  description:
    "Turn per-group welcome ON or OFF (must be used inside the group).",
})(async (message, match) => {
  // require group context
  const groupJid =
    message.from ||
    message.chat ||
    message.key?.remoteJid ||
    (message.isGroup ? message.isGroup : null);
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.(
      "❌ Use this command inside the group to toggle welcome messages."
    );
  }

  // only on/off supported. ignore custom message
  const raw = (match || "").trim().toLowerCase();
  if (!raw) {
    // read current
    const botNumber =
      (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
      "bot";
    const key = `group:${groupJid}:welcome`;
    const cfg = await db.getAsync(botNumber, key, null);
    const status = cfg && typeof cfg === "object" ? toBool(cfg.status) : false;
    return await message.sendreply?.(
      `Welcome is ${status ? "✅ ON" : "❌ OFF"} for this group.`
    );
  }

  if (raw !== "on" && raw !== "off") {
    return await message.send?.("❌ Invalid option. Use `on` or `off`.");
  }

  const botNumber =
    (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
    "bot";
  const key = `group:${groupJid}:welcome`;
  const cfg = { status: raw === "on" };
  await db.set(botNumber, key, cfg);
  await message.react?.("✅");
  return await message.send(
    cfg.status
      ? "✅ Welcome ENABLED for this group"
      : "❌ Welcome DISABLED for this group"
  );
});

Module({
  command: "goodbye",
  package: "group",
  description:
    "Turn per-group goodbye ON or OFF (must be used inside the group).",
})(async (message, match) => {
  const groupJid =
    message.from ||
    message.chat ||
    message.key?.remoteJid ||
    (message.isGroup ? message.isGroup : null);
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.(
      "❌ Use this command inside the group to toggle goodbye messages."
    );
  }

  const raw = (match || "").trim().toLowerCase();
  if (!raw) {
    const botNumber =
      (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
      "bot";
    const key = `group:${groupJid}:goodbye`;
    const cfg = await db.getAsync(botNumber, key, null);
    const status = cfg && typeof cfg === "object" ? toBool(cfg.status) : false;
    return await message.sendreply?.(
      `Goodbye is ${status ? "✅ ON" : "❌ OFF"} for this group.`
    );
  }

  if (raw !== "on" && raw !== "off") {
    return await message.send?.("❌ Invalid option. Use `on` or `off`.");
  }

  const botNumber =
    (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
    "bot";
  const key = `group:${groupJid}:goodbye`;
  const cfg = { status: raw === "on" };
  await db.set(botNumber, key, cfg);
  await message.react?.("✅");
  return await message.send(
    cfg.status
      ? "✅ Goodbye ENABLED for this group"
      : "❌ Goodbye DISABLED for this group"
  );
});

/* ---------------- CUSTOM WELCOME/GOODBYE ---------------- */
Module({
  command: "setwelcome",
  package: "group",
  description: "Set a custom welcome template"
})(async (message, match) => {
  if (!message.isGroup) return message.send("❌ Use this command inside a group.");
  await message.loadGroupInfo?.();
  if (!message.isAdmin && !message.isFromMe) return message.send("❌ Admin/owner only.");
  const value = String(match || "").trim();
  if (!value) return message.send("Usage: .setwelcome <message>\nTags: &mention &pp &name &size &number &user &group &count &bot &owner");
  const botNumber = String(message.conn?.user?.id || "bot").split(":")[0].split("@")[0];
  await db.set(botNumber, getGroupConfigKey(message.from, "welcome"), { status: true, custom: value });
  return message.send("✅ Custom welcome saved and enabled.");
});

Module({
  command: "setgoodbye",
  package: "group",
  description: "Set a custom goodbye template"
})(async (message, match) => {
  if (!message.isGroup) return message.send("❌ Use this command inside a group.");
  await message.loadGroupInfo?.();
  if (!message.isAdmin && !message.isFromMe) return message.send("❌ Admin/owner only.");
  const value = String(match || "").trim();
  if (!value) return message.send("Usage: .setgoodbye <message>\nTags: &mention &pp &name &size &number &user &group &count &bot &owner");
  const botNumber = String(message.conn?.user?.id || "bot").split(":")[0].split("@")[0];
  await db.set(botNumber, getGroupConfigKey(message.from, "goodbye"), { status: true, custom: value });
  return message.send("✅ Custom goodbye saved and enabled.");
});

Module({
  command: "resetwelcome",
  package: "group",
  description: "Reset custom welcome"
})(async (message) => {
  if (!message.isGroup) return message.send("❌ Use this command inside a group.");
  const botNumber = String(message.conn?.user?.id || "bot").split(":")[0].split("@")[0];
  await db.set(botNumber, getGroupConfigKey(message.from, "welcome"), { status: false, custom: "" });
  return message.send("♻️ Welcome reset.");
});

Module({
  command: "resetgoodbye",
  package: "group",
  description: "Reset custom goodbye"
})(async (message) => {
  if (!message.isGroup) return message.send("❌ Use this command inside a group.");
  const botNumber = String(message.conn?.user?.id || "bot").split(":")[0].split("@")[0];
  await db.set(botNumber, getGroupConfigKey(message.from, "goodbye"), { status: false, custom: "" });
  return message.send("♻️ Goodbye reset.");
});

async function nextWelcomeVideo(botNumber, groupJid) {
  const key = `group:${groupJid}:welcome:videoIndex`;
  let index = Number(await db.getAsync(botNumber, key, 0));
  if (!Number.isInteger(index) || index < 0) index = 0;
  const url = WELCOME_VIDEO_URLS[index % WELCOME_VIDEO_URLS.length];
  await db.setHot(botNumber, key, (index + 1) % WELCOME_VIDEO_URLS.length);
  return url;
}

/* ---------------- EVENT: group-participants.update ---------------- */
Module({ on: "group-participants.update" })(async (_msg, event, conn) => {
  try {
    if (
      !event ||
      !event.id ||
      !event.action ||
      !Array.isArray(event.participants)
    )
      return;
    const groupJid = event.id;
    const groupName =
      event.groupName ||
      (event.groupMetadata && event.groupMetadata.subject) ||
      "";
    const groupSize =
      typeof event.groupSize === "number"
        ? event.groupSize
        : event.groupMetadata && Array.isArray(event.groupMetadata.participants)
        ? event.groupMetadata.participants.length
        : event.groupMetadata && event.groupMetadata.participants
        ? event.groupMetadata.participants.length
        : 0;

    // compute botNumber same as commands
    const botNumber =
      (conn?.user?.id && String(conn.user.id).split(":")[0]) || "bot";
    const action = String(event.action).toLowerCase();
    const botJidFull = jidNormalizedUser(conn?.user?.id);

    for (const p of event.participants) {
      const participantJid = jidNormalizedUser(
        typeof p === "string" ? p : p.id || p.jid || ""
      );
      if (!participantJid) continue;
      if (botJidFull && participantJid === botJidFull) continue; // skip bot itself

      // WELCOME (add/invite/join)
      if (action === "add" || action === "invite" || action === "joined") {
        const key = `group:${groupJid}:welcome`;
        const cfgRaw = await db.getAsync(botNumber, key, null);
        const enabled =
          cfgRaw && typeof cfgRaw === "object" ? toBool(cfgRaw.status) : false;
        if (!enabled) continue;

        const mentionText = `@${participantJid.split("@")[0]}`;
        const memberMeta = (md?.participants || []).find((item) => {
          const jid = typeof item === "string" ? item : item?.id || item?.jid || "";
          return jidNormalizedUser(jid) === participantJid;
        });
        const memberName = memberMeta?.notify || memberMeta?.name || memberMeta?.verifiedName || participantJid.split("@")[0];
        const replacements = { mentionText, name: memberName, group: groupName, size: groupSize, number: participantJid.split("@")[0], botName: process.env.BOT_NAME || "RAHUL MD BOT", ownerName: process.env.OWNER_NAME || "OWNER" };
        const template = cfgRaw?.custom || DEFAULT_WELCOME;
        const base = buildText(template, replacements);
        const text = base.text;
        const wantsPp = base.wantsPp;

        let imgBuf = null;
        let videoUrl = null;
        if (wantsPp) {
          imgBuf = await fetchProfileBuffer(conn, participantJid);
        } else {
          videoUrl = await nextWelcomeVideo(botNumber, groupJid);
        }

        try {
          await sendWelcomeMsg(conn, groupJid, text, [participantJid], imgBuf, videoUrl);
        } catch (e) {
          console.error(
            "[welcome-goodbye] error sending welcome:",
            e?.message || e
          );
        }
      }

      // GOODBYE (remove/leave/left/kicked)
      if (
        action === "remove" ||
        action === "leave" ||
        action === "left" ||
        action === "kicked"
      ) {
        const key = `group:${groupJid}:goodbye`;
        const cfgRaw = await db.getAsync(botNumber, key, null);
        const enabled =
          cfgRaw && typeof cfgRaw === "object" ? toBool(cfgRaw.status) : false;
        if (!enabled) continue;

        const mentionText = `@${participantJid.split("@")[0]}`;
        const memberMeta = (md?.participants || []).find((item) => {
          const jid = typeof item === "string" ? item : item?.id || item?.jid || "";
          return jidNormalizedUser(jid) === participantJid;
        });
        const memberName = memberMeta?.notify || memberMeta?.name || memberMeta?.verifiedName || participantJid.split("@")[0];
        const replacements = { mentionText, name: memberName, group: groupName, size: groupSize, number: participantJid.split("@")[0], botName: process.env.BOT_NAME || "RAHUL MD BOT", ownerName: process.env.OWNER_NAME || "OWNER" };
        const template = cfgRaw?.custom || DEFAULT_GOODBYE;
        const base = buildText(template, replacements);
        const text = base.text;
        const wantsPp = base.wantsPp;

        let imgBuf = null;
        let videoUrl = null;
        if (wantsPp) {
          imgBuf = await fetchProfileBuffer(conn, participantJid);
        } else {
          videoUrl = await nextWelcomeVideo(botNumber, groupJid);
        }

        try {
          await sendWelcomeMsg(conn, groupJid, text, [participantJid], imgBuf, videoUrl);
        } catch (e) {
          console.error(
            "[welcome-goodbye] error sending goodbye:",
            e?.message || e
          );
        }
      }

      // PROMOTE / DEMOTE (kept as-is)
      if (action === "promote" || action === "demote") {
        const owner = botJidFull || null;
        const ownerMention = owner
          ? `@${owner.split("@")[0]}`
          : conn.user?.id
          ? `@${String(conn.user.id).split(":")[0]}`
          : "Owner";
        const actor = event.actor || event.author || event.by || null;
        const actorText = actor ? `@${actor.split("@")[0]}` : "Admin";
        const targetText = `@${participantJid.split("@")[0]}`;
        const actionText = action === "promote" ? "promoted" : "demoted";
        const sendText = `╭─〔 *🎉 Admin Event* 〕\n├─ ${actorText} has ${actionText} ${targetText}\n├─ Group: ${groupName}\n╰─➤`;
        try {
          const mentions = [actor, participantJid, botJidFull].filter(Boolean);
          if (owner) mentions.push(owner);
          await conn.sendMessage(groupJid, { text: sendText, mentions });
        } catch (e) {
          console.error(
            "[welcome-goodbye] promote/demote send error:",
            e?.message || e
          );
          try {
            await conn.sendMessage(groupJid, { text: sendText });
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.error(
      "[welcome-goodbye] event handler error:",
      err?.message || err
    );
  }
});
