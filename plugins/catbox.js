import { Module } from "../lib/plugins.js";
import config from "../config.js";
import { getTheme } from "../Themes/themes.js";
import path from "path";
import axios from "axios";
import FormData from "form-data";

const theme = getTheme();

// Helper to format bytes into readable strings
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

Module({
  command: "url",
  package: "converter",
  description: "Convert media to URL (upload to Catbox)",
})(async (message) => {
  try {
    const quotedMsg = message.quoted || message;

    // Normalize Baileys message type handling
    const rawType = quotedMsg.type || Object.keys(quotedMsg.message || {})[0] || "";
    const mimeType =
      quotedMsg.content?.mimetype ||
      quotedMsg.mimetype ||
      quotedMsg.message?.[rawType]?.mimetype ||
      "";

    const supportedTypes = [
      "imageMessage",
      "videoMessage",
      "audioMessage",
      "documentMessage",
      "stickerMessage",
      "image",
      "video",
      "audio",
      "document",
      "sticker",
    ];

    const isSupported =
      supportedTypes.includes(rawType) ||
      mimeType.startsWith("image/") ||
      mimeType.startsWith("video/") ||
      mimeType.startsWith("audio/");

    if (!isSupported) {
      return message.send(
        "_Reply to an image, video, audio, or document_\n\n" +
          "*Supported:*\n" +
          "• Images (JPG, PNG, GIF, WEBP)\n" +
          "• Videos (MP4, MKV)\n" +
          "• Audio (MP3, WAV, OGG)\n" +
          "• Documents"
      );
    }

    await message.react("⏳");
    await message.send("_Uploading to Catbox... Please wait_");

    // Download the media buffer directly
    const mediaBuffer = await quotedMsg.download();
    if (!mediaBuffer || mediaBuffer.length === 0) {
      throw new Error("Failed to download media buffer");
    }

    // Determine extension
    let extension = ".bin";
    if (mimeType.includes("image/jpeg") || rawType.includes("image")) extension = ".jpg";
    else if (mimeType.includes("image/png")) extension = ".png";
    else if (mimeType.includes("image/gif")) extension = ".gif";
    else if (mimeType.includes("image/webp") || rawType.includes("sticker")) extension = ".webp";
    else if (mimeType.includes("video/mp4") || rawType.includes("video")) extension = ".mp4";
    else if (mimeType.includes("video/mkv")) extension = ".mkv";
    else if (mimeType.includes("audio/mpeg") || rawType.includes("audio")) extension = ".mp3";
    else if (mimeType.includes("audio/wav")) extension = ".wav";
    else if (mimeType.includes("audio/ogg")) extension = ".ogg";
    else if (quotedMsg.content?.fileName || quotedMsg.fileName) {
      extension = path.extname(quotedMsg.content?.fileName || quotedMsg.fileName) || ".bin";
    }

    const fileName = `upload_${Date.now()}${extension}`;

    // Upload buffer directly through FormData without writing to disk
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", mediaBuffer, {
      filename: fileName,
      contentType: mimeType || "application/octet-stream",
    });

    const response = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: form.getHeaders(),
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const mediaUrl = response.data?.toString().trim();
    if (!mediaUrl || mediaUrl.toLowerCase().includes("error")) {
      throw new Error(mediaUrl || "Unknown upload response from Catbox");
    }

    // Resolve media label
    let mediaType = "File";
    if (rawType.includes("image") || mimeType.startsWith("image/")) mediaType = "Image";
    else if (rawType.includes("video") || mimeType.startsWith("video/")) mediaType = "Video";
    else if (rawType.includes("audio") || mimeType.startsWith("audio/")) mediaType = "Audio";
    else if (rawType.includes("sticker") || mimeType.includes("webp")) mediaType = "Sticker";
    else if (rawType.includes("document")) mediaType = "Document";

    const fileSize = formatBytes(mediaBuffer.length);

    const resultMessage = `
╭━━━「 *UPLOAD SUCCESS* 」━━━┈⊷
┃
┃ ✅ *${mediaType} uploaded successfully*
┃
┃ *📊 Details:*
┃ • Type: ${mediaType}
┃ • Size: ${fileSize}
┃ • Format: ${extension.replace(".", "").toUpperCase()}
┃
┃ *🔗 URL:*
┃ ${mediaUrl}
┃
┃ _Link is permanent and can be shared_
┃
╰━━━━━━━━━━━━━━━━━━━┈⊷
    `.trim();

    // Fallback if sendreply is not supported by your bot framework
    if (typeof message.sendreply === "function") {
      await message.sendreply(resultMessage);
    } else {
      await message.send(resultMessage);
    }

    await message.react("✅");
  } catch (uploadError) {
    console.error("Upload error:", uploadError);

    let errorMessage = "❌ *Upload Failed*\n\n";
    if (uploadError.code === "ETIMEDOUT") {
      errorMessage += "_Timeout: Catbox server is not responding_";
    } else if (uploadError.code === "ECONNABORTED") {
      errorMessage += "_Connection aborted. Check file size or internet connection_";
    } else if (uploadError.response?.status === 413) {
      errorMessage += "_File too large for upload (Maximum: 200MB)_";
    } else {
      errorMessage += `_${uploadError.message || "Unknown error occurred"}_`;
    }

    await message.send(errorMessage);
    await message.react("❌");
  }
});

