import fs from "fs";
import path from "path";

import { logger } from "../core/logger.js";
import { DATA_DIR } from "../core/utils.js";

type ExportData = {
  memories: unknown[];
  snippets: unknown[];
  agents: unknown[];
};

async function main() {
  const result: ExportData = { memories: [], snippets: [], agents: [] };

  for (const storeName of ["memories", "snippets", "agents"] as const) {
    const dir = path.join(DATA_DIR, storeName);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")) as unknown;
        result[storeName].push(data);
      } catch {
        // skip corrupted files
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.resolve(`export-${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");

  logger.info("export", `Exported to: ${outPath}`);
  logger.info("export", `  memories : ${result.memories.length}`);
  logger.info("export", `  snippets : ${result.snippets.length}`);
  logger.info("export", `  agents   : ${result.agents.length}`);
}

main().catch((err) => logger.error("export", String(err)));
