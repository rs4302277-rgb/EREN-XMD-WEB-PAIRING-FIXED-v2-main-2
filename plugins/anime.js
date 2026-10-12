import axios from "axios";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import { Module } from "../lib/plugins.js";

const execFileAsync = promisify(execFile);
const API = "https://rabbitapi.zone.id/search/pinterest";

async function rabbit(query, limit = 5) {
  const { data } = await axios.get(API, {
    params: { q: query, limit, type: "both" },
    timeout: 20000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!data?.status || !Array.isArray(data.result)) {
    throw new Error("Rabbit API returned no results");
  }
  return data.result;
}

// Pinterest sometimes returns MP4 files encoded/containerized in a way that
// works on one WhatsApp client but is rejected by another. Always make a
// clean, broadly compatible H.264/AAC MP4 before sending.
async function downloadAndNormalizeVideo(url) {
  if (!url) throw new Error("Missing video URL");

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 45000,
    maxContentLength: 80 * 1024 * 1024,
    maxBodyLength: 80 * 1024 * 1024,
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
      Accept: "video/mp4,video/*,*/*;q=0.8",
    },
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const input = Buffer.from(response.data);
  const head = input.subarray(0, 64).toString("utf8").toLowerCase();
  if (!input.length || head.includes("<html") || head.includes("<!doctype")) {
    throw new Error("Pinterest returned an invalid video file");
  }

  const id = crypto.randomBytes(8).toString("hex");
  const dir = path.join(os.tmpdir(), `rahul-anime-${id}`);
  const inputPath = path.join(dir, "input");
  const outputPath = path.join(dir, "output.mp4");

  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.writeFile(inputPath, input);

    if (!ffmpegPath) throw new Error("FFmpeg is unavailable on this host");

    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        "-hide_banner",
        "-loglevel", "error",
        "-i", inputPath,
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-vf", "scale=min(720\\,iw):-2",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-profile:v", "main",
        "-level", "3.1",
        "-pix_fmt", "yuv420p",
        "-crf", "27",
        "-c:a", "aac",
        "-b:a", "96k",
        "-ar", "44100",
        "-movflags", "+faststart",
        "-f", "mp4",
        outputPath,
      ],
      { timeout: 90000, maxBuffer: 1024 * 1024 * 4 }
    );

    const output = await fs.readFile(outputPath);
    if (!output.length) throw new Error("FFmpeg produced an empty video");
    return output;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function sendReliableVideo(message, urls, caption) {
  const candidates = [...new Set(urls.filter(Boolean))];

  let lastError;
  for (const url of candidates) {
    try {
      const video = await downloadAndNormalizeVideo(url);
      await message.conn.sendMessage(
        message.from,
        {
          video,
          mimetype: "video/mp4",
          caption,
          fileName: "rahul-anime.mp4",
        },
        { quoted: message.gift }
      );
      return true;
    } catch (e) {
      lastError = e;
      console.error("[anime-video]", url, e?.message || e);
    }
  }

  throw lastError || new Error("No playable video result");
}

async function sendRabbit(message, query, label = "ANIME") {
  if (!query) return message.send(`Usage: .${label.toLowerCase()} <name>`);

  const results = await rabbit(query, 5);
  const videos = results.filter(
    (x) => x?.type === "video" && (x.video || x.download)
  );

  const caption =
    `> 🎭 ${label} : ${query}\n` +
    `> 𝐑ᴀʜᴜʟ × 𝐌𝐃 𓂃‹𝟹`;

  if (videos.length) {
    const urls = [];
    for (const item of videos) {
      if (item.video) urls.push(item.video);
      if (item.download) urls.push(item.download);
    }
    await sendReliableVideo(message, urls, caption);
    return;
  }

  const image = results.find(
    (x) => x?.type === "image" && (x.image || x.pin || x.download)
  );
  if (image) {
    return message.send({
      image: { url: image.image || image.pin || image.download },
      caption,
    });
  }

  throw new Error("No usable media found");
}

const defs = [
  ["anime", "Anime search"],
  ["character", "Anime character search"],
  ["manga", "Manga search"],
  ["achar", "Anime character media search"],
  ["asearch", "Anime media search"],
  ["arecommend", "Anime recommendations"],
  ["aquote", "Anime quote media"],
  ["waifu", "Waifu anime media"],
  ["neko", "Neko anime media"],
  ["megumin", "Megumin anime media"],
  ["maid", "Maid anime media"],
  ["shinobu", "Shinobu anime media"],
];

for (const [command, description] of defs) {
  Module({ command, package: "anime", description })(async (message, match) => {
    try {
      const q =
        String(match || "").trim() ||
        (command === "aquote"
          ? "anime quote"
          : command === "arecommend"
            ? "popular anime"
            : command);

      await message.react("🎭").catch(() => {});
      await sendRabbit(message, q, command.toUpperCase());
      await message.react("✅").catch(() => {});
    } catch (e) {
      await message.react("❌").catch(() => {});
      return message.send(
        `❌ ${command}: ${String(e?.message || e).slice(0, 180)}`
      );
    }
  });
}
