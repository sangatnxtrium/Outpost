import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// /api/news-ingest  —  triggered by Vercel Cron (see vercel.json) or manually.
// Reads active rows from `news_sources`, fetches each Google News RSS search
// feed, parses the items, de-duplicates by url, and inserts new headlines into
// `news_articles`. No AI, no third-party keys — just RSS. Old articles are
// pruned to keep the table small. All secrets come from env vars.
// ---------------------------------------------------------------------------

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, CRON_SECRET } = process.env

const PER_SOURCE = 18 // max items kept per query per run
const PRUNE_DAYS = 30 // delete articles older than this

function isAuthorized(req) {
  if (!CRON_SECRET) return true // no secret configured -> allow (set one in prod!)
  const auth = req.headers?.authorization || ''
  if (auth === `Bearer ${CRON_SECRET}`) return true // Vercel Cron sends this
  const url = new URL(req.url, 'http://localhost')
  return url.searchParams.get('secret') === CRON_SECRET
}

// Minimal, dependency-free helpers for parsing RSS XML --------------------------
function decodeEntities(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}
function stripTags(s = '') {
  return decodeEntities(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? m[1] : ''
}

// Google News titles look like "Headline - Publisher". Strip the trailing
// " - Publisher" so the card shows a clean headline (publisher shown separately).
function cleanTitle(title) {
  const t = stripTags(title)
  const idx = t.lastIndexOf(' - ')
  if (idx > 20) return t.slice(0, idx).trim()
  return t
}

function parseItems(xml) {
  const items = []
  const re = /<item\b[\s\S]*?<\/item>/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    const block = m[0]
    const link = stripTags(tag(block, 'link'))
    if (!link) continue
    const sourceRaw = tag(block, 'source')
    const sourceName = stripTags(sourceRaw) || null
    const descText = stripTags(tag(block, 'description'))
    const cleaned = cleanTitle(tag(block, 'title'))
    // Only keep a description if it's a real snippet (not just the headline echoed back)
    const description = descText && descText.length > cleaned.length + 15 ? descText.slice(0, 300) : null
    const pub = stripTags(tag(block, 'pubDate'))
    const published_at = pub && !isNaN(Date.parse(pub)) ? new Date(pub).toISOString() : null
    items.push({ title: cleaned, url: link, source_name: sourceName, description, published_at })
  }
  return items
}

function feedUrl(query) {
  const q = encodeURIComponent(query)
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'missing Supabase env vars' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: sources, error: srcErr } = await supabase
    .from('news_sources').select('label, query, category').eq('active', true)
  if (srcErr) return res.status(500).json({ error: srcErr.message })
  if (!sources?.length) return res.status(200).json({ ok: true, note: 'no active sources', inserted: 0 })

  const rows = []
  const seen = new Set()
  const perSource = {}

  for (const src of sources) {
    try {
      const resp = await fetch(feedUrl(src.query), {
        headers: { 'User-Agent': 'OutpostNews/1.0 (+https://www.getoutpost.net)' },
      })
      if (!resp.ok) { perSource[src.label] = `http ${resp.status}`; continue }
      const xml = await resp.text()
      const items = parseItems(xml).slice(0, PER_SOURCE)
      let kept = 0
      for (const it of items) {
        if (!it.url || seen.has(it.url)) continue
        seen.add(it.url)
        rows.push({ ...it, category: src.category })
        kept++
      }
      perSource[src.label] = kept
    } catch (e) {
      perSource[src.label] = `error: ${e.message}`
    }
  }

  let inserted = 0
  if (rows.length) {
    // onConflict url + ignoreDuplicates => INSERT ... ON CONFLICT DO NOTHING,
    // so only genuinely new headlines are added.
    const { data, error } = await supabase
      .from('news_articles')
      .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
      .select('id')
    if (error) return res.status(500).json({ error: error.message, perSource })
    inserted = data?.length || 0
  }

  // Prune old articles so the table stays small.
  const cutoff = new Date(Date.now() - PRUNE_DAYS * 86400_000).toISOString()
  await supabase.from('news_articles').delete().lt('published_at', cutoff)

  return res.status(200).json({ ok: true, sources: sources.length, fetched: rows.length, inserted, perSource })
}
