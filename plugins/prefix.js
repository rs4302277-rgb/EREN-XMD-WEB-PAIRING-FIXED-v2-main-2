import { Module } from "../lib/plugins.js";

Module({
  command: "prefix",
  aliases: ["setprefix", "pfx"],
  name: "prefix",
  description: "Change the command prefix for this WhatsApp session",
  package: "OWNER",
})(async (msg, args) => {
  // Prefix handling is implemented in lib/client.js so it can affect
  // command parsing immediately. This plugin exists for command metadata/menu.
});
