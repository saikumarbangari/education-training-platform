import { readFile } from "node:fs/promises";
import { transaction } from "./db.js";
import { seedAdministrator, seedCourses } from "./lib/seed-data.js";
import { resetAdministratorPassword } from "./lib/reset-admin-password.js";

// Free hosts do not provide a separate migration job. Run setup before listening.
export async function prepareDatabase(env = process.env) {
  const schema = await readFile(
    new URL("./db/schema.sql", import.meta.url),
    "utf8",
  );
  const passwordReset = await transaction(async (runQuery) => {
    await runQuery(schema);
    const setup = await runQuery(
      `INSERT INTO application_setup (name) VALUES ('initial-catalogue')
       ON CONFLICT DO NOTHING RETURNING name`,
    );
    if (setup.rowCount) {
      const result = await runQuery("SELECT COUNT(*) AS count FROM courses");
      // Preserve an already-populated catalogue when upgrading an existing database.
      if (Number(result.rows[0].count) === 0) await seedCourses(runQuery, env);
    }
    if (env.ADMIN_PASSWORD_RESET_REQUEST) {
      return resetAdministratorPassword(runQuery, env);
    }
    await seedAdministrator(runQuery, { env });
    return false;
  });
  if (passwordReset) {
    console.log(
      "Administrator password reset completed; previous administrator sessions revoked.",
    );
  }
}
