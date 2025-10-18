import React from 'react'

export default function OrderCard({ o, onAccept, compact }){
  return (
    <div className="card" style={{padding: compact? '8px 10px':'14px'}}>
      <div><b>Order:</b> {o.id}</div>
      <div className="small">Status: {o.status} • Class: {o.class}</div>
      <div className="small">Price: <b>{o.price} грн</b> • Dist: {(o.distance_m/1000).toFixed(1)} км • ETA: {Math.round(o.eta_s/60)} хв</div>
      {onAccept && o.status==='pending' && <button onClick={()=>onAccept(o)}>Прийняти</button>}
    </div>
  )
}