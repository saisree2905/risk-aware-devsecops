const fs = require('fs');
const path = require('path');
const { getPool, closePool, sanitizeDbError } = require('./index');

async function runMigrations() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log('[Migration] Checking migration tracking table...');
    // Ensure migrations history table exists (outside transaction so it is always present)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Fetch applied migrations
    const { rows: appliedRows } = await client.query('SELECT name FROM schema_migrations ORDER BY id ASC');
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // Read migration files sorted alphabetically
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[Migration] No migrations directory found.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[Migration] Already applied: ${file}`);
        continue;
      }

      console.log(`[Migration] Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Execute transactionally
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[Migration] Successfully applied: ${file}`);
        appliedCount++;
      } catch (migrationErr) {
        await client.query('ROLLBACK');
        const sanitized = sanitizeDbError(migrationErr);
        console.error(`[Migration FAILED] ${file}:`, sanitized.message);
        throw new Error(`Migration ${file} failed and was rolled back.`);
      }
    }

    console.log(`[Migration] Finished. ${appliedCount} new migration(s) applied.`);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Migration Runner Error]:', err.message);
      await closePool();
      process.exit(1);
    });
}

module.exports = { runMigrations };
