// Run with Playwright installed: node tests/browser.cjs [URL] [screenshot-directory]
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.argv[2] || "http://127.0.0.1:8086/";
const screenshots = process.argv[3];
const source = "https://metshein.com/kordamine/json/broneeringud.json";
const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/broneeringud.json"), "utf8"),
);
const classes = {
  Juuksur: "juuksur",
  Massaaž: "massaaz",
  Spa: "spa",
  Kosmeetika: "kosmeetika",
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  const logs = [];
  const failedRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) =>
    logs.push({ type: message.type(), text: message.text() }),
  );
  page.on("requestfailed", (request) =>
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText,
    }),
  );
  const waitReady = () =>
    page.waitForFunction(
      () =>
        document.querySelector("#table-region").getAttribute("aria-busy") ===
        "false",
    );
  const count = () => page.locator("tbody tr").count();
  const shot = async (name) => {
    if (screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      await page.screenshot({
        path: path.join(screenshots, name + ".png"),
        fullPage: true,
      });
    }
  };
  try {
    const html = await (await page.request.get(base)).text();
    assert.match(html, /<tbody[^>]*>\s*<\/tbody>/);
    const noJs = await browser.newPage({ javaScriptEnabled: false });
    await noJs.goto(base);
    assert.equal(await noJs.locator("tbody tr").count(), 0);
    assert.equal(await noJs.locator("thead tr").count(), 1);
    await noJs.close();
    await page.goto(base);
    await waitReady();
    assert.equal(await count(), 100);
    assert(logs.some((log) => log.text.includes("Fetch API — broneeringud:")));
    assert.equal(await page.locator("#total-count").textContent(), "100");
    const colors = new Set();
    for (const [service, cssClass] of Object.entries(classes)) {
      await page.getByRole("button", { name: "Kõik", exact: true }).click();
      const expected = fixture.broneeringud.filter(
        (item) => item.teenus === service,
      ).length;
      assert.equal(
        await page.locator(`tbody tr.${cssClass}`).count(),
        expected,
      );
      colors.add(
        await page
          .locator(`tbody tr.${cssClass} td`)
          .first()
          .evaluate((node) => getComputedStyle(node).backgroundColor),
      );
      await page.getByRole("button", { name: service, exact: true }).click();
      assert.equal(await count(), expected);
      assert.equal(
        (await page.locator(".filter.active").textContent()).trim(),
        service,
      );
    }
    assert.equal(colors.size, 4);
    await page.getByRole("button", { name: "Kõik", exact: true }).click();
    await shot("desktop");
    await page.locator("#search").fill("  TÕNU  ");
    assert.equal(
      await count(),
      fixture.broneeringud.filter((item) => item.klient.includes("Tõnu"))
        .length,
    );
    await page.getByRole("button", { name: "Juuksur", exact: true }).click();
    assert.equal(
      await count(),
      fixture.broneeringud.filter(
        (item) => item.klient.includes("Tõnu") && item.teenus === "Juuksur",
      ).length,
    );
    await page.locator("#search").fill("no-such-client");
    assert.equal(await count(), 0);
    assert(await page.locator("#empty").isVisible());
    await shot("empty");
    await page.locator("#reset").click();
    assert.equal(await count(), 100);
    await page.locator("#search").fill("massaaž");
    assert.equal(await count(), 28);
    await page.locator("#search").fill("");
    for (const direction of ["desc", "asc"]) {
      await page.locator("#sort").selectOption(direction);
      const keys = await page
        .locator("tbody tr")
        .evaluateAll((rows) =>
          rows.map(
            (row) =>
              row.cells[2].querySelector("time").dateTime +
              "T" +
              row.cells[3].textContent,
          ),
        );
      assert.deepEqual(
        keys,
        [...keys].sort((a, b) =>
          direction === "asc" ? a.localeCompare(b) : b.localeCompare(a),
        ),
      );
    }
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Page overflow at ${width}`,
      );
      assert(
        await page.evaluate(
          () =>
            document.querySelector("table").scrollWidth <=
            document.querySelector("#table-region").clientWidth + 1,
        ),
        `Table overflow at ${width}`,
      );
      if (width === 390) await shot("mobile");
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".skeleton")
        .first()
        .evaluate((node) => getComputedStyle(node).animationName),
      "none",
    );
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("Tab");
    assert(
      await page.evaluate(
        () => getComputedStyle(document.activeElement).outlineStyle !== "none",
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real fetch/fallback, console JSON, initial empty HTML, 100 generated rows, service classes/colors/counts, filters, search, sorting, reset, 320/390/768/1440px layouts, reduced motion, keyboard focus.",
    );
    console.log(
      "Real source status:",
      await page.locator("#source-status").textContent(),
    );
    console.log("Real network failures:", JSON.stringify(failedRequests));
    console.log("Real console:", JSON.stringify(logs));

    // Controlled network responses test states without changing application code.
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    await page.route(source, async (route) => {
      await gate;
      await route.fulfill({ json: fixture });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    assert(await page.locator("#loading").isVisible());
    assert(await page.locator("#refresh").isDisabled());
    assert.equal(await count(), 0);
    await shot("loading");
    release();
    await waitReady();
    assert.equal(await count(), 100);
    assert.equal(
      await page.locator("#source-status").textContent(),
      "Andmed laaditud otse allikast",
    );
    await page.unroute(source);
    await page.route(source, (route) => route.abort());
    await page.route("**/data/broneeringud.json", (route) =>
      route.fulfill({ status: 503, body: "Unavailable" }),
    );
    await page.reload();
    await waitReady();
    assert(await page.locator("#error").isVisible());
    assert.equal(await count(), 0);
    await shot("error");
    await page.unroute("**/data/broneeringud.json");
    await page.locator("#retry").click();
    await waitReady();
    assert.equal(await count(), 100);
    await page.unroute(source);
    await page.route(source, (route) =>
      route.fulfill({ json: { broneeringud: [] } }),
    );
    await page.reload();
    await waitReady();
    assert.equal(await count(), 0);
    assert.equal(await page.locator("#total-count").textContent(), "0");
    assert(await page.locator("#empty").isVisible());
    await page.unroute(source);
    await page.route("**/*broneeringud.json", (route) =>
      route.fulfill({
        json: {
          broneeringud: [{ ...fixture.broneeringud[0], kuupäev: "2025-02-31" }],
        },
      }),
    );
    await page.reload();
    await waitReady();
    assert(await page.locator("#error").isVisible());
    assert.deepEqual(errors, []);
    console.log(
      "PASS: delayed loading, simulated direct-source success, total failure, retry recovery, empty dataset, malformed date. No uncaught JavaScript errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
