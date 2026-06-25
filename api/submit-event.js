import { createClient } from '@supabase/supabase-js'
import { inferCategories, parseEventDate, makeDedupeKey } from './_lib/events.js'

// ---------------------------------------------------------------------------
// /api/submit-event  —  community-sourced events (merchants + hunters).
// Inserts into `event_submissions` with status 'pending'. An admin approves
// them into the live `events` table from the Admin panel. This is the data
// source no API has, so it's intentionally low-friction but moderated.
// ---------------------------------------------------------------------------

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'missing Supabase env vars' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  body = body || {}

  const title = (body.title || '').trim()
  const rawDate = (body.date || '').trim()
  const city = (body.city || '').trim()

  if (!title || !rawDate || !city) {
    return res.status(400).json({ error: 'title, date, and city are required' })
  }

  const date = parseEventDate(rawDate) || rawDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be a real date (YYYY-MM-DD)' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const row = {
    title,
    date,
    location: (body.location || '').trim(),
    city,
    state: (body.state || '').trim().toUpperCase().slice(0, 2),
    description: (body.description || '').slice(0, 1000),
    website: (body.website || '').trim(),
    categories: Array.isArray(body.categories) && body.categories.length
      ? body.categories
      : inferCategories(title, body.description, body.location),
    submitter_user_id: body.user_id || null,
    submitter_email: (body.email || '').trim(),
    dedupe_key: makeDedupeKey(title, date, city),
    status: 'pending',
  }

  const { error } = await supabase.from('event_submissions').insert(row)
  if (error) {
    // Friendly message on duplicate submissions
    if (error.code === '23505') {
      return res.status(200).json({ ok: true, duplicate: true, message: 'Already submitted — thanks!' })
    }
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ ok: true, message: 'Submitted for review. Thanks!' })
}
