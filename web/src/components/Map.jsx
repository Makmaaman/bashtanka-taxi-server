
import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// center expects [lon, lat]
export default function Map({ center=[32.444167,47.402778], zoom=14, marker, onClick, tileUrl }){
  const ref = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const markerAddedRef = useRef(false)

  const valid = (m) => !!m && Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lon))
  const toLngLat = (m) => ({ lng: Number(m.lon), lat: Number(m.lat) })

  useEffect(()=>{
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: [ tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' ],
            tileSize: 256,
            attribution: '© OpenStreetMap'
          }
        },
        layers: [{ id:'osm', type:'raster', source:'osm' }]
      },
      center,
      zoom
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'top-right')
    map.getCanvas().style.cursor = 'crosshair'
    map.touchZoomRotate.disableRotation()

    const handler = (e)=>{
      if (typeof onClick !== 'function') return
      let lnglat = null
      if (e && e.lngLat && Number.isFinite(e.lngLat.lng) && Number.isFinite(e.lngLat.lat)){
        lnglat = e.lngLat
      } else if (e && e.point && map.unproject){
        const p = map.unproject(e.point)
        if (p && Number.isFinite(p.lng) && Number.isFinite(p.lat)) lnglat = p
      }
      if (!lnglat) return
      onClick({ lat: Number(lnglat.lat), lon: Number(lnglat.lng) })
    }

    map.on('click', handler)
    map.on('mousedown', (e)=>{ if(e.originalEvent?.button===0) handler(e) })
    map.on('touchstart', handler)

    return ()=> {
      try { if (markerRef.current) markerRef.current.remove() } catch {}
      map.remove()
    }
  }, [])

  useEffect(()=>{
    const map = mapRef.current
    if(!map) return

    if(!valid(marker)){
      if (markerRef.current){
        try { markerRef.current.remove() } catch {}
        markerRef.current = null
      }
      markerAddedRef.current = false
      return
    }

    if(!markerRef.current){
      markerRef.current = new maplibregl.Marker()
      markerAddedRef.current = false
    }

    const lnglat = toLngLat(marker)

    try {
      markerRef.current.setLngLat(lnglat)
      if(!markerAddedRef.current){
        markerRef.current.addTo(map)
        markerAddedRef.current = true
      }
    } catch (e) {
      try { markerRef.current.remove() } catch {}
      markerRef.current = null
      markerAddedRef.current = false
      console.error('Marker update error', e)
    }
  }, [marker])

  return <div className="map" ref={ref} />
}
