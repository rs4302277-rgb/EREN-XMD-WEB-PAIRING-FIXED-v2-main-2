import axios from "axios";
import { Module } from "../lib/plugins.js";

const COUPLE_API = "https://r-bots-free-apis.co08.art/api/couplepp";
const pickUrl = (v) => {
  if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
  if (Array.isArray(v)) { for (const x of v) { const u=pickUrl(x); if(u)return u; } }
  if (v && typeof v === "object") { for (const [k,x] of Object.entries(v)) { if(/url|link|download|image|photo|boy|girl|male|female|man|woman/i.test(k)){const u=pickUrl(x);if(u)return u;} } }
  return "";
};
function collect(v,out=[]){
  if(typeof v==='string'){for(const u of v.match(/https?:\/\/[^\s"'<>]+/gi)||[])out.push(u.replace(/[),.;]+$/,''));}
  else if(Array.isArray(v))v.forEach(x=>collect(x,out));
  else if(v&&typeof v==='object')Object.values(v).forEach(x=>collect(x,out));
  return [...new Set(out)];
}
function findNamed(v, keys){
  if(!v||typeof v!=='object')return '';
  if(Array.isArray(v)){for(const x of v){const u=findNamed(x,keys);if(u)return u;}return ''}
  for(const [k,x] of Object.entries(v)){
    if(keys.some(re=>re.test(k))){const u=pickUrl(x);if(u)return u;}
    if(x&&typeof x==='object'){const u=findNamed(x,keys);if(u)return u;}
  }
  return '';
}

for(let i=1;i<=20;i++){
  Module({command:`coupledp${i}`,package:"couple dp",description:`Two-image couple DP #${i}`})(async(m)=>{
    try{
      const {data}=await axios.get(COUPLE_API,{timeout:45000,headers:{"User-Agent":"Mozilla/5.0"}});
      const boy=findNamed(data,[/boy/i,/male/i,/man/i,/b_d/i]) || collect(data)[0];
      const girl=findNamed(data,[/girl/i,/female/i,/woman/i,/g_d/i]) || collect(data)[1];
      if(!boy||!girl)throw new Error("API did not return both boy and girl URLs");
      await m.reply({image:{url:boy},caption:`💙 COUPLE DP ${i} — BOY`});
      return m.reply({image:{url:girl},caption:`💗 COUPLE DP ${i} — GIRL`});
    }catch(e){return m.reply(`❌ coupledp${i} failed: ${e.message}`)}
  });
}

// legacy downloader names: fetch one usable media URL from the universal API and reply to the requester.
const downloaderNames=["animedl","episode","moviedl","tiktokslide","tiktokaudio","ttsearch","telestick","gitclone","happymod","twittervid","tiktok","facebook"];
const universal="https://rabbitapi.zone.id/api/dwnall?url=";
function urls(v,out=[]){
  if(typeof v==='string'){for(const u of v.match(/https?:\/\/[^\s"'<>]+/gi)||[])out.push(u.replace(/[),.;]+$/,''));}
  else if(Array.isArray(v))v.forEach(x=>urls(x,out));
  else if(v&&typeof v==='object')Object.values(v).forEach(x=>urls(x,out));
  return [...new Set(out)];
}
for(const command of downloaderNames){
  if(command==='tiktok' || command==='facebook') continue; // native Rahul compatibility already provides these.
  Module({command,package:"download",description:`Universal downloader compatibility: ${command}`})(async(m,a)=>{
    const u=String(a||'').match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[),.;]+$/,'');
    if(!u)return m.reply(`Usage: .${command} <URL>`);
    try{const {data}=await axios.get(universal+encodeURIComponent(u),{timeout:60000,headers:{"User-Agent":"Mozilla/5.0"}});const list=urls(data);if(!list.length)throw new Error("No downloadable URL in API response");const pick=list[Math.floor(Math.random()*list.length)];const isVideo=/\.(mp4|webm|mov)(\?|$)/i.test(pick)||/video/i.test(pick);return isVideo?m.reply({video:{url:pick},mimetype:"video/mp4",caption:`⬇️ ${command.toUpperCase()}`}):m.reply({document:{url:pick},caption:`⬇️ ${command.toUpperCase()}`});}catch(e){return m.reply(`❌ ${command} failed: ${e.message}`)}
  });
}
