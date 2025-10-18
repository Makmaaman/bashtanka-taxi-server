
import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import { io } from 'socket.io-client'

export default function Admin(){
  const [me, setMe] = useState(()=>{
    const saved = localStorage.getItem('admin')
    return saved ? JSON.parse(saved) : null
  })
  const [landmarks, setLandmarks] = useState([])
  const [form, setForm] = useState({ name:'', lat:'', lon:'', tags:'' })

  useEffect(()=>{
    api.get('/api/landmarks').then(r=> setLandmarks(r.data)).catch(()=>{})
    const s = io(import.meta.env.VITE_API_BASE || 'http://localhost:4000', { transports:['websocket'] })
    s.on('landmarks:update', (rows)=> setLandmarks(rows))
    return ()=> s.close()
  }, [])

  function login(){
    const phone = prompt('Телефон адміна (демо):')
    if(!phone) return
    api.post('/api/auth/login', { phone, role:'admin', name:'Admin' })
      .then(r=>{ localStorage.setItem('admin', JSON.stringify(r.data.user)); setMe(r.data.user) })
      .catch(err=> alert('Логін не вдався: ' + (err.response?.data?.error || '')))
  }

  function addLm(){
    const lat = parseFloat(form.lat), lon=parseFloat(form.lon)
    if(!form.name || Number.isNaN(lat) || Number.isNaN(lon)) return alert('Перевірте поля')
    api.post('/api/landmarks', { name: form.name, lat, lon, tags: form.tags||'' })
      .then(()=>{
        setForm({ name:'', lat:'', lon:'', tags:'' })
      })
      .catch(err=> alert('Не вдалося додати точку: ' + (err.response?.data?.error || '')))
  }
  function delLm(id){
    if(!confirm('Видалити точку?')) return
    api.delete('/api/landmarks/'+id).catch(()=>{})
  }

  return (
    <div className="container">
      <div className="card">
        <h3>Адмін-панель</h3>
        {!me ? <button onClick={login}>Увійти (демо)</button> :
          <div className="small">Ви увійшли як <b>{me.phone}</b></div>}
      </div>

      <div className="card">
        <h3>Landmarks (Точки посадки)</h3>
        <div className="row">
          <div className="col">
            <label>Назва</label>
            <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Напр.: Ринок" />
          </div>
          <div className="col">
            <label>Широта (lat)</label>
            <input value={form.lat} onChange={e=>setForm({...form, lat:e.target.value})} placeholder="47.4028" />
          </div>
          <div className="col">
            <label>Довгота (lon)</label>
            <input value={form.lon} onChange={e=>setForm({...form, lon:e.target.value})} placeholder="32.4442" />
          </div>
          <div className="col">
            <label>Теги</label>
            <input value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})} placeholder="пошта, банк..." />
          </div>
        </div>
        <div style={{marginTop:8}}><button onClick={addLm}>Додати</button></div>

        <table style={{marginTop:12}}>
          <thead><tr><th>Назва</th><th>Lat</th><th>Lon</th><th>Tags</th><th></th></tr></thead>
          <tbody>
            {landmarks.map(l=>(
              <tr key={l.id}>
                <td>{l.name}</td><td>{(+l.lat).toFixed(6)}</td><td>{(+l.lon).toFixed(6)}</td><td>{l.tags}</td>
                <td><button onClick={()=>delLm(l.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
