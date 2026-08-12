// mysql-demo/demo.mjs
//
// Run: `npm run mysql:demo`
// Demonstrates full CRUD against the MySQL-backed feedback_messages table:
// Create -> Read -> Update -> Delete. Good for a screenshot/video for your
// project report showing MySQL actually working.

import pool from "./db.mjs";

async function main() {
  console.log("=== RideNepal MySQL Feedback Demo ===\n");

  // CREATE
  const [insertResult] = await pool.execute(
    `INSERT INTO feedback_messages (name, email, subject, message, category)
     VALUES (:name, :email, :subject, :message, :category)`,
    {
      name: "Sapun Shrestha",
      email: "sapun@example.com",
      subject: "Great experience with the eSewa payment",
      message: "Booking flow was smooth, just wanted to say thanks!",
      category: "payment",
    },
  );
  const newId = insertResult.insertId;
  console.log(`CREATE -> inserted feedback message with id ${newId}`);

  // READ
  const [rows] = await pool.query(
    "SELECT id, name, subject, category, status, created_at FROM feedback_messages ORDER BY created_at DESC LIMIT 5",
  );
  console.log("\nREAD -> latest 5 feedback messages:");
  console.table(rows);

  // UPDATE
  await pool.execute(
    "UPDATE feedback_messages SET status = :status, resolved_at = NOW() WHERE id = :id",
    { status: "resolved", id: newId },
  );
  console.log(`\nUPDATE -> marked message ${newId} as resolved`);

  const [[updatedRow]] = await pool.query(
    "SELECT id, status, resolved_at FROM feedback_messages WHERE id = :id",
    { id: newId },
  );
  console.log(updatedRow);

  await pool.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Demo failed:", err.message);
  process.exit(1);
});
