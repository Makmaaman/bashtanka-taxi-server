import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { nanoid } from 'nanoid';
import db, { seedLandmarks } from './db.js';
import { estimate } from './pricing.js';
import { haversineKm, plusCode, nowSec } from './utils.js';

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });

seedLandmarks();

const q = {
  insUser: db.prepare('INSERT INTO users (id,phone,name,role) VALUES (?,?,?,?)'),
  getUserByPhone: db.prepare('SELECT * FROM users WHERE phone=?'),
  upsertDriver: db.prepare('INSERT INTO drivers (id,user_id,vehicle_class,seats,plate,active) VALUES (?,?,?,?,?,?) '
    + 'ON CONFLICT(user_id) DO UPDATE SET vehicle_class=excluded.vehicle_class, seats=excluded.seats, plate=excluded.plate, active=excluded.active'),
  getDriverByUser: db.prepare('SELECT d.*, u.phone as user_phone, u.name as user_name FROM drivers d JOIN users u ON d.user_id=u.id WHERE d.user_id=?'),
  getDriverById: db.prepare('SELECT d.*, u.phone as user_phone, u.name as user_name FROM drivers d JOIN users u ON d.user_id=u.id WHERE d.id=?'),
  insOrder: db.prepare(`INSERT INTO orders 
    (id,user_id,status,class,pickup_lat,pickup_lon,pickup_plus,pickup_comment,drop_lat,drop_lon,drop_plus,drop_comment,distance_m,eta_s,price,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  updOrderStatus: db.prepare('UPDATE orders SET status=?, driver_id=?, updated_at=? WHERE id=?'),
  updOrderOnlyStatus: db.prepare('UPDATE orders SET status=?, updated_at=? WHERE id=?'),
  getPendingOrders: db.prepare("SELECT * FROM orders WHERE status='pending' ORDER BY created_at ASC"),
  getPendingOrdersFiltered: db.prepare(`
    SELECT * FROM orders o
    WHERE o.status='pending' AND NOT EXISTS (
      SELECT 1 FROM order_decisions d
      WHERE d.order_id=o.id AND d.driver_id=? AND d.decision='declined'
    )
    ORDER BY o.created_at ASC
  `),
  getDriverOrders: db.prepare("SELECT * FROM orders WHERE driver_id=? AND status IN ('assigned','enroute','arrived','started') ORDER BY created_at DESC"),
  getUserOrders: db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC'),
  getOrder: db.prepare('SELECT * FROM orders WHERE id=?'),
  listLandmarks: db.prepare('SELECT * FROM landmarks ORDER BY name ASC'),
  insLandmark: db.prepare('INSERT INTO landmarks (id,name,lat,lon,tags) VALUES (?,?,?,?,?)'),
  delLandmark: db.prepare('DELETE FROM landmarks WHERE id=?'),
  insDecision: db.prepare('INSERT OR REPLACE INTO order_decisions (order_id,driver_id,decision,created_at) VALUES (?,?,?,?)'),
  removeDecisions: db.prepare('DELETE FROM order_decisions WHERE order_id=?')
};

app.post('/api/auth/login', (req,res) => {
  const { phone, name='', role } = req.body;
  if (!phone || !['passenger','driver','admin'].includes(role)) return res.status(400).json({ error: 'phone and role required' });
  let user = q.getUserByPhone.get(phone);
  if(!user){
    const id = nanoid();
    q.insUser.run(id, phone, name, role);
    user = q.getUserByPhone.get(phone);
  }
  if(role === 'driver'){
    q.upsertDriver.run(nanoid(), user.id, 'eco', 4, '', 1);
  }
  res.json({ user });
});

app.get('/api/driver/:userId/profile', (req,res)=>{
  const row = q.getDriverByUser.get(req.params.userId);
  if(!row) return res.status(404).json({error:'driver not found'});
  res.json(row);
});
app.post('/api/driver/:userId/profile', (req,res)=>{
  const { vehicle_class='eco', seats=4, plate='', active=1 } = req.body || {};
  q.upsertDriver.run(nanoid(), req.params.userId, vehicle_class, Number(seats)||4, String(plate), active?1:0);
  const row = q.getDriverByUser.get(req.params.userId);
  res.json(row);
});
app.get('/api/drivers/:driverId', (req,res)=>{
  const row = q.getDriverById.get(req.params.driverId);
  if(!row) return res.status(404).json({error:'not found'});
  res.json(row);
});

app.get('/api/landmarks', (req,res)=>{
  try{ res.json(q.listLandmarks.all()); }catch(e){ res.status(500).json({error:e.message}); }
});
app.post('/api/landmarks', (req,res)=>{
  try{
    const { name, lat, lon, tags } = req.body;
    const latNum = Number(lat), lonNum = Number(lon);
    if(!name || Number.isNaN(latNum) || Number.isNaN(lonNum)) return res.status(400).json({error:'bad landmark: name/lat/lon'});
    q.insLandmark.run(nanoid(), name, latNum, lonNum, tags || '');
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});
app.delete('/api/landmarks/:id', (req,res)=>{
  try{ q.delLandmark.run(req.params.id); res.json({ok:true}); }catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/api/orders/pending', (req,res)=>{
  const { driverId } = req.query;
  if(driverId){
    res.json(q.getPendingOrdersFiltered.all(driverId));
  } else {
    res.json(q.getPendingOrders.all());
  }
});
app.get('/api/orders/user/:userId', (req,res)=>{
  res.json(q.getUserOrders.all(req.params.userId));
});
app.get('/api/orders/driver/:driverId', (req,res)=>{
  res.json(q.getDriverOrders.all(req.params.driverId));
});
app.get('/api/orders/:id', (req,res)=>{
  const row = q.getOrder.get(req.params.id);
  if(!row) return res.status(404).json({error:'not found'});
  res.json(row);
});

app.post('/api/orders', (req,res)=>{
  const { userId, klass='eco', pickup, drop, commentPickup='', commentDrop='' } = req.body;
  if(!userId || !pickup || !drop) return res.status(400).json({error:'bad order'});
  const km = haversineKm(pickup.lat, pickup.lon, drop.lat, drop.lon);
  const minutes = Math.max(5, Math.round(km * 2));
  const price = estimate({km, minutes, klass});
  const id = nanoid();
  const now = nowSec();
  db.prepare('INSERT INTO orders (id,user_id,status,class,pickup_lat,pickup_lon,pickup_plus,pickup_comment,drop_lat,drop_lon,drop_plus,drop_comment,distance_m,eta_s,price,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, userId, 'pending', klass, pickup.lat, pickup.lon, plusCode(pickup.lat, pickup.lon), commentPickup, drop.lat, drop.lon, plusCode(drop.lat, drop.lon), commentDrop, Math.round(km*1000), minutes*60, price, now, now);
  q.removeDecisions.run(id)
  const order = q.getOrder.get(id);
  io.emit('order:new', order);
  res.json(order);
});

app.post('/api/orders/:id/accept', (req,res)=>{
  const { driverId } = req.body;
  const ord = q.getOrder.get(req.params.id);
  if(!ord) return res.status(404).json({error:'not found'});
  if(ord.status !== 'pending') return res.status(409).json({error:'already taken'});
  q.updOrderStatus.run('assigned', driverId, nowSec(), ord.id);
  const updated = q.getOrder.get(ord.id);
  io.emit('order:update', updated);
  res.json(updated);
});

app.post('/api/orders/:id/decline', (req,res)=>{
  const { driverId } = req.body;
  if(!driverId) return res.status(400).json({error:'driverId required'});
  q.insDecision.run(req.params.id, driverId, 'declined', nowSec());
  res.json({ok:true});
});

app.post('/api/orders/:id/cancel', (req,res)=>{
  const { by='system' } = req.body || {};
  const ord = q.getOrder.get(req.params.id);
  if(!ord) return res.status(404).json({error:'not found'});
  db.prepare('UPDATE orders SET status=?, canceled_by=?, updated_at=? WHERE id=?')
    .run('canceled', String(by), nowSec(), ord.id);
  const updated = q.getOrder.get(ord.id);
  io.emit('order:update', updated);
  res.json(updated);
});

app.post('/api/orders/:id/status', (req,res)=>{
  const { status } = req.body;
  const ord = q.getOrder.get(req.params.id);
  if(!ord) return res.status(404).json({error:'not found'});
  const allowed = ['assigned','enroute','arrived','started','completed','canceled'];
  if(!allowed.includes(status)) return res.status(400).json({error:'bad status'});
  q.updOrderOnlyStatus.run(status, nowSec(), ord.id);
  const updated = q.getOrder.get(ord.id);
  io.emit('order:update', updated);
  res.json(updated);
});

import { fileURLToPath } from 'url'
import path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
app.get('/', (_, res)=> res.json({ ok: true }))

io.on('connection', (socket)=>{
  socket.on('driver:location', (payload)=> io.emit('driver:location', payload));
});

httpServer.listen(PORT, ()=>{
  console.log('Server listening on http://localhost:'+PORT);
});
