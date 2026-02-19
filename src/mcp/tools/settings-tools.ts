import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { logger } from "../../core/logger.js";
import { getSettings } from "../../core/settings-store.js";
import { getToolDescription } from "../../core/tool-catalog.js";

export function registerSettingsTools(server: McpServer): void {
  server.registerTool(
    "settings_get",
    {
      description: getToolDescription("settings_get"),
      inputSchema: {},
    },
    async () => {
      logger.info("mcp", "settings_get");
      const settings = getSettings();
      return {
        content: [{ type: "text", text: JSON.stringify(settings, null, 2) }],
      };
    },
  );
}
