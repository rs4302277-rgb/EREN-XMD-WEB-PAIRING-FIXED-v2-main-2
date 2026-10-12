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

async function downloadAndNormalizeVideo(url) {
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
  const dir = path.join(os.tmpdir(), `rahul-pinterest-${id}`);
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

    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

Module({
  command: "pint",
  aliases: ["pinterest"],
  package: "downloader",
  description: "Search Pinterest and return a video result",
})(async (message, match) => {
  const q = String(match || "").trim();
  if (!q) return message.send("_Use: .pint <search>_");

  try {
    await message.react("🔎").catch(() => {});

    const url =
      `https://rabbitapi.zone.id/search/pinterest?q=${encodeURIComponent(q)}` +
      `&limit=5&type=both`;

    const { data } = await axios.get(url, {
      timeout: 20000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const results = Array.isArray(data?.result) ? data.result : [];
    const videos = results.filter(
      (x) => x?.type === "video" && (x.video || x.download)
    );

    if (!videos.length) {
      await message.react("❌").catch(() => {});
      return message.send("❌ _No Pinterest video result found._");
    }

    const candidates = [];
    for (const item of videos) {
      if (item.video) candidates.push(item.video);
      if (item.download) candidates.push(item.download);
    }

    const caption =
      `╭━━〔 ᴘɪɴᴛᴇʀᴇsᴛ 〕━━╮\n` +
      `┃ 🔎 ǫᴜᴇʀʏ : ${q}\n` +
      `┃ 🎬 ʀᴇsᴜʟᴛ : ᴠɪᴅᴇᴏ\n` +
      `╰━━━━━━━━━━━━━━╯`;

    let sent = false;
    let lastError;
    for (const candidate of [...new Set(candidates)]) {
      try {
        const video = await downloadAndNormalizeVideo(candidate);
        await message.conn.sendMessage(
          message.from,
          {
            video,
            mimetype: "video/mp4",
            fileName: "rahul-pinterest.mp4",
            caption,
          },
          { quoted: message.gift }
        );
        sent = true;
        break;
      } catch (e) {
        lastError = e;
        console.error("[pint-video]", e?.message || e);
      }
    }

    if (!sent) throw lastError || new Error("No playable Pinterest video");

    await message.react("✅").catch(() => {});
  } catch (e) {
    console.error("[pint]", e?.message || e);
    await message.react("❌").catch(() => {});
    return message.send(
      "❌ _Pinterest API/video fetch failed. Try another keyword._"
    );
  }
});
