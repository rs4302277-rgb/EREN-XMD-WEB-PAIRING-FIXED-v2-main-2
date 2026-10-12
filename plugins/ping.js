import { Module } from "../lib/plugins.js";

Module({ command: "ping", package: "mics", description: "Fast editable latency check" })(async (message) => {
  const started = Date.now();
  const emojis = ["🌚","🎀","🌸","⚡","💀","🍃","💫","🦋","🌙","🍒"];
  const react = emojis[Math.floor(Math.random() * emojis.length)];
  const sent = await message.send("●⏤͟͟͞͞>𝐏ɪɴɪɴɢ-//🌚🎀");
  const speed = Date.now() - started;
  await message.react(react).catch(() => {});
  const key = sent?.key || sent;
  if (key && message.conn?.sendMessage) {
    try {
      await message.conn.sendMessage(message.from, {
        text: `> ╰➤ 𝐏๏፝֟ƞ̽ɢ ${speed} 𝐌ꜱ ${react} 𓂃‹𝟹`,
        edit: key
      });
      return;
    } catch {}
  }
  await message.send(`> ╰➤ 𝐏๏፝֟ƞ̽ɢ ${speed} 𝐌ꜱ ${react} 𓂃‹𝟹`);
});
