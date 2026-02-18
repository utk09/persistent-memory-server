import fs from "fs";
import path from "path";

import { DATA_DIR } from "../core/utils.js";

type ImportData = {
  memories?: unknown[];
  snippets?: unknown[];
  agents?: unknown[];
};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: jiti src/scripts/import.ts <path/to/export.json>");
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(filePath), "utf-8");
  const data = JSON.parse(raw) as ImportData;

  let imported = 0;

  for (const storeName of ["memories", "snippets", "agents"] as const) {
    const items = data[storeName];
    if (!Array.isArray(items)) continue;

    const dir = path.join(DATA_DIR, storeName);
    fs.mkdirSync(dir, { recursive: true });

    for (const item of items) {
      const record = item as Record<string, unknown>;
      if (!record.id || typeof record.id !== "string") continue;
      const dest = path.join(dir, `${record.id}.json`);
      fs.writeFileSync(dest, JSON.stringify(item, null, 2), "utf-8");
      imported++;
    }
  }

  console.info(`Imported ${imported} items from ${filePath}`);
}

main().catch(console.error);
