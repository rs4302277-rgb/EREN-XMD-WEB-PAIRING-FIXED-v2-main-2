import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const skip = new Set(["node_modules", ".git"]);
const files = [];

async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && full.endsWith(".js")) files.push(full);
  }
}

await walk(root);
files.sort();
let failed = 0;
for (const file of files) {
  try {
    await execFileAsync(process.execPath, ["--check", file]);
  } catch (err) {
    failed++;
    console.error(`FAIL ${path.relative(root, file)}\n${err.stderr || err.message}`);
  }
}
if (failed) process.exit(1);
console.log(`Syntax OK: ${files.length} JavaScript files checked.`);
