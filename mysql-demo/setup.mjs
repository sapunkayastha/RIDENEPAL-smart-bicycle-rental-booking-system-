// mysql-demo/setup.mjs
//
// Run once: `npm run mysql:setup`
// Builds the REAL app database ('ridenepal') by executing schema-full.sql
// (base tables + platform_settings) followed by every migration/patch file
// in mysql-demo/, in dependency order, then seeds demo bikes.
//
// (schema.sql is legacy — it only creates the old standalone
// 'ridenepal_mysql' feedback table and is no longer what the app uses.)

import mysql from "mysql2/promise";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

config({ path: new URL("../.env.mysql", import.meta.url).pathname });

// Order matters: each file may ALTER tables/columns created by an earlier one.
const MIGRATION_FILES = [
  "schema-full.sql", // base tables + platform_settings
  "fix-rewards-schema.sql", // replaces rewards -> reward_catalog
  "vendor-marketplace.sql", // vendor role, vendor_profiles, vendor_reviews, bikes.vendor_id
  "add-vendor-location-and-stock.sql", // needs vendor_profiles + bikes from above
  "add-bulk-rent-vendor.sql",
  "fix-bulkrent-schema.sql",
  "fix-add-safety-features.sql", // login lockout columns + audit_log
  "fix-bikes-image-column.sql",
  "add-extensions.sql", // booking_extensions + payments.extension_id
  "fix-chat-schema.sql",
  "fix-gallery-schema.sql",
  "seed-bikes.sql", // demo bike listings (optional but useful for a demo)
];

async function main() {
  console.log("Connecting to MySQL at", process.env.MYSQL_HOST || "127.0.0.1", "...");

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    multipleStatements: true,
  });

  try {
    for (const file of MIGRATION_FILES) {
      const filePath = fileURLToPath(new URL(`./${file}`, import.meta.url));
      const sql = readFileSync(filePath, "utf8");
      console.log(`Running ${file} ...`);
      await connection.query(sql);
    }
    console.log("✅ Database 'ridenepal' is fully set up (schema + migrations + demo bikes).");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("❌ Setup failed:", err.message);
  console.error(
    "\nCheck that MySQL is running (8.0.29+, for ADD COLUMN IF NOT EXISTS support) and that mysql-demo/.env.mysql has the right credentials.",
  );
  process.exit(1);
});
