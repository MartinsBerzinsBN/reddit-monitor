import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import fs from "node:fs";
import path from "path";
import { initSchema } from "./schema";

const dbPath = path.resolve(process.cwd(), "db/db.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === "development" ? console.log : null,
});

let sqliteVecLoaded = false;
try {
  sqliteVec.load(db);
  sqliteVecLoaded = true;
} catch (error) {
  console.warn("[sqlite] sqlite-vec extension failed to load", error?.message);
}

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

initSchema(db, { sqliteVecLoaded });

export const sqliteVecReady = sqliteVecLoaded;
export default db;
