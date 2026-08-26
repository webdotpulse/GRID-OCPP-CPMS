import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { PGlite } from "@electric-sql/pglite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pg from "pg";
import EventEmitter from "events";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../data/postgres");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const pgliteInstance = new PGlite(DATA_DIR);

class PgliteClientWrapper extends EventEmitter {
  async connect() {
    await pgliteInstance.waitReady;
    return this;
  }

  async query(queryObjOrText: any, values?: any[]) {
    await pgliteInstance.waitReady;
    const text = typeof queryObjOrText === "string" ? queryObjOrText : queryObjOrText.text;
    const vals = typeof queryObjOrText === "string" ? values : (queryObjOrText.values || values);
    const rowMode = typeof queryObjOrText === "object" ? queryObjOrText.rowMode : undefined;

    const res = await pgliteInstance.query(text, vals, { rowMode });
    const rows = res.rows.map((row: any) => {
      if (Array.isArray(row)) {
        return row.map((val: any) => {
          if (val && typeof val === "object" && !(val instanceof Date) && !Buffer.isBuffer(val)) {
            return JSON.stringify(val);
          }
          return val;
        });
      }
      return row;
    });

    return {
      rows,
      fields: res.fields.map((f: any) => ({ name: f.name, dataTypeID: f.dataTypeID })),
      rowCount: res.affectedRows !== undefined ? res.affectedRows : res.rows.length,
    };
  }

  release() {}
}
Object.setPrototypeOf(PgliteClientWrapper.prototype, pg.Client.prototype);

class PglitePoolWrapper extends EventEmitter {
  options = {};
  client = new PgliteClientWrapper();

  async connect() {
    await pgliteInstance.waitReady;
    return this.client;
  }

  async query(queryObjOrText: any, values?: any[]) {
    return this.client.query(queryObjOrText, values);
  }

  async end() {}
}
Object.setPrototypeOf(PglitePoolWrapper.prototype, pg.Pool.prototype);

const pool = new PglitePoolWrapper();
const adapter = new PrismaPg(pool as any);
export const prisma = new PrismaClient({ adapter });

// Graceful shutdown handler
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
