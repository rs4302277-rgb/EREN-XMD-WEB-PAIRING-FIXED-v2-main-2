const capture = {
  "message": {
    "conversation": "✅ *ɢʀᴏᴜᴘ sᴛᴀᴛᴜs sᴇɴᴛ!*\n\n╭─〔 ɢsᴛᴀᴛᴜs ᴠ2 〕\n│ 📦 ᴛʏᴘᴇ : ᴠɪᴅᴇᴏ\n│ 👤 ɴᴀᴍᴇ : ʀᴀʜᴜʟ xᴍᴅ\n│ ❤️‍🩹 ᴇᴍᴏᴊɪ : ❤️‍🩹\n│ 🎨 ʙɢ : ʀᴀɴᴅᴏᴍ\n│ 📍 ɢʀᴏᴜᴘ : 120363426268480966@ɢ.ᴜs\n│ ⏱️ ᴛɪᴍᴇ : 1.43s\n╰────────────"
  },
  "capturedContextInfo": {
    "mentionedJid": [],
    "groupMentions": [],
    "statusAttributions": [],
    "stanzaId": "3EB0086B36A4STARFALLA379E4FA31",
    "participant": "72920810418429@lid",
    "quotedMessage": {
      "conversation": "✅ *ɢʀᴏᴜᴘ sᴛᴀᴛᴜs sᴇɴᴛ!*\n\n╭─〔 ɢsᴛᴀᴛᴜs ᴠ2 〕\n│ 📦 ᴛʏᴘᴇ : ᴠɪᴅᴇᴏ\n│ 👤 ɴᴀᴍᴇ : ʀᴀʜᴜʟ xᴍᴅ\n│ ❤️‍🩹 ᴇᴍᴏᴊɪ : ❤️‍🩹\n│ 🎨 ʙɢ : ʀᴀɴᴅᴏᴍ\n│ 📍 ɢʀᴏᴜᴘ : 120363426268480966@ɢ.ᴜs\n│ ⏱️ ᴛɪᴍᴇ : 1.43s\n╰────────────"
    },
    "quotedType": 0
  }
};
const revive = (x) => {
    if (x === null || x === undefined) return x;
    if (Array.isArray(x)) return x.map(revive);
    if (typeof x === 'object') {
        if (typeof x.b64 === 'string') return Buffer.from(x.b64, 'base64');
        if (typeof x.__b64__ === 'string') return Buffer.from(x.__b64__, 'base64');
        return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, revive(v)]));
    }
    return x;
};
const msg = revive(capture.message);
await client.relayMessage(m.chat, msg, {});
