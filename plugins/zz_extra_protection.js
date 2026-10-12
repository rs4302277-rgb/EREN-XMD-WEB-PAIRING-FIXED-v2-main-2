import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
const botNum=m=>String(m?.conn?.user?.id||m?.conn?.user?.jid||"").split("@")[0].split(":")[0].replace(/\D/g,"");
const isAdmin=m=>!!(m?.isFromMe||m?.isfromMe||m?.isAdmin||m?.isGroupAdmin);
const key=(f,g)=>`${f}:${g}`;

Module({command:"antistatus",package:"group protection",description:"Block non-admin group status posts"})(async(m,a)=>{
 if(!m?.isGroup)return m.reply("❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.");
 if(!isAdmin(m))return m.reply("❌ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴ/ᴏᴡɴᴇʀ ᴏɴʟʏ.");
 await m.loadGroupInfo?.(); if(!m.isBotAdmin)return m.reply("❌ ʙᴏᴛ ɴᴇᴇᴅs ᴀᴅᴍɪɴ.");
 const n=botNum(m); const input=String(a||"").trim().toLowerCase(),ek=key("antistatus:enabled",m.from),mk=key("antistatus:mode",m.from);
 if(!input)return m.reply(`╭━━〔 🛡️ ᴀɴᴛɪsᴛᴀᴛᴜs 〕━━╮\n┃ sᴛᴀᴛᴜs : ${db.get(n,ek,false)?"🟢 ᴏɴ":"🔴 ᴏғғ"}\n┃ ᴍᴏᴅᴇ : ${String(db.get(n,mk,"delete")).toUpperCase()}\n╰━━━━━━━━━━━━━━━━╯\nᴜsᴇ : .antistatus on/off/kick/warn/delete`);
 if(input==="on"){db.setHot(n,ek,true);if(!db.get(n,mk))db.setHot(n,mk,"delete");return m.reply("✅ ᴀɴᴛɪsᴛᴀᴛᴜs ᴏɴ");}
 if(input==="off"){db.setHot(n,ek,false);return m.reply("❌ ᴀɴᴛɪsᴛᴀᴛᴜs ᴏғғ");}
 if(["kick","warn","delete"].includes(input)){db.setHot(n,mk,input);db.setHot(n,ek,true);return m.reply(`✅ ᴀɴᴛɪsᴛᴀᴛᴜs ${input.toUpperCase()} ᴍᴏᴅᴇ`);}
 return m.reply("Usage: .antistatus on/off/kick/warn/delete");
});

Module({on:"message",package:"group protection",description:"AntiStatus enforcement"})(async m=>{
 try{
  if(!m?.isGroup||isAdmin(m))return; const n=botNum(m); if(!n||db.get(n,key("antistatus:enabled",m.from),false)!==true||!m.isBotAdmin)return;
  const raw=m.raw?.message||{}; const isStatus=m.type==="groupStatusMessage"||!!raw.groupStatusMessage||!!raw.groupStatusMessageV2||!!m.content?.groupStatusMessage; if(!isStatus)return;
  const jid=m.sender||m.key?.participant; if(!jid)return; try{await m.conn.sendMessage(m.from,{delete:m.key});}catch{}
  const mode=String(db.get(n,key("antistatus:mode",m.from),"delete")); const num=jid.split("@")[0].split(":")[0];
  if(mode==="delete")return m.send(`⚠️ @${num} — ɢʀᴏᴜᴘ sᴛᴀᴛᴜs ʙʟᴏᴄᴋᴇᴅ`,{mentions:[jid]});
  if(mode==="warn"){
   const wk=key(`warn:antistatus:${jid}`,m.from),w=(Number(db.get(n,wk,0))||0)+1;db.setHot(n,wk,w);
   if(w<3)return m.send(`⚠️ @${num} — ᴀɴᴛɪsᴛᴀᴛᴜs ᴡᴀʀɴɪɴɢ ${w}/3`,{mentions:[jid]});db.delHot(n,wk);
  }
  await new Promise(r=>setTimeout(r,350)); await m.conn.groupParticipantsUpdate(m.from,[jid],"remove").catch(()=>{});
 }catch{}
});
