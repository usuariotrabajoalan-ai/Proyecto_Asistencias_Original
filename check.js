const { Client } = require('pg');
async function run() {
  const connectionString = 'postgresql://postgres.uwnqhalizmlzizfnhblp:Kt8AWKh*aPLY2Vt@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    const res = await client.query(SELECT table_name FROM information_schema.tables WHERE table_schema = 'public');
    console.log('Tables:', res.rows.map(r => r.table_name));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
