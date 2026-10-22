import { createClient } from '@supabase/supabase-js'
import { get, set } from 'idb-keyval'
export const sb = createClient('https://hnzxnmroevtufggxkllz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuenhubXJvZXZ0dWZnZ3hrbGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODk5ODAsImV4cCI6MjEwODI2NTk4MH0.ehui8EDKJh2Bl6AFjHLRgFS69l1idzWjvdllKPpeGd8', { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
export const gs = (n: number) => 'Gs. ' + Math.round(Number(n) || 0).toLocaleString('es-AR')
export const uid = () => crypto.randomUUID()
export const fdate = (d?: string) => d ? new Date(d + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Sin fecha'
export const daysTo = (d?: string) => d ? Math.ceil((new Date(d + 'T00:00').getTime() - Date.now()) / 864e5) : 0

// Deudas simplificadas: saldo neto por persona + emparejamiento greedy (mínimo de transferencias)
export function settle(expenses: any[]) {
  const bal: Record<string, number> = {}
  for (const e of expenses) {
    const s = e.split_between || []; if (!s.length || !e.paid_by) continue
    bal[e.paid_by] = (bal[e.paid_by] || 0) + Number(e.amount)
    for (const u of s) bal[u] = (bal[u] || 0) - Number(e.amount) / s.length
  }
  let cs = Object.entries(bal).filter(([, v]) => v > 0.5).map(([u, v]) => ({ u, v }))
  let ds = Object.entries(bal).filter(([, v]) => v < -0.5).map(([u, v]) => ({ u, v }))
  const out: { from: string; to: string; amt: number }[] = []
  while (cs.length && ds.length) {
    cs.sort((a, b) => b.v - a.v); ds.sort((a, b) => a.v - b.v)
    const m = Math.min(cs[0].v, -ds[0].v)
    out.push({ from: ds[0].u, to: cs[0].u, amt: m }); cs[0].v -= m; ds[0].v += m
    cs = cs.filter(x => x.v > 0.5); ds = ds.filter(x => x.v < -0.5)
  }
  return out
}
export const cache = { get, set }
