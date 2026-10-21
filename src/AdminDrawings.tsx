// Admin: monthly prize drawings. All reads/writes go through /api/admin-drawings
// (service key + ADMIN_EMAILS), except the prize photo, which the admin uploads
// with their own session into the existing public `listings` bucket under
// <their user id>/ (the same path pattern marketplace listings use).
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { monthWindowMT, fmtMT, fmtArv } from './drawing'

type AdminFetch = (path: string, init?: RequestInit) => Promise<Response>

function nextMonthValue() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Denver' }))
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AdminDrawings({ adminFetch }: { adminFetch: AdminFetch }) {
  const [drawings, setDrawings] = useState<any[]>([])
  const [myListings, setMyListings] = useState<any[]>([])
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [arv, setArv] = useState('')
  const [month, setMonth] = useState(nextMonthValue())
  const [cap, setCap] = useState('10')
  const [prizeListingId, setPrizeListingId] = useState('')
  const [uploading, setUploading] = useState(false)

  async function load() {
    setError('')
    const r = await adminFetch('/api/admin-drawings')
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setMissing(!!j.missingTables); setError(j.missingTables ? '' : (j.error || `HTTP ${r.status}`)); return }
    setMissing(false); setDrawings(j.drawings || []); setMyListings(j.myListings || [])
  }
  useEffect(() => { load() }, [])

  function pickListing(id: string) {
    setPrizeListingId(id)
    const l = myListings.find(x => x.id === id)
    if (!l) return
    setTitle(l.title || ''); setDesc(l.description || ''); setImageUrl(l.image_url || '')
    if (l.price && !arv) setArv(String(l.price))
  }

  async function upload(file: File) {
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/drawing-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('listings').upload(path, file, { upsert: false, contentType: file.type })
      if (error) throw error
      setImageUrl(supabase.storage.from('listings').getPublicUrl(path).data.publicUrl)
    } catch (e: any) { setError('Photo upload failed: ' + (e?.message || e)) }
    setUploading(false)
  }

  const win = month ? monthWindowMT(month) : null

  async function create() {
    if (!title.trim() || !win) { setError('Title and month are required'); return }
    setBusy('create'); setError('')
    const r = await adminFetch('/api/admin-drawings', { method: 'POST', body: JSON.stringify({ action: 'create', drawing: {
      title: title.trim(), prize_description: desc, prize_image_url: imageUrl || null,
      prize_arv_cents: arv ? Math.round(parseFloat(arv) * 100) : null, prize_listing_id: prizeListingId || null,
      starts_at: win.starts_at.toISOString(), ends_at: win.ends_at.toISOString(), max_entries_per_user: parseInt(cap) || 10,
    } }) })
    const j = await r.json().catch(() => ({}))
    setBusy(null)
    if (!r.ok) { setError(j.error || `HTTP ${r.status}`); return }
    setTitle(''); setDesc(''); setImageUrl(''); setArv(''); setPrizeListingId('')
    load()
  }

  async function act(action: 'draw' | 'cancel', d: any) {
    if (action === 'draw' && !confirm(`Draw a random winner for "${d.title}" from ${d.entry_count} entries? This can't be undone.`)) return
    if (action === 'cancel' && !confirm(`Cancel "${d.title}"?`)) return
    setBusy(d.id); setError('')
    const r = await adminFetch('/api/admin-drawings', { method: 'POST', body: JSON.stringify({ action, id: d.id }) })
    const j = await r.json().catch(() => ({}))
    setBusy(null)
    if (!r.ok) setError(j.error || `HTTP ${r.status}`)
    load()
  }

  const now = Date.now()
  const phase = (d: any) => d.status === 'drawn' ? 'Drawn' : d.status === 'cancelled' ? 'Cancelled'
    : now < new Date(d.starts_at).getTime() ? 'Upcoming' : now < new Date(d.ends_at).getTime() ? 'Live' : 'Ended — ready to draw'
  const phaseStyle = (p: string) => p === 'Live' ? { background: '#EF3E36', color: 'white' } : p.startsWith('Ended') ? { background: '#FEF3C7', color: '#92400E' }
    : p === 'Drawn' ? { background: '#F0FDF4', color: '#166534' } : { background: '#143456', color: '#ACB3AE' }
  const input = 'w-full bg-zinc-100 border border-zinc-200 rounded-md px-3 py-2 text-sm outline-none'

  if (missing) return (
    <div className="space-y-2"><h2 className="font-black text-xl">Drawings</h2>
      <p className="text-sm text-zinc-400">The drawings tables don't exist yet. Run <code>migrations/005_drawings.sql</code> in the Supabase SQL editor, then reload.</p></div>
  )

  return (
    <div className="space-y-4">
      <h2 className="font-black text-xl">Monthly Drawings</h2>
      {error && <p className="text-sm p-3 rounded-md" style={{ background: 'rgba(239,62,54,0.15)', color: '#FFD9D6' }}>{error}</p>}

      <div className="bg-zinc-50 rounded-md border border-zinc-100 p-4 space-y-3">
        <p className="font-black text-sm">New monthly drawing</p>
        {myListings.length > 0 && (
          <label className="block text-xs text-zinc-400">Use one of my listings as the prize (prefills)
            <select value={prizeListingId} onChange={e => pickListing(e.target.value)} className={input + ' mt-1'}>
              <option value="">— none —</option>
              {myListings.map(l => <option key={l.id} value={l.id}>{l.title}{l.price ? ` · $${l.price}` : ''}</option>)}
            </select>
          </label>
        )}
        <label className="block text-xs text-zinc-400">Title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. PSA 10 Charizard" className={input + ' mt-1'} /></label>
        <label className="block text-xs text-zinc-400">Prize description<textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} className={input + ' mt-1'} /></label>
        <div className="flex gap-3 items-start">
          <div className="h-24 w-24 rounded-md bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-[10px] text-zinc-400">
            {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover" /> : uploading ? 'Uploading…' : 'No photo'}
          </div>
          <label className="text-xs text-zinc-400 flex-1">Prize photo
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} className="block mt-1 text-xs" />
            {imageUrl && <button onClick={() => setImageUrl('')} className="mt-1 underline">Remove photo</button>}
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="block text-xs text-zinc-400">ARV ($)<input value={arv} onChange={e => setArv(e.target.value)} inputMode="decimal" placeholder="250" className={input + ' mt-1'} /></label>
          <label className="block text-xs text-zinc-400">Month<input type="month" value={month} onChange={e => setMonth(e.target.value)} className={input + ' mt-1'} /></label>
          <label className="block text-xs text-zinc-400">Max listing entries / user<input value={cap} onChange={e => setCap(e.target.value)} inputMode="numeric" className={input + ' mt-1'} /></label>
        </div>
        {win && <p className="text-xs text-zinc-400">Runs {fmtMT(win.starts_at)} → {fmtMT(win.ends_at)}. Only one drawing can run at a time; overlapping months are rejected.</p>}
        <button onClick={create} disabled={busy === 'create' || uploading} className="px-4 py-2 rounded-md text-sm font-bold text-white disabled:opacity-50" style={{ background: '#EF3E36' }}>
          {busy === 'create' ? 'Saving…' : 'Create drawing'}
        </button>
      </div>

      <div className="bg-zinc-50 rounded-md border border-zinc-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 font-black text-sm">All drawings ({drawings.length})</div>
        {drawings.length === 0 ? <p className="text-center text-zinc-400 py-8 text-sm font-mono">No drawings yet</p> : drawings.map(d => {
          const p = phase(d)
          return (
            <div key={d.id} className="px-4 py-3 flex items-center gap-3 border-b border-zinc-50 last:border-0">
              {d.prize_image_url ? <img src={d.prize_image_url} alt="" className="h-12 w-12 rounded-md object-cover flex-shrink-0" /> : <div className="h-12 w-12 rounded-md bg-zinc-100 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{d.title} {fmtArv(d.prize_arv_cents) && <span className="text-zinc-400 font-normal">· ARV {fmtArv(d.prize_arv_cents)}</span>}</p>
                <p className="text-xs text-zinc-400">{fmtMT(d.starts_at)} → {fmtMT(d.ends_at)} · <b>{d.entry_count.toLocaleString()}</b> entries</p>
                {d.winner && <p className="text-xs mt-0.5" style={{ color: '#166534' }}>🏆 Winner: @{d.winner.username || '?'}{d.winner.email ? ` · ${d.winner.email}` : ''} · {fmtMT(d.drawn_at)}</p>}
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-md flex-shrink-0" style={phaseStyle(p)}>{p}</span>
              {p.startsWith('Ended') && (
                <button onClick={() => act('draw', d)} disabled={busy === d.id || !d.entry_count} className="text-xs font-black px-3 py-1.5 rounded-md text-white flex-shrink-0 disabled:opacity-50" style={{ background: '#EF3E36' }}>Draw winner</button>
              )}
              {(p === 'Upcoming' || p === 'Live') && (
                <button onClick={() => act('cancel', d)} disabled={busy === d.id} className="text-xs px-2 py-1.5 rounded-md border border-zinc-200 text-zinc-400 flex-shrink-0">Cancel</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
