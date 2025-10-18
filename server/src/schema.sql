PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  name TEXT,
  role TEXT CHECK (role IN ('passenger','driver','admin')) NOT NULL,
  rating REAL DEFAULT 5.0
);

CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  vehicle_class TEXT CHECK (vehicle_class IN ('eco','comfort','van')) DEFAULT 'eco',
  seats INTEGER DEFAULT 4,
  plate TEXT,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  driver_id TEXT UNIQUE,
  make TEXT, model TEXT, color TEXT, plate TEXT,
  class TEXT CHECK (class IN ('eco','comfort','van')) DEFAULT 'eco',
  seats INTEGER DEFAULT 4,
  FOREIGN KEY (driver_id) REFERENCES drivers(id)
);

CREATE TABLE IF NOT EXISTS landmarks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  tags TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  driver_id TEXT,
  status TEXT CHECK (status IN ('pending','assigned','enroute','arrived','started','completed','canceled')) DEFAULT 'pending',
  class TEXT CHECK (class IN ('eco','comfort','van')) DEFAULT 'eco',
  pickup_lat REAL, pickup_lon REAL, pickup_plus TEXT, pickup_comment TEXT,
  drop_lat REAL, drop_lon REAL, drop_plus TEXT, drop_comment TEXT,
  distance_m REAL DEFAULT 0,
  eta_s INTEGER DEFAULT 0,
  price REAL DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (driver_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  method TEXT,
  amount REAL,
  status TEXT,
  provider_ref TEXT,
  created_at INTEGER,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);