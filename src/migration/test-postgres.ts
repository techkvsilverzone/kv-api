import { Pool } from 'pg';
import 'dotenv/config';

async function main() {
    const url = process.env.POSTGRES_MIGRATION_URL;

    if (!url) {
        throw new Error('POSTGRES_MIGRATION_URL is not set.');
    }

    const pool = new Pool({
        connectionString: url,
    });

    try {
        const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS user,
        version() AS version
    `);

        console.log('PostgreSQL connection successful.');
        console.log(`Database: ${result.rows[0].database}`);
        console.log(`User: ${result.rows[0].user}`);
        console.log(`Version: ${result.rows[0].version}`);
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error('PostgreSQL connection failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});