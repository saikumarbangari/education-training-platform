import "dotenv/config";
import { closePool, transaction } from "../db.js";
import { seedCourses, seedAdministrator } from "../lib/seed-data.js";

try {
  const inserted = await transaction(async (runQuery) => {
    const count = await seedCourses(runQuery);
    // This explicit maintenance command can reset the configured administrator.
    await seedAdministrator(runQuery, { resetExisting: true });
    return count;
  });
  console.log(`Course seed checked; ${inserted} courses added.`);
} finally {
  await closePool();
}
