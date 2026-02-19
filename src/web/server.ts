import { logger } from "../core/logger.js";
import { startWebServer } from "./app.js";

logger.cleanOldLogs();
startWebServer();
