// mysql-demo/db.mjs
//
// Connection pool for the local MySQL "Feedback / Support Messages" feature.
// Reads connection details from environment variables (see .env.mysql.example).
//
// This module is intentionally separate from src/ — it is NOT deployed to
// Cloudflare Workers, since Workers can't use TCP-based MySQL drivers like
// mysql2. It's meant to be run locally with plain Node.js.

import mysql from "mysql2/promise";
import { config } from "dotenv";

config({ path: new URL("../.env.mysql", import.meta.url).pathname });

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "ridenepal_mysql",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

export default pool;
