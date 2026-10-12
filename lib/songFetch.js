import axios from "axios";

// Keep CSONG on the same working YouTube-audio provider chain used by
// This is the same provider chain already used by plugins/song.js.
const API_BUILDERS = [
  (url) => `https://kiraxmd-api.vercel.app/api/play?query=${encodeURIComponent(url)}`,
  (url) => `https://xenoytdl-2.vercel.app/api/youtube?url=${encodeURIComponent(url)}`,
  (url) => `https://jerrycoder.oggyapi.workers.dev/down/ytmp3-v1?url=${encodeURIComponent(url)}`,
  (url) => `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`,
  (url) => `https://eliteprotech-apis.zone.id/ytdown?format=mp3&url=${encodeURIComponent(url)}`,
];

const AUDIO_KEYS = [
  "downloadUrl", "download_url", "download", "audioUrl", "audio_url",
  "audio", "mp3", "mp3Url", "mp3_url", "url", "link", "resultUrl", "result_url",
];

function findAudioCandidate(value, depth = 0) {
  if (depth > 7 || value == null) return null;
  if (typeof value === "string") {
    const v = value.trim();
    if (/^https?:\/\//i.test(v) && /(?:\.mp3(?:\?|$)|audio|mp3|download|ytmp3)/i.test(v)) return v;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findAudioCandidate(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const key of AUDIO_KEYS) {
      if (value[key] != null) {
        const hit = findAudioCandidate(value[key], depth + 1);
        if (hit) return hit;
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (/audio|mp3|download|result/i.test(key)) {
        const hit = findAudioCandidate(child, depth + 1);
        if (hit) return hit;
      }
    }
  }
  return null;
}

async function fetchProvider(endpoint, timeout) {
  const res = await axios.get(endpoint, {
    timeout,
    responseType: "arraybuffer",
    validateStatus: () => true,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
  });

  const ct = String(res.headers?.["content-type"] || "").toLowerCase();
  if (res.status >= 200 && res.status < 300 &&
      (ct.includes("audio/") || ct.includes("mpeg") || ct.includes("octet-stream"))) {
    return { buffer: Buffer.from(res.data), title: "song" };
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(res.data).toString("utf8"));
  } catch {
    throw new Error(`provider returned HTTP ${res.status} without JSON/audio`);
  }

  const audioUrl = findAudioCandidate(data);
  if (!audioUrl) throw new Error("provider response did not contain an audio URL");

  const media = await axios.get(audioUrl, {
    timeout: Math.max(timeout, 45_000),
    responseType: "arraybuffer",
    validateStatus: () => true,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "audio/*,*/*;q=0.8" },
  });
  const mct = String(media.headers?.["content-type"] || "").toLowerCase();
  if (media.status < 200 || media.status >= 300) {
    throw new Error(`audio URL returned HTTP ${media.status}`);
  }
  if (!(mct.includes("audio") || mct.includes("mpeg") || mct.includes("octet-stream") || /\.mp3(?:\?|$)/i.test(audioUrl))) {
    throw new Error("audio URL did not return an audio file");
  }

  return {
    buffer: Buffer.from(media.data),
    title: data?.title || data?.name || data?.result?.title || "song",
  };
}

export async function fetchSongAudio(youtubeUrl, options = {}) {
  const timeout = Number(options.timeout) || 45_000;
  const errors = [];

  for (const makeUrl of API_BUILDERS) {
    const endpoint = makeUrl(youtubeUrl);
    try {
      const result = await fetchProvider(endpoint, timeout);
      if (result?.buffer?.length) return result;
    } catch (err) {
      errors.push(err?.message || String(err));
      console.warn(`[CSONG] audio provider failed: ${err?.message || err}`);
    }
  }

  throw new Error(`all YouTube audio providers failed: ${errors.slice(0, 3).join(" | ")}`);
}
