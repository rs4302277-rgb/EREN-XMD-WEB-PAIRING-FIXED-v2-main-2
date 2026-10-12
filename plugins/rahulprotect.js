import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import { generateWAMessageContent, generateWAMessageFromContent, generateMessageID } from "@whiskeysockets/baileys";
import crypto from "crypto";

const botNum = (conn) => String(conn?.user?.id || conn?.user?.jid || "").split("@")[0].split(":")[0].replace(/\D/g, "") || null;
const key = (name, group) => `rahulprotect:${name}:${group}`;
const get = (n,k,d=false) => { const v=db.get(n,k); return v===undefined||v===null?d:v; };
const owner = (m) => !!(m?.isFromMe || m?.isfromMe || (String(m?.sender||"").split("@")[0]===String(m?.conn?.user?.id||"").split("@")[0]));
async function admin(m){ if(!m?.isGroup) { await m.send("❌ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪɴ ᴀ ɢʀᴏᴜᴘ."); return false; } if(!(owner(m)||m.isAdmin||m.isGroupAdmin)){ await m.send("❌ ᴏɴʟʏ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴ ᴄᴀɴ ᴜsᴇ ᴛʜɪs."); return false;} if(!m.isBotAdmin && !owner(m)){ await m.send("❌ ʙᴏᴛ ɴᴇᴇᴅs ᴀᴅᴍɪɴ ᴘᴇʀᴍɪssɪᴏɴ."); return false;} return true; }
async function toggle(m,name,arg){
  if(!(await admin(m))) return;
  const n=botNum(m.conn); if(!n)return m.send("❌ ʙᴏᴛ ɴᴜᴍʙᴇʀ ɴᴏᴛ ғᴏᴜɴᴅ.");
  const a=String(arg||"").trim().toLowerCase(); const k=key(name,m.from);
  const current=get(n,k,false);
  const currentMode = current && typeof current === "object" ? (current.mode || (current.enabled ? "kick" : "off")) : (current ? "kick" : "off");
  if(!a) return m.send(`╭━━〔 ${name.toUpperCase()} 〕━━╮\n┃ sᴛᴀᴛᴜs : ${currentMode==='off'?"🔴 ᴏғғ":"🟢 ᴏɴ"}\n┃ ᴍᴏᴅᴇ : ${currentMode==='off'?"—":currentMode.toUpperCase()}\n┃ ᴜsᴇ : .${name} on/off/warn/kick\n╰━━━━━━━━━━━━━━╯`);
  if(a==='off'){ db.setHot(n,k,{enabled:false,mode:'off'}); return m.send(`✅ ${name} OFF`); }
  if(a==='on'){ db.setHot(n,k,{enabled:true,mode:'kick'}); return m.send(`✅ ${name} ON — KICK mode`); }
  if(['warn','kick'].includes(a)){ db.setHot(n,k,{enabled:true,mode:a}); return m.send(`✅ ${name} ${a.toUpperCase()} mode enabled`); }
  return m.send(`❌ ᴜsᴇ : .${name} on/off/warn/kick`);
}
Module({command:"antigstatus",aliases:["antigcstatus"],package:"group",description:"Block group status posts"})(async(m,a)=>toggle(m,"antigstatus",a));
Module({command:"antipromote",package:"group",description:"Reverse unauthorized promotions"})(async(m,a)=>toggle(m,"antipromote",a));
Module({command:"antidemote",package:"group",description:"Reverse unauthorized demotions"})(async(m,a)=>toggle(m,"antidemote",a));

async function sendGroupStatus(conn, jid, storyData){
  if (!jid?.endsWith("@g.us")) throw new Error("Group status requires a group chat");
  if (typeof conn?.relayMessage !== "function") throw new Error("Group-status relay is unavailable");

  const messageSecret = crypto.randomBytes(32);
  let inner;

  if (storyData?.text != null) {
    inner = {
      extendedTextMessage: {
        text: String(storyData.text),
        backgroundArgb: storyData.backgroundColor ?? 0xff128c7e,
        textArgb: 0xffffffff,
        font: Number.isInteger(storyData.font) ? storyData.font : 1,
        contextInfo: { isGroupStatus: true },
      },
    };
  } else {
    const generated = await generateWAMessageContent(storyData, {
      upload: conn.waUploadToServer,
    });
    inner = generated?.message || generated;
    if (!inner) throw new Error("Could not build group-status payload");

    for (const value of Object.values(inner)) {
      if (value && typeof value === "object") {
        value.contextInfo = {
          ...(value.contextInfo || {}),
          isGroupStatus: true,
        };
      }
    }
  }

  inner.messageContextInfo = { messageSecret };

  const envelope = {
    messageContextInfo: { messageSecret },
    groupStatusMessageV2: { message: inner },
  };

  const generated = generateWAMessageFromContent(jid, envelope, {
    userJid: conn?.user?.id,
  });

  await conn.relayMessage(
    jid,
    generated.message,
    { messageId: generated.key?.id || generateMessageID() }
  );
}

Module({command:"gstatusall",aliases:["gsall"],package:"group",description:"Post text or replied media as group status in all groups"})(async(m,match)=>{
  if(!(await admin(m))) return;
  const text=String(match||"").trim(); const q=m.quoted; const type=q?.type||q?.mtype||"";
  if(!text && !q)return m.send("❌ ᴛᴇxᴛ ᴅɪɴ ʙᴀ ɪᴍᴀɢᴇ/ᴠɪᴅᴇᴏ ʀᴇᴘʟʏ ᴋᴏʀᴜɴ.");
  let storyData;
  if(q && ["imageMessage","videoMessage","audioMessage","stickerMessage"].includes(type)){
    const media=await q.download(); if(!media?.length)return m.send("❌ ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅ ғᴀɪʟᴇᴅ.");
    if(type==="imageMessage") storyData={image:media,caption:text||q.body||""};
    else if(type==="videoMessage") storyData={video:media,caption:text||q.body||""};
    else if(type==="audioMessage") storyData={audio:media,mimetype:q.mimetype||"audio/ogg; codecs=opus",ptt:!!q.ptt};
    else storyData={sticker:media};
  } else storyData={text:text||q?.body||"",backgroundColor:0xff128c7e,font:1};
  const groups=await m.conn.groupFetchAllParticipating(); const ids=Object.keys(groups||{}); if(!ids.length)return m.send("❌ ɴᴏ ɢʀᴏᴜᴘs ғᴏᴜɴᴅ.");
  let ok=0,fail=0;
  for(const id of ids){ try{ await sendGroupStatus(m.conn,id,storyData); ok++; }catch(e){ fail++; console.error("[gstatusall]",id,e?.message||e); } }
  return m.send(`╭━━〔 ɢsᴛᴀᴛᴜsᴀʟʟ 〕━━╮\n┃ ᴛᴏᴛᴀʟ : ${ids.length}\n┃ sᴇɴᴛ : ${ok}\n┃ ғᴀɪʟᴇᴅ : ${fail}\n╰━━━━━━━━━━━━━━╯`);
});

// Group-status enforcement. Baileys exposes this as groupStatusMessage on builds that support incoming group status messages.
Module({on:"message",package:"group",description:"Anti group-status enforcement"})(async(m)=>{
  try{ if(!m?.isGroup) return; const n=botNum(m.conn); if(!n||!get(n,key("antigstatus",m.from),false)) return; const raw=m.raw?.message||{}; const isGS=m.type==="groupStatusMessage"||!!raw.groupStatusMessage||!!raw.groupStatusMessageV2||m.content?.groupStatusMessage; if(!isGS||owner(m)||m.isAdmin||m.isGroupAdmin)return; if(m.isBotAdmin){try{await m.conn.sendMessage(m.from,{delete:m.key});}catch{}} }catch{}
});

// Revert promotions/demotions. A short local guard prevents loops caused by the bot itself.
const selfChanges=new Map();
const mark=(g,j,a)=>{selfChanges.set(`${g}|${j}|${a}`,Date.now()+8000);};
const wasSelf=(g,j,a)=>{const k=`${g}|${j}|${a}`,t=selfChanges.get(k); if(t&&t>Date.now())return true; selfChanges.delete(k); return false;};
async function reverse(event,conn,name,action,reverseAction){
  const n=botNum(conn); if(!n||!conn.groupParticipantsUpdate)return;
  const cfg=get(n,key(name,event.id),false);
  const mode = cfg && typeof cfg === 'object' ? (cfg.enabled===false ? 'off' : (cfg.mode||'kick')) : (cfg ? 'kick' : 'off');
  if(mode==='off') return;
  const warnKey=(j)=>`rahulprotect:warn:${name}:${event.id}:${j}`;
  for(const p of event.participants||[]){
    const j=typeof p==="string"?p:p?.id||p?.jid||"";
    if(!j||wasSelf(event.id,j,action))continue;
    if(String(j).split('@')[0]===String(n)) continue;
    try{
      if(mode==='warn'){
        const warns=(Number(get(n,warnKey(j),0))||0)+1;
        if(warns>=3){
          db.delHot(n,warnKey(j)); mark(event.id,j,reverseAction);
          await conn.groupParticipantsUpdate(event.id,[j],reverseAction);
          await conn.sendMessage(event.id,{text:`🚨 @${j.split('@')[0]} — ${action} blocked. 3/3 warnings reached; member removed.`,mentions:[j]});
        } else {
          db.setHot(n,warnKey(j),warns);
          await conn.sendMessage(event.id,{text:`⚠️ @${j.split('@')[0]} — unauthorized ${action}. Warning ${warns}/3.`,mentions:[j]});
          mark(event.id,j,reverseAction); await conn.groupParticipantsUpdate(event.id,[j],reverseAction);
        }
      } else {
        mark(event.id,j,reverseAction);
        await conn.groupParticipantsUpdate(event.id,[j],reverseAction);
        await conn.sendMessage(event.id,{text:`⚠️ @${j.split('@')[0]} — ${action} ʙʟᴏᴄᴋᴇᴅ.`,mentions:[j]});
      }
    }catch(err){ console.error(`[${name}]`,err?.message||err); }
  }
}
Module({on:"group-participants.update",package:"group"})(async(_m,e,c)=>{ if(e?.action==="promote") await reverse(e,c,"antipromote","promote","demote"); if(e?.action==="demote") await reverse(e,c,"antidemote","demote","promote"); });
