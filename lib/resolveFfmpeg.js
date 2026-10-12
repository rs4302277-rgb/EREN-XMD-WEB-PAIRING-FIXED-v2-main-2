import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** Resolve a usable ffmpeg binary without requiring a system installation. */
export function resolveFfmpegPath() {
  const candidates = [
    process.env.FFMPEG_PATH,
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }

  try {
    // @ffmpeg-installer/ffmpeg is a dependency of this project.
    const installer = require("@ffmpeg-installer/ffmpeg");
    if (installer?.path && fs.existsSync(installer.path)) return installer.path;
  } catch {}

  // On Linux/Android hosting, fluent-ffmpeg can use PATH when no bundled
  // binary is available. Returning the executable name keeps that behaviour.
  return process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
}

export default resolveFfmpegPath;
