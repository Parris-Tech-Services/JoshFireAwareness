import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.dirname(fileURLToPath(import.meta.url));
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname === "/") pathname = "/index.html";

      const target = path.resolve(root, `.${pathname}`);
      if (!target.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      const info = await stat(target);
      if (!info.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": mimeTypes.get(path.extname(target).toLowerCase()) ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
}

function isExpectedConsoleError(message) {
  return (
    message.includes("/api/emv") ||
    message.includes("Failed to load resource") ||
    message.includes("ERR_NAME_NOT_RESOLVED")
  );
}

async function runViewport(browser, baseUrl, name, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error" && !isExpectedConsoleError(message.text())) {
      errors.push(`Console error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`Page error: ${error.message}`));

  try {
    const response = await page.goto(`${baseUrl}/index.html`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!response?.ok()) errors.push(`Homepage returned HTTP ${response?.status() ?? "unknown"}`);

    await page.waitForSelector("body", { state: "visible" });
    await page.waitForTimeout(750);

    const title = await page.title();
    if (!title.includes("JoshFireAwareness")) errors.push(`Unexpected page title: ${title}`);

    const heading = (await page.locator("h1").first().textContent())?.trim();
    if (!heading) errors.push("Primary h1 heading is missing or empty");

    if (!(await page.locator("#refreshBtn").isVisible())) {
      errors.push("Refresh control is not visible");
    }

    const unnamedButtons = await page.locator("button").evaluateAll((buttons) =>
      buttons.filter((button) => {
        const ariaLabel = button.getAttribute("aria-label")?.trim();
        const text = button.textContent?.trim();
        return !ariaLabel && !text;
      }).length
    );
    if (unnamedButtons > 0) errors.push(`${unnamedButtons} button(s) have no accessible name`);

    const imagesWithoutAlt = await page.locator("img:not([alt])").count();
    if (imagesWithoutAlt > 0) errors.push(`${imagesWithoutAlt} image(s) are missing alt attributes`);

    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    if (dimensions.documentWidth > dimensions.viewportWidth + 32) {
      errors.push(
        `Horizontal overflow is too large (${dimensions.documentWidth}px document in ${dimensions.viewportWidth}px viewport)`
      );
    }
  } finally {
    await context.close();
  }

  if (errors.length) {
    throw new Error(`${name} smoke test failed:\n- ${errors.join("\n- ")}`);
  }

  console.log(`${name} smoke test passed.`);
}

const server = createStaticServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
if (!address || typeof address === "string") {
  server.close();
  throw new Error("Could not determine QA server port");
}

const baseUrl = `http://127.0.0.1:${address.port}`;
let browser;

try {
  console.log(`Starting JoshFireAwareness QA at ${baseUrl}`);
  browser = await chromium.launch();
  await runViewport(browser, baseUrl, "Desktop", { width: 1440, height: 1000 });
  await runViewport(browser, baseUrl, "Mobile", { width: 390, height: 844 });
  console.log("QA passed with no unexpected browser errors.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
