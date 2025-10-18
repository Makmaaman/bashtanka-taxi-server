// server/src/db.js
import 'dotenv/config';

const USE_PG = !!process.env.DATABASE_URL;

let db = null;
let seedLandmarks = async function(){};

if (USE_PG) {
  // ---------- Postgres ----------
  const { Pool } = await import('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000
  });

  // змінюємо sqlite-плейсхолдери ? на PG-стиль $1..$n
  function toPg(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  function prepare(sql) {
    const pgSql = toPg(sql);
    return {
      run: async (...params) => { await pool.query(pgSql, params); return { ok: true }; },
      get: async (...params) => { const r = await pool.query(pgSql, params); return r.rows[0] || null; },
      all: async (...params) => { const r = await pool.query(pgSql, params); return r.rows; }
    };
  }

  async function exec(sql) {
    const parts = sql.split(/;\s*$/m).filter(s => s.trim());
    for (const p of parts) await pool.query(p);
  }

  async function initSchema() {
    await exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE,
        name TEXT DEFAULT '',
        role TEXT
      );
      CREATE TABLE IF NOT EXISTS drivers (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE,
        vehicle_class TEXT,
        seats INTEGER,
        plate TEXT,
        active INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        driver_id TEXT,
        status TEXT,
        class TEXT,
        pickup_lat REAL,
        pickup_lon REAL,
        pickup_plus TEXT,
        pickup_comment TEXT,
        drop_lat REAL,
        drop_lon REAL,
        drop_plus TEXT,
        drop_comment TEXT,
        distance_m INTEGER,
        eta_s INTEGER,
        price INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        canceled_by TEXT
      );
      CREATE TABLE IF NOT EXISTS landmarks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        tags TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS order_decisions (
        order_id TEXT NOT NULL,
        driver_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(order_id, driver_id)
      );
    `);
  }

  seedLandmarks = async function(){
    const cRow = await prepare('SELECT COUNT(*) as c FROM landmarks').get();
    const c = Number(cRow?.c || 0);
    if (c === 0) {
      await prepare('INSERT INTO landmarks (id,name,lat,lon,tags) VALUES (?,?,?,?,?)')
        .run('lm1', 'Центр Баштанки', 47.402778, 32.444167, 'центр');
      await prepare('INSERT INTO landmarks (id,name,lat,lon,tags) VALUES (?,?,?,?,?)')
        .run('lm2', 'Автостанція', 47.4042, 32.4467, 'транспорт');
    }
  };

  await initSchema();

  db = {
    prepare,
    exec: async (sql) => exec(sql),
    pragma: () => {}
  };

} else {
  // ---------- SQLite ----------
  const { default: Database } = await import('better-sqlite3');
  const sqlite = new Database(process.env.SQLITE_PATH || 'data.sqlite');
  sqlite.pragma('journal_mode = WAL');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE,
      name TEXT DEFAULT '',
      role TEXT
    );
    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      vehicle_class TEXT,
      seats INTEGER,
      plate TEXT,
      active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      driver_id TEXT,
      status TEXT,
      class TEXT,
      pickup_lat REAL,
      pickup_lon REAL,
      pickup_plus TEXT,
      pickup_comment TEXT,
      drop_lat REAL,
      drop_lon REAL,
      drop_plus TEXT,
      drop_comment TEXT,
      distance_m INTEGER,
      eta_s INTEGER,
      price INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS landmarks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      tags TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS order_decisions (
      order_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(order_id, driver_id)
    );
  `);

  function prepare(sql){
    const st = sqlite.prepare(sql);
    return {
      run: (...params) => st.run(...params),
      get: (...params) => st.get(...params),
      all: (...params) => st.all(...params),
    };
  }

  seedLandmarks = async function(){
    const c = sqlite.prepare('SELECT COUNT(*) as c FROM landmarks').get().c;
    if (c === 0) {
      sqlite.prepare('INSERT INTO landmarks (id,name,lat,lon,tags) VALUES (?,?,?,?,?)')
        .run('lm1', 'Центр Баштанки', 47.402778, 32.444167, 'центр');
      sqlite.prepare('INSERT INTO landmarks (id,name,lat,lon,tags) VALUES (?,?,?,?,?)')
        .run('lm2', 'Автостанція', 47.4042, 32.4467, 'транспорт');
    }
  };

  db = {
    prepare,
    exec: (sql) => sqlite.exec(sql),
    pragma: (s) => sqlite.pragma(s)
  };
}

export { seedLandmarks };
export default db;
