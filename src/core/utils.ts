import fs from "fs";
import path from "path";
import { v7 as uuidv7 } from "uuid";

export const DATA_DIR = path.resolve(import.meta.dirname, "../../data");

export function generateId(): string {
  return uuidv7();
}

export function getStorePath(storeName: string): string {
  const dir = path.join(DATA_DIR, storeName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export function searchMatches(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((term) => lower.includes(term));
}

export function tagsMatch(entryTags: string[], filterTags: string[]): boolean {
  if (filterTags.length === 0) return true;
  return filterTags.every((tag) => entryTags.includes(tag));
}
