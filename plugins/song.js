import fs from "fs";
import os from "os";
import path from "path";
import axios from "axios";
import yts from "yt-search";
import { Module } from "../lib/plugins.js";

const API_BUILDERS = [
  (url) => `https://kiraxmd-api.vercel.app/api/play?query=${encodeURIComponent(url)}`,
  (url) => `https://xenoytdl-2.vercel.app/api/youtube?url=${encodeURIComponent(url)}`,
  (url) => `https://jerrycoder.oggyapi.workers.dev/down/ytmp3-v1?url=${encodeURIComponent(url)}`,
  (url) => `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`,
  (url) => `https://eliteprotech-apis.zone.id/ytdown?format=mp3&url=${encodeURIComponent(url)}`,
];

const AUDIO_KEYS = [
  "downloadUrl","download_url","download","audioUrl","audio_url","audio","mp3","mp3Url","mp3_url","url","link","resultUrl","result_url"
];

function ytUrl(input) {
  if (/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i.test(input)) return input;
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return `https://www.youtube.com/watch?v=${input}`;
  return null;
}

function findAudioCandidate(value, depth = 0) {
  if (depth > 6 || value == null) return null;
  if (typeof value === "string") {
    const v = value.trim();
    if (/^https?:\/\//i.test(v) && /(?:\.mp3(?:\?|$)|audio|mp3|download|ytmp3)/i.test(v)) return v;
    return null;
  }
  if (Array.isArray(value)) {
    for (const x of value) { const hit = findAudioCandidate(x, depth + 1); if (hit) return hit; }
    return null;
  }
  if (typeof value === "object") {
    for (const k of AUDIO_KEYS) {
      if (value[k]) {
        const hit = findAudioCandidate(value[k], depth + 1);
        if (hit) return hit;
      }
    }
    for (const [k, v] of Object.entries(value)) {
      if (/audio|mp3|download|result/i.test(k)) {
        const hit = findAudioCandidate(v, depth + 1);
        if (hit) return hit;
      }
    }
  }
  return null;
}

async function fetchApiAudio(apiUrl) {
  const res = await axios.get(apiUrl, {
    timeout: 45_000,
    responseType: "arraybuffer",
    validateStatus: () => true,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
  });
  const ct = String(res.headers["content-type"] || "").toLowerCase();
  if (res.status >= 200 && res.status < 300 && (ct.includes("audio/") || ct.includes("mpeg") || ct.includes("octet-stream"))) {
    return { buffer: Buffer.from(res.data), title: "song" };
  }
  let data;
  try { data = JSON.parse(Buffer.from(res.data).toString("utf8")); } catch { data = null; }
  if (!data) throw new Error(`API returned ${res.status} without JSON/audio`);
  const url = findAudioCandidate(data);
  if (!url) throw new Error("No audio URL in API response");
  const media = await axios.get(url, {
    timeout: 90_000,
    responseType: "arraybuffer",
    validateStatus: () => true,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "audio/*,*/*;q=0.8" },
  });
  const mct = String(media.headers["content-type"] || "").toLowerCase();
  if (media.status < 200 || media.status >= 300) throw new Error(`audio URL returned ${media.status}`);
  // Accept octet-stream because many free MP3 endpoints mislabel MP3 files.
  if (!(mct.includes("audio") || mct.includes("mpeg") || mct.includes("octet-stream") || /\.mp3(?:\?|$)/i.test(url))) throw new Error("API URL did not return audio");
  return { buffer: Buffer.from(media.data), title: data.title || data.name || data.result?.title || "song" };
}

async function getAudio(youtubeUrl) {
  const errors = [];
  for (const makeUrl of API_BUILDERS) {
    const endpoint = makeUrl(youtubeUrl);
    try {
      const result = await fetchApiAudio(endpoint);
      if (result?.buffer?.length > 0) return result;
    } catch (e) { errors.push(e?.message || String(e)); }
  }
  throw new Error(`All audio APIs failed (${errors.slice(0,3).join(" | ")})`);
}

async function resolveYouTube(input) {
  const direct = ytUrl(input);
  if (direct) return { url: direct, title: "song" };
  const found = await yts(input);
  const v = found?.videos?.[0];
  if (!v?.url) throw new Error("No YouTube result found");
  return { url: v.url, title: v.title || "song" };
}

for (const command of ["song", "play", "yta", "ytmp3"]) {
  Module({ command, package: "downloader", description: "YouTube audio downloader" })(async (message, match) => {
    const input = String(match || "").trim();
    if (!input) return message.send(`Usage: .${command} <song name or YouTube URL>`);
    try {
      // Show that the bot is searching/downloading; output remains audio-only.
      await message.react("🔎").catch(() => {});
      const target = await resolveYouTube(input);
      const result = await getAudio(target.url);
      const safe = String(result.title || target.title || "song").replace(/[\\/:*?"<>|]/g, "_").slice(0, 90) || "song";
      const tmp = path.join(os.tmpdir(), `rahul_audio_${Date.now()}.mp3`);
      fs.writeFileSync(tmp, result.buffer);
      try {
        // ONLY audio is sent. No thumbnail, buttons, text, or video.
        await message.conn.sendMessage(message.from, {
          audio: fs.readFileSync(tmp),
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: `${safe}.mp3`,
        }, { quoted: message.raw });
      } finally { fs.promises.unlink(tmp).catch(() => {}); }
      await message.react("🎵").catch(() => {});
    } catch (e) {
      console.error(`[${command}]`, e);
      return message.send(`❌ ${command.toUpperCase()} failed: ${e?.message || e}`);
    }
  });
}

Module({ command: "yts", package: "search", description: "Search YouTube videos" })(async (message, match) => {
  const q = String(match || "").trim();
  if (!q) return message.send("Usage: .yts <search query>");
  try {
    const r = await yts(q);
    if (!r?.videos?.length) return message.send("❌ No results found");
    return message.send(r.videos.slice(0,8).map((v,i)=>`${i+1}. ${v.title}\n${v.url}`).join("\n\n"));
  } catch (e) { return message.send(`❌ Search failed: ${e?.message || e}`); }
});
