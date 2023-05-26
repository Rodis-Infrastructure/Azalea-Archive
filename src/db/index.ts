import { Database } from "sqlite3";
import ms from "ms";

if (!process.env.DB_PATH) throw new Error("No database path provided in .env file.");
export const conn = new Database(process.env.DB_PATH);

export async function removeExpiredData() {
    await new Promise((resolve, reject) => {
        conn.run(`
            DELETE
            FROM messages
            WHERE ${Date.now()} - createdAt > ${ms("24h")}
        `, err => {
            if (err) reject(err);
            resolve(null);
        });
    });
}