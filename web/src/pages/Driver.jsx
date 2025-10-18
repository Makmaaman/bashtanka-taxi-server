import React, { useEffect, useMemo, useState, useRef } from 'react'
import { api } from '../api.js'
import { io } from 'socket.io-client'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
const socket = io(API_BASE, { transports:['websocket'] })

export default function Driver(){
  const [me, setMe] = useState(()=>{
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [profile, setProfile] = useState(null)
  const [driverId, setDriverId] = useState(null)
  const [pending, setPending] = useState([])
  const [mine, setMine] = useState([])
  const [declined, setDeclined] = useState({})
  const watchId = useRef(null)

  useEffect(()=>{ loadPending() }, [])
  useEffect(()=>{
    if(!me) return
    api.get('/api/driver/'+me.id+'/profile').then(r=>{
      setProfile(r.data); setDriverId(r.data.id)
      loadMine(r.data.id); loadPending(r.data.id)
    })
  }, [me])

  function login(){
    const phone = prompt('Телефон (водій, демо):')
    const name = prompt('Ваше ім’я (для пасажира):') || ''
    if(!phone) return
    api.post('/api/auth/login', { phone, name, role:'driver' }).then(r=>{
      localStorage.setItem('user', JSON.stringify(r.data.user))
      setMe(r.data.user)
    })
  }

  function saveProfile(){
    api.post('/api/driver/'+me.id+'/profile', profile).then(r=> setProfile(r.data))
  }

  function loadPending(did){
    const q = did ? ('?driverId='+did) : ''
    api.get('/api/orders/pending'+q).then(r=> setPending(r.data))
  }
  function loadMine(did){
    if(!did) return
    api.get('/api/orders/driver/'+did).then(r=> setMine(r.data))
  }

  function accept(ord){
    if(!driverId) return alert('Без профілю водія прийняти не можна')
    api.post('/api/orders/'+ord.id+'/accept', { driverId }).then(r=>{
      if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(pos=>{
          const origin = `${pos.coords.latitude},${pos.coords.longitude}`
          const waypoint = `${r.data.pickup_lat},${r.data.pickup_lon}`
          const dest = `${r.data.drop_lat},${r.data.drop_lon}`
          const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoint}&travelmode=driving`
          window.open(url, '_blank')
        })
      }
      loadPending(driverId); loadMine(driverId)
    }).catch(e=>{
      alert(e.response?.data?.error || 'Не вдалося прийняти')
      loadPending(driverId)
    })
  }
  function decline(ord){
    setDeclined(prev=> ({...prev, [ord.id]: true}))
    api.post('/api/orders/'+ord.id+'/decline', { driverId }).finally(()=> loadPending(driverId))
  }

  function startShare(){
    if(!driverId) return alert('Спочатку заповніть профіль')
    if(!navigator.geolocation) return alert('Геолокація недоступна')
    if(watchId.current) return
    watchId.current = navigator.geolocation.watchPosition(pos=>{
      socket.emit('driver:location', {
        driverId,
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        heading: pos.coords.heading || 0
      })
    }, ()=>{}, { enableHighAccuracy:true, maximumAge:1000, timeout:5000 })
  }
  function stopShare(){
    if(watchId.current){
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h3>Водій</h3>
        {!me ? <button onClick={login}>Увійти (демо)</button> :
          <div className="small">Ви увійшли як <b>{me.phone}</b></div>}
      </div>

      {me && (
        <div className="card">
          <h3>Мій профіль</h3>
          {profile ? (
            <div className="row">
              <div className="col">
                <label>Клас авто</label>
                <select value={profile.vehicle_class} onChange={e=>setProfile({...profile, vehicle_class:e.target.value})}>
                  <option value="eco">Eco</option>
                  <option value="comfort">Comfort</option>
                  <option value="van">Minivan</option>
                </select>
              </div>
              <div className="col">
                <label>Місць</label>
                <input value={profile.seats} onChange={e=>setProfile({...profile, seats:e.target.value})} />
              </div>
              <div className="col">
                <label>Номер авто</label>
                <input value={profile.plate} onChange={e=>setProfile({...profile, plate:e.target.value})} />
              </div>
              <div className="col" style={{alignSelf:'end'}}>
                <button onClick={saveProfile}>Зберегти</button>
              </div>
              <div className="col" style={{alignSelf:'end'}}>
                <button onClick={startShare}>Почати трансляцію локації</button>
                <button onClick={stopShare} style={{marginLeft:8}}>Зупинити</button>
              </div>
            </div>
          ) : (
            <div>Завантаження профілю...</div>
          )}
        </div>
      )}

      <div className="row">
        <div className="col">
          <div className="card">
            <h3>Очікують (pending)</h3>
            {pending.filter(o=>!declined[o.id]).map(o=>(
              <div key={o.id} className="row" style={{borderBottom:'1px solid #ddd', padding:'6px 0'}}>
                <div className="col">
                  <div className="small">ID: <b>{o.id}</b> • Клас: {o.class}</div>
                  <div className="small">Відстань ~ {(o.distance_m/1000).toFixed(1)} км • Ціна: <b>{o.price} грн</b></div>
                </div>
                <div className="col" style={{textAlign:'right'}}>
                  <button onClick={()=>accept(o)}>Прийняти</button>
                  <button onClick={()=>decline(o)} style={{marginLeft:8}}>Відхилити</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="col">
          <div className="card">
            <h3>Мої активні</h3>
            {mine.map(o=>(
              <div key={o.id} className="row" style={{borderBottom:'1px solid #ddd', padding:'6px 0'}}>
                <div className="col">
                  <div className="small">ID: <b>{o.id}</b> • Статус: <b>{o.status}</b></div>
                  <div className="small">Ціна: <b>{o.price} грн</b></div>
                </div>
                <div className="col" style={{textAlign:'right'}}>
                  <select defaultValue={o.status} onChange={(e)=>{
                    api.post('/api/orders/'+o.id+'/status', { status: e.target.value }).then(()=> loadMine(driverId))
                  }}>
                    <option value="assigned">assigned</option>
                    <option value="enroute">enroute</option>
                    <option value="arrived">arrived</option>
                    <option value="started">started</option>
                    <option value="completed">completed</option>
                    <option value="canceled">canceled</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
