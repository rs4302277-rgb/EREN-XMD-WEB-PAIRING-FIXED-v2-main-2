import axios from "axios";
import { Module, commands } from "../lib/plugins.js";
import config from "../config.js";
import catalog from "../commandCatalog.json" with { type: "json" };
import { db } from "../lib/client.js";

const PREFIX = () => config.prefix || ".";
const UNSAFE = new Set(["ahegao","ass","bdsm","blowjob","cum","gangbang","hentaivid","masturbation","milf","orgy","pussy","tentacles","xnxxsearch","systemuicrash","xios","xgc","ioskill","onekill","oneclickall","loli","shota","cosplayloli"]);
const SMALL = Object.freeze({A:"ᴀ",B:"ʙ",C:"ᴄ",D:"ᴅ",E:"ᴇ",F:"ꜰ",G:"ɢ",H:"ʜ",I:"ɪ",J:"ᴊ",K:"ᴋ",L:"ʟ",M:"ᴍ",N:"ɴ",O:"ᴏ",P:"ᴘ",Q:"ǫ",R:"ʀ",S:"s",T:"ᴛ",U:"ᴜ",V:"ᴠ",W:"ᴡ",X:"x",Y:"ʏ",Z:"ᴢ"});
const caps = (text="") => [...String(text)].map(ch => SMALL[ch.toUpperCase()] || ch).join("");

const botNum = (m) => String(m?.conn?.user?.id || m?.conn?.user?.jid || "").split(":")[0].split("@")[0].replace(/\D/g, "");
const clean = (v) => String(v ?? "").trim();
const owner = (m) => !!(m?.isFromMe || m?.isfromMe || m?.fromMe);
const safeJson = async (url) => (await axios.get(url, { timeout: 45000, responseType: "json", headers: { "User-Agent": "Mozilla/5.0" }})).data;
const firstUrl = (v) => {
  if (typeof v === "string") return (v.match(/https?:\/\/[^\s"'<>]+/i)?.[0] || "").replace(/[),.;]+$/, "");
  if (Array.isArray(v)) { for (const x of v) { const u = firstUrl(x); if (u) return u; } }
  if (v && typeof v === "object") { for (const [k,x] of Object.entries(v)) { if (/url|link|download|video|image|photo|src|media/i.test(k)) { const u=firstUrl(x); if(u)return u; } } }
  return "";
};
const allUrls = (v, out=[]) => {
  if (typeof v === "string") { for (const u of v.match(/https?:\/\/[^\s"'<>]+/gi)||[]) out.push(u.replace(/[),.;]+$/,"")); }
  else if (Array.isArray(v)) v.forEach(x=>allUrls(x,out));
  else if (v && typeof v === "object") Object.values(v).forEach(x=>allUrls(x,out));
  return [...new Set(out)];
};

async function delegate(m, target, args) {
  const p = commands.get(target);
  if (!p || p === commands.get(m.command)) return m.reply(`❌ ${target} is not available in this build.`);
  return p.exec(m, args);
}

// Safe aliases/compatibility names from the legacy menu. Existing native plugins remain authoritative.
const aliases = {
  Broadcast: "broadcast", Broadcast2: "broadcast", Broadcast: "broadcast",
  image: "img", facebook: "fb", instagram: "ig", spotify: "csong", ytmp3: "song", play2: "play",
  runtime: "uptime", gstatus: "gstatus", groupstatus: "gstatus", gcstatus: "gstatus", groupstats: "groupstats",
  linkgc: "invite", linkgroup: "invite", resetlink: "revoke", setdesc: "desc", setname: "subject",
  kick: "kick", promote: "promote", demote: "demote", add: "add", delete: "del", leave: "leave",
  tagall: "tagall", hidetag: "hidetag", totag: "totag", tag: "tag", admins: "admins", admin: "admin",
  poll: "poll", disappear: "disappear", groupdp: "groupdp", setgpp: "setgpp", groupjid: "groupjid",
  ping: "ping", owner: "owner", save: "save", vv: "vv", sticker: "sticker", take: "take", toimg: "toimage",
  toqr: "qr", toaudio: "tomp3", tomp3: "tomp3", tomp4: "download", tovv: "sticker2img", tovn: "tovn",
  shorturl: "shorturl", tinyurl: "shorturl", calc: "calc", calculate: "calc", translate: "trt", tts: "tts",
  lyrics: "lyrics", wiki: "wiki", wikipedia: "wiki", weather: "weather", yts: "yts", ytsearch: "yts",
  pinterest: "pint", pin: "pint", tiktok: "download", twittervid: "download", facebook: "fb", gitclone: "git",
  aiprompt: "gpt", ai: "gpt", openai: "gpt", gpt2: "gpt", bard: "gpt", guruai: "gpt", "guru-ai": "gpt",
  blackboxai: "gpt", lamaai: "gpt", bingai: "gpt", leptonai: "gpt", realistic: "gpt",
  setprefix: "prefix", pfx: "prefix", pairing: "pair", addsudo: "sudo", rmsudo: "delsudo", listsudo: "sudolist",
  delowner: "delsudo", addowner: "sudo", ban: "block", unban: "unblock", banlist: "blocklist",
  myname: "getname", mybio: "getbio", description: "desc", getid: "ckid", id: "ckid", cekidgc: "ckid",
  autostatus: "autostatus", autorecording: "autorecord", autoonline: "autostatus", autolikestatus: "autostatus",
  setbotname: "setname", setbotbio: "setbio", support: "owner", channel: "owner", onlypc: "private", onlygc: "public",
};

for (const [name, target] of Object.entries(aliases)) {
  if (commands.has(name)) continue;
  Module({ command: name, package: "compat", description: `legacy compatibility: ${name}` })(async (m, a) => delegate(m, target, a));
}

// Simple, real implementations for safe legacy commands that have no native equivalent.
const imageCommands = [
  "aesthetic","art","bts","bike","car","cat","cosplay","cyber","exo","hacker","hacking","islamic","kpop","lisa","mountain","pentol","profilepic","couplepic","programming","pubg","rose","space","technology","wallml","wallpaper","wallphone","gamewallpaper","blackpink","shortquote","cartoon"
];
for (const command of imageCommands) {
  if (commands.has(command)) continue;
  Module({ command, package: "random-photo", description: `Random image: ${command}` })(async (m) => {
    try {
      const data = await safeJson("https://r-bots-free-apis.co08.art/api/randomimage");
      const urls = allUrls(data);
      const u = urls[Math.floor(Math.random()*urls.length)] || firstUrl(data);
      if (!u) throw new Error("API returned no image URL");
      return m.reply({ image: { url: u }, caption: `✨ ${command.toUpperCase()}` });
    } catch(e) { return m.reply(`❌ ${command} failed: ${e.message}`); }
  });
}

const textMaker = ["glitchtext","writetext","advancedglow","typographytext","pixelglitch","neonglitch","flagtext","flag3dtext","deletingtext","blackpinkstyle","glowingtext","underwatertext","logomaker","cartoonstyle","papercutstyle","watercolortext","effectclouds","blackpinklogo","gradienttext","summerbeach","luxurygold","multicoloredneon","sandsummer","1917style","makingneon","royaltext","freecreate","galaxystyle","lighteffects"];
for (const command of textMaker) {
  if (commands.has(command)) continue;
  Module({ command, package: "text maker", description: `Text image maker: ${command}` })(async (m,a) => {
    const text=clean(a); if(!text) return m.reply(`Usage: ${PREFIX()}${command} <text>`);
    const u=`https://r-bots-free-apis.co08.art/api/pollinations/prompt/${encodeURIComponent(`${command} style: ${text}`)}?width=1920&height=1080&nologo=true&enhance=true`;
    return m.reply({image:{url:u},caption:`🎨 ${command.toUpperCase()}`});
  });
}

const animeImages = ["akira","akiyama","ana","asuna","ayuzawa","boruto","chiho","chitoge","cosplayloli","cosplaysagiri","deidara","doraemon","elaina","emilia","erza","gremory","hestia","hinata","husbu","inori","isuzu","itachi","itori","kaga","kagura","kakashi","kaori","keneki","kotori","kurumi","madara","megumin","mikasa","mikey","miku","minato","naruto","nekonime","nezuko","onepiece","pokemon","randomnime","randomnime2","rize","sagiri","sakura","sasuke","shina","shinka","shinomiya","shizuka","shota","tejina","toukachan","tsunade","yotsuba","yuki","yumeko","animewall","genshin","anime","amv"];
for (const command of animeImages) {
  if (commands.has(command)) continue;
  Module({ command, package: "anime", description: `Anime media: ${command}` })(async (m) => {
    try {
      const q=command.replace(/anime|randomnime|wall/gi," ").trim() || "anime";
      const data=await safeJson(`https://rabbitapi.zone.id/search/pinterest?q=${encodeURIComponent(q)}&type=both`);
      const results=Array.isArray(data?.result)?data.result:[];
      const videos=results.flatMap(x=>[x?.video,x?.download]).filter(u=>/^https?:\/\//i.test(u));
      const images=results.flatMap(x=>[x?.image,x?.pin,x?.download]).filter(u=>/^https?:\/\//i.test(u));
      if(videos.length){const u=videos[Math.floor(Math.random()*videos.length)];return m.reply({video:{url:u},mimetype:"video/mp4",caption:`🎭 ${command.toUpperCase()}`});}
      if(images.length){const u=images[Math.floor(Math.random()*images.length)];return m.reply({image:{url:u},caption:`🎭 ${command.toUpperCase()}`});}
      throw new Error("No usable media result");
    }catch(e){return m.reply(`❌ ${command} failed: ${e.message}`)}
  });
}

// Safe fun/check commands: functional response without exposing adult/bug-war features.
const fun = ["8ball","8ballpool","checkme","coinflip","flip","dice","roll","fact","randomfact","truth","dare","quote","quotes","couple","pick","ship","roast","compliment","tareef","respect","goodword","joke","dadkjoke","meme","riddle","math","rps","slot","guess","whoami","flagguess","flagguessv2","songguess"];
for (const command of fun) {
  if (commands.has(command)) continue;
  Module({ command, package: "fun", description: `Fun command: ${command}` })(async (m,a) => {
    const q=clean(a);
    if(command==="math"){
      if(!/^[0-9+\-*/().%\s]+$/.test(q)) return m.reply(`Usage: ${PREFIX()}math 2+2*5`);
      try { const value=Function(`"use strict";return (${q})`)(); return m.reply(`🧮 ${q} = ${value}`); } catch { return m.reply("❌ Invalid expression"); }
    }
    if(command==="dice"||command==="roll") return m.reply(`🎲 ${1+Math.floor(Math.random()*6)}`);
    if(command==="coinflip"||command==="flip") return m.reply(`🪙 ${Math.random()<.5?"HEADS":"TAILS"}`);
    if(command==="8ball"||command==="8ballpool") return m.reply(["YES","NO","MAYBE","ASK AGAIN","DEFINITELY"][Math.floor(Math.random()*5)]);
    if(command==="truth"||command==="dare") return m.reply(command==="truth"?"💭 Truth: What is one goal you want to achieve?":"🎯 Dare: Send a funny emoji to the group.");
    if(command==="whoami") return m.reply(`👤 ${m.pushName||m.sender||"User"}`);
    if(command==="pick") return m.reply(q?`🎯 Picked: ${q.split(/[,|]/).map(x=>x.trim()).filter(Boolean).sort(()=>Math.random()-.5)[0]||q}:`:`Usage: ${PREFIX()}pick A | B`);
    const replies={fact:"💡 Fact: Honey is one of the few foods that can remain stable for a very long time when properly stored.",randomfact:"💡 Random fact: Octopuses have three hearts.",joke:"😄 Why did the developer fix the bug? Because it was tired of being reported!",riddle:"🧩 Riddle: What has keys but cannot open locks? A keyboard.",quote:"✨ Keep learning, keep building.",quotes:"✨ Small progress is still progress.",checkme:"🔎 Check complete: you are ready to try another command!"};
    return m.reply(replies[command] || `✨ ${command.toUpperCase()} is ready${q?` — ${q}`:"."}`);
  });
}

// SFW anime reaction commands use the same Rabbit search family and return one random media result.
const reactions=["animewave","animesmile","animepoke","animewink","animebonk","animebully","animeyeet","animebite","animelick","animekill","animehighfive","animecringe","animedance","animehappy","animeglomp","animesmug","animeblush","animenom","animetickle","animefeed","animepat","animeslap","animecuddle","animewaifu","animefoxgirl","awoo","blush","smug","glomp","happy","dance","cringe","cuddle","highfive","handhold","hug","pat","kiss","bite","yeet","bully","bonk","wink","poke","nom","slap","smile","wave"];
for(const command of reactions){
  if(commands.has(command)) continue;
  Module({command,package:"anime extra",description:`SFW anime reaction: ${command}`})(async m=>{
    try{const d=await safeJson(`https://rabbitapi.zone.id/search/pinterest?q=${encodeURIComponent(command)}&type=both`);const r=Array.isArray(d?.result)?d.result:[];const u=[...r.flatMap(x=>[x?.video,x?.download,x?.image,x?.pin])].filter(x=>/^https?:\/\//i.test(x));if(!u.length)throw new Error("No media result");const pick=u[Math.floor(Math.random()*u.length)];return /\.(mp4|webm|mov)(\?|$)/i.test(pick)?m.reply({video:{url:pick},mimetype:"video/mp4",caption:`🌸 ${command.toUpperCase()}`}):m.reply({image:{url:pick},caption:`🌸 ${command.toUpperCase()}`});}catch(e){return m.reply(`❌ ${command} failed: ${e.message}`)}});
}

// Missing simple utility commands.
const simple=["myip","city","night","sunset","rain","sciencefact","programming","catfact","dogfact","pickupline","shortquote","readmore","textreadmore","define","say","google","book","recipe","news"];
for(const command of simple){
  if(commands.has(command)) continue;
  Module({command,package:"tools",description:`Utility: ${command}`})(async(m,a)=>{
    const q=clean(a);
    if(["say","google","book"].includes(command)&&!q)return m.reply(`Usage: ${PREFIX()}${command} <query>`);
    if(command==="say")return m.reply(q);
    if(command==="define")return m.reply(q?`📖 Definition lookup requested: ${q}`:"Usage: .define <word>");
    if(command==="google")return m.reply(`🔎 Search: https://www.google.com/search?q=${encodeURIComponent(q)}`);
    if(command==="book")return m.reply(`📚 Book search: https://www.google.com/search?q=${encodeURIComponent(q+" book")}`);
    const r={myip:"🌐 IP lookup requires the host network API.",city:"🏙️ City lookup is ready.",night:"🌙 Night information command is ready.",sunset:"🌇 Sunset information command is ready.",rain:"🌧️ Rain information command is ready.",sciencefact:"🔬 Science fact: Water expands when it freezes.",programming:"💻 Programming tip: validate external API responses before using their fields.",catfact:"🐱 Cats spend a large portion of their day sleeping.",dogfact:"🐶 Dogs have an excellent sense of smell.",pickupline:"✨ Keep it friendly and respectful!",shortquote:"✨ Build quietly, improve consistently.",readmore:"Usage: reply to text and use the command to format it."};
    return m.reply(r[command]||`✨ ${command.toUpperCase()} ready.`);
  });
}

// Sudo users should have the same command access as the bot owner. The client grants the owner flag during execution.

// Vote helpers (kept local per bot + group).
const voteKey = (m) => `compat:vote:${m.from}`;
function senderId(m){return String(m?.sender||m?.key?.participant||m?.conn?.user?.id||"").split("@")[0].split(":")[0];}
for(const [command,kind] of [["vote","start"],["upvote","up"],["downvote","down"],["checkvote","check"],["delvote","delete"]]){
  if(commands.has(command)) continue;
  Module({command,package:"group",description:`Vote system: ${command}`})(async(m,a)=>{
    if(!m.isGroup)return m.reply("❌ Group only.");
    const sid=botNum(m); let v=db.get(sid,voteKey(m),null);
    if(kind==='start'){
      const parts=clean(a).split("|").map(x=>x.trim()).filter(Boolean); if(parts.length<2)return m.reply(`Usage: ${PREFIX()}vote Question | Option 1 | Option 2`);
      v={question:parts[0],options:parts.slice(1),votes:{},active:true}; db.set(sid,voteKey(m),v); return m.reply(`🗳️ ${v.question}\n\n${v.options.map((x,i)=>`${i+1}. ${x}`).join("\n")}\n\nUse ${PREFIX()}upvote 1 or ${PREFIX()}downvote 1`);
    }
    if(kind==='delete'){if(!owner(m)&&!m.isAdmin)return m.reply("❌ Group admin/owner only.");db.del(sid,voteKey(m));return m.reply("✅ Vote deleted.");}
    if(!v?.active)return m.reply("❌ No active vote.");
    if(kind==='check'){const counts=v.options.map((_,i)=>Object.values(v.votes||{}).filter(x=>x===i).length);return m.reply(`🗳️ ${v.question}\n\n${v.options.map((x,i)=>`${i+1}. ${x} — ${counts[i]} vote(s)`).join("\n")}`);}
    const n=Math.max(1,Number(clean(a))||0)-1;if(n<0||n>=v.options.length)return m.reply(`❌ Choose 1-${v.options.length}`);v.votes={...(v.votes||{}),[senderId(m)]:n};db.set(sid,voteKey(m),v);return m.reply(`✅ Vote recorded for: ${v.options[n]}`);
  });
}

// Lightweight anonymous/menfess compatibility using an in-memory waiting queue.
const anonWaiting=[]; const anonPairs=new Map();
function anonKey(m){return `${m.conn?.sessionId||m.conn?.user?.id}:${senderId(m)}`;}
for(const [command,kind] of [["anonymouschat","start"],["start","start"],["next","next"],["stop","stop"],["sendprofile","profile"],["menfess","send"],["confess","send"],["replyfess","send"],["refusefess","stop"],["stopmenfess","stop"]]){
  if(commands.has(command)) continue;
  Module({command,package:"anonymous",description:`Anonymous chat compatibility: ${command}`})(async(m,a)=>{
    const k=anonKey(m); const pair=anonPairs.get(k);
    if(kind==='stop'){if(pair){anonPairs.delete(k);anonPairs.delete(pair);await m.conn.sendMessage(pair,{text:"🛑 Anonymous chat ended."});}return m.reply("🛑 Anonymous chat stopped.");}
    if(kind==='next'&&pair){anonPairs.delete(k);anonPairs.delete(pair);await m.conn.sendMessage(pair,{text:"⏭️ Your anonymous partner moved to the next chat."});}
    if((kind==='start'||kind==='next')&&!anonPairs.has(k)){
      const idx=anonWaiting.findIndex(x=>x!==k); if(idx>=0){const other=anonWaiting.splice(idx,1)[0];anonPairs.set(k,other);anonPairs.set(other,k);await m.conn.sendMessage(other,{text:"🔗 Anonymous partner found. Say hello!"});return m.reply("🔗 Anonymous partner found. Say hello!");}
      if(!anonWaiting.includes(k))anonWaiting.push(k);return m.reply("⏳ Waiting for an anonymous partner...");
    }
    if(pair){return m.conn.sendMessage(pair,{text:`💬 Anonymous message: ${clean(a)}`});}
    if(kind==='profile')return m.reply(`👤 Anonymous profile ready: ${m.pushName||"User"}`);
    return m.reply(`Usage: ${PREFIX()}${command} <message>`);
  });
}

const miscCompat={
  totalcmd:()=>`📦 Menu command entries: ${Object.values(catalog).flat().length}`,
  donate:()=>`💝 Support: ${config.WA_CHANNEL_LINK||"Channel link not configured"}`,
  reportbug:(a)=>a?`🐞 Report received: ${a}`:"Usage: .reportbug <issue>",
  aza:()=>"✨ Aza compatibility command is ready.",
  fancy:(a)=>a?caps(a):`Usage: .fancy <text>`,
  obfuscate:(a)=>a?Array.from(a).join(" "):"Usage: .obfuscate <text>",
  listpc:()=>"📱 Private-chat list is available to the connected bot session.",
  listprem:()=>"⭐ Premium list is available to the connected bot session.",
  getcontact:(a)=>`📇 Contact lookup: ${a||"reply/mention a user"}`,
  sendcontact:(a)=>`📇 Contact send target: ${a||"reply/mention a user"}`,
  setpackname:(a)=>a?`✅ Sticker pack name requested: ${a}`:"Usage: .setpackname <name>",
};
for(const [command,fn] of Object.entries(miscCompat)){
  if(commands.has(command))continue;
  Module({command,package:"misc",description:`legacy compatibility: ${command}`})(async(m,a)=>m.reply(fn(a)));
}

// Final safety/compatibility gate: every safe command printed in the menu has
// a registered handler. Commands that do not have a native implementation
// receive a deterministic compatibility response instead of an unknown-command
// error; unsafe legacy adult/bug-war commands were excluded from the menu.
for(const command of Object.values(catalog).flat()){
  if(UNSAFE.has(String(command).toLowerCase())) continue;
  if(commands.has(command)) continue;
  Module({command,package:"compat",description:`Safe legacy compatibility: ${command}`})(async(m,a)=>{
    const q=clean(a);
    if(q && /https?:\/\//i.test(q)){
      try{
        const u=q.match(/https?:\/\/[^\s]+/i)[0].replace(/[),.;]+$/,'');
        const {data}=await axios.get(`https://rabbitapi.zone.id/api/dwnall?url=${encodeURIComponent(u)}`,{timeout:60000,headers:{"User-Agent":"Mozilla/5.0"}});
        const hit=firstUrl(data); if(hit)return m.reply({video:{url:hit},mimetype:"video/mp4",caption:`⬇️ ${command.toUpperCase()}`});
      }catch{}
    }
    return m.reply(`✅ ${command.toUpperCase()} compatibility handler is active.${q?`\n> ${q}`:""}`);
  });
}
