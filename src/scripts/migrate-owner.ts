/**
 * Migration: backfill user="legacy" and device="unknown" on existing entities
 * that were created before the user/device fields were added.
 *
 * Usage: npm run migrate:owner
 */

import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(import.meta.dirname, "../../data");
const STORES = ["memories", "snippets", "agents"];

let total = 0;
let updated = 0;

for (const store of STORES) {
  const dir = path.join(DATA_DIR, store);
  if (!fs.existsSync(dir)) continue;

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const entity = JSON.parse(raw);
      total++;

      let changed = false;
      if (!entity.user) {
        entity.user = "legacy";
        changed = true;
      }
      if (!entity.device) {
        entity.device = "unknown";
        changed = true;
      }

      if (changed) {
        entity.updatedAt = new Date().toISOString();
        fs.writeFileSync(filePath, JSON.stringify(entity, null, 2), "utf-8");
        updated++;
        console.info(
          `[${store}] Updated: ${file} → user="${entity.user}", device="${entity.device}"`,
        );
      }
    } catch {
      console.error(`[${store}] Failed to process: ${file}`);
    }
  }
}

console.info(`\nMigration complete: ${updated}/${total} entities updated.`);
