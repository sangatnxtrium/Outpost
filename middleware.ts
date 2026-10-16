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

import { FOR_SHOPS, FOR_SHOPS_CONTACT_EMAIL, FOR_SHOPS_META } from './shared/forShops'

export const config = {
  // Every page-like path. API routes, image proxy, built assets and anything
  // with a file extension (icons, robots.txt, sitemap.xml, ...) are excluded.
  matcher: ['/((?!api/|img/|assets/|.*\\.).*)'],
}

// Top-level path segments the SPA actually handles. Keep in sync with
// src/main.tsx (admin/privacy/terms/for-shops) and applyRouteFromPath() in
// src/App.tsx (shop/city/marketplace/news/fcbd/profile/messages; '' = home).
const SPA_ROUTES = new Set([
  '', 'shop', 'city', 'marketplace', 'news', 'fcbd', 'profile', 'messages',
  'admin', 'privacy', 'terms', 'for-shops',
])

// Routes that get page-specific HTML/meta (at minimum a self-referencing
// canonical/og:url) from this middleware. Everything else that's a known SPA
// route ('' home, admin, profile, messages) passes straight through untouched.
const META_ROUTES = new Set(['shop', 'city', 'marketplace', 'for-shops', 'news', 'fcbd', 'privacy', 'terms'])

function setCanonical(html: string, pageUrl: string) {
  const u = escapeHtml(pageUrl)
  html = html.replace(/<link rel="canonical" href="[\s\S]*?"\s*\/?>/, () => `<link rel="canonical" href="${u}" />`)
  return html.replace(/<meta property="og:url" content="[\s\S]*?"\s*\/?>/, () => `<meta property="og:url" content="${u}" />`)
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
    `&select=name,description,image_url,address,category,categories,hours,phone,website,lat,lng&limit=1`
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] || null
}

async function fetchCityShops(supabaseUrl: string, serviceKey: string, citySlug: string) {
  const url = `${supabaseUrl}/rest/v1/shops` +
    `?city_slug=eq.${encodeURIComponent(citySlug)}` +
    `&name_slug=not.is.null` +
    `&select=name,name_slug,address,category,categories&order=name&limit=200`
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  if (!res.ok) return null
  return (await res.json()) as any[]
}

function shopCategories(shop: any): string[] {
  const cats = Array.isArray(shop.categories) && shop.categories.length > 0
    ? shop.categories
    : (shop.category ? [shop.category] : [])
  return cats.map((c: any) => String(c))
}

// JSON inside <script> must not be able to close the tag.
function jsonLd(data: unknown) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

const SITE = 'https://www.getoutpost.net'
const LINK = 'style="color:#0F9D8A"'
const MAIN_OPEN = '<main style="max-width:640px;margin:0 auto;padding:48px 20px;font-family:system-ui,sans-serif;color:#F5F5F4;background:#131615">'

function shopBody(shop: any, citySlug: string) {
  const city = unslugCity(citySlug)
  const cats = shopCategories(shop)
  const rows: string[] = []
  if (shop.address) rows.push(`<p><strong>Address:</strong> ${escapeHtml(String(shop.address))}</p>`)
  if (cats.length) rows.push(`<p><strong>Categories:</strong> ${escapeHtml(cats.join(', '))}</p>`)
  if (shop.hours) rows.push(`<p><strong>Hours:</strong> ${escapeHtml(String(shop.hours))}</p>`)
  if (shop.phone) rows.push(`<p><strong>Phone:</strong> ${escapeHtml(String(shop.phone))}</p>`)
  return `${MAIN_OPEN}
        <h1>${escapeHtml(String(shop.name))}</h1>
        <p>Collectibles shop in ${escapeHtml(city)}.</p>
        ${shop.description ? `<p>${escapeHtml(String(shop.description))}</p>` : ''}
        ${rows.join('\n        ')}
        <p><a href="/city/${encodeURIComponent(citySlug)}" ${LINK}>More shops in ${escapeHtml(city)}</a> · <a href="/" ${LINK}>Outpost home</a></p>
      </main>`
}

function shopJsonLd(shop: any, pageUrl: string) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: shop.name,
    url: pageUrl,
  }
  if (shop.description) data.description = String(shop.description).slice(0, 500)
  if (shop.address) data.address = String(shop.address)
  if (shop.phone) data.telephone = String(shop.phone)
  if (shop.image_url) data.image = String(shop.image_url)
  if (shop.website) data.sameAs = [String(shop.website)]
  const lat = Number(shop.lat), lng = Number(shop.lng)
  if (shop.lat != null && shop.lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    data.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng }
  }
  return jsonLd(data)
}

function cityBody(citySlug: string, shops: any[]) {
  const city = unslugCity(citySlug)
  const items = shops.map(s => {
    const cats = shopCategories(s)
    return `<li><a href="/shop/${encodeURIComponent(citySlug)}/${encodeURIComponent(String(s.name_slug))}" ${LINK}>${escapeHtml(String(s.name))}</a>` +
      `${s.address ? ` — ${escapeHtml(String(s.address))}` : ''}${cats.length ? ` (${escapeHtml(cats.join(', '))})` : ''}</li>`
  })
  return `${MAIN_OPEN}
        <h1>Card, Comic &amp; Collectibles Shops in ${escapeHtml(city)}</h1>
        <p>${shops.length} shop${shops.length === 1 ? '' : 's'} in ${escapeHtml(city)} on Outpost.</p>
        <ul>
        ${items.join('\n        ')}
        </ul>
        <p><a href="/" ${LINK}>Outpost home</a> · <a href="/for-shops" ${LINK}>Own a shop? Claim your listing</a></p>
      </main>`
}

function cityJsonLd(citySlug: string, shops: any[]) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Collectibles shops in ${unslugCity(citySlug)}`,
    itemListElement: shops.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Store',
        name: s.name,
        url: `${SITE}/shop/${citySlug}/${s.name_slug}`,
        ...(s.address ? { address: String(s.address) } : {}),
      },
    })),
  })
}

function forShopsBody() {
  const C = FOR_SHOPS
  return `${MAIN_OPEN}
        <h1>${escapeHtml(C.heading)}</h1>
        <p>${escapeHtml(C.intro)}</p>
        <h2>${escapeHtml(C.founding.title)}</h2>
        <p>${escapeHtml(C.founding.body)}</p>
        <h2>Why claim your shop</h2>
        <ul>
        ${C.benefits.map(b => `<li><strong>${escapeHtml(b.title)}.</strong> ${escapeHtml(b.body)}</li>`).join('\n        ')}
        </ul>
        <h2>How claiming works</h2>
        <ol>
        ${C.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('\n        ')}
        </ol>
        <p>${escapeHtml(C.einNote)}</p>
        <p>Questions? <a href="mailto:${FOR_SHOPS_CONTACT_EMAIL}" ${LINK}>${FOR_SHOPS_CONTACT_EMAIL}</a></p>
        <p><a href="/" ${LINK}>Find and claim your shop on Outpost</a></p>
      </main>`
}

const ROOT_RE = /<!--ssr-root-start-->[\s\S]*?<!--ssr-root-end-->/

function injectBody(html: string, body: string) {
  return html.replace(ROOT_RE, () => `<!--ssr-root-start-->\n      ${body}\n      <!--ssr-root-end-->`)
}

function injectHead(html: string, extra: string) {
  return html.replace('</head>', () => `    ${extra}\n  </head>`)
}

const NOINDEX = '<meta name="robots" content="noindex" />'

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

  // Keep canonical + Twitter card tags in sync with the page-specific values,
  // otherwise every shop/city/listing page would declare the homepage canonical.
  html = html.replace(
    /<link rel="canonical" href="[\s\S]*?"\s*\/?>/,
    `<link rel="canonical" href="${escapeHtml(opts.url)}" />`
  )
  html = html.replace(
    /<meta name="twitter:title" content="[\s\S]*?"\s*\/?>/,
    `<meta name="twitter:title" content="${title}" />`
  )
  html = html.replace(
    /<meta name="twitter:description" content="[\s\S]*?"\s*\/?>/,
    `<meta name="twitter:description" content="${description}" />`
  )

  if (opts.image) {
    html = html.replace(
      /<meta name="twitter:image" content="[\s\S]*?"\s*\/?>/,
      `<meta name="twitter:image" content="${escapeHtml(opts.image)}" />`
    )
    const imageTag = `<meta property="og:image" content="${escapeHtml(opts.image)}" />`
    if (/<meta property="og:image"/.test(html)) {
      html = html.replace(/<meta property="og:image" content="[\s\S]*?"\s*\/?>/, imageTag)
    } else {
      html = html.replace('</head>', `    ${imageTag}\n  </head>`)
    }
  }

  return html
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

export default async function middleware(request: Request) {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const top = parts[0] || ''

  const known = SPA_ROUTES.has(top)
  // Known SPA routes with nothing to inject: let the request continue
  // untouched (vercel.json rewrites serve index.html as before).
  if (known && !META_ROUTES.has(top)) return

  // Fetch the real static shell. /index.html has an extension, so it's
  // excluded by the matcher and goes straight to the static file.
  let originHtml: string
  try {
    const originRes = await fetch(new URL('/index.html', url))
    if (!originRes.ok) return
    originHtml = await originRes.text()
  } catch {
    return // fail open: normal SPA shell via rewrites
  }

  // Unknown top-level route: the SPA would just show the homepage, so tell
  // crawlers it's not a real page.
  if (!known) {
    return htmlResponse(injectHead(originHtml, NOINDEX), 404)
  }

  const pageUrl = url.origin + url.pathname

  if (top === 'for-shops') {
    let html = injectMeta(originHtml, { ...FOR_SHOPS_META, url: pageUrl })
    html = injectBody(html, forShopsBody())
    return htmlResponse(html)
  }

  // Pages with no server-side data: just make the canonical self-referencing.
  if (top === 'news' || top === 'fcbd' || top === 'privacy' || top === 'terms') {
    return htmlResponse(setCanonical(originHtml, pageUrl))
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // Env vars not available in this context for some reason — fail open and
    // serve the normal page rather than break the site.
    return htmlResponse(setCanonical(originHtml, pageUrl))
  }

  try {
    let meta: { title: string; description: string; image?: string } | null = null
    let body: string | null = null
    let ld: string | null = null
    let notFound = false

    if (top === 'shop' && parts[1] && parts[2]) {
      const shop = await fetchShop(SUPABASE_URL, SUPABASE_SERVICE_KEY, parts[1], parts[2])
      if (shop) {
        meta = {
          title: `${shop.name} — Outpost`,
          description: shop.description
            ? String(shop.description).slice(0, 200)
            : `${shop.name} — collectibles shop in ${unslugCity(parts[1])}. Find hours, address, and more on Outpost.`,
          image: shop.image_url || undefined,
        }
        body = shopBody(shop, parts[1])
        ld = shopJsonLd(shop, pageUrl)
      } else {
        notFound = true
      }
    } else if (top === 'city' && parts[1]) {
      const city = unslugCity(parts[1])
      meta = {
        title: `Collectibles Shops in ${city} — Outpost`,
        description: `Find card shops, comic stores, and collectibles dealers in ${city}. Every shop, every drop, near you.`,
      }
      const shops = await fetchCityShops(SUPABASE_URL, SUPABASE_SERVICE_KEY, parts[1])
      if (shops && shops.length > 0) {
        body = cityBody(parts[1], shops)
        ld = cityJsonLd(parts[1], shops)
      } else if (shops) {
        notFound = true // a city with no shops is a thin/empty page
      }
    } else if (top === 'marketplace' && parts[1] === 'trade' && parts[2]) {
      const trade = await fetchTrade(SUPABASE_URL, SUPABASE_SERVICE_KEY, parts[2])
      if (trade) {
        meta = {
          title: `Trade: ${trade.offer} for ${trade.look_for} — Outpost`,
          description: `Has: ${trade.offer}. Wants: ${trade.look_for}. Local trade on Outpost.`,
          image: trade.image_url || undefined,
        }
      } else {
        notFound = true
      }
    } else if (top === 'marketplace' && !parts[1]) {
      meta = {
        title: 'Marketplace: Buy, Sell & Trade Collectibles Locally — Outpost',
        description: 'Buy, sell and trade cards, comics and collectibles with collectors and shops near you on the Outpost marketplace.',
      }
    } else if (top === 'marketplace' && parts[1]) {
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
      } else {
        notFound = true
      }
    }

    let html = meta ? injectMeta(originHtml, { ...meta, url: pageUrl }) : setCanonical(originHtml, pageUrl)
    if (body) html = injectBody(html, body)
    if (ld) html = injectHead(html, ld)
    // Missing shop/listing/trade: keep 200 so the SPA still loads normally
    // (e.g. a just-created item), but keep it out of the index.
    if (notFound) html = injectHead(html, NOINDEX)
    return htmlResponse(html)
  } catch (e) {
    console.error('middleware render failed', e)
    return htmlResponse(setCanonical(originHtml, pageUrl)) // fail safe: normal shell
  }
}
