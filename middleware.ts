// ===========================================================================
// middleware.ts  (Vercel Routing/Edge Middleware — runs on every /shop/* and
// /city/* request, before the static SPA is served)
//
// Outpost is a plain client-rendered SPA (Vite, no SSR), so a crawler or a
// link-preview bot (iMessage, Twitter/X, Facebook, Slack, etc.) that doesn't
// execute JS only ever sees the one static <title>/description/og:* tags in
// index.html — the same generic tags for every URL. This middleware fetches
// the real index.html, swaps in that specific shop's (or city's) name and
// description, and serves the modified HTML. Real users get this too, but it
// doesn't change their experience — the React app boots normally right after
// and takes over. It only matters for the handful of requests that never run
// JS at all: search engine crawlers and social link-preview bots.
//
// Place this file at the project root (next to package.json, alongside
// vercel.json) — NOT inside src/ or api/. Vercel builds/deploys it
// automatically; it isn't part of the Vite/tsc build.
//
// Uses the same SUPABASE_URL + SUPABASE_SERVICE_KEY env vars your other
// server-side scripts (api/news-ingest.js, etc.) already use in this Vercel
// project — no new environment variables to add.
// ===========================================================================

export const config = {
  matcher: ['/shop/:path*', '/city/:path*', '/marketplace/:path*'],
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// "san-francisco" -> "San Francisco" (same heuristic as the app's unslugCity)
function unslugCity(slug: string) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function fetchShop(supabaseUrl: string, serviceKey: string, citySlug: string, nameSlug: string) {
  const url = `${supabaseUrl}/rest/v1/shops` +
    `?city_slug=eq.${encodeURIComponent(citySlug)}` +
    `&name_slug=eq.${encodeURIComponent(nameSlug)}` +
    `&select=name,description,image_url&limit=1`
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] || null
}

async function fetchListing(supabaseUrl: string, serviceKey: string, slug: string) {
  const url = `${supabaseUrl}/rest/v1/listings` +
    `?slug=eq.${encodeURIComponent(slug)}` +
    `&select=title,description,price,condition,image_url&limit=1`
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] || null
}

async function fetchTrade(supabaseUrl: string, serviceKey: string, slug: string) {
  const url = `${supabaseUrl}/rest/v1/trade_posts` +
    `?slug=eq.${encodeURIComponent(slug)}` +
    `&select=offer,look_for,image_url&limit=1`
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] || null
}

function injectMeta(html: string, opts: { title: string; description: string; url: string; image?: string }) {
  const title = escapeHtml(opts.title)
  const description = escapeHtml(opts.description)

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
  html = html.replace(
    /<meta name="description" content="[\s\S]*?"\s*\/?>/,
    `<meta name="description" content="${description}" />`
  )
  html = html.replace(
    /<meta property="og:title" content="[\s\S]*?"\s*\/?>/,
    `<meta property="og:title" content="${title}" />`
  )
  html = html.replace(
    /<meta property="og:description" content="[\s\S]*?"\s*\/?>/,
    `<meta property="og:description" content="${description}" />`
  )
  html = html.replace(
    /<meta property="og:url" content="[\s\S]*?"\s*\/?>/,
    `<meta property="og:url" content="${opts.url}" />`
  )

  if (opts.image) {
    const imageTag = `<meta property="og:image" content="${escapeHtml(opts.image)}" />`
    if (/<meta property="og:image"/.test(html)) {
      html = html.replace(/<meta property="og:image" content="[\s\S]*?"\s*\/?>/, imageTag)
    } else {
      html = html.replace('</head>', `    ${imageTag}\n  </head>`)
    }
  }

  return html
}

export default async function middleware(request: Request) {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean)

  // Fetch the real static shell. This is a *different* path than the one
  // that triggered this middleware (matcher only covers /shop and /city), so
  // it goes straight to the static file instead of re-entering middleware.
  const originRes = await fetch(new URL('/index.html', url))
  const originHtml = await originRes.text()

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // Env vars not available in this context for some reason — fail open and
    // serve the normal page rather than break the site.
    return new Response(originHtml, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }

  let meta: { title: string; description: string; image?: string } | null = null

  if (parts[0] === 'shop' && parts[1] && parts[2]) {
    const shop = await fetchShop(SUPABASE_URL, SUPABASE_SERVICE_KEY, parts[1], parts[2])
    if (shop) {
      meta = {
        title: `${shop.name} — Outpost`,
        description: shop.description
          ? String(shop.description).slice(0, 200)
          : `${shop.name} — collectibles shop in ${unslugCity(parts[1])}. Find hours, address, and more on Outpost.`,
        image: shop.image_url || undefined,
      }
    }
  } else if (parts[0] === 'city' && parts[1]) {
    const city = unslugCity(parts[1])
    meta = {
      title: `Collectibles Shops in ${city} — Outpost`,
      description: `Find card shops, comic stores, and collectibles dealers in ${city}. Every shop, every drop, near you.`,
    }
  } else if (parts[0] === 'marketplace' && parts[1] === 'trade' && parts[2]) {
    const trade = await fetchTrade(SUPABASE_URL, SUPABASE_SERVICE_KEY, parts[2])
    if (trade) {
      meta = {
        title: `Trade: ${trade.offer} for ${trade.look_for} — Outpost`,
        description: `Has: ${trade.offer}. Wants: ${trade.look_for}. Local trade on Outpost.`,
        image: trade.image_url || undefined,
      }
    }
  } else if (parts[0] === 'marketplace' && parts[1]) {
    const listing = await fetchListing(SUPABASE_URL, SUPABASE_SERVICE_KEY, parts[1])
    if (listing) {
      const price = listing.price != null ? `$${Number(listing.price).toLocaleString()} — ` : ''
      meta = {
        title: `${listing.title} — Outpost Marketplace`,
        description: listing.description
          ? String(listing.description).slice(0, 200)
          : `${price}${listing.title}${listing.condition ? ` (${listing.condition})` : ''}. For sale locally on Outpost.`,
        image: listing.image_url || undefined,
      }
    }
  }

  const html = meta ? injectMeta(originHtml, { ...meta, url: url.toString() }) : originHtml

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
