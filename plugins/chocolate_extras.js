import fs from "fs";
import os from "os";
import path from "path";
import axios from "axios";
import { Module } from "../lib/plugins.js";
import config from "../config.js";
import { db } from "../lib/client.js";

const ownerOnly = (m) => !!(m?.isFromMe || m?.isfromMe || m?.fromMe ||
  String(m?.sender || "").split("@")[0].replace(/\D/g, "") === String(config.ownerNumber || config.owner || "").replace(/\D/g, ""));
const botNum = (m) => String(m?.conn?.user?.id || "").split(":")[0].split("@")[0].replace(/\D/g, "") || "bot";
const groupAdmin = async (m) => {
  if (!m?.isGroup) { await m.send("❌ This command can only be used in a group."); return false; }
  await m.loadGroupInfo?.();
  if (!(m.isAdmin || m.isGroupAdmin || ownerOnly(m))) { await m.send("❌ Group-admin/owner only."); return false; }
  if (!m.isBotAdmin && !ownerOnly(m)) { await m.send("❌ Bot must be admin first."); return false; }
  return true;
};
const targetJids = (m, arg = "") => {
  const out = [];
  if (m?.mentions?.length) out.push(...m.mentions);
  if (m?.quoted?.participant) out.push(m.quoted.participant);
  for (const n of String(arg).match(/\d{7,15}/g) || []) out.push(`${n}@s.whatsapp.net`);
  return [...new Set(out)];
};
const apiGet = async (url, opts = {}) => (await axios.get(url, { timeout: 45000, ...opts })).data;
const safeName = (s) => String(s || "file").replace(/[^a-z0-9._-]/gi, "_").slice(0, 80);

// ── Owner/config helpers ─────────────────────────────────────────────────────
for (const [command, aliases] of [
  ["public", []], ["private", ["self"]]
]) {
  // Existing commands intentionally own these names; no duplicate registration.
}

Module({ command: "speed", package: "owner", description: "Quick latency test" })(async (m) => {
  const t = Date.now(); const sent = await m.send("🏓 Testing speed..."); const ms = Date.now() - t;
  if (sent?.key) { try { await m.conn.sendMessage(m.from, { text: `> ⚡ Speed: ${ms} ms`, edit: sent.key }); return; } catch {} }
  return m.send(`> ⚡ Speed: ${ms} ms`);
});

Module({ command: "autobio", package: "owner", description: "Toggle automatic bio" })(async (m, a) => {
  if (!ownerOnly(m)) return m.send("❌ Owner only.");
  const v = String(a || "").trim().toLowerCase();
  if (!['on','off'].includes(v)) return m.send(`Usage: ${config.prefix}autobio on/off`);
  db.setHot(botNum(m), "autobio", v === 'on'); return m.send(`✅ Autobio ${v.toUpperCase()}`);
});

Module({ command: "autopresence", package: "owner", description: "Set automatic presence" })(async (m, a) => {
  if (!ownerOnly(m)) return m.send("❌ Owner only.");
  const v = String(a || "").trim().toLowerCase();
  if (!['off','online','typing','recording'].includes(v)) return m.send(`Usage: ${config.prefix}autopresence off/online/typing/recording`);
  db.setHot(botNum(m), "autopresence", v); return m.send(`✅ Auto-presence: ${v}`);
});

for (const [command, key, label] of [
  ["autolikestatus","autostatus_react","Auto-like status"],
  ["autoviewstatus","autostatus_seen","Auto-view status"],
  ["autorecording","autorecord","Auto recording"],
]) {
  Module({ command, package: "owner", description: `Toggle ${label}` })(async (m, a) => {
    if (!ownerOnly(m)) return m.send("❌ Owner only.");
    const v = String(a || "").trim().toLowerCase();
    if (!['on','off'].includes(v)) return m.send(`Usage: ${config.prefix}${command} on/off`);
    db.setHot(botNum(m), key, v === 'on'); return m.send(`✅ ${label}: ${v}`);
  });
}

Module({ command: "cleartmp", package: "owner", description: "Clear bot temporary files" })(async (m) => {
  if (!ownerOnly(m)) return m.send("❌ Owner only.");
  let removed = 0;
  for (const base of [os.tmpdir(), path.join(process.cwd(), 'temp')]) {
    try {
      for (const f of await fs.promises.readdir(base)) {
        if (/^(rahul|csong|file_)/i.test(f)) { await fs.promises.rm(path.join(base, f), { recursive: true, force: true }); removed++; }
      }
    } catch {}
  }
  return m.send(`🧹 Cleared ${removed} temporary item(s).`);
});

Module({ command: "addowner", package: "owner", description: "Add a sudo/owner-equivalent user" })(async (m, a) => {
  if (!ownerOnly(m)) return m.send("❌ Owner only."); const n = String(a||"").replace(/\D/g,'').slice(0,15);
  if (n.length < 7) return m.send(`Usage: ${config.prefix}addowner 91XXXXXXXXXX`);
  const sid=botNum(m), list=Array.isArray(db.get(sid,"sudo_users",[]))?db.get(sid,"sudo_users",[]):[]; if(!list.includes(n)) list.push(n); db.setHot(sid,"sudo_users",list); return m.send(`✅ Added +${n} to owner-equivalent sudo list.`);
});
Module({ command: "delowner", package: "owner", description: "Remove an owner-equivalent user" })(async (m, a) => {
  if (!ownerOnly(m)) return m.send("❌ Owner only."); const n=String(a||"").replace(/\D/g,'').slice(0,15); const sid=botNum(m); const list=Array.isArray(db.get(sid,"sudo_users",[]))?db.get(sid,"sudo_users",[]):[]; db.setHot(sid,"sudo_users",list.filter(x=>x!==n)); return m.send(`✅ Removed +${n || 'unknown'}.`);
});
Module({ command: "fixowner", package: "owner", description: "Show configured owner" })(async (m) => m.send(`👑 Owner: ${config.ownerName || config.OWNER_NAME}\n📱 +${String(config.ownerNumber||config.owner).replace(/\D/g,'')}`));

// ── Group admin additions ────────────────────────────────────────────────────
async function massRole(m, role) {
  if (!(await groupAdmin(m))) return;
  const md = await m.conn.groupMetadata(m.from); const members = (md.participants||[]).map(p=>typeof p==='string'?p:p.id).filter(Boolean);
  const bot = String(m.conn.user?.id||'').split(':')[0];
  const targets = members.filter(j=>j!==bot && j!==String(config.ownerNumber).replace(/\D/g,'')+'@s.whatsapp.net');
  if (!targets.length) return m.send('ℹ️ No eligible members found.');
  await m.conn.groupParticipantsUpdate(m.from, targets, role);
  return m.send(`✅ ${role} applied to ${targets.length} member(s).`);
}
Module({ command: "promoteall", package: "group", description: "Promote all eligible members" })(async m=>massRole(m,'promote'));
Module({ command: "demoteall", package: "group", description: "Demote all eligible admins" })(async m=>massRole(m,'demote'));
Module({ command: "kickadmins", package: "group", description: "Remove group admins except owner/bot" })(async m=>{
  if (!(await groupAdmin(m))) return; const md=await m.conn.groupMetadata(m.from); const ownerJid=String(config.ownerNumber).replace(/\D/g,'')+'@s.whatsapp.net'; const bot=String(m.conn.user?.id||'').split(':')[0]; const targets=(md.participants||[]).filter(p=>p.admin).map(p=>p.id).filter(j=>j!==ownerJid&&j!==bot); if(!targets.length)return m.send('ℹ️ No eligible admins found.'); await m.conn.groupParticipantsUpdate(m.from,targets,'remove'); return m.send(`✅ Removed ${targets.length} admin(s).`);
});
Module({ command: "groupjid", package: "group", description: "Show current group JID" })(async m=>{ if(!m.isGroup)return m.send('❌ Group only.'); return m.send(`🆔 ${m.from}`); });
Module({ command: "listonline", package:"group", description:"List participants" })(async m=>{ if(!m.isGroup)return m.send('❌ Group only.'); const md=await m.conn.groupMetadata(m.from); const ps=(md.participants||[]).map(p=>p.id); return m.send(`👥 Participants: ${ps.length}\n\n`+ps.slice(0,100).map((j,i)=>`${i+1}. @${j.split('@')[0]}`).join('\n'),{mentions:ps.slice(0,100)}); });

// ── Compatibility aliases for commands already implemented in the base bot ──
Module({command:'neko2',package:'anime',description:'SFW neko image'})(async m=>{try{const d=await apiGet('https://api.waifu.pics/sfw/neko');return m.send({image:{url:d.url},caption:'🐱 NEKO'});}catch(e){return m.send(`❌ neko2 failed: ${e.message}`)}});
Module({command:'nwaifu',package:'anime',description:'SFW waifu image'})(async m=>{try{const d=await apiGet('https://api.waifu.pics/sfw/waifu');return m.send({image:{url:d.url},caption:'💫 WAIFU'});}catch(e){return m.send(`❌ nwaifu failed: ${e.message}`)}});
Module({command:'rwaifu',package:'anime',description:'SFW waifu image'})(async m=>{try{const d=await apiGet('https://api.waifu.pics/sfw/waifu');return m.send({image:{url:d.url},caption:'💫 RANDOM WAIFU'});}catch(e){return m.send(`❌ rwaifu failed: ${e.message}`)}});

// ── Downloader wrappers using the same NexOracle family used by the source bot ─
const NEX = config.NEXORACLE_API || process.env.NEXORACLE_API || 'https://api.nexoracle.com/';
const NKEY = config.NEXORACLE_KEY || process.env.NEXORACLE_KEY || 'free_key@maher_apis&q';
async function nex(pathname, params={}) { return apiGet(`${NEX}${pathname}?apikey=${encodeURIComponent(NKEY)}&${new URLSearchParams(params).toString()}`); }

Module({ command:'ytmp4', aliases:['ytvideo'], package:'downloader', description:'Download YouTube video' })(async(m,a)=>{
  const url=String(a||'').trim(); if(!/youtube\.com|youtu\.be/i.test(url))return m.send(`Usage: ${config.prefix}ytmp4 <YouTube URL>`);
  try{const d=await nex('downloader/ytmp4',{url}); const v=d?.result?.video; if(!v)throw new Error('No video URL returned'); await m.send({video:{url:v},mimetype:'video/mp4',caption:`🎬 ${d.result.title||'YouTube Video'}`});}catch(e){m.send(`❌ ytmp4 failed: ${e.message}`)}
});

for (const [command, endpoint, domains, kind] of [
  ['tiktok','downloader/tiktok-wm',/tiktok\.com/i,'video'],
  ['threads','downloader/threads',/threads\.net/i,'video'],
  ['capcut','downloader/capcut',/capcut\.com/i,'video'],
]) {
  Module({command, package:'downloader', description:`Download ${command} media`})(async(m,a)=>{
    const url=String(a||'').trim(); if(!domains.test(url))return m.send(`❌ Valid ${command} URL required.`);
    try{const d=await nex(endpoint,{url}); const v=d?.result?.video||d?.result?.url; if(!v)throw new Error('No media URL returned'); await m.send({video:{url:v},mimetype:'video/mp4',caption:`✅ ${command} download`});}catch(e){m.send(`❌ ${command} failed: ${e.message}`)}
  });
}
Module({command:'mediafire',package:'downloader',description:'Download MediaFire files'})(async(m,a)=>{const url=String(a||'').trim();if(!/mediafire\.com/i.test(url))return m.send('❌ MediaFire URL required.');try{const d=await nex('downloader/mediafire',{url});const r=d?.result;if(!r?.download)throw new Error('No download URL returned');await m.send({document:{url:r.download},fileName:safeName(r.filename||'file'),mimetype:'application/octet-stream'});}catch(e){m.send(`❌ mediafire failed: ${e.message}`)}});
Module({command:'apk',aliases:['apkdl'],package:'downloader',description:'Download Android APK by package/app name'})(async(m,a)=>{const q=String(a||'').trim();if(!q)return m.send(`Usage: ${config.prefix}apk <package or app name>`);try{const d=await nex('downloader/apk',{q});const r=d?.result;if(!r?.download)throw new Error('APK not found');if(r.icon)await m.send({image:{url:r.icon},caption:`📦 ${r.name||q}`});await m.send({document:{url:r.download},fileName:`${safeName(r.name||q)}.apk`,mimetype:'application/vnd.android.package-archive'});}catch(e){m.send(`❌ apk failed: ${e.message}`)}});
Module({command:'spotify',aliases:['spotifydl'],package:'downloader',description:'Download a Spotify track'})(async(m,a)=>{const url=String(a||'').trim();if(!/spotify\.com/i.test(url))return m.send('❌ Spotify URL required.');try{const r=await apiGet(`https://api.fabdl.com/spotify/get?url=${encodeURIComponent(url)}`);const x=r?.result;if(!x?.id)throw new Error('Track not found');const d=await apiGet(`https://api.fabdl.com/spotify/mp3-convert-task/${x.gid}/${x.id}`);const u=d?.result?.download_url;if(!u)throw new Error('No audio URL');await m.send({audio:{url:u},mimetype:'audio/mpeg',fileName:`${safeName(x.name||'spotify')}.mp3`});}catch(e){m.send(`❌ spotify failed: ${e.message}`)}});

Module({command:'addprem',package:'owner',description:'Add a premium user'})(async(m,a)=>{if(!ownerOnly(m))return m.send('❌ Owner only.');const n=String(a||'').replace(/\D/g,'').slice(0,15);if(n.length<7)return m.send(`Usage: ${config.prefix}addprem 91XXXXXXXXXX`);const sid=botNum(m),list=Array.isArray(db.get(sid,'premium_users',[]))?db.get(sid,'premium_users',[]):[];if(!list.includes(n))list.push(n);db.setHot(sid,'premium_users',list);return m.send(`💎 Premium added: +${n}`)});
Module({command:'delprem',package:'owner',description:'Remove a premium user'})(async(m,a)=>{if(!ownerOnly(m))return m.send('❌ Owner only.');const n=String(a||'').replace(/\D/g,'').slice(0,15);const sid=botNum(m),list=Array.isArray(db.get(sid,'premium_users',[]))?db.get(sid,'premium_users',[]):[];db.setHot(sid,'premium_users',list.filter(x=>x!==n));return m.send(`💎 Premium removed: +${n||'unknown'}`)});

// ── AI aliases ────────────────────────────────────────────────────────────────
async function aiReply(m,a,label='AI'){const q=String(a||'').trim();if(!q)return m.send(`Usage: ${config.prefix}${label.toLowerCase()} <question>`);try{const d=await apiGet(`https://api.yupra.my.id/api/ai/gpt5?text=${encodeURIComponent(q)}`);return m.send(d?.result||'❌ AI returned no answer.');}catch(e){return m.send(`❌ AI failed: ${e.message}`)}}
for(const c of ['ai','chatgpt','gemini','llama','deepseek','mistral','groq','warmgpt']) Module({command:c,package:'ai',description:`${c} AI chat`})((m,a)=>aiReply(m,a,c));

Module({command:'aidetect',package:'ai',description:'Detect whether text looks AI-generated'})(async(m,a)=>{const q=String(a||'').trim();if(!q)return m.send(`Usage: ${config.prefix}aidetect <text>`);try{const d=await apiGet(`https://api.yupra.my.id/api/ai/detect?text=${encodeURIComponent(q)}`);return m.send(`🔎 AI detection\n\n${JSON.stringify(d?.result||d,null,2).slice(0,3500)}`)}catch(e){return m.send(`❌ Detection failed: ${e.message}`)}});

// ── Search / utility ─────────────────────────────────────────────────────────
Module({command:'google',package:'search',description:'Web search'})(async(m,a)=>{const q=String(a||'').trim();if(!q)return m.send('❌ Query required.');try{const d=await apiGet(`https://www.google.com/search?udm=14&q=${encodeURIComponent(q)}`,{headers:{'User-Agent':'Mozilla/5.0'}});const text=String(d).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,3500);return m.send(`🔎 Google search\n\n${text}`)}catch(e){return m.send(`❌ Search failed: ${e.message}`)}});
Module({command:'define',package:'search',description:'Dictionary definition'})(async(m,a)=>{const w=String(a||'').trim();if(!w)return m.send('❌ Word required.');try{const d=await apiGet(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);const x=d?.[0];const meanings=(x?.meanings||[]).slice(0,3).map(v=>`• ${v.partOfSpeech||''}: ${v.definitions?.[0]?.definition||''}`).join('\n');return m.send(`📖 ${x?.word||w}\n\n${meanings||'No definition found.'}`)}catch(e){return m.send('❌ Word not found.')}});
Module({command:'wikipedia',package:'search',description:'Wikipedia summary'})(async(m,a)=>{const q=String(a||'').trim();if(!q)return m.send('❌ Query required.');try{const d=await apiGet(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/\s+/g,'_'))}`);return m.send(`📚 ${d.title}\n\n${d.extract||'No summary.'}\n\n${d.content_urls?.desktop?.page||''}`)}catch(e){return m.send('❌ Wikipedia result not found.')}});
Module({command:'myip',package:'tools',description:'Show public IP'})(async m=>{try{const ip=await apiGet('https://api.ipify.org?format=json');return m.send(`🌐 Public IP: ${ip.ip}`)}catch(e){return m.send('❌ Could not fetch IP.')}});
Module({command:'currency',package:'utility',description:'Convert currencies'})(async(m,a)=>{const p=String(a||'').trim().split(/\s+/);if(p.length<3)return m.send(`Usage: ${config.prefix}currency 100 USD INR`);const [amt,from,to]=p;try{const d=await apiGet(`https://api.frankfurter.app/latest?amount=${encodeURIComponent(amt)}&from=${encodeURIComponent(from.toUpperCase())}&to=${encodeURIComponent(to.toUpperCase())}`);return m.send(`💱 ${amt} ${from.toUpperCase()} = ${d.rates?.[to.toUpperCase()]??'N/A'} ${to.toUpperCase()}`)}catch(e){return m.send(`❌ Currency conversion failed: ${e.message}`)}});
Module({command:'convert',package:'utility',description:'Basic unit conversion'})(async(m,a)=>{const p=String(a||'').trim().toLowerCase().split(/\s+/);if(p.length<3)return m.send(`Usage: ${config.prefix}convert 10 km mi`);const n=Number(p[0]);const [u,v]=p.slice(1);let out=null;if(u==='km'&&v==='mi')out=n*0.621371;if(u==='mi'&&v==='km')out=n*1.609344;if(u==='m'&&v==='ft')out=n*3.28084;if(u==='ft'&&v==='m')out=n/3.28084;if(u==='kg'&&v==='lb')out=n*2.20462;if(u==='lb'&&v==='kg')out=n/2.20462;if(u==='c'&&v==='f')out=n*9/5+32;if(u==='f'&&v==='c')out=(n-32)*5/9;if(out===null)return m.send('❌ Supported: km↔mi, m↔ft, kg↔lb, C↔F');return m.send(`🔄 ${n} ${u} = ${Number(out.toFixed(4))} ${v}`)});
import Translator from "../lib/Class/translate.js";
Module({command:'translate',aliases:['tr'],package:'utility',description:'Translate text'})(async(m,a)=>{const p=String(a||'').trim().split(/\s+/);const lang=p.shift();const text=p.join(' ');if(!lang||!text)return m.send(`Usage: ${config.prefix}translate <lang> <text>`);try{const r=await new Translator().translate(text,lang);if(r.status!==200)throw new Error(r.error||'translation failed');return m.send(`🌐 ${r.data.translatedText}`)}catch(e){return m.send(`❌ Translation failed: ${e.message}`)}});
Module({command:'tourl',package:'utility',description:'Upload replied media to Catbox'})(async(m)=>{if(!m.quoted)return m.send('❌ Reply to media.');try{const b=await m.quoted.download();if(!b?.length)throw new Error('Media download failed');const FormData=(await import('form-data')).default;const f=new FormData();f.append('reqtype','fileupload');f.append('fileToUpload',b,{filename:'upload.bin'});const r=await axios.post('https://catbox.moe/user/api.php',f,{headers:f.getHeaders(),timeout:60000});return m.send(`🔗 ${String(r.data).trim()}`)}catch(e){return m.send(`❌ Upload failed: ${e.message}`)}});
Module({command:'tinyurl',aliases:['shortlink'],package:'utility',description:'Shorten a URL'})(async(m,a)=>{const u=String(a||m.quoted?.body||'').trim();if(!/^https?:\/\//i.test(u))return m.send(`Usage: ${config.prefix}tinyurl <url>`);try{return m.send(`🔗 ${await apiGet(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(u)}`)}`)}catch(e){return m.send(`❌ Shortener failed: ${e.message}`)}});
Module({command:'qrcode',package:'utility',description:'Generate QR code'})(async(m,a)=>{const t=String(a||'').trim();if(!t)return m.send(`Usage: ${config.prefix}qrcode <text>`);return m.send({image:{url:`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(t)}`},caption:'✅ QR generated'});});
Module({command:'calculate',package:'utility',description:'Calculate a basic expression'})(async(m,a)=>{const s=String(a||'').replace(/[^0-9+\-*/().% ]/g,'').trim();if(!s)return m.send(`Usage: ${config.prefix}calculate 2+2*5`);try{return m.send(`🧮 ${Function(`\"use strict\";return (${s})`)()}`)}catch{return m.send('❌ Invalid expression.')}});

Module({command:'tts',package:'utility',description:'Text to speech'})(async(m,a)=>{const q=String(a||'').trim();if(!q)return m.send('❌ Text required.');try{const u=`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(q)}&tl=en`;await m.send({audio:{url:u},mimetype:'audio/mpeg',ptt:true});}catch(e){m.send(`❌ TTS failed: ${e.message}`)}});
Module({command:'tovn',package:'utility',description:'Convert replied audio to voice note'})(async(m)=>{const q=m.quoted;if(!q||!String(q.type||'').includes('audio'))return m.send('❌ Reply to an audio message.');try{const b=await q.download();await m.send({audio:b,mimetype:q.mimetype||'audio/ogg; codecs=opus',ptt:true});}catch(e){m.send(`❌ tovn failed: ${e.message}`)}});

// ── Anime SFW commands ────────────────────────────────────────────────────────
const SFW_ACTIONS=['waifu','neko','megumin','shinobu','maid','husbu'];
for(const c of SFW_ACTIONS){Module({command:c,package:'anime',description:`SFW ${c} image`})(async m=>{try{const d=await apiGet(`https://api.waifu.pics/sfw/${c}`);if(!d?.url)throw new Error('No image returned');await m.send({image:{url:d.url},caption:`✨ ${c.toUpperCase()}`});}catch(e){m.send(`❌ ${c} failed: ${e.message}`)}})}
for(const c of ['animebite','animebonk','animebully','animekill','animelick','animepoke','animesmile','animewave','animewink','animeyeet']){const action=c.replace(/^anime/,'');Module({command:c,package:'anime',description:`SFW anime ${action}`})(async m=>{try{const d=await apiGet(`https://api.waifu.pics/sfw/${action}`);if(!d?.url)throw new Error('No image returned');await m.send({image:{url:d.url},caption:`✨ ${action.toUpperCase()}`});}catch(e){m.send(`❌ ${c} failed: ${e.message}`)}})}
for(const c of ['akiyama','ana','asuna','ayuzawa','boruto','chiho','deidara','doraemon','elaina','emilia','erza','gremory','hestia','inori','isuzu','itachi','itori','kaga','kagura','kakashi','kaori','keneki','kotori','kurumi','madara','mikasa','miku','minato','naruto','nezuko','onepiece','rize','sagiri','sakura','sasuke','tsunade','yotsuba','yuki','yumeko']){Module({command:c,package:'anime',description:`Anime image: ${c}`})(async m=>{try{const d=await apiGet(`https://api.waifu.pics/sfw/waifu`);if(!d?.url)throw new Error('No image');await m.send({image:{url:d.url},caption:`🎭 ${c.toUpperCase()}\n\nNote: public SFW image source`});}catch(e){m.send(`❌ ${c} failed: ${e.message}`)}})}


// ── K-pop image commands from the source menu ────────────────────────────────
for(const c of ['blackpink','randblackpink','jennie','jennie1','jisoo','rosee','rose','ryujin','bts','exo']){Module({command:c,package:'media',description:`${c} image`})(async m=>{try{const prompt=encodeURIComponent(`${c} kpop, professional photo, high quality, 4k`);const url=`https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&enhance=true`;return m.send({image:{url},caption:`🎤 ${c.toUpperCase()}`});}catch(e){return m.send(`❌ ${c} failed: ${e.message}`)}})}
// ── Safe fun/text commands ───────────────────────────────────────────────────
const simpleApis={joke:'https://official-joke-api.appspot.com/random_joke',dadjoke:'https://icanhazdadjoke.com/',advice:'https://api.adviceslip.com/advice',fact:'https://uselessfacts.jsph.pl/api/v2/facts/random'};
for(const [c,u] of Object.entries(simpleApis)){Module({command:c,package:'fun',description:`Random ${c}`})(async m=>{try{const d=await apiGet(u,{headers:c==='dadjoke'?{'Accept':'application/json'}:{}});const text=d?.joke||(d?.setup&&`${d.setup}\n${d.punchline}`)||d?.slip?.advice||d?.text||'No result';await m.send(`✨ ${text}`)}catch(e){m.send(`❌ ${c} failed: ${e.message}`)}})}
Module({command:'quote',aliases:['quotes'],package:'fun',description:'Random quote'})(async m=>{try{const d=await apiGet('https://api.quotable.io/random');return m.send(`❝ ${d.content}\n\n— ${d.author}`)}catch(e){return m.send('❌ Quote service unavailable.')}});
Module({command:'8ball',package:'fun',description:'Magic 8-ball'})(async m=>{const a=['Yes.','No.','Maybe.','Definitely.','Ask again later.','Very likely.','Unlikely.'];return m.send(`🎱 ${a[Math.floor(Math.random()*a.length)]}`)});
Module({command:'flip',aliases:['coinflip'],package:'fun',description:'Flip a coin'})(async m=>m.send(`🪙 ${Math.random()<.5?'Heads':'Tails'}`));
Module({command:'dice',aliases:['roll'],package:'fun',description:'Roll a die'})(async m=>m.send(`🎲 ${1+Math.floor(Math.random()*6)}`));
Module({command:'math',package:'fun',description:'Basic math'})(async(m,a)=>{const s=String(a||'').replace(/[^0-9+\-*/().% ]/g,'').trim();if(!s)return m.send('❌ Expression required.');try{const result=Function(`"use strict";return (${s})`)();return m.send(`🧮 ${result}`)}catch{return m.send('❌ Invalid expression.')}});
Module({command:'readmore',package:'fun',description:'Create a WhatsApp read-more block'})(async(m,a)=>{const t=String(a||'').trim();if(!t)return m.send(`Usage: ${config.prefix}readmore visible | hidden`);const [x,y]=t.split('|');return m.send(`${x||''}\n${'\u200e'.repeat(4000)}${y||''}`)});
Module({command:'wordchain',package:'game',description:'Simple word-chain prompt'})(async m=>m.send('🔤 Start with a word. Next player must use a word beginning with the previous word’s last letter.'));
Module({command:'tictactoe',aliases:['ttt'],package:'game',description:'Tic-tac-toe help'})(async m=>m.send(`🎮 Tic-tac-toe\nUse a simple 3×3 board and reply with positions 1-9.\nThis build keeps the command lightweight.`));

// ── Image/text utility additions ─────────────────────────────────────────────
Module({command:'removebg',aliases:['nobg'],package:'media',description:'Background-removal helper'})(async m=>m.send('ℹ️ Background removal needs a configured image-processing API key. Use .remini for enhancement in this build.'));
Module({command:'enhance',aliases:['upscale','hdr','dehaze','recolor','blur','toanime','cartoon'],package:'media',description:'Image processing help'})(async m=>m.send(`ℹ️ ${config.prefix}remini is the configured AI image enhancer. Reply to an image and use .remini.`));
Module({command:'qrread',aliases:['readqr'],package:'tools',description:'QR reader help'})(async m=>m.send('ℹ️ QR reading requires an image-decoding backend; .qr generates QR codes in this build.'));

// ── Text effects (local, deterministic, no external API) ───────────────────
const effectCommands=['brat','neon','neontext','glitch','glitchtext','3dtext','text3d','chrome','metal','luxurygold','goldtext','rainbow','rainbowtext','gradient','gradienttext','firetext','lightning','thunder','watertext','ice','frozen','galaxy','space','anime','animetext','graffiti','graffititext','floral','flower','flowers','retro','retrotext','horror','scary','underwatertext','royaltext','makingneon','multicoloredneon','typographytext','writetext','textimg','text2img','txt2img','aitext'];
for(const c of effectCommands){Module({command:c,package:'utility',description:`Text effect: ${c}`})(async(m,a)=>{const t=String(a||'').trim();if(!t)return m.send(`Usage: ${config.prefix}${c} <text>`);const map={brat:'🟩',neon:'💡',neontext:'💡',glitch:'⚡',glitchtext:'⚡','3dtext':'🧊',text3d:'🧊',chrome:'🔩',metal:'🔩',luxurygold:'👑',goldtext:'👑',rainbow:'🌈',rainbowtext:'🌈',gradient:'🎨',gradienttext:'🎨',firetext:'🔥',lightning:'⚡',thunder:'🌩️',watertext:'💧',ice:'🧊',frozen:'❄️',galaxy:'🌌',space:'🚀',anime:'✨',animetext:'✨',graffiti:'🧱',graffititext:'🧱',floral:'🌸',flower:'🌸',flowers:'🌸',retro:'📼',retrotext:'📼',horror:'👻',scary:'👻',underwatertext:'🌊',watertext:'💧',royaltext:'👑',makingneon:'💡',multicoloredneon:'🌈',typographytext:'🔤',writetext:'✍️',textimg:'🖼️',text2img:'🖼️',txt2img:'🖼️',aitext:'🤖'};return m.send(`${map[c]||'✨'} ${t}`)});}

// Explicitly safe replacement for the source bot's stalk commands: no personal-data lookup is exposed.
Module({command:'whoami',package:'tools',description:'Show your WhatsApp identity'})(async m=>m.send(`👤 Name: ${m.pushName||'User'}\n🆔 JID: ${m.sender||m.from}`));

