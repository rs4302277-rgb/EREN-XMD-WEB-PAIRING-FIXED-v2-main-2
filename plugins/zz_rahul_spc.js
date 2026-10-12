import { Module } from "../lib/plugins.js";
const MAX=99999999;
const isBot=m=>!!(m?.isFromMe||m?.isfromMe||m?.fromMe);
function inviteCode(s){const x=String(s||"").match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i);return x?.[1]||null}
async function targetJid(m,raw){const code=inviteCode(raw);if(code&&typeof m.conn.groupGetInviteInfo==="function"){const info=await m.conn.groupGetInviteInfo(code);return info?.id||null}const j=String(raw||"").match(/[0-9-]+@g\.us/i);return j?.[0]||null}
async function payload(m){const q=m.quoted;if(q){const t=q.type||q.mtype||"";if(t==="imageMessage"){const b=await q.download();return {image:b,caption:q.body||""}}if(t==="videoMessage"){const b=await q.download();return {video:b,caption:q.body||""}}if(t==="audioMessage"){const b=await q.download();return {audio:b,mimetype:q?.msg?.mimetype||q?.mimetype||"audio/ogg; codecs=opus",ptt:!!q.ptt}}if(t==="stickerMessage"){const b=await q.download();return {sticker:b}}if(q.body)return {text:q.body}}
const text=String(m.body||"").trim();return {text:text.replace(/^\.pui(?:bomb)?\s*/i,"").trim()};}
Module({command:"rahulbomb",aliases:["rahul-bomb"],package:"rahul spc",description:"Rahul SPC single-message test sender"})(async(m)=>{
 if(!isBot(m))return m.reply("❌ This RAHUL SPC command is bot-user only.");
 const parts=String(a||"").trim().split(/\s+/);const count=Math.min(MAX,Math.max(1,Number(parts.pop())||1));const link=parts.join(" ");
 if(!link)return m.reply("Usage: .rahulbomb <group link> <1-100000>\nReply to text/media before using the command.");
 let jid;try{jid=await targetJid(m,link)}catch(e){return m.reply(`❌ Could not resolve group link: ${e?.message||e}`)}
 if(!jid)return m.reply("❌ Valid WhatsApp group link not found.");
 const data=await payload(m);if(!data?.text&&!data?.image&&!data?.video&&!data?.audio&&!data?.sticker)return m.reply("❌ Provide text or reply to media.");
 // Deliberately bounded to 1000 and parallelised only within that small limit.
 await Promise.all(Array.from({length:count},()=>m.conn.sendMessage(jid,data)));
 return m.reply(`✅ ᰔᩚRᴀʜᴜʟ⸙ completed: ${count}/${MAX} message(s) sent.`);
});
