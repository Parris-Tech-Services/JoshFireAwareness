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
