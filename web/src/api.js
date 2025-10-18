import axios from 'axios'
const base = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
export const api = axios.create({ baseURL: base })

export function getSocketUrl(){
  return base.replace(/^http/,'ws')
}