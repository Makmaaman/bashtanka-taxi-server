
import React from 'react'

export default function LandmarkPicker({ landmarks=[], onPick, label='Точки посадки' }){
  function handleChange(e){
    const id = e.target.value
    const opt = e.target.selectedOptions && e.target.selectedOptions[0]
    if(!opt) return
    let lat = parseFloat(opt.dataset.lat)
    let lon = parseFloat(opt.dataset.lon)
    let name = opt.textContent

    if(Number.isNaN(lat) || Number.isNaN(lon)){
      const lm = landmarks.find(l => String(l.id) == String(id))
      if(lm){ lat = parseFloat(lm.lat); lon = parseFloat(lm.lon); name = lm.name }
    }
    if(!Number.isNaN(lat) && !Number.isNaN(lon)){
      onPick && onPick({ id, name, lat, lon })
    }
  }

  return (
    <div style={{marginBottom:8}}>
      <label>{label}</label>
      <select defaultValue="" onChange={handleChange}>
        <option value="">— Оберіть місце —</option>
        {landmarks.map(l=> (
          <option key={l.id} value={l.id} data-lat={l.lat} data-lon={l.lon}>{l.name}</option>
        ))}
      </select>
    </div>
  )
}
