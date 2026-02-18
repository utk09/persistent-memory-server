import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve(import.meta.dirname, "../../logs");
const MAX_LOG_AGE_DAYS = 30;

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let minLevel: LogLevel = "DEBUG";

function getLogFileName(): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `${date}.log`);
}

function formatMessage(level: LogLevel, source: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] [${source}] ${message}`;
}

function writeToFile(line: string): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(getLogFileName(), line + "\n", "utf-8");
  } catch {
    // If we can't write to the log file, silently fail - don't crash the server
  }
}

function log(level: LogLevel, source: string, message: string): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const formatted = formatMessage(level, source, message);
  writeToFile(formatted);

  switch (level) {
    case "DEBUG":
      console.debug(formatted);
      break;
    case "INFO":
      console.info(formatted);
      break;
    case "WARN":
      console.warn(formatted);
      break;
    case "ERROR":
      console.error(formatted);
      break;
  }
}

function cleanOldLogs(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) return;

    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();
    const maxAge = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.endsWith(".log")) continue;

      const filePath = path.join(LOG_DIR, file);
      const stat = fs.statSync(filePath);

      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {
    // Silent fail on cleanup
  }
}

export const logger = {
  debug: (source: string, message: string) => log("DEBUG", source, message),
  info: (source: string, message: string) => log("INFO", source, message),
  warn: (source: string, message: string) => log("WARN", source, message),
  error: (source: string, message: string) => log("ERROR", source, message),
  setLevel: (level: LogLevel) => {
    minLevel = level;
  },
  cleanOldLogs,
};
