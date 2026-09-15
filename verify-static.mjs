import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(root, "index.html");
const html = await readFile(indexPath, "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

expect(/<!doctype html>/i.test(html), "index.html is missing a doctype");
expect(/<html\b[^>]*\blang=["'][^"']+["']/i.test(html), "index.html is missing an html lang attribute");
expect(/<meta\b[^>]*\bname=["']viewport["']/i.test(html), "index.html is missing a viewport meta tag");
expect(/<title>[^<]+<\/title>/i.test(html), "index.html is missing a non-empty title");
expect(/<h1\b/i.test(html), "index.html is missing a primary h1 heading");

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
expect(duplicateIds.length === 0, `Duplicate HTML ids: ${duplicateIds.join(", ")}`);

for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
  const attrs = match[1];
  const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const hasAriaLabel = /\baria-label=["'][^"']+["']/i.test(attrs);
  expect(Boolean(text || hasAriaLabel), "Found a button without visible text or aria-label");
}

const refs = new Set(
  [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .filter((ref) => !/^(?:https?:|mailto:|tel:|sms:|data:|javascript:|#)/i.test(ref))
    .map((ref) => ref.split(/[?#]/, 1)[0])
    .filter(Boolean)
);

for (const ref of refs) {
  const relative = ref.startsWith("/") ? ref.slice(1) : ref.replace(/^\.\//, "");
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${root}${path.sep}`) && target !== root) {
    failures.push(`Local asset escapes repository root: ${ref}`);
    continue;
  }
  try {
    await access(target);
  } catch {
    failures.push(`Missing local asset referenced by index.html: ${ref}`);
  }
}

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

console.log(`Static verification passed: ${ids.length} ids checked, ${refs.size} local references resolved.`);
