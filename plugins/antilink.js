import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

const LINK_REGEX=/(?:https?:\/\/[^\s]+)|(?:www\.[^\s]+)|(?:chat\.whatsapp\.com\/[A-Za-z0-9_-]+)|(?:wa\.me\/[0-9]+)|(?:t\.me\/[A-Za-z0-9_-]+)|(?:telegram\.me\/[A-Za-z0-9_-]+)|(?:discord\.gg\/[A-Za-z0-9_-]+)|(?:bit\.ly\/[A-Za-z0-9_-]+)|(?:tinyurl\.com\/[A-Za-z0-9_-]+)|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|gg|xyz|me|app|online|site|link)\b/gi;
const botNumber=m=>String(m?.conn?.user?.id||m?.conn?.user?.jid||"").split("@")[0].split(":")[0].replace(/\D/g,"");
const key=(group,part)=>`antilink:${group}:${part}`;
const sender=m=>m?.sender||m?.key?.participant||m?.key?.participantAlt||null;

async function commandAdmin(m){
  if(!m?.isGroup){await m.send("❌ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴡᴏʀᴋs ᴏɴʟʏ ɪɴ ɢʀᴏᴜᴘs.");return false;}
  await m.loadGroupInfo?.();
  if(!(m.isAdmin||m.isGroupAdmin||m.isFromMe||m.isfromMe)){await m.send("❌ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴ/ᴏᴡɴᴇʀ ᴏɴʟʏ.");return false;}
  if(!m.isBotAdmin){await m.send("❌ ᴍᴀᴋᴇ ᴛʜᴇ ʙᴏᴛ ᴀɴ ᴀᴅᴍɪɴ ғɪʀsᴛ.");return false;}
  return true;
}

Module({command:"antilink",aliases:["antilinks"],package:"group",description:"Enable anti-link with kick, warn or delete"})(async(m,a)=>{
  if(!(await commandAdmin(m)))return;
  const sid=botNumber(m), raw=String(a||"").trim().toLowerCase(), ek=key(m.from,"enabled"), mk=key(m.from,"mode");
  if(!raw)return m.send(`╭━━〔 🔗 𝐀𝐍𝐓𝐈𝐋𝐈𝐍𝐊 〕━━╮\n┃ sᴛᴀᴛᴜs : ${db.get(sid,ek,false)?"🟢 ᴏɴ":"🔴 ᴏғғ"}\n┃ ᴍᴏᴅᴇ : ${String(db.get(sid,mk,"kick")).toUpperCase()}\n╰━━━━━━━━━━━━━━━━╯\n\n${process.env.PREFIX||"."}antilink on/off/kick/warn/delete`);
  if(raw==="on"){db.setHot(sid,ek,true);if(!db.get(sid,mk))db.setHot(sid,mk,"kick");return m.send("✅ ᴀɴᴛɪʟɪɴᴋ ᴏɴ");}
  if(raw==="off"){db.setHot(sid,ek,false);return m.send("❌ ᴀɴᴛɪʟɪɴᴋ ᴏғғ");}
  if(["kick","warn","delete"].includes(raw)){db.setHot(sid,mk,raw);db.setHot(sid,ek,true);return m.send(`✅ ᴀɴᴛɪʟɪɴᴋ ${raw.toUpperCase()} ᴍᴏᴅᴇ`);}
  return m.send("Usage: .antilink on/off/kick/warn/delete");
});

async function remove(m){try{await m.conn.sendMessage(m.from,{delete:m.key});return true;}catch{}try{await m.send({delete:m.key});return true;}catch{}return false;}
async function kick(m,jid){try{const r=await m.conn.groupParticipantsUpdate(m.from,[jid],"remove");const s=String(JSON.stringify(r||""));if(/(?:status|code)["']?\s*[:=]\s*[45]\d\d/i.test(s))return false;return true;}catch(e){console.error("[antilink] kick",e?.message||e);return false;}}

Module({on:"text",package:"group",description:"Anti-link enforcement"})(async(m)=>{
  try{
    if(!m?.isGroup||!m.body)return;
    const sid=botNumber(m);if(db.get(sid,key(m.from,"enabled"),false)!==true)return;
    await m.loadGroupInfo?.();if(!m.isBotAdmin)return;if(m.isAdmin||m.isGroupAdmin||m.isFromMe||m.isfromMe)return;
    if(!LINK_REGEX.test(String(m.body)))return;LINK_REGEX.lastIndex=0;
    const jid=sender(m);if(!jid)return;const num=String(jid).split("@")[0].split(":")[0];const mode=String(db.get(sid,key(m.from,"mode"),"kick")).toLowerCase();
    await remove(m);
    if(mode==="delete")return m.send(`🗑️ @${num} — ʟɪɴᴋ ʀᴇᴍᴏᴠᴇᴅ.`,{mentions:[jid]});
    if(mode==="warn"){
      const wk=key(m.from,`warn:${jid}`);const w=(Number(db.get(sid,wk,0))||0)+1;db.setHot(sid,wk,w);
      if(w<3)return m.send(`⚠️ @${num} — ʟɪɴᴋ ɴᴏᴛ ᴀʟʟᴏᴡᴇᴅ. ᴡᴀʀɴɪɴɢ ${w}/3.`,{mentions:[jid]});
      db.delHot(sid,wk);await m.send(`🚫 @${num} — 3/3 ᴡᴀʀɴɪɴɢs ʀᴇᴀᴄʜᴇᴅ. ʀᴇᴍᴏᴠɪɴɢ ᴜsᴇʀ.`,{mentions:[jid]});
    }
    await new Promise(r=>setTimeout(r,350));
    const ok=await kick(m,jid);if(!ok)await m.send(`❌ @${num} — ᴋɪᴄᴋ ғᴀɪʟᴇᴅ. ᴄʜᴇᴄᴋ ʙᴏᴛ ᴀᴅᴍɪɴ ᴘᴇʀᴍɪssɪᴏɴ.`,{mentions:[jid]});
  }catch(e){console.error("[antilink enforcement]",e?.message||e);}
});
