import Database from 'better-sqlite3'

const db = new Database(process.env.SQLITE_PATH || 'data.sqlite')
db.pragma('journal_mode = WAL')

db.exec(`
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

try { db.exec("ALTER TABLE orders ADD COLUMN canceled_by TEXT"); } catch (e) {}

export function seedLandmarks(){
  const c = db.prepare('SELECT COUNT(*) as c FROM landmarks').get().c
  if(c === 0){
    const ins = db.prepare('INSERT INTO landmarks (id,name,lat,lon,tags) VALUES (?,?,?,?,?)')
    ins.run('lm1', 'Центр Баштанки', 47.402778, 32.444167, 'центр')
    ins.run('lm2', 'Автостанція', 47.4042, 32.4467, 'транспорт')
  }
}

export default db
