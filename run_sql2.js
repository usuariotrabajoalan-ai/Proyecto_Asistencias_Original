const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const connectionString = 'postgresql://postgres.uwnqhalizmlzizfnhblp:Kt8AWKh*aPLY2Vt@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    const sql = fs.readFileSync('create_tables.sql', 'utf8');
    await client.query(sql);
    console.log('Tables created successfully');
    
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

run();
