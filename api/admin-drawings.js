import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// /api/admin-drawings — admin management for monthly prize drawings.
// GET                                   -> all drawings + entry counts + winner usernames
//                                          + the admin's own active listings (prize picker)
// POST { action: 'create', drawing }    -> insert a drawing (scheduled)
// POST { action: 'draw', id }           -> pick a random winner (only after ends_at)
// POST { action: 'cancel', id }         -> cancel a drawing that hasn't been drawn
// Auth: same pattern as /api/admin-submissions — the caller's Supabase session
// token must belong to an email in ADMIN_EMAILS; writes use the service key
// because drawings/drawing_entries have no client write policies.
// ---------------------------------------------------------------------------

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'sangtruong@gmail.com').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'missing Supabase env vars' })
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const token = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'sign in required' })
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  const email = userData?.user?.email?.toLowerCase()
  if (userErr || !email || !ADMIN_EMAILS.includes(email)) return res.status(403).json({ error: 'not an admin' })
  const adminId = userData.user.id

  if (req.method === 'GET') {
    const { data: drawings, error } = await supabase.from('drawings').select('*').order('starts_at', { ascending: false }).limit(100)
    if (error) return res.status(error.code === '42P01' || error.code === 'PGRST205' ? 404 : 500).json({ error: error.message, missingTables: error.code === '42P01' || error.code === 'PGRST205' })
    const ids = (drawings || []).map((d) => d.id)
    const counts = {}
    for (const id of ids) {
      const { count } = await supabase.from('drawing_entries').select('id', { count: 'exact', head: true }).eq('drawing_id', id)
      counts[id] = count || 0
    }
    const winnerIds = [...new Set((drawings || []).map((d) => d.winner_user_id).filter(Boolean))]
    const winners = {}
    if (winnerIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username, display_name').in('id', winnerIds)
      for (const p of profs || []) winners[p.id] = p
      for (const id of winnerIds) {
        if (!winners[id]) winners[id] = {}
        const { data: u } = await supabase.auth.admin.getUserById(id)
        winners[id].email = u?.user?.email || null
      }
    }
    const { data: myListings } = await supabase.from('listings').select('id, title, description, image_url, price')
      .eq('user_id', adminId).eq('status', 'active').order('created_at', { ascending: false }).limit(100)
    return res.status(200).json({
      drawings: (drawings || []).map((d) => ({ ...d, entry_count: counts[d.id] || 0, winner: d.winner_user_id ? winners[d.winner_user_id] || null : null })),
      myListings: myListings || [],
    })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' })
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { action } = body || {}

  if (action === 'create') {
    const d = body.drawing || {}
    if (!d.title || !d.starts_at || !d.ends_at) return res.status(400).json({ error: 'title, starts_at and ends_at are required' })
    const row = {
      title: String(d.title).slice(0, 200),
      prize_description: String(d.prize_description || '').slice(0, 4000),
      prize_image_url: d.prize_image_url || null,
      prize_arv_cents: d.prize_arv_cents != null && d.prize_arv_cents !== '' ? Math.round(Number(d.prize_arv_cents)) : null,
      prize_listing_id: d.prize_listing_id || null,
      starts_at: d.starts_at,
      ends_at: d.ends_at,
      max_entries_per_user: Math.max(1, Math.min(1000, parseInt(d.max_entries_per_user) || 10)),
      status: 'scheduled',
    }
    const { data, error } = await supabase.from('drawings').insert(row).select().single()
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ drawing: data })
  }

  if (action === 'draw') {
    if (!body.id) return res.status(400).json({ error: 'id required' })
    const { data, error } = await supabase.rpc('pick_drawing_winner', { p_drawing_id: body.id })
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ result: Array.isArray(data) ? data[0] : data })
  }

  if (action === 'cancel') {
    if (!body.id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase.from('drawings').update({ status: 'cancelled' }).eq('id', body.id).eq('status', 'scheduled')
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'unknown action' })
}
