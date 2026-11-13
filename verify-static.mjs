import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const html = await readFile(path.join(root, "index.html"), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

expect(/<!doctype html>/i.test(html), "index.html is missing a doctype");
expect(/<html\b[^>]*\blang=["'][^"']+["']/i.test(html), "index.html is missing an html lang attribute");
expect(/<meta\b[^>]*\bname=["']viewport["']/i.test(html), "index.html is missing a viewport meta tag");
expect(/<title>[^<]+<\/title>/i.test(html), "index.html is missing a non-empty title");
expect(/<h1\b/i.test(html), "index.html is missing a primary h1 heading");
expect(/\bid=["']refreshBtn["']/i.test(html), "index.html is missing the manual refresh control");
expect(/navigator\.serviceWorker|serviceWorker\.register/i.test(html), "index.html does not register offline support");

for (const required of ["service-worker.js", "docs/favicon.svg"]) {
  try {
    await access(path.join(root, required));
  } catch {
    failures.push(`Required app asset is missing: ${required}`);
  }
}

if (failures.length) {
  console.error("Static verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Static verification passed: document shell, refresh control, offline registration, and required assets are present.");

// Brigade companion: the public repository must hold only the data-free shell.
{
  const { readdir, readFile: rf } = await import("node:fs/promises");
  const dir = path.join(root, "orana", "companion");
  const files = (await readdir(dir, { recursive: true })).filter((f) => /\.(html|js|css|json)$/.test(f));
  const bad = [];
  if (!files.includes("index.html") || !files.includes("login.js")) bad.push("companion shell is incomplete");
  if (files.some((f) => /(^|\/)data(\.js|\/)/.test(f))) bad.push("companion must not ship a data bundle");
  for (const f of files) {
    const t = await rf(path.join(dir, f), "utf8");
    if (/drive\.google\.com|mail\.google\.com/.test(t)) bad.push(`${f}: private link`);
    if (/(?:\+?61|\b0)[23478](?:[ -]?\d){8}\b/.test(t)) bad.push(`${f}: phone number`);
    if (f !== "lib/integrity.js" && /\bBSB\b/.test(t)) bad.push(`${f}: bank detail`);
    if (/self\.BBC_DATA\s*=\s*\{/.test(t)) bad.push(`${f}: embedded library data`);
  }
  if (bad.length) { console.error("Companion checks failed:\n - " + bad.join("\n - ")); process.exit(1); }
  console.log(`companion shell checked: ${files.length} files, no private data`);
}
