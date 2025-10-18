import React, { useEffect, useMemo, useState } from 'react'
import Map from '../components/Map.jsx'
import LandmarkPicker from '../components/LandmarkPicker.jsx'
import { api } from '../api.js'
import * as olc from 'open-location-code'
import { io } from 'socket.io-client'

const toPlus = (lat, lon) => (typeof olc.encode === 'function' ? olc.encode(lat, lon) : '')
const BASHTANKA = { lat: 47.402778, lon: 32.444167 } // Баштанка
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
const socket = io(API_BASE, { transports:['websocket'] })

export default function Passenger(){
  const [me, setMe] = useState(()=>{
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [landmarks, setLandmarks] = useState([])
  const [pickup, setPickup] = useState(null)
  const [drop, setDrop] = useState(null)
  const [klass, setKlass] = useState('eco')
  const [commentP, setCommentP] = useState('')
  const [commentD, setCommentD] = useState('')
  const [active, setActive] = useState(null)
  const [driverInfo, setDriverInfo] = useState(null)
  const [carMarker, setCarMarker] = useState(null)

  useEffect(()=>{ api.get('/api/landmarks').then(r=>setLandmarks(r.data)) }, [])

  useEffect(()=>{
    const savedId = localStorage.getItem('activeOrderId')
    if(savedId){
      api.get('/api/orders/'+savedId).then(r=> setActive(r.data)).catch(()=>{})
    }
  }, [])

  useEffect(()=>{
    if(!me) return
    function onUpdate(ord){
      if(active && ord.id === active.id){
        setActive(ord)
        localStorage.setItem('activeOrderId', ord.id)
        if(ord.driver_id) loadDriver(ord.driver_id)
      }
    }
    socket.on('order:update', onUpdate)
    return ()=> socket.off('order:update', onUpdate)
  }, [me, active])

  useEffect(()=>{
    function onLoc(p){
      if(!active || !active.driver_id) return
      if(p.driverId !== active.driver_id) return
      setCarMarker({ lat: p.lat, lon: p.lon })
    }
    socket.on('driver:location', onLoc)
    return ()=> socket.off('driver:location', onLoc)
  }, [active])

  function login(){
    const phone = prompt('Ваш телефон:')
    const name = prompt('Ваше ім’я:') || ''
    if(!phone) return
    api.post('/api/auth/login', { phone, name, role:'passenger' }).then(r=>{
      localStorage.setItem('user', JSON.stringify(r.data.user))
      setMe(r.data.user)
      refreshOrders(r.data.user.id)
    })
  }

  function refreshOrders(uid){
    api.get('/api/orders/user/'+uid).then(r=>{
      const list = r.data
      const act = list.find(o=> ['assigned','enroute','arrived','started'].includes(o.status)) || list.find(o=>o.status==='pending')
      setActive(act || null)
      if(act){
        localStorage.setItem('activeOrderId', act.id)
        if(act.driver_id) loadDriver(act.driver_id)
      } else {
        localStorage.removeItem('activeOrderId')
      }
    })
  }

  function loadDriver(driverId){
    api.get('/api/drivers/'+driverId).then(r=> setDriverInfo(r.data)).catch(()=> setDriverInfo(null))
  }

  function createOrder(){
    if(!me) return alert('Спочатку увійдіть')
    if(!pickup || !drop) return alert('Оберіть місця посадки та висадки')
    api.post('/api/orders', {
      userId: me.id,
      klass,
      pickup: {lat:pickup.lat, lon:pickup.lon},
      drop: {lat:drop.lat, lon:drop.lon},
      commentPickup: commentP, commentDrop: commentD
    }).then(r=> {
      setActive(r.data)
      localStorage.setItem('activeOrderId', r.data.id)
      setDriverInfo(null)
    })
  }

  function cancelOrder(){
    if(!active) return
    api.post('/api/orders/'+active.id+'/cancel', { by: 'passenger' }).then(r=>{
      setActive(r.data)
      localStorage.removeItem('activeOrderId')
    })
  }

  const tileUrl = import.meta.env.VITE_TILE_URL

  return (
    <div className="container">
      <div className="row">
        <div className="col">
          <div className="card">
            <h3>Пасажир</h3>
            {!me ? <button onClick={login}>Увійти / Зареєструватись</button> :
              <div className="small">Ви увійшли як <b>{me.phone}</b></div>}
            <div className="row" style={{marginTop:8}}>
              <div className="col">
                <label>Точка посадки</label>
                <LandmarkPicker landmarks={landmarks} onPick={(lm)=> setPickup({ lat: lm.lat, lon: lm.lon, plus: toPlus(lm.lat,lm.lon) })} label="Точки посадки" />
                <label>Або виберіть на мапі (клік)</label>
                <Map center={[BASHTANKA.lon, BASHTANKA.lat]} zoom={14} tileUrl={tileUrl}
                     marker={pickup} onClick={(p)=>setPickup({ ...p, plus: toPlus(p.lat,p.lon) })} />
                {pickup && <div className="small">
                  Pickup: {pickup.lat?.toFixed?.(5)}, {pickup.lon?.toFixed?.(5)} • Plus Code: <b>{pickup.plus}</b>
                </div>}
                <label>Коментар для посадки</label>
                <input value={commentP} onChange={e=>setCommentP(e.target.value)} placeholder="Напр.: в арку, біля банкомату" />
              </div>
              <div className="col">
                <label>Точка висадки</label>
                <LandmarkPicker landmarks={landmarks} onPick={(lm)=> setDrop({ lat: lm.lat, lon: lm.lon, plus: toPlus(lm.lat,lm.lon) })} label="Точки висадки" />
                <label>Або виберіть на мапі (клік)</label>
                <Map center={[BASHTANKA.lon, BASHTANKA.lat]} zoom={14} tileUrl={tileUrl}
                     marker={drop} onClick={(p)=>setDrop({ ...p, plus: toPlus(p.lat,p.lon) })} />
                {drop && <div className="small">
                  Drop: {drop.lat?.toFixed?.(5)}, {drop.lon?.toFixed?.(5)} • Plus Code: <b>{drop.plus}</b>
                </div>}
                <label>Коментар для висадки</label>
                <input value={commentD} onChange={e=>setCommentD(e.target.value)} placeholder="Напр.: лівий вхід, 3 під'їзд" />
              </div>
            </div>
            <div className="row">
              <div className="col">
                <label>Клас авто</label>
                <select value={klass} onChange={e=>setKlass(e.target.value)}>
                  <option value="eco">Eco</option>
                  <option value="comfort">Comfort</option>
                  <option value="van">Minivan</option>
                </select>
              </div>
              <div className="col" style={{alignSelf:'end'}}>
                <button onClick={createOrder}>Замовити</button>
                {active && <button onClick={cancelOrder} style={{marginLeft:8}}>Скасувати</button>}
              </div>
            </div>
          </div>

          {active && (
            <div className="card">
              <h3>Статус поїздки</h3>
              <div className="small">ID: <b>{active.id}</b> • Статус: <b>{active.status}</b> • Ціна: <b>{active.price} грн</b></div>
              {driverInfo ? (
                <div className="small">
                  Водій: <b>{driverInfo.user_name || '—'}</b> • Телефон: <b>{driverInfo.user_phone}</b> • Авто: <b>{driverInfo.vehicle_class}</b> • Номер: <b>{driverInfo.plate || '—'}</b>
                </div>
              ) : (
                <div className="small">Шукаємо водія…</div>
              )}
              <div className="row" style={{marginTop:8}}>
                <div className="col">
                  <label>Карта (машина рухається)</label>
                  <Map center={[BASHTANKA.lon, BASHTANKA.lat]} zoom={14} tileUrl={tileUrl}
                       marker={carMarker} onClick={()=>{}} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
