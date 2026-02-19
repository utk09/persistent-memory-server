import fs from "fs";
import path from "path";

import { logger } from "./logger.js";
import { DATA_DIR } from "./utils.js";

export type Settings = {
  defaultUser?: string;
  defaultDevice?: string;
};

const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export function getSettings(): Settings {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return JSON.parse(data) as Settings;
  } catch {
    return {};
  }
}

export function updateSettings(updates: Partial<Settings>): Settings {
  const current = getSettings();
  const merged = { ...current, ...updates };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  logger.info("settings-store", "Updated settings");
  return merged;
}
