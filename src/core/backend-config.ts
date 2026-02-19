/**
 * Set DB_BACKEND=sqlite to use the SQLite backend.
 * Defaults to JSON file storage.
 *
 * Examples:
 *   DB_BACKEND=sqlite jiti src/web/server.ts
 *   npm run start:web:sqlite
 */
export const USE_SQLITE = process.env.DB_BACKEND === "sqlite";
