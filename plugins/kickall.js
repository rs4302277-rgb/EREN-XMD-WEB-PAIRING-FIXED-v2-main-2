// plugins/kickall.js - raw Miku MD handler, hardened for Baileys v7/LID variants
import { Module } from "../lib/plugins.js";
import { jidNormalizedUser, areJidsSameUser } from "@whiskeysockets/baileys";

const normalize = (jid) => { try { return jidNormalizedUser(jid); } catch { return String(jid || ""); } };

async function getMetadata(message) {
  try { await message.loadGroupInfo(); } catch {}
  if (message.groupMetadata?.participants?.length) return message.groupMetadata;
  try { return await message.conn.groupMetadata(message.from); } catch { return null; }
}

function participantId(p) {
  if (typeof p === "string") return p;
  return p?.id || p?.jid || p?.participant || p?.pn || p?.phoneNumber || p?.lid || "";
}
function isAdmin(p) {
  return p?.admin === true || p?.isAdmin === true || p?.admin === "admin" || p?.admin === "superadmin" || p?.role === "admin" || p?.role === "superadmin";
}
function allIds(p) {
  return [p?.id, p?.jid, p?.participant, p?.pn, p?.phoneNumber, p?.lid].filter(Boolean).map(normalize);
}

Module({ command: "kickall", package: "group", description: "Remove all non-admin members" })(async (message) => {
  try {
    if (!message.isGroup) return message.send("❌ Group only");
    await message.loadGroupInfo();
    if (!(message.isAdmin || message.isFromMe || message.isfromMe)) return message.send("❌ Admin only");
    if (!message.isBotAdmin) return message.send("❌ Bot must be admin");

    const md = await getMetadata(message);
    const participants = Array.isArray(md?.participants) ? md.participants : [];
    if (!participants.length) return message.send("❌ No participants found");

    const botIds = new Set([
      message.conn?.user?.id,
      message.conn?.user?.lid,
      message.conn?.user?.jid,
      message.conn?.user?.phoneNumber,
    ].filter(Boolean).map(normalize));

    const targets = participants.filter((p) => !isAdmin(p)).filter((p) => {
      const ids = allIds(p);
      return !ids.some((id) => [...botIds].some((b) => {
        try { return areJidsSameUser(id, b); } catch { return id === b; }
      }));
    }).map(participantId).filter(Boolean);

    if (!targets.length) return message.send("✅ No non-admin users to remove");

    await message.react("⏳");
    let result;
    try {
      result = await message.conn.groupParticipantsUpdate(message.from, targets, "remove");
    } catch (e) {
      console.error("[kickall] groupParticipantsUpdate:", e);
      await message.react("❌");
      return message.send(`❌ Failed to remove users: ${e?.message || e}`);
    }

    const statuses = [];
    const collect = (v) => {
      if (!v || typeof v !== "object") return;
      if (v.status != null) statuses.push(Number(v.status));
      for (const x of Object.values(v)) if (x && typeof x === "object") collect(x);
    };
    collect(result);
    const failed = statuses.filter((s) => Number.isFinite(s) && s >= 400);
    if (failed.length) {
      await message.react("❌");
      return message.send(`❌ WhatsApp rejected ${failed.length} removal action(s).`);
    }

    await message.react("✅");
    return message.send(`✅ *Kicked ${targets.length} non-admin user(s).*`);
  } catch (e) {
    console.error("[kickall]", e);
    await message.react("❌").catch(() => {});
    return message.send(`❌ Kickall failed: ${e?.message || e}`);
  }
});
