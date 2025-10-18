import React, { useEffect, useState } from 'react'
import Passenger from './pages/Passenger.jsx'
import Driver from './pages/Driver.jsx'
import Admin from './pages/Admin.jsx'

export default function App(){
  const [route, setRoute] = useState(window.location.hash || '#/passenger')
  useEffect(()=>{
    const onHash = ()=> setRoute(window.location.hash || '#/passenger')
    window.addEventListener('hashchange', onHash)
    return ()=> window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <>
      <header>
        <div className="brand">🚕 Bashtanka Taxi</div>
        <div className="badge kbd">PWA</div>
        <nav style={{marginLeft:'auto', display:'flex', gap:6}}>
          <a className="badge" href="#/passenger">Passenger</a>
          <a className="badge" href="#/driver">Driver</a>
          <a className="badge" href="#/admin">Admin</a>
        </nav>
      </header>
      {route.startsWith('#/driver') ? <Driver/> :
       route.startsWith('#/admin') ? <Admin/> : <Passenger/>}
      <footer className="small">© 2025 Bashtanka Taxi MVP • Map data © OpenStreetMap contributors</footer>
    </>
  )
}