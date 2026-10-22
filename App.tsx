import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { sb, gs, uid, fdate, daysTo, settle, cache } from './lib'

const go = (p: string) => { history.pushState({}, '', p); window.dispatchEvent(new Event('popstate')) }
const KEYS: any = { bookings: 'bookings', expenses: 'expenses', places: 'places', place_votes: 'votes', todos: 'todos' }

function useTrip(id: string) {
  const [d, setD] = useState<any>(null), [off, setOff] = useState(false), tm = useRef<any>()
  const load = useCallback(async () => {
    try {
      const q = (t: string) => sb.from(t).select(t === 'trip_members' ? '*,profiles(name,avatar_color)' : '*').eq(...(t === 'place_votes' ? ['place_id', 'x'] : ['trip_id', id]) as [string, string])
      const [t, b, e, p, v, td, m] = await Promise.all([
        sb.from('trips').select().eq('id', id).single(), q('bookings'), q('expenses'), q('places'),
        sb.from('place_votes').select(), q('todos'), q('trip_members')])
      if (t.error) throw t.error
      const nd = { trip: t.data, bookings: b.data, expenses: e.data, places: p.data, votes: v.data, todos: td.data, members: m.data }
      setD(nd); setOff(false); cache.set('trip:' + id, nd)
    } catch { const c = await cache.get('trip:' + id); if (c) { setD(c); setOff(true) } }
  }, [id])
  useEffect(() => {
    load()
    const ch = sb.channel('trip-' + id)
    for (const t of ['bookings', 'expenses', 'places', 'todos', 'trip_members'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `trip_id=eq.${id}` }, () => { clearTimeout(tm.current); tm.current = setTimeout(load, 150) })
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${id}` }, load)
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'place_votes' }, load)
    ch.subscribe()
    return () => { sb.removeChannel(ch) }
  }, [id, load])
  // Escritura optimista: actualiza el estado local y después escribe; si falla, recarga.
  const mut = async (t: string, op: 'upsert' | 'delete', row: any) => {
    if (t === 'trips') setD((s: any) => ({ ...s, trip: { ...s.trip, ...row } }))
    else { const k = KEYS[t], same = (a: any) => t === 'place_votes' ? a.place_id === row.place_id && a.user_id === row.user_id : a.id === row.id
      setD((s: any) => ({ ...s, [k]: op === 'delete' ? s[k].filter((a: any) => !same(a)) : s[k].some(same) ? s[k].map((a: any) => same(a) ? { ...a, ...row } : a) : [...s[k], row] })) }
    const r = op === 'delete' ? await sb.from(t).delete().match(t === 'place_votes' ? { place_id: row.place_id, user_id: row.user_id } : { id: row.id }) : await sb.from(t).upsert(row)
    if (r.error) { alert('No se pudo guardar: ' + r.error.message); load() } else if (t === 'bookings') setTimeout(load, 400)
  }
  return { d, off, mut, load }
}

const Cross = () => <>{['top-1 left-1', 'top-1 right-1', 'bottom-1 left-1', 'bottom-1 right-1'].map(c => <span key={c} className={`absolute ${c} text-[10px] leading-none text-accd`}>+</span>)}</>
const Skel = () => <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-surf animate-pulse" />)}</div>
const Empty = ({ t, a, f }: any) => <div className="border border-dashed border-line p-6 text-center"><p className="text-ink/70 mb-3">{t}</p><button className="btn" onClick={f}>{a}</button></div>

function Sheet({ title, onClose, children }: any) {
  return <div className="fixed inset-0 z-50 flex items-end bg-ink/40" onClick={onClose}>
    <div className="w-full max-h-[90%] overflow-auto bg-bg border-t border-ink p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-3"><h2 className="t text-2xl">{title}</h2><button className="min-w-[44px] min-h-[44px] t text-xl" onClick={onClose}>✕</button></div>{children}</div></div>
}
// Formulario genérico dentro del bottom sheet
function Form({ title, fields, init, onSave, onClose, onDelete, members }: any) {
  const [v, setV] = useState<any>(init || {})
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))
  return <Sheet title={title} onClose={onClose}>
    <div className="space-y-3">{fields.map((f: any) => <label key={f.k} className="block"><span className="lbl">{f.l}</span>
      {f.t === 'select' ? <select className="inp" value={v[f.k] ?? ''} onChange={e => set(f.k, e.target.value)}>{f.o.map((o: any) => <option key={o[0] ?? o} value={o[0] ?? o}>{o[1] ?? o}</option>)}</select>
        : f.t === 'check' ? <input type="checkbox" className="block w-6 h-6 mt-2" checked={!!v[f.k]} onChange={e => set(f.k, e.target.checked)} />
        : f.t === 'multi' ? <div className="flex flex-wrap gap-2 mt-1">{members.map((m: any) => { const on = (v[f.k] || []).includes(m.user_id); return <button type="button" key={m.user_id} className={`min-h-[44px] px-3 border ${on ? 'bg-acc text-bg border-acc' : 'border-line'}`} onClick={() => set(f.k, on ? v[f.k].filter((x: string) => x !== m.user_id) : [...(v[f.k] || []), m.user_id])}>{m.profiles?.name}</button> })}</div>
        : <input className="inp" type={f.t || 'text'} inputMode={f.t === 'number' ? 'decimal' : undefined} value={v[f.k] ?? ''} onChange={e => set(f.k, f.t === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />}</label>)}
      <div className="flex gap-2 pt-2"><button className="btn flex-1" onClick={() => { onSave(v); onClose() }}>Guardar</button>{onDelete && <button className="btn2" onClick={() => { onDelete(); onClose() }}>Borrar</button>}</div></div></Sheet>
}

function Login() {
  const [email, setEmail] = useState(''), [sent, setSent] = useState(false)
  const redirectTo = location.href
  return <div className="min-h-full flex flex-col justify-center p-6 max-w-md mx-auto">
    <p className="lbl">Escapadas en grupo</p><h1 className="t text-6xl mb-6">Rumbo</h1>
    {sent ? <p>Listo, mirá tu mail: te mandamos un link para entrar.</p> : <div className="space-y-3">
      <input className="inp" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
      <button className="btn w-full" onClick={async () => { const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } }); error ? alert(error.message) : setSent(true) }}>Entrar con link por mail</button>
      <button className="btn2 w-full" onClick={() => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })}>Seguir con Google</button></div>}</div>
}

function Invite({ token }: { token: string }) {
  const [err, setErr] = useState('')
  useEffect(() => { sb.rpc('accept_invite', { p_token: token }).then(({ data, error }) => { if (error) setErr(error.message); else { localStorage.setItem('trip', data); go('/') } }) }, [token])
  return <div className="p-6">{err ? <><p className="mb-3">{err}</p><button className="btn" onClick={() => go('/')}>Ir a mis viajes</button></> : <p>Sumándote al viaje…</p>}</div>
}

function Trips({ me }: any) {
  const [list, setList] = useState<any[] | null>(null), [form, setForm] = useState(false)
  const load = () => sb.from('trips').select().order('start_date').then(({ data }) => setList(data || []))
  useEffect(() => { load() }, [])
  return <div className="p-4 max-w-md mx-auto">
    <div className="flex justify-between items-end mb-4"><h1 className="t text-4xl">Mis viajes</h1><button className="btn2" onClick={() => sb.auth.signOut()}>Salir</button></div>
    {!list ? <Skel /> : list.length === 0 ? <Empty t="Todavía no tenés viajes. Creá uno o abrí un link de invitación." a="Crear viaje" f={() => setForm(true)} /> :
      <div className="space-y-3">{list.map(t => <button key={t.id} className="card block w-full text-left min-h-[44px]" onClick={() => { localStorage.setItem('trip', t.id); go('/') }}><Cross /><p className="lbl">{fdate(t.start_date)} → {fdate(t.end_date)}</p><p className="t text-3xl">{t.destination}</p><p className="text-sm">{t.name}</p></button>)}
        <button className="btn w-full" onClick={() => setForm(true)}>+ Nuevo viaje</button></div>}
    {form && <Form title="Nuevo viaje" onClose={() => setForm(false)} fields={[{ k: 'name', l: 'Nombre' }, { k: 'destination', l: 'Destino' }, { k: 'start_date', l: 'Desde', t: 'date' }, { k: 'end_date', l: 'Hasta', t: 'date' }, { k: 'budget_cap', l: 'Tope de presupuesto', t: 'number' }]}
      onSave={async (v: any) => { const { data, error } = await sb.from('trips').insert({ ...v, owner_id: me.id }).select().single(); if (error) alert(error.message); else { localStorage.setItem('trip', data.id); go('/') } }} />}</div>
}

const TABS = ['Resumen', 'Reservas', 'Plata', 'Lugares', 'Tareas']
function Trip({ id, me }: any) {
  const { d, off, mut } = useTrip(id), [tab, setTab] = useState(0), [form, setForm] = useState<any>(null)
  const name = useMemo(() => Object.fromEntries((d?.members || []).map((m: any) => [m.user_id, m.profiles?.name || '?'])), [d])
  if (!d) return <Skel />
  const P = { d, me, name, mut, setForm }
  return <div className="max-w-md mx-auto min-h-full flex flex-col">
    {off && <p className="chip text-center">Sin conexión · mostrando lo último guardado</p>}
    <div className="flex-1 pb-24">{[<Resumen {...P} />, <Reservas {...P} />, <Plata {...P} />, <Lugares {...P} />, <Tareas {...P} />][tab]}</div>
    <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto grid grid-cols-5 border-t border-ink bg-bg" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {TABS.map((t, i) => <button key={t} className={`min-h-[56px] t text-sm tracking-wider ${tab === i ? 'bg-acc text-bg' : ''}`} onClick={() => setTab(i)}>{t}</button>)}</nav>
    {form && <Form {...form} members={d.members} onClose={() => setForm(null)} />}</div>
}

function Resumen({ d, me, name, mut, setForm }: any) {
  const { trip, bookings, expenses, places, todos, members } = d
  const spent = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0), mine = todos.filter((t: any) => !t.done && t.assignee_ids.includes(me.id))
  const today = new Date().toISOString().slice(0, 10), next = [...bookings].filter((b: any) => (b.date || '') >= today).sort((a: any, b: any) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0]
  const isOwner = trip.owner_id === me.id, left = daysTo(trip.start_date)
  const share = async () => { const { data, error } = await sb.from('invites').insert({ trip_id: trip.id }).select().single(); if (error) return alert(error.message)
    const url = `${location.origin}/invite/${data.token}`; if (navigator.share) navigator.share({ title: 'Rumbo', text: 'Sumate a nuestro viaje', url }).catch(() => {}); else { await navigator.clipboard.writeText(url); alert('Link copiado. Vale 7 días.') } }
  const tile = (l: string, big: string, sub: string) => <div className="card"><Cross /><p className="lbl">{l}</p><p className="t text-4xl">{big}</p><p className="text-sm text-ink/70">{sub}</p></div>
  return <div className="p-4 space-y-4">
    <div className="flex justify-between"><button className="lbl min-h-[44px]" onClick={() => { localStorage.removeItem('trip'); go('/') }}>← Mis viajes</button><button className="lbl min-h-[44px] text-accd" onClick={share}>Compartir viaje</button></div>
    <div><p className="lbl">{fdate(trip.start_date)} → {fdate(trip.end_date)}</p><h1 className="t text-6xl leading-none">{trip.destination}</h1>
      <p className="mt-1"><span className="chip">{left > 0 ? `Faltan ${left} días` : left === 0 ? 'Es hoy' : 'En curso o terminado'}</span></p>
      <p className="text-sm mt-2">{members.map((m: any) => m.profiles?.name).join(' · ')}</p></div>
    <div className="grid grid-cols-2 gap-3">
      {tile('Reservas', `${bookings.filter((b: any) => b.confirmation_code).length}/${bookings.length}`, `${bookings.filter((b: any) => !b.paid).length} sin pagar`)}
      {tile('Presupuesto', `${trip.budget_cap ? Math.round(spent / trip.budget_cap * 100) : 0}%`, `${gs(spent)} de ${gs(trip.budget_cap)}`)}
      {tile('Lugares', String(places.filter((p: any) => p.in_plan).length), 'en el plan')}
      {tile('Pendientes', String(todos.filter((t: any) => !t.done).length), `${mine.length} son tuyos`)}</div>
    <div className="card"><Cross /><p className="lbl">Lo próximo</p>{next ? <><p className="t text-2xl">{next.title}</p><p className="text-sm">{fdate(next.date)} {next.time?.slice(0, 5)} · {next.detail}</p></> : <p className="text-sm text-ink/70">No hay reservas próximas.</p>}</div>
    <div className="card"><p className="lbl mb-1">Tus pendientes</p>{mine.length === 0 ? <p className="text-sm text-ink/70">No tenés nada pendiente. 🙌</p> : mine.map((t: any) => <button key={t.id} className="flex items-center gap-3 min-h-[44px] w-full text-left" onClick={() => mut('todos', 'upsert', { id: t.id, done: true, done_at: new Date().toISOString() })}><span className="w-5 h-5 border border-ink shrink-0" />{t.title}</button>)}</div>
    {isOwner && <div className="card"><p className="lbl mb-1">Miembros</p>{members.filter((m: any) => m.user_id !== me.id).map((m: any) => <div key={m.user_id} className="flex justify-between items-center min-h-[44px]">{m.profiles?.name}<button className="lbl text-accd min-h-[44px]" onClick={async () => { if (confirm(`¿Sacar a ${m.profiles?.name}?`)) { await sb.from('trip_members').delete().match({ trip_id: trip.id, user_id: m.user_id }); location.reload() } }}>Sacar</button></div>)}
      <button className="lbl text-accd min-h-[44px]" onClick={async () => { if (confirm('¿Borrar el viaje para todos? No se puede deshacer.')) { await sb.from('trips').delete().eq('id', trip.id); localStorage.removeItem('trip'); go('/') } }}>Borrar viaje</button></div>}
  </div>
}

const KINDS = ['vuelo', 'alojamiento', 'auto', 'actividad', 'otro']
function Reservas({ d, me, name, mut, setForm }: any) {
  const list = [...d.bookings].sort((a: any, b: any) => ((a.date || '9') + (a.time || '')).localeCompare((b.date || '9') + (b.time || '')))
  const open = (b?: any) => setForm({ title: b ? 'Editar reserva' : 'Nueva reserva', init: b || { kind: 'vuelo', paid: false }, onDelete: b && (() => mut('bookings', 'delete', b)),
    fields: [{ k: 'kind', l: 'Tipo', t: 'select', o: KINDS }, { k: 'title', l: 'Título' }, { k: 'detail', l: 'Detalle' }, { k: 'date', l: 'Fecha', t: 'date' }, { k: 'time', l: 'Hora', t: 'time' }, { k: 'confirmation_code', l: 'Código de confirmación' }, { k: 'price', l: 'Precio', t: 'number' }, { k: 'paid', l: 'Pagada', t: 'check' }],
    onSave: (v: any) => { const { profiles, ...r } = v; mut('bookings', 'upsert', { id: uid(), trip_id: d.trip.id, created_by: me.id, ...r, paid_by: r.paid ? (r.paid_by || me.id) : null, time: r.time || null, date: r.date || null }) } })
  return <div className="p-4"><div className="flex justify-between items-end mb-3"><h1 className="t text-4xl">Reservas</h1><button className="btn" onClick={() => open()}>+</button></div>
    {list.length === 0 ? <Empty t="Todavía no cargaron reservas." a="Cargar una reserva" f={() => open()} /> :
      <div className="border-l border-ink ml-2 space-y-3">{list.map((b: any) => <button key={b.id} className="card block w-full text-left ml-4" onClick={() => open(b)}>
        <span className="absolute -left-[22px] top-5 w-3 h-3 bg-acc" /><p className="lbl">{fdate(b.date)} {b.time?.slice(0, 5)} · {b.kind}</p>
        <p className="t text-2xl">{b.title}</p><p className="text-sm">{b.detail}</p>
        <div className="flex justify-between items-center mt-2"><span className="text-sm">{b.confirmation_code && `#${b.confirmation_code} · `}{gs(b.price)}</span><span className={b.paid ? 'chip' : 'lbl text-accd'}>{b.paid ? 'Confirmado' : 'Sin pagar'}</span></div></button>)}</div>}</div>
}

const CATS = ['alojamiento', 'vuelos', 'actividades', 'auto', 'comida', 'otros']
function Plata({ d, me, name, mut, setForm }: any) {
  const { trip, expenses, members } = d, spent = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0), cap = Number(trip.budget_cap) || 0
  const segs = cap ? Math.min(20, Math.round(spent / cap * 20)) : 0, debts = settle(expenses)
  const open = () => setForm({ title: 'Cargar un gasto', init: { category: 'comida', paid_by: me.id, split_between: members.map((m: any) => m.user_id), date: new Date().toISOString().slice(0, 10) },
    fields: [{ k: 'description', l: 'Qué fue' }, { k: 'amount', l: 'Monto', t: 'number' }, { k: 'category', l: 'Categoría', t: 'select', o: CATS }, { k: 'paid_by', l: 'Pagó', t: 'select', o: members.map((m: any) => [m.user_id, m.profiles?.name]) }, { k: 'split_between', l: 'Dividir entre', t: 'multi' }, { k: 'date', l: 'Fecha', t: 'date' }],
    onSave: (v: any) => v.description && v.amount && mut('expenses', 'upsert', { id: uid(), trip_id: trip.id, ...v }) })
  return <div className="p-4 space-y-4"><div className="flex justify-between items-end"><h1 className="t text-4xl">Plata</h1><button className="btn" onClick={open}>Cargar un gasto</button></div>
    <div className="card"><Cross /><p className="lbl">Gastado de {gs(cap)}</p><p className="t text-5xl">{gs(spent)}</p>
      <div className="grid grid-cols-20 gap-[2px] mt-3" style={{ gridTemplateColumns: 'repeat(20,1fr)' }}>{Array.from({ length: 20 }, (_, i) => <span key={i} className={`h-4 ${i < segs ? (spent > cap ? 'bg-ink' : 'bg-acc') : 'bg-line'}`} />)}</div>
      <p className="text-sm mt-2">{cap - spent >= 0 ? `Quedan ${gs(cap - spent)}` : `Te pasaste ${gs(spent - cap)}`}</p></div>
    <div className="card"><p className="lbl mb-1">Por persona (lo que puso cada uno)</p>{members.map((m: any) => <div key={m.user_id} className="flex justify-between min-h-[32px]"><span>{m.profiles?.name}</span><span>{gs(expenses.filter((e: any) => e.paid_by === m.user_id).reduce((s: number, e: any) => s + Number(e.amount), 0))}</span></div>)}</div>
    <div className="card"><p className="lbl mb-2">Por categoría</p>{CATS.map(c => { const v = expenses.filter((e: any) => e.category === c).reduce((s: number, e: any) => s + Number(e.amount), 0); return <div key={c} className="mb-2"><div className="flex justify-between text-sm"><span className="capitalize">{c}</span><span>{gs(v)}</span></div><div className="h-2 bg-line"><div className="h-2 bg-acc" style={{ width: `${spent ? v / spent * 100 : 0}%` }} /></div></div> })}</div>
    <div className="card"><Cross /><p className="lbl mb-1">Cuentas entre ustedes</p>{debts.length === 0 ? <p className="text-sm text-ink/70">Están a mano. 🎉</p> : debts.map((x, i) => <p key={i} className="min-h-[32px]"><b>{name[x.from]}</b> le pasa <b>{gs(x.amt)}</b> a <b>{name[x.to]}</b></p>)}</div>
    {expenses.length === 0 && <Empty t="Todavía no hay gastos." a="Cargar el primero" f={open} />}</div>
}

const PCATS: any = { bodega: 'Bodegas', comer: 'Comer', paseo: 'Paseos' }
function Lugares({ d, me, name, mut, setForm }: any) {
  const [f, setF] = useState('todos'), list = d.places.filter((p: any) => f === 'todos' || p.category === f)
  const add = () => setForm({ title: 'Nuevo lugar', init: { category: 'bodega' }, fields: [{ k: 'name', l: 'Nombre' }, { k: 'category', l: 'Categoría', t: 'select', o: [['bodega', 'Bodega'], ['comer', 'Comer'], ['paseo', 'Paseo'], ['otro', 'Otro']] }, { k: 'note', l: 'Nota' }, { k: 'distance_km', l: 'Distancia (km)', t: 'number' }, { k: 'maps_url', l: 'Link de Google Maps' }],
    onSave: (v: any) => v.name && mut('places', 'upsert', { id: uid(), trip_id: d.trip.id, saved_by: me.id, in_plan: false, ...v, distance_km: v.distance_km || null }) })
  return <div className="p-4"><div className="flex justify-between items-end mb-3"><h1 className="t text-4xl">Lugares</h1><button className="btn" onClick={add}>+</button></div>
    <div className="flex gap-2 mb-3 overflow-auto">{['todos', 'bodega', 'comer', 'paseo'].map(c => <button key={c} className={`min-h-[44px] px-3 border t tracking-wider whitespace-nowrap ${f === c ? 'bg-acc text-bg border-acc' : 'border-line'}`} onClick={() => setF(c)}>{c === 'todos' ? 'Todos' : PCATS[c]}</button>)}</div>
    {list.length === 0 ? <Empty t="No hay lugares guardados acá." a="Guardar un lugar" f={add} /> : <div className="space-y-3">{list.map((p: any) => {
      const votes = d.votes.filter((v: any) => v.place_id === p.id), voted = votes.some((v: any) => v.user_id === me.id)
      return <div key={p.id} className="card"><p className="lbl">{p.category}{p.distance_km ? ` · ${p.distance_km} km` : ''}</p><p className="t text-2xl">{p.maps_url ? <a href={p.maps_url} target="_blank" rel="noreferrer">{p.name}</a> : p.name}</p><p className="text-sm">{p.note}</p><p className="lbl mt-1">Lo guardó {name[p.saved_by] || '—'}</p>
        <div className="flex gap-2 mt-2"><button className={`btn2 ${voted ? 'bg-accl text-accd' : ''}`} onClick={() => mut('place_votes', voted ? 'delete' : 'upsert', { place_id: p.id, user_id: me.id })}>▲ {votes.length}</button>
          <button className={p.in_plan ? 'btn' : 'btn2'} onClick={() => mut('places', 'upsert', { id: p.id, in_plan: !p.in_plan })}>{p.in_plan ? '✓ En el plan' : '+ Al plan'}</button></div></div> })}</div>}</div>
}

function Tareas({ d, me, name, mut, setForm }: any) {
  const done = d.todos.filter((t: any) => t.done).length
  const add = () => setForm({ title: 'Nueva tarea', init: { phase: 'antes', assignee_ids: [] }, fields: [{ k: 'title', l: 'Qué hay que hacer' }, { k: 'phase', l: 'Cuándo', t: 'select', o: [['antes', 'Antes de viajar'], ['alla', 'Allá']] }, { k: 'due_label', l: 'Fecha límite (texto)' }, { k: 'assignee_ids', l: 'Responsables', t: 'multi' }],
    onSave: (v: any) => v.title && mut('todos', 'upsert', { id: uid(), trip_id: d.trip.id, created_by: me.id, done: false, ...v }) })
  const group = (ph: string, l: string) => { const list = d.todos.filter((t: any) => t.phase === ph); return <div className="mb-4"><p className="lbl mb-1">{l}</p>{list.map((t: any) => <button key={t.id} className="card flex items-center gap-3 w-full text-left mb-2 min-h-[44px]" onClick={() => mut('todos', 'upsert', { id: t.id, done: !t.done, done_at: t.done ? null : new Date().toISOString() })}>
    <span className={`w-5 h-5 border border-ink shrink-0 flex items-center justify-center text-xs ${t.done ? 'bg-acc text-bg' : ''}`}>{t.done && '✓'}</span>
    <span className="flex-1"><span className={t.done ? 'line-through text-ink/50' : ''}>{t.title}</span><br /><span className="lbl">{t.due_label}</span></span>
    <span className="chip">{t.assignee_ids.length ? t.assignee_ids.map((a: string) => name[a]).join(', ') : 'De todos'}</span></button>)}</div> }
  return <div className="p-4"><div className="flex justify-between items-end mb-1"><h1 className="t text-4xl">Tareas</h1><button className="btn" onClick={add}>+</button></div>
    <p className="lbl mb-3">{done} de {d.todos.length} hechos</p>
    {d.todos.length === 0 ? <Empty t="No hay tareas todavía." a="Agregar una" f={add} /> : <>{group('antes', 'Antes de viajar')}{group('alla', 'Allá')}</>}</div>
}

export default function App() {
  const [s, setS] = useState<any>(undefined), [path, setPath] = useState(location.pathname)
  useEffect(() => { sb.auth.getSession().then(({ data }) => setS(data.session)); const { data } = sb.auth.onAuthStateChange((_, x) => setS(x)); const p = () => setPath(location.pathname); window.addEventListener('popstate', p); return () => { data.subscription.unsubscribe(); window.removeEventListener('popstate', p) } }, [])
  if (s === undefined) return <Skel />
  if (!s) return <Login />
  const me = s.user, inv = path.match(/^\/invite\/(.+)$/), tid = localStorage.getItem('trip')
  return inv ? <Invite token={inv[1]} /> : tid ? <Trip key={tid} id={tid} me={me} /> : <Trips me={me} />
}
