#!/usr/bin/env node

const API = "https://www.googleapis.com/drive/v3/files";
const IMAGE_MIME_PREFIX = "image/";

const args = parseArgs(process.argv.slice(2));
const token = await getDriveAccessToken();
const rootFolderId = args.root || "1E6XqPMoxn-xq36Kf4wVkYW3JlupTyjIU";
const outputPath = args.out || "data/catalog.json";

const products = [];
await crawlFolder(rootFolderId, []);

const payload = {
  source: {
    provider: "Google Drive",
    rootFolderId,
    rootUrl: `https://drive.google.com/drive/folders/${rootFolderId}`,
    syncedAt: new Date().toISOString(),
    note: "Gerado automaticamente pelo sync do catalogo."
  },
  priceRules: defaultPriceRules(),
  products: products.sort((a, b) => new Date(b.createdTime || 0) - new Date(a.createdTime || 0))
};

await writeJson(outputPath, payload);
console.log(`Synced ${products.length} products to ${outputPath}`);

async function crawlFolder(folderId, path) {
  const children = await listChildren(folderId);

  for (const item of children) {
    if (item.mimeType === "application/vnd.google-apps.folder") {
      await crawlFolder(item.id, [...path, item.name]);
      continue;
    }

    if (!item.mimeType?.startsWith(IMAGE_MIME_PREFIX)) {
      continue;
    }

    products.push(buildProduct(item, path));
  }
}

async function listChildren(folderId) {
  const fields = [
    "nextPageToken",
    "files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink)"
  ].join(",");

  let pageToken = "";
  const files = [];

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields,
      pageSize: "1000",
      orderBy: "folder,name_natural",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true"
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(`${API}?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Drive API ${response.status}: ${await response.text()}`);
    }

    const page = await response.json();
    files.push(...(page.files || []));
    pageToken = page.nextPageToken || "";
  } while (pageToken);

  return files;
}

function buildProduct(file, path) {
  const category = inferCategory(path);
  const size = inferSize(path) || "Unico";
  const brand = inferBrand(path) || "A identificar";
  const title = inferTitle(category, brand);

  return {
    id: slug([category, brand, size, file.id].join("-")),
    title,
    category,
    brand,
    size,
    price: null,
    status: "available",
    confidence: "path",
    driveFileId: file.id,
    driveUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    image: `https://drive.google.com/thumbnail?id=${file.id}&sz=w900`,
    folderPath: path.join(" / "),
    createdTime: file.createdTime,
    modifiedTime: file.modifiedTime
  };
}

function inferCategory(path) {
  const joined = normalize(path.join(" "));

  if (joined.includes("polo")) return "Camisa polo";
  if (joined.includes("jeans")) return "Calca jeans";
  if (joined.includes("sueter")) return "Sueter";
  if (joined.includes("regata")) return "Regata";
  if (joined.includes("cueca")) return "Cueca premium";
  if (joined.includes("calca")) return "Calca";
  if (joined.includes("short") || joined.includes("bermuda")) return "Short / Bermuda";
  if (joined.includes("camisa") || joined.includes("premium") || joined.includes("farm")) return "Camiseta / Camisa";

  return path[0] || "Produto";
}

function inferSize(path) {
  const joined = ` ${normalize(path.join(" "))} `;
  const numeric = joined.match(/\b(3[6-9]|4[0-9]|5[0-4])\b/);
  if (numeric) return numeric[1];

  const alpha = joined.match(/\b(PP|P|M|G|GG|XXL|XG)\b/i);
  if (alpha) return alpha[1].toUpperCase();

  return "";
}

function inferBrand(path) {
  const joined = normalize(path.join(" "));
  const brands = ["Farm", "Premium", "Ralph Lauren", "Lacoste", "Tommy", "Nike", "Adidas"];
  return brands.find((brand) => joined.includes(normalize(brand))) || "";
}

function inferTitle(category, brand) {
  if (brand && brand !== "A identificar" && !category.toLowerCase().includes(brand.toLowerCase())) {
    return `${category} ${brand}`.trim();
  }

  return category;
}

function defaultPriceRules() {
  return [
    { category: "Camiseta / Camisa", price: null },
    { category: "Camisa polo", price: null },
    { category: "Calca jeans", price: null },
    { category: "Sueter", price: null },
    { category: "Regata", price: null },
    { category: "Cueca premium", price: null }
  ];
}

async function writeJson(path, data) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slug(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") parsed.root = argv[++index];
    if (arg === "--out") parsed.out = argv[++index];
  }

  return parsed;
}

async function getDriveAccessToken() {
  if (process.env.GOOGLE_ACCESS_TOKEN) {
    return process.env.GOOGLE_ACCESS_TOKEN;
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error("Missing Google credentials.");
    console.error("Use GOOGLE_ACCESS_TOKEN for local tests or GOOGLE_SERVICE_ACCOUNT_JSON for daily automation.");
    process.exit(1);
  }

  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const assertion = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(claim))
  ].join(".");

  const { createSign } = await import("node:crypto");
  const signature = createSign("RSA-SHA256")
    .update(assertion)
    .sign(serviceAccount.private_key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${assertion}.${base64url(signature)}`
    })
  });

  if (!response.ok) {
    throw new Error(`Google OAuth ${response.status}: ${await response.text()}`);
  }

  const token = await response.json();
  return token.access_token;
}

function base64url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
