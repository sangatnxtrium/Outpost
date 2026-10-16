import { createClient } from '@supabase/supabase-js'
import { makeDedupeKey } from './_lib/events.js'

// ---------------------------------------------------------------------------
// /api/admin-submissions — moderation queue for community event submissions.
// GET  -> pending (or ?status=approved|rejected|all) submissions
// POST { id, action: 'approve' | 'reject' } -> approve copies into `events`
// Auth: caller sends their Supabase session access token as a Bearer token;
// the email on that session must be in ADMIN_EMAILS. event_submissions has RLS
// with no anon policies, so all access goes through this service-key route.
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

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost')
    const status = url.searchParams.get('status') || 'pending'
    let query = supabase.from('event_submissions').select('*').order('created_at', { ascending: false }).limit(200)
    if (status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ submissions: data || [] })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { id, action } = body || {}
  if (!id || !['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'id and action (approve|reject) required' })

  const { data: sub, error: subErr } = await supabase.from('event_submissions').select('*').eq('id', id).single()
  if (subErr || !sub) return res.status(404).json({ error: 'submission not found' })

  if (action === 'approve') {
    const row = {
      title: sub.title,
      date: sub.date,
      location: sub.location || '',
      city: sub.city,
      state: sub.state || '',
      description: sub.description || '',
      website: sub.website || '',
      categories: sub.categories?.length ? sub.categories : ['collectibles'],
      is_national: false,
      source: 'submission',
      external_id: `submission:${sub.id}`,
      dedupe_key: sub.dedupe_key || makeDedupeKey(sub.title, sub.date, sub.city),
      is_active: true,
      last_seen_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('events').upsert(row, { onConflict: 'dedupe_key' })
    if (error) return res.status(500).json({ error: error.message })
  }

  const { error: updErr } = await supabase.from('event_submissions').update({ status: action === 'approve' ? 'approved' : 'rejected' }).eq('id', id)
  if (updErr) return res.status(500).json({ error: updErr.message })
  return res.status(200).json({ ok: true })
}
