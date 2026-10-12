import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===================== EREN XMD BOT CONFIG =====================
const BOT_NAME = "●⏤͟͟͞͞>𝐄ʀᴇɴ-𝐗ᴍᴅ//";
const OWNER_NAME = "𝕰 𝖗 𝖊 𝖓";
const DEVELOPER_NAME = "𝕰 𝖗 𝖊 𝖓";
const OWNER_NUMBER = "917029177912";
const PREFIX = ".";

// WhatsApp channel + menu media
const WA_CHANNEL_LINK = "https://whatsapp.com/channel/0029VbDepaOCnA7mPSaTTQ1S";
const WA_CHANNEL_JID = "";
const BOT_PIC_URL = "https://files.catbox.moe/i10gvo.jpg";
const MENU_VIDEO_URL = "https://files.catbox.moe/0wgiyc.mp4";
const MENU_VIDEO_URLS = [
  'https://files.catbox.moe/0wgiyc.mp4',
  'https://files.catbox.moe/ak0q4j.mp4',
  'https://files.catbox.moe/8hwaoq.mp4',
  'https://files.catbox.moe/s85ljg.mp4',
  'https://files.catbox.moe/jdos44.mp4',
  'https://files.catbox.moe/61lduh.mp4',
  'https://files.catbox.moe/l5ibh6.mp4',
  'https://files.catbox.moe/u2vfs7.mp4',
  'https://files.catbox.moe/9a2qks.mp4',
  'https://files.catbox.moe/31mhpm.mp4',
  'https://files.catbox.moe/tpa4nh.mp4',
  'https://files.catbox.moe/pantdn.mp4',
  'https://files.catbox.moe/rt7zfy.mp4',
  'https://files.catbox.moe/8dv7yg.mp4',
  'https://files.catbox.moe/k3sp0v.mp4',
  'https://files.catbox.moe/e35oz0.mp4',
  'https://files.catbox.moe/d7n3jv.mp4',
  'https://files.catbox.moe/mk5glb.mp4',
  'https://files.catbox.moe/shuxrf.mp4',
  'https://files.catbox.moe/hbp4pa.mp4',
  'https://files.catbox.moe/snxu1w.mp4',
  'https://files.catbox.moe/7n3zf9.mp4',
  'https://files.catbox.moe/4p9vrq.mp4',
  'https://files.catbox.moe/fvjlbj.mp4',
  'https://files.catbox.moe/caqr7p.mp4',
  'https://files.catbox.moe/tgyl27.mp4'
];
const MENU_AUDIO_URL = "https://files.catbox.moe/k24ny1.m4a";

const SESSION_DIR = path.join(__dirname, "sessions");
const META_FILE = path.join(__dirname, "data", "sessions.json");

const env = { BOT_NAME, OWNER_NAME, DEVELOPER_NAME, OWNER_NUMBER, PREFIX,
  MENU_VIDEO_URLS,
  WA_CHANNEL_LINK, WA_CHANNEL_JID, BOT_PIC_URL, MENU_VIDEO_URL, MENU_AUDIO_URL };
for (const [k, v] of Object.entries(env)) process.env[k] = String(v);
process.env.NODE_ENV = "production";

export default {
  prefix: PREFIX, owner: OWNER_NUMBER, ownerNumber: OWNER_NUMBER, ownerContact: OWNER_NUMBER, sudo: OWNER_NUMBER,
  botName: BOT_NAME, BOT_NAME, ownerName: OWNER_NAME, OWNER_NAME, developerName: DEVELOPER_NAME, DEVELOPER_NAME,
  packname: BOT_NAME, author: DEVELOPER_NAME, version: "4.0.0", mode: "public", workType: "public", WORK_TYPE: "public",
  theme: "t", THEME: "t", timezone: "Asia/Kolkata", maxFileSize: 100 * 1024 * 1024,
  statusReact: false, STATUS_REACT: false, WA_CHANNEL_LINK, WA_CHANNEL_JID, BOT_PIC_URL, MENU_VIDEO_URL, MENU_VIDEO_URLS, MENU_AUDIO_URL,
  whatsapp: { botPic: BOT_PIC_URL, channelLink: WA_CHANNEL_LINK, channelId: WA_CHANNEL_JID, menuVideo: MENU_VIDEO_URL, menuAudio: MENU_AUDIO_URL },
  authDir: SESSION_DIR, AUTH_DIR: SESSION_DIR, SESSION_DIR, META_FILE, SESSION_ID: "", CONCURRENCY: 5, START_DELAY_MS: 500, RECONNECT_LIMIT: 10,
};
