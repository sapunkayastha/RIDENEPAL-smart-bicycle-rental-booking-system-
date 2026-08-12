// mysql-demo/setup.mjs
//
// Run once: `npm run mysql:setup`
// Creates the ridenepal_mysql database and feedback_messages table
// by executing mysql-demo/schema.sql against your local MySQL server.

import mysql from "mysql2/promise";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

config({ path: new URL("../.env.mysql", import.meta.url).pathname });

const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));

async function main() {
  const schemaSql = readFileSync(schemaPath, "utf8");

  console.log("Connecting to MySQL at", process.env.MYSQL_HOST || "127.0.0.1", "...");

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    multipleStatements: true,
  });

  try {
    await connection.query(schemaSql);
    console.log("✅ Database 'ridenepal_mysql' and table 'feedback_messages' are ready.");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("❌ Setup failed:", err.message);
  console.error(
    "\nCheck that MySQL is running locally and that mysql-demo/.env.mysql has the right credentials.",
  );
  process.exit(1);
});
