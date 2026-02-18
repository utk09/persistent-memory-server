import fs from "fs";
import path from "path";

import { DATA_DIR } from "../core/utils.js";

type Item = Record<string, unknown>;

function loadAll(storeName: string): Item[] {
  const dir = path.join(DATA_DIR, storeName);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as Item;
      } catch {
        return null;
      }
    })
    .filter((x): x is Item => x !== null);
}

function countBy(items: Item[], key: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const val = String(item[key] ?? "unknown");
    counts[val] = (counts[val] ?? 0) + 1;
  }
  return counts;
}

function topTags(items: Item[], limit = 10): [string, number][] {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const tags = item.tags;
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (typeof tag === "string") {
          counts[tag] = (counts[tag] ?? 0) + 1;
        }
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function printTable(label: string, counts: Record<string, number>) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return;
  console.info(`\n${label}:`);
  for (const [k, v] of entries) {
    console.info(`  ${k.padEnd(16)} ${v}`);
  }
}

function main() {
  const memories = loadAll("memories");
  const snippets = loadAll("snippets");
  const agents = loadAll("agents");

  console.info("=== Persistent Memory Server Stats ===\n");
  console.info(`Memories : ${memories.length}`);
  console.info(`Snippets : ${snippets.length}`);
  console.info(`Agents   : ${agents.length}`);

  printTable("Memories by scope", countBy(memories, "scope"));
  printTable("Snippets by type", countBy(snippets, "type"));
  printTable("Agents by permission", countBy(agents, "permission"));

  const tags = topTags([...memories, ...snippets, ...agents]);
  if (tags.length > 0) {
    console.info("\nTop tags:");
    for (const [tag, count] of tags) {
      console.info(`  ${tag.padEnd(20)} ${count}`);
    }
  }
}

main();
