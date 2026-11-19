#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function fail(message) {
  console.error(`\n[verify-styles] ${message}\n`);
  process.exit(1);
}

function findStylesheetHref(html) {
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)];
  for (const match of links) {
    if (match[1].includes("/_next/static/css/")) {
      return match[1];
    }
  }
  return null;
}

async function main() {
  console.log(`[verify-styles] Checking ${BASE_URL}`);

  let html;
  try {
    const response = await fetch(BASE_URL);
    html = await response.text();
    if (!response.ok) {
      await fail(`Homepage returned HTTP ${response.status}.`);
    }
  } catch (error) {
    await fail(
      `Could not reach ${BASE_URL}. Start the server with npm run dev:clean.\n${error}`,
    );
  }

  const stylesheet = findStylesheetHref(html);
  if (!stylesheet) {
    await fail("Homepage HTML has no Next.js CSS stylesheet link.");
  }

  const cssUrl = stylesheet.startsWith("http")
    ? stylesheet
    : `${BASE_URL}${stylesheet.startsWith("/") ? "" : "/"}${stylesheet}`;

  const cssResponse = await fetch(cssUrl);
  if (!cssResponse.ok) {
    await fail(`Stylesheet missing: ${cssUrl} (HTTP ${cssResponse.status}).`);
  }

  const cssText = await cssResponse.text();
  if (cssText.length < 512) {
    await fail("Stylesheet is too small. Tailwind may not have compiled.");
  }

  if (!cssText.includes("--bg-deep") && !cssText.includes("tailwind")) {
    await fail("Stylesheet does not contain expected app tokens.");
  }

  console.log("[verify-styles] OK — CSS link present and stylesheet loads.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
