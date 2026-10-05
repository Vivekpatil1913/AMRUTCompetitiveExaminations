const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
});

// Return DATE columns as 'YYYY-MM-DD' strings (avoids timezone shifts in display)
require('pg').types.setTypeParser(1082, (v) => v);

const q = (text, params) => pool.query(text, params);
const many = async (text, params) => (await pool.query(text, params)).rows;
const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;

module.exports = { pool, q, many, one };
