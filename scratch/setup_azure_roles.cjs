const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const client = new pg.Client({
  host: 'us24-vob-db.postgres.database.azure.com',
  port: 5432,
  user: 'us24admin',
  password: 'Ankitsingh@123',
  database: 'vob',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to vob database on Azure PostgreSQL.');

  const check = await client.query("SELECT rolname FROM pg_roles WHERE rolname = 'app_role';");
  if (check.rowCount === 0) {
    console.log('Creating app_role with LOGIN and NOBYPASSRLS...');
    await client.query("CREATE ROLE app_role WITH LOGIN PASSWORD 'AppRole@2026Secure!' NOBYPASSRLS;");
    console.log('✓ app_role created successfully!');
  } else {
    console.log('app_role already exists, ensuring LOGIN and NOBYPASSRLS...');
    await client.query("ALTER ROLE app_role WITH LOGIN PASSWORD 'AppRole@2026Secure!' NOBYPASSRLS;");
    console.log('✓ app_role updated successfully!');
  }

  await client.query("GRANT USAGE ON SCHEMA public TO app_role;");
  await client.query("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_role;");
  await client.query("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_role;");
  await client.query("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_role;");
  await client.query("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_role;");
  console.log('✓ Grants for app_role configured successfully!');
}

run().catch(e => console.error('Error:', e.message)).finally(() => client.end());
