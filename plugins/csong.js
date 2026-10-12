import axios from "axios";
import yts from "yt-search";
import fs from "fs";
import path from "path";
import os from "os";
import ffmpeg from "fluent-ffmpeg";
import { resolveFfmpegPath } from "../lib/resolveFfmpeg.js";
import { Module } from "../lib/plugins.js";
import config from "../config.js";
import { monoCaps, sansBold } from "../lib/boldify.js";
import { fetchSongAudio } from "../lib/songFetch.js";
import { db } from "../lib/client.js";

ffmpeg.setFfmpegPath(resolveFfmpegPath());

const M = (text) => monoCaps(String(text));
const B = (text) => `*${M(text)}*`;

function botScope(message) {
  return String(message.conn?.user?.id || "bot").split(":")[0].split("@")[0];
}

const THUMB_DIR = path.join(process.cwd(), "data", "csong_thumbs");

function thumbFilePath(scope) {
  return path.join(THUMB_DIR, `${scope}.jpg`);
}

function getCustomThumbnailBuffer(scope) {
  try {
    const file = thumbFilePath(scope);
    if (fs.existsSync(file)) return fs.readFileSync(file);
  } catch (_) {}
  return null;
}

function saveCustomThumbnail(scope, buffer) {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  fs.writeFileSync(thumbFilePath(scope), buffer);
  db.set(scope, "csong_custom_thumbnail", true);
}

function removeCustomThumbnail(scope) {
  db.set(scope, "csong_custom_thumbnail", false);
  try { fs.unlinkSync(thumbFilePath(scope)); } catch (_) {}
}

const DEFAULT_SONG_LABEL = "಄ 𝐒ᴏɴɢ ➛";
const DEFAULT_SINGER_LABEL = "಄ 𝐒ɪɴɢᴇʀ ➛";
const DEFAULT_BOTTOM_TEXT =
  `*៚  ꧊᭡ᴏsᴛ 𝐁ʏ ⟿  {postby} ᡣ𐭩*\n` +
  `> *𝐔sε 𝐇εαᴅρнοɴε  𝐅ᴏʀ 𝐁ᴇᴛᴛᴇʀ  𝐕ιʙᴇ…!! 🩷🎧🌼*`;

function getCsongSettings(scope) {
  return {
    thumbnail: db.get(scope, "csong_thumbnail", true) !== false,
    onlyAudio: db.get(scope, "csong_onlyaudio", false) === true,
    customThumbnail: db.get(scope, "csong_custom_thumbnail", false) === true,
    captionTemplate: db.get(scope, "csong_caption_template", null) || null,
    captionTop: db.get(scope, "csong_caption_top", null) || null,
    captionBottom: db.get(scope, "csong_caption_bottom", null) || null,
    songLabel: db.get(scope, "csong_caption_song_label", null) || null,
    singerLabel: db.get(scope, "csong_caption_singer_label", null) || null,
  };
}

function resolvePostByName(message) {
  return (
    message.conn?.user?.name ||
    message.conn?.user?.verifiedName ||
    config.ownerName || config.OWNER_NAME || "OWNER"
  );
}

function applyCaptionTemplate(template, vars) {
  return template
    .replace(/\{song\}|\{title\}/gi, vars.title)
    .replace(/\{singer\}|\{artist\}/gi, vars.singer)
    .replace(/\{postby\}|\{postedby\}|\{channel\}/gi, vars.postByName);
}

// Splits off everything after the first `n` whitespace-separated words,
// preserving the original casing/spacing/newlines of the remainder.
function afterNWords(raw, n) {
  const re = /\S+/g;
  let idx = 0, count = 0, m;
  while (count < n && (m = re.exec(raw))) {
    idx = m.index + m[0].length;
    count++;
  }
  if (count < n) return "";
  return raw.slice(idx).trim();
}

function buildStyledCaption(title, singer, postByName, opts = {}) {
  // Style the song title / singer name to match the channel's look (bold
  // sans-serif for Latin text). Non-Latin script (Hindi titles etc.) has no
  // bold Unicode equivalent so sansBold leaves those characters untouched.
  const vars = { title: sansBold(title), singer: sansBold(singer), postByName };

  if (opts.fullTemplate) {
    return applyCaptionTemplate(opts.fullTemplate, vars);
  }

  const songLabel = opts.songLabel ? applyCaptionTemplate(opts.songLabel, vars) : DEFAULT_SONG_LABEL;
  const singerLabel = opts.singerLabel ? applyCaptionTemplate(opts.singerLabel, vars) : DEFAULT_SINGER_LABEL;
  const top = opts.top ? `${applyCaptionTemplate(opts.top, vars)}\n\n` : "";
  const bottom = applyCaptionTemplate(opts.bottom || DEFAULT_BOTTOM_TEXT, vars);

  return (
    `${top}` +
    `*${songLabel} ${title} 🔥♪*\n` +
    `*${singerLabel} ${singer}*\n\n` +
    `${bottom}`
  );
}

function buildCsongPanel(prefix, settings) {
  return (
    `🎧 ${B("csong panel")}\n\n` +
    `> ${B("thumbnail")}: ${settings.thumbnail ? "✅ ON" : "❎ OFF"}${settings.customThumbnail ? ` (${M("custom saved")})` : ""}\n` +
    `> ${B("caption")}: ${settings.captionTemplate ? M("full custom") : M("default")}${(!settings.captionTemplate && (settings.captionTop || settings.captionBottom || settings.songLabel || settings.singerLabel)) ? ` (${M("partly custom")})` : ""}\n` +
    `> ${B("only audio")}: ${settings.onlyAudio ? "✅ ON" : "❎ OFF"}\n\n` +
    `${B("usage")}:\n` +
    `• \`${prefix}csong <song> , <channel link>\` — ${B("download + post to channel")}\n` +
    `• \`${prefix}csong thumbnail on/off\` — ${B("banner image + styled text, or styled text only")}\n` +
    `• \`${prefix}csong thumbnail set\` (${B("reply to an image")}) ${B("or")} \`${prefix}csong thumbnail set <image link>\` — ${B("save your own default thumbnail")}\n` +
    `• \`${prefix}csong thumbnail remove\` — ${B("delete saved thumbnail, back to auto")}\n` +
    `${B("one-off thumbnail (just for a single send, doesn't change the saved default)")}:\n` +
    `• \`${prefix}csong <song> , <channel link> , <thumbnail link>\` — ${B("that image link becomes the thumbnail for this send only")}\n` +
    `• ${B("reply to an image")} + \`${prefix}csong <song> , <channel link>\` — ${B("same, but using the replied image")}\n` +
    `• \`${prefix}csong caption top set <text>\` — ${B("text above song/singer lines")}\n` +
    `• \`${prefix}csong caption bottom set <text>\` — ${B("text below song/singer lines (footer)")}\n` +
    `• \`${prefix}csong caption label song <text>\` — ${B("change the")} \`Song ➛\` ${B("label")}\n` +
    `• \`${prefix}csong caption label singer <text>\` — ${B("change the")} \`Singer ➛\` ${B("label")}\n` +
    `• \`${prefix}csong caption set <full text>\` — ${B("replace the whole caption yourself")}\n` +
    `• \`${prefix}csong caption show\` — ${B("preview current caption")}\n` +
    `• \`${prefix}csong caption reset\` — ${B("clear all custom caption parts")}\n` +
    `${B("placeholders (usable anywhere above)")}: {song} {singer} {postby}\n` +
    `• \`${prefix}csong onlyaudio on/off\` — ${B("on = just the plain voice note like before, no styled post")}\n` +
    `• \`${prefix}csong panel\` — ${B("show this panel")}`
  );
}

const generateWaveform = () =>
  Array.from({ length: 100 }, () => Math.floor(Math.random() * 101));

const formatChannelFallback = (raw) => {
  if (!raw) return "WhatsApp Channel";
  return raw.replace(/@newsletter$/, "");
};

const resolveChannel = async (input, message) => {
  input = input.trim();

  try {
    const url = new URL(input);
    if (url.pathname.startsWith("/channel/")) {
      const code = url.pathname.split("/channel/")[1];
      const meta = await message.conn.newsletterMetadata("invite", code, "GUEST");
      if (!meta?.id) return null;
      return { jid: meta.id, name: meta.name || formatChannelFallback(meta.id) };
    }
  } catch (_) {}

  if (input.includes("@newsletter")) {
    try {
      const meta = await message.conn.newsletterMetadata("jid", input, "GUEST");
      return { jid: input, name: meta?.name || formatChannelFallback(input) };
    } catch (_) {
      return { jid: input, name: formatChannelFallback(input) };
    }
  }

  return null;
};

const isYouTubeUrl = (str) =>
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(str.trim());

const toVoiceNote = async (audioBuffer, knownSeconds) => {
  const inFile = path.join(os.tmpdir(), `csong_in_${Date.now()}.mp3`);
  const outFile = path.join(os.tmpdir(), `csong_out_${Date.now()}.ogg`);

  try {
    if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      throw new Error("YouTube audio provider returned an empty file");
    }

    console.time("[CSONG TIMING]   -> write provider audio bytes");
    fs.writeFileSync(inFile, audioBuffer);
    console.timeEnd("[CSONG TIMING]   -> write provider audio bytes");

    console.time("[CSONG TIMING]   -> ffmpeg transcode");
    await new Promise((resolve, reject) => {
      ffmpeg(inFile)
        .audioCodec("libopus")
        .audioBitrate("48k")
        .noVideo()
        .format("ogg")
        .on("error", reject)
        .on("end", resolve)
        .save(outFile);
    });
    console.timeEnd("[CSONG TIMING]   -> ffmpeg transcode");

    let duration = knownSeconds && knownSeconds > 0 ? Math.ceil(knownSeconds) : null;
    if (!duration) {
      duration = await new Promise((resolve) => {
        ffmpeg.ffprobe(outFile, (err, meta) => {
          const d = meta?.format?.duration;
          resolve(!err && d ? Math.ceil(d) : null);
        });
      });
    }

    if (!duration) {
      const bytes = fs.statSync(outFile).size;
      duration = Math.max(1, Math.round((bytes * 8) / 64000));
    }

    return { outFile, duration };
  } catch (err) {
    try { fs.unlinkSync(inFile); } catch (_) {}
    try { fs.unlinkSync(outFile); } catch (_) {}
    throw err;
  }
};;

Module({
  command: "csong",
  package: "youtube",
  description: "Download song → voice note → send to channel",
  usage: ".csong <song name / yt link> , <channel link> [, <thumbnail image link>]",
})(async (message, match) => {
  const jid = message.from;
  let statusMsg = null;

  const setStatus = async (text) => {
    if (statusMsg?.key) {
      try {
        const edited = await message.conn.sendMessage(jid, {
          text: B(text),
          edit: statusMsg.key,
        });
        if (edited?.key) {
          statusMsg = edited;
          return statusMsg;
        }
      } catch (_) {}
    }
    statusMsg = await message.conn.sendMessage(
      jid,
      { text: B(text) },
      { quoted: message.raw }
    );
    return statusMsg;
  };

  try {
    if (!match) {
      return message.send(
        `${B("usage")}\n\n.csong love nwantiti , https://whatsapp.com/channel/xxx\n\n` +
        `${B("one-off thumbnail for just this send")}:\n.csong love nwantiti , https://whatsapp.com/channel/xxx , https://example.com/pic.jpg\n${B("or reply to an image with the normal command")}\n\n${B("tip")}: .csong panel`
      );
    }

    const scope = botScope(message);
    const trimmedMatch = match.trim();
    const firstWord = trimmedMatch.split(/\s+/)[0]?.toLowerCase();
    const restRaw = trimmedMatch.slice(firstWord?.length || 0).trim();
    const rest = restRaw.toLowerCase();

    if (firstWord === "panel" && !match.includes(",")) {
      return message.send(buildCsongPanel(config.prefix || ".", getCsongSettings(scope)));
    }

    if (firstWord === "onlyaudio" && !match.includes(",")) {
      if (rest !== "on" && rest !== "off") {
        return message.send(`❎ ${B("usage")}: *.csong onlyaudio on/off*`);
      }
      db.set(scope, "csong_onlyaudio", rest === "on");
      return message.send(
        `✅ ${B("onlyaudio turned")} *${rest.toUpperCase()}*\n\n` +
        buildCsongPanel(config.prefix || ".", getCsongSettings(scope))
      );
    }

    if (firstWord === "thumbnail" && !match.includes(",")) {
      const subWord = rest.split(/\s+/)[0] || "";

      if (subWord === "on" || subWord === "off") {
        db.set(scope, "csong_thumbnail", subWord === "on");
        return message.send(
          `✅ ${B("thumbnail turned")} *${subWord.toUpperCase()}*\n\n` +
          buildCsongPanel(config.prefix || ".", getCsongSettings(scope))
        );
      }

      if (subWord === "set") {
        const urlArg = restRaw.slice(3).trim();
        let buffer = null;

        try {
          if (message.quoted && message.quoted.type === "imageMessage") {
            buffer = await message.quoted.download();
          } else if (message.type === "imageMessage") {
            buffer = await message.download();
          } else if (urlArg) {
            const { data } = await axios.get(urlArg, {
              responseType: "arraybuffer",
              timeout: 20000,
            });
            buffer = Buffer.from(data);
          }
        } catch (dlErr) {
          console.error("[CSONG] thumbnail set download failed:", dlErr?.message || dlErr);
          buffer = null;
        }

        if (!buffer) {
          return message.send(
            `❎ ${B("reply to an image with")} *.csong thumbnail set*\n${B("or give an image link")}:\n*.csong thumbnail set <image link>*`
          );
        }

        try {
          saveCustomThumbnail(scope, buffer);
        } catch (saveErr) {
          console.error("[CSONG] thumbnail save failed:", saveErr?.message || saveErr);
          return message.send(`⚠️ ${B("couldn't save the thumbnail, try again")}`);
        }

        return message.send(
          `✅ ${B("your custom csong thumbnail is saved")}\n\n` +
          `${B("this image will be used on every csong post from now on, instead of the song's own thumbnail")}`
        );
      }

      if (subWord === "remove" || subWord === "reset" || subWord === "clear") {
        removeCustomThumbnail(scope);
        return message.send(
          `✅ ${B("custom thumbnail removed")}\n${B("back to the default auto thumbnail")}`
        );
      }

      return message.send(
        `❎ ${B("usage")}:\n` +
        `• *.csong thumbnail on/off*\n` +
        `• *.csong thumbnail set* (${B("reply to image")}) ${B("or")} *.csong thumbnail set <image link>*\n` +
        `• *.csong thumbnail remove*`
      );
    }

    if (firstWord === "caption" && !match.includes(",")) {
      const capOpts = (s) => ({
        fullTemplate: s.captionTemplate,
        top: s.captionTop,
        bottom: s.captionBottom,
        songLabel: s.songLabel,
        singerLabel: s.singerLabel,
      });
      const preview = () => {
        const s = getCsongSettings(scope);
        return (
          `${B("current caption preview")}:\n\n` +
          buildStyledCaption("Example Song", "Example Singer", resolvePostByName(message), capOpts(s))
        );
      };
      const captionUsage = () => message.send(
        `❎ ${B("usage")}:\n` +
        `• *.csong caption top set <text>* — ${B("text above song/singer")}\n` +
        `• *.csong caption top reset*\n` +
        `• *.csong caption bottom set <text>* — ${B("footer text below song/singer")}\n` +
        `• *.csong caption bottom reset*\n` +
        `• *.csong caption label song <text>* — ${B("change the Song ➛ label")}\n` +
        `• *.csong caption label singer <text>* — ${B("change the Singer ➛ label")}\n` +
        `• *.csong caption label song/singer reset*\n` +
        `• *.csong caption set <full text>* — ${B("replace the whole caption yourself")}\n` +
        `• *.csong caption show*\n` +
        `• *.csong caption reset* — ${B("clear everything custom")}\n\n` +
        `${B("placeholders")}: {song} {singer} {postby}`
      );

      const tokens = restRaw.split(/\s+/).filter(Boolean);
      const sub1 = (tokens[0] || "").toLowerCase();

      if (!sub1 || sub1 === "show") {
        return message.send(preview());
      }

      if (sub1 === "set") {
        const text = afterNWords(restRaw, 1);
        if (!text) return captionUsage();
        db.set(scope, "csong_caption_template", text);
        return message.send(`✅ ${B("full caption saved")}\n\n${preview()}`);
      }

      if (sub1 === "reset" || sub1 === "remove" || sub1 === "clear") {
        db.set(scope, "csong_caption_template", null);
        db.set(scope, "csong_caption_top", null);
        db.set(scope, "csong_caption_bottom", null);
        db.set(scope, "csong_caption_song_label", null);
        db.set(scope, "csong_caption_singer_label", null);
        return message.send(`✅ ${B("caption reset to default")}\n\n${preview()}`);
      }

      if (sub1 === "top" || sub1 === "bottom") {
        const dbKey = sub1 === "top" ? "csong_caption_top" : "csong_caption_bottom";
        const sub2 = (tokens[1] || "").toLowerCase();

        if (sub2 === "reset" || sub2 === "remove" || sub2 === "clear" || sub2 === "off") {
          db.set(scope, dbKey, null);
          return message.send(`✅ ${B(`${sub1} text removed`)}\n\n${preview()}`);
        }

        const text = sub2 === "set" ? afterNWords(restRaw, 2) : afterNWords(restRaw, 1);
        if (!text) return captionUsage();
        db.set(scope, dbKey, text);
        return message.send(`✅ ${B(`${sub1} text saved`)}\n\n${preview()}`);
      }

      if (sub1 === "label") {
        const target = (tokens[1] || "").toLowerCase();
        if (target !== "song" && target !== "singer") return captionUsage();

        const dbKey = target === "song" ? "csong_caption_song_label" : "csong_caption_singer_label";
        const sub3 = (tokens[2] || "").toLowerCase();

        if (sub3 === "reset" || sub3 === "remove" || sub3 === "clear") {
          db.set(scope, dbKey, null);
          return message.send(`✅ ${B(`${target} label reset to default`)}\n\n${preview()}`);
        }

        const text = afterNWords(restRaw, 2);
        if (!text) return captionUsage();
        db.set(scope, dbKey, text);
        return message.send(`✅ ${B(`${target} label saved`)}\n\n${preview()}`);
      }

      return captionUsage();
    }

    // Optional 3rd comma segment: a one-off thumbnail image link for just
    // this send. `.csong song , channel` still works exactly as before —
    // this only kicks in when a 3rd part is present *and* looks like a URL.
    let songInput, channelInput, thumbLinkInput = null;
    const commaParts = match.split(",");
    if (commaParts.length >= 3 && /^https?:\/\//i.test(commaParts[commaParts.length - 1].trim())) {
      thumbLinkInput = commaParts[commaParts.length - 1].trim();
      channelInput = commaParts[commaParts.length - 2].trim();
      songInput = commaParts.slice(0, commaParts.length - 2).join(",").trim();
    } else {
      const lastComma = match.lastIndexOf(",");
      if (lastComma === -1) {
        return message.send(
          `${B("use a comma to separate the song and the channel link")}\n\n${B("example")}:\n.csong song name , channel link`
        );
      }
      songInput = match.slice(0, lastComma).trim();
      channelInput = match.slice(lastComma + 1).trim();
    }

    if (!songInput) return message.send(B("enter a song name or youtube link"));
    if (!channelInput) return message.send(B("enter a channel link"));

    // A one-off thumbnail for this send: either the 3rd comma link above,
    // or the image being replied to when the command was sent.
    let oneOffThumbBuffer = null;
    if (thumbLinkInput) {
      try {
        const { data } = await axios.get(thumbLinkInput, { responseType: "arraybuffer", timeout: 20000 });
        oneOffThumbBuffer = Buffer.from(data);
      } catch (thumbErr) {
        console.error("[CSONG] one-off thumbnail link download failed:", thumbErr?.message || thumbErr);
      }
    } else if (message.quoted && message.quoted.type === "imageMessage") {
      try {
        oneOffThumbBuffer = await message.quoted.download();
      } catch (thumbErr) {
        console.error("[CSONG] replied-image thumbnail download failed:", thumbErr?.message || thumbErr);
      }
    }

    await message.react("🔍");

    const channel = await resolveChannel(channelInput, message);
    if (!channel) {
      return message.send(B("invalid channel link"));
    }

    console.time("[CSONG TIMING] search");
    const ytsWithRetry = async (arg, tries = 2) => {
      let lastErr;
      for (let i = 0; i < tries; i++) {
        try {
          return await yts(arg);
        } catch (e) {
          lastErr = e;
          if (i < tries - 1) await new Promise((r) => setTimeout(r, 800));
        }
      }
      throw lastErr;
    };

    let video;
    try {
      if (isYouTubeUrl(songInput)) {
        const videoId = songInput.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] || "";
        const res = await ytsWithRetry({ videoId });
        if (res?.title) {
          video = {
            title: res.title,
            author: { name: res.author?.name || "Unknown" },
            timestamp: res.timestamp || "?",
            url: songInput,
            seconds: res.seconds || res.duration?.seconds || null,
          };
        } else {
          video = {
            title: "Unknown Title",
            author: { name: "Unknown" },
            timestamp: "?",
            url: songInput,
            seconds: null,
          };
        }
      } else {
        const res = await ytsWithRetry(songInput);
        if (!res.videos || res.videos.length === 0) {
          return message.send(B("song not found"));
        }
        video = res.videos[0];
        video.seconds = video.seconds || video.duration?.seconds || null;
      }
    } catch (searchErr) {
      console.timeEnd("[CSONG TIMING] search");
      console.error("[CSONG ERROR] youtube search failed:", searchErr.message);
      return setStatus("youtube search failed — youtube blocked/rate-limited the request, try again in a bit");
    }
    console.timeEnd("[CSONG TIMING] search");

    await message.react("⬇️");

    await setStatus(`sending song to channel\n\nsong : ${video.title}`);

    console.time("[CSONG TIMING] song lookup (fallback chain)");
    let audioResult;
    try {
      audioResult = await fetchSongAudio(video.url, { timeout: 45000 });
    } catch (lookupErr) {
      console.timeEnd("[CSONG TIMING] song lookup (fallback chain)");
      console.error("[CSONG ERROR] all YouTube audio providers failed:", lookupErr.message);
      return setStatus("audio download failed — all YouTube audio providers failed, please try again later");
    }
    console.timeEnd("[CSONG TIMING] song lookup (fallback chain)");

    await message.react("🎙️");

    console.time("[CSONG TIMING] download+transcode to voice note");
    let outFile, duration;
    try {
      ({ outFile, duration } = await toVoiceNote(audioResult.buffer, video.seconds));
    } catch (dlErr) {
      console.timeEnd("[CSONG TIMING] download+transcode to voice note");
      console.error("[CSONG ERROR] voice note conversion failed:", dlErr.message);
      return setStatus("audio download failed — the song link expired mid-download, try again");
    }
    console.timeEnd("[CSONG TIMING] download+transcode to voice note");
    const waveform = generateWaveform();

    const csongSettings = getCsongSettings(scope);

    // WhatsApp Channels (newsletters) are not normal chats. Baileys returns a
    // local message key immediately after sending, so a key alone is NOT a
    // reliable proof that the post reached the channel. We therefore verify
    // the post through newsletterFetchMessages before showing success.
    const verifyNewsletterPost = async (expectedKeyId, label = "post") => {
      if (!expectedKeyId || typeof message.conn.newsletterFetchMessages !== "function") {
        return false;
      }

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          // Give WhatsApp a moment to commit the newsletter message.
          await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 1200 : 900));
          const messages = await message.conn.newsletterFetchMessages(channel.jid, 20);
          if (Array.isArray(messages)) {
            const found = messages.some((m) => String(m?.key?.id || "") === String(expectedKeyId));
            if (found) {
              console.log(`[CSONG] ${label} verified in channel: ${expectedKeyId}`);
              return true;
            }
          }
        } catch (verifyErr) {
          console.warn(`[CSONG] ${label} verification attempt ${attempt + 1} failed:`, verifyErr?.message || verifyErr);
        }
      }
      return false;
    };

    // Check the actual Channel role before spending more time on a post.
    // Metadata is intentionally informational unless WhatsApp explicitly
    // reports a non-posting role, so we do not break older Baileys responses.
    try {
      const meta = await message.conn.newsletterMetadata("jid", channel.jid);
      const role = String(meta?.viewer_metadata?.role || meta?.viewerMetadata?.role || "").toUpperCase();
      if (role === "GUEST" || role === "SUBSCRIBER") {
        try { fs.unlinkSync(outFile); } catch {}
        return setStatus(
          `channel post blocked by WhatsApp\nrole : ${role}\n\nthis WhatsApp account must be an admin or owner of the channel to publish posts`
        );
      }
    } catch (metaErr) {
      console.warn("[CSONG] channel role check skipped:", metaErr?.message || metaErr);
    }

    let captionMsgResult = null;

    if (!csongSettings.onlyAudio) {
      try {
        const caption = buildStyledCaption(
          video.title,
          video.author?.name || "Unknown Artist",
          resolvePostByName(message),
          {
            fullTemplate: csongSettings.captionTemplate,
            top: csongSettings.captionTop,
            bottom: csongSettings.captionBottom,
            songLabel: csongSettings.songLabel,
            singerLabel: csongSettings.singerLabel,
          }
        );

        let thumbBuffer = null;
        if (csongSettings.thumbnail) {
          // Priority: this-send override → saved custom thumbnail →
          // YouTube thumbnail.
          thumbBuffer = oneOffThumbBuffer || getCustomThumbnailBuffer(scope);
          if (!thumbBuffer && video.thumbnail) {
            const { data: thumbData } = await axios.get(video.thumbnail, {
              responseType: "arraybuffer",
              timeout: 20000,
            });
            thumbBuffer = Buffer.from(thumbData);
          }
        }

        // Never quote a Channel post. Newsletter messages use their own
        // plaintext relay path in Baileys and quoting can make the payload
        // invalid for some WhatsApp versions.
        if (thumbBuffer) {
          captionMsgResult = await message.conn.sendMessage(channel.jid, {
            image: thumbBuffer,
            caption,
          });
        } else {
          captionMsgResult = await message.conn.sendMessage(channel.jid, {
            text: caption,
          });
        }

        if (captionMsgResult?.key?.id) {
          const captionVerified = await verifyNewsletterPost(captionMsgResult.key.id, "caption post");
          if (!captionVerified) {
            // If the thumbnail/image was rejected by the newsletter relay,
            // retry the caption as plain text so the channel still receives
            // the announcement.
            if (thumbBuffer) {
              console.warn("[CSONG] image caption was not verified; retrying as text");
              const textRetry = await message.conn.sendMessage(channel.jid, { text: caption });
              if (textRetry?.key?.id) {
                const retryVerified = await verifyNewsletterPost(textRetry.key.id, "text caption retry");
                if (retryVerified) captionMsgResult = textRetry;
              }
            }
          }
        }
      } catch (postErr) {
        console.error("[CSONG] styled caption post failed:", postErr?.message || postErr);
      }
    }

    await message.react("📤");

    console.time("[CSONG TIMING] upload to channel");
    let sendResult;
    try {
      // Use the real OGG/Opus file as a Buffer. This avoids local-file URL
      // handling differences and lets Baileys' newsletter media uploader
      // prepare the media exactly once for the @newsletter destination.
      const audioBuffer = fs.readFileSync(outFile);

      sendResult = await message.conn.sendMessage(
        channel.jid,
        {
          audio: audioBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true,
          seconds: duration,
          waveform: waveform,
        }
      );
    } catch (audioErr) {
      console.error("[CSONG ERROR] audio send to newsletter failed:", audioErr);
      try { fs.unlinkSync(outFile); } catch {}
      return setStatus(
        `audio failed to deliver to the channel: ${audioErr.message}\n\ncheck whether this account is the owner or admin of that channel — admin rights are required to post media on a newsletter`
      );
    }
    console.timeEnd("[CSONG TIMING] upload to channel");
    try { fs.unlinkSync(outFile); } catch {}

    if (!sendResult?.key?.id) {
      console.log("[CSONG] WhatsApp returned no message key:", sendResult);
      return setStatus(
        "whatsapp did not return a channel message id — the post was not confirmed"
      );
    }

    // This is the important fix: only call it successful after the message
    // can actually be read back from the Channel.
    const audioVerified = await verifyNewsletterPost(sendResult.key.id, "audio post");
    if (!audioVerified) {
      return setStatus(
        `channel post was not confirmed by WhatsApp\nchannel : ${channel.name}\nsong : ${video.title}\n\ncheck that this account is an admin/owner and that the Baileys version supports newsletter media`
      );
    }

    await message.react("✅");
    await setStatus(
      `csong posted successfully ✅\nchannel : ${channel.name}\nsong : ${video.title}\n\n> *𝙲𝙾𝙳𝙴 𝙱𝚈 ${config.ownerName || config.OWNER_NAME || "OWNER"}*`
    );
  } catch (err) {
    console.error("[CSONG ERROR]", err);
    if (err.code === "ECONNABORTED") {
      await setStatus("server timeout, try again");
    } else {
      const reason =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        (typeof err === "string" ? err : null) ||
        (err ? JSON.stringify(err).slice(0, 200) : "unknown error");
      await setStatus(`csong failed: ${reason}`);
    }
  }
});
