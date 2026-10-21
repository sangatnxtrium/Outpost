// Monthly prize drawing: data hook, Discover banner, drawing page and helpers.
// Everything renders nothing if the drawings tables/RPCs don't exist yet
// (migration 005 not run) or there's no live drawing.
import React, { useCallback, useEffect, useState } from 'react'
import { Gift, Ticket, Tag, FileText, ChevronRight } from 'lucide-react'
import { supabase } from './lib/supabase'
import { BRAND, CountdownBig, CountUp, celebrate, toast } from './polish'

export type Drawing = {
  id: string; title: string; prize_description: string; prize_image_url: string | null
  prize_arv_cents: number | null; starts_at: string; ends_at: string; status: string; max_entries_per_user: number
  social_bonus_entries?: number
}
export type DrawingStats = { total_entries: number; entrants: number; my_entries: number; my_listing_entries: number; my_free_claimed: boolean; my_social_entries: number }

// --- Mountain Time month window ------------------------------------------------
// Offset (minutes) of America/Denver from UTC at a given instant, e.g. -360 / -420.
function denverOffsetMin(at: Date) {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', timeZoneName: 'shortOffset' })
    .formatToParts(at).find(p => p.type === 'timeZoneName')?.value || 'GMT-7'
  const m = s.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : -420
}
// Wall-clock time in Denver -> UTC Date (DST-aware).
export function denverToUtc(y: number, mo: number, d: number, h = 0, mi = 0, s = 0) {
  const guess = Date.UTC(y, mo, d, h, mi, s)
  let off = denverOffsetMin(new Date(guess - (-420) * 6e4))
  off = denverOffsetMin(new Date(guess - off * 6e4))
  return new Date(guess - off * 6e4)
}
// "2026-11" -> 1st 00:00 MT through last day 23:59:59 MT.
export function monthWindowMT(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { starts_at: denverToUtc(y, m - 1, 1, 0, 0, 0), ends_at: denverToUtc(y, m - 1, last, 23, 59, 59) }
}
export const fmtMT = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
export const fmtArv = (c: number | null | undefined) => c == null ? null : `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

// --- data -----------------------------------------------------------------------
export function useDrawing(userId: string | null) {
  const [drawing, setDrawing] = useState<Drawing | null>(null)
  const [stats, setStats] = useState<DrawingStats | null>(null)

  const loadStats = useCallback(async (id: string) => {
    const { data, error } = await supabase.rpc('drawing_stats', { p_drawing_id: id })
    if (error) { setStats(null); return null }
    const r = (Array.isArray(data) ? data[0] : data) || {}
    const s: DrawingStats = { total_entries: Number(r.total_entries || 0), entrants: Number(r.entrants || 0), my_entries: Number(r.my_entries || 0), my_listing_entries: Number(r.my_listing_entries || 0), my_free_claimed: !!r.my_free_claimed, my_social_entries: Number(r.my_social_entries || 0) }
    setStats(s); return s
  }, [])

  const load = useCallback(async () => {
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('drawings')
      .select('id,title,prize_description,prize_image_url,prize_arv_cents,starts_at,ends_at,status,max_entries_per_user,social_bonus_entries')
      .eq('status', 'scheduled').lte('starts_at', now).gt('ends_at', now)
      .order('starts_at').limit(1)
    // Missing table (migration not run) or any error: hide the feature.
    if (error || !data?.length) { setDrawing(null); setStats(null); return }
    setDrawing(data[0] as Drawing)
    loadStats(data[0].id)
  }, [loadStats])

  useEffect(() => { load() }, [load, userId])

  const [mySocial, setMySocial] = useState<SocialSubmission[]>([])
  const loadSocial = useCallback(async (drawingId: string) => {
    if (!userId) { setMySocial([]); return }
    const { data, error } = await supabase.from('drawing_social_submissions')
      .select('id,platform,post_url,status,note,created_at').eq('drawing_id', drawingId).eq('user_id', userId).order('created_at')
    setMySocial(error ? [] : (data as SocialSubmission[]) || [])
  }, [userId])
  useEffect(() => { if (drawing) loadSocial(drawing.id) }, [drawing, loadSocial])

  const submitSocial = useCallback(async (platform: SocialPlatform, url: string): Promise<boolean> => {
    if (!drawing || !userId) return false
    const v = validateSocialUrl(platform, url)
    if (!v.ok) { toast((v as any).error, 'error'); return false }
    const { error } = await supabase.from('drawing_social_submissions').insert({ drawing_id: drawing.id, user_id: userId, platform, post_url: v.url })
    if (error) {
      toast(/duplicate|unique/i.test(error.message) ? 'You already submitted this post or this platform for this drawing.' : error.message, 'error')
      return false
    }
    toast('Submitted! We\u2019ll review your post soon.', 'success')
    loadSocial(drawing.id)
    return true
  }, [drawing, userId, loadSocial])

  // Call after a listing is created: if the trigger awarded an entry, celebrate.
  const checkForNewEntry = useCallback(async () => {
    if (!drawing) return
    const before = stats?.my_entries ?? 0
    // trigger runs in the insert transaction, so stats are already updated
    const s = await loadStats(drawing.id)
    if (s && s.my_entries > before) { celebrate(); toast('You earned a drawing entry! 🎟️', 'success') }
  }, [drawing, stats, loadStats])

  const claimFree = useCallback(async () => {
    if (!drawing) return
    const { data, error } = await supabase.rpc('claim_free_drawing_entry', { p_drawing_id: drawing.id })
    if (error) { toast(error.message, 'error'); return }
    if (data === 'already_claimed') toast('You already used your free entry for this drawing.', 'info')
    else { celebrate(); toast('Free entry added. Good luck! 🍀', 'success') }
    loadStats(drawing.id)
  }, [drawing, loadStats])

  return { drawing, stats, refresh: load, checkForNewEntry, claimFree, mySocial, submitSocial }
}

// --- social bonus -----------------------------------------------------------------
export type SocialPlatform = 'facebook' | 'x' | 'instagram' | 'tiktok'
export type SocialSubmission = { id: string; platform: SocialPlatform; post_url: string; status: 'pending' | 'approved' | 'rejected'; note: string | null; created_at: string }
export const PLATFORMS: { id: SocialPlatform; label: string; short: string; color: string; hosts: string[] }[] = [
  { id: 'facebook', label: 'Facebook', short: 'f', color: '#1877F2', hosts: ['facebook.com', 'fb.com', 'fb.watch'] },
  { id: 'x', label: 'X', short: '𝕏', color: '#000000', hosts: ['x.com', 'twitter.com'] },
  { id: 'instagram', label: 'Instagram', short: 'IG', color: '#E1306C', hosts: ['instagram.com', 'instagr.am'] },
  { id: 'tiktok', label: 'TikTok', short: 'TT', color: '#111111', hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'] },
]
export function PlatformIcon({ p, size = 22 }: { p: SocialPlatform; size?: number }) {
  const m = PLATFORMS.find(x => x.id === p)!
  return <span className="inline-flex items-center justify-center rounded-md font-black text-white flex-shrink-0" style={{ background: m.color, width: size, height: size, fontSize: size * 0.45, border: '1px solid rgba(255,255,255,0.2)' }}>{m.short}</span>
}
// Mirrors normalize_social_url() in SQL (the server is the source of truth).
export function validateSocialUrl(platform: SocialPlatform, raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u = raw.trim()
  if (!u) return { ok: false, error: 'Paste the link to your post' }
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  let url: URL
  try { url = new URL(u) } catch { return { ok: false, error: 'That doesn\u2019t look like a link' } }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.|web\.)/, '')
  const meta = PLATFORMS.find(x => x.id === platform)!
  if (!meta.hosts.includes(host)) return { ok: false, error: `That link isn\u2019t ${/^[aeiouIX]/.test(meta.label) ? 'an' : 'a'} ${meta.label} post` }
  const path = url.pathname.replace(/\/+$/, '')
  if (path.length < 2) return { ok: false, error: 'Paste the link to the post itself, not a profile home page' }
  return { ok: true, url: `https://${host === 'twitter.com' ? 'x.com' : host}${path}` }
}

export function SocialBonusCard({ drawing, isSignedIn, referralCode, mySocial, onSubmit, onSignIn }: {
  drawing: Drawing; isSignedIn: boolean; referralCode: string | null; mySocial: SocialSubmission[]
  onSubmit: (p: SocialPlatform, url: string) => Promise<boolean>; onSignIn: () => void
}) {
  const bonus = drawing.social_bonus_entries ?? 3
  const [platform, setPlatform] = useState<SocialPlatform>('instagram')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const link = referralCode ? `https://getoutpost.net/?ref=${referralCode}` : 'https://getoutpost.net'
  const caption = `I'm entered to win ${drawing.title} on Outpost, the app for finding card & comic shops, drops and trades near you. Join me: ${link} #OutpostGiveaway #contest`
  const used = new Set(mySocial.map(s => s.platform))
  const firstFree = PLATFORMS.find(p => !used.has(p.id))?.id
  useEffect(() => { if (used.has(platform) && firstFree) setPlatform(firstFree) }, [mySocial.length])
  const v = url ? validateSocialUrl(platform, url) : null
  const copy = async () => {
    try { await navigator.clipboard.writeText(caption); toast('Caption copied', 'success') } catch { toast('Couldn\u2019t copy. Long-press to select the text instead.', 'error') }
  }
  if (bonus <= 0) return null
  return (
    <div className="rounded-md p-4 border" style={{ background: BRAND.navy, borderColor: 'rgba(246,241,231,0.18)' }}>
      <p className="text-[11px] font-display tracking-[0.18em] uppercase" style={{ color: '#FFD166' }}>Optional · bonus</p>
      <p className="font-display text-2xl leading-tight" style={{ color: BRAND.cream }}>Earn {bonus} bonus entries</p>
      <p className="text-xs mt-1" style={{ color: 'rgba(246,241,231,0.75)' }}>Post about Outpost publicly with <b>#OutpostGiveaway #contest</b>, then paste the link. Each approved post earns {bonus} entries (one post per platform).</p>
      <div className="mt-3 rounded-md p-3 text-xs leading-relaxed" style={{ background: '#0A1A2B', color: BRAND.cream, border: '1px dashed rgba(246,241,231,0.25)' }}>{caption}</div>
      <button onClick={copy} className="mt-2 w-full rounded-md py-2 text-sm font-bold op-press" style={{ background: 'rgba(246,241,231,0.12)', color: BRAND.cream }}>Copy caption</button>
      <p className="text-[11px] text-zinc-500 mt-2">Facebook: post or comment with the hashtag; sharing is not required.</p>

      {!isSignedIn ? (
        <button onClick={onSignIn} className="mt-3 w-full rounded-md py-2.5 font-display text-lg text-white" style={{ background: BRAND.red }}>Sign in to submit a post</button>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            {PLATFORMS.map(p => (
              <button key={p.id} onClick={() => setPlatform(p.id)} disabled={used.has(p.id)}
                className="rounded-md py-2 flex flex-col items-center gap-1 text-[11px] border disabled:opacity-40"
                style={platform === p.id ? { borderColor: BRAND.red, background: 'rgba(239,62,54,0.15)', color: BRAND.cream } : { borderColor: 'rgba(246,241,231,0.15)', color: '#9ca3af' }}>
                <PlatformIcon p={p.id} />{p.label}
              </button>
            ))}
          </div>
          <input value={url} onChange={e => setUrl(e.target.value)} inputMode="url" placeholder={`Link to your ${PLATFORMS.find(p => p.id === platform)!.label} post`}
            className="w-full rounded-md px-3 py-2.5 text-sm outline-none bg-zinc-100 border" style={{ borderColor: v && !v.ok ? BRAND.red : 'rgba(246,241,231,0.15)' }} />
          {v && !v.ok && <p className="text-[11px]" style={{ color: '#FF9A93' }}>{(v as any).error}</p>}
          <button disabled={busy || !v?.ok || used.has(platform)} onClick={async () => { setBusy(true); if (await onSubmit(platform, url)) setUrl(''); setBusy(false) }}
            className="w-full rounded-md py-2.5 font-display text-lg text-white disabled:opacity-50 op-press" style={{ background: BRAND.red }}>
            {used.has(platform) ? 'Already submitted for this platform' : busy ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      )}

      {mySocial.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-display tracking-[0.15em] uppercase text-zinc-500">Your submissions</p>
          {mySocial.map(s => (
            <div key={s.id} className="flex items-center gap-2 rounded-md px-2.5 py-2" style={{ background: '#0A1A2B' }}>
              <PlatformIcon p={s.platform} size={20} />
              <a href={s.post_url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-xs truncate underline" style={{ color: BRAND.cream }}>{s.post_url.replace(/^https:\/\//, '')}</a>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0" style={
                s.status === 'approved' ? { background: '#F0FDF4', color: '#166534' } : s.status === 'rejected' ? { background: 'rgba(239,62,54,0.2)', color: '#FFB4AE' } : { background: 'rgba(246,241,231,0.12)', color: BRAND.cream }}>
                {s.status === 'approved' ? `Approved · +${bonus}` : s.status === 'rejected' ? 'Not approved' : 'Pending review'}
              </span>
            </div>
          ))}
          {mySocial.filter(s => s.status === 'rejected' && s.note).map(s => <p key={s.id + 'n'} className="text-[11px] text-zinc-500">Note on {PLATFORMS.find(p => p.id === s.platform)!.label}: {s.note}</p>)}
        </div>
      )}
      <p className="text-[11px] text-zinc-500 mt-3">Optional. You can always use the free entry instead. Posts must be public, follow the platform's rules and include #contest. Outpost isn't sponsored by or affiliated with any social platform.</p>
    </div>
  )
}

// --- UI -------------------------------------------------------------------------
export function DrawingBanner({ drawing, stats, onOpen }: { drawing: Drawing; stats: DrawingStats | null; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="w-full text-left rounded-md overflow-hidden relative op-in op-press flex items-stretch"
      style={{ background: BRAND.navy, border: `1px solid ${BRAND.red}` }}>
      {drawing.prize_image_url && <img src={drawing.prize_image_url} alt="" className="w-24 md:w-32 object-cover flex-shrink-0" />}
      <div className="flex-1 min-w-0 p-3">
        <p className="font-display text-[12px] tracking-[0.2em] uppercase flex items-center gap-1.5" style={{ color: '#FFD166' }}>
          <Gift className="h-3.5 w-3.5" /> Monthly drawing
        </p>
        <p className="font-display text-xl leading-tight truncate" style={{ color: BRAND.cream }}>Win: {drawing.title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(246,241,231,0.75)' }}>
          List an item = 1 entry{stats ? ` · ${stats.total_entries.toLocaleString()} entries so far` : ''}
        </p>
      </div>
      <div className="flex items-center pr-3"><ChevronRight className="h-5 w-5" style={{ color: BRAND.cream }} /></div>
    </button>
  )
}

export function DrawingPage({ drawing, stats, isSignedIn, onSignIn, onListItem, onClaimFree, onBack, social }: {
  drawing: Drawing; stats: DrawingStats | null; isSignedIn: boolean; social?: React.ReactNode
  onSignIn: () => void; onListItem: () => void; onClaimFree: () => void; onBack: () => void
}) {
  const arv = fmtArv(drawing.prize_arv_cents)
  const cap = drawing.max_entries_per_user
  return (
    <div className="p-4 space-y-3 max-w-lg op-in">
      <button onClick={onBack} className="text-xs text-zinc-400">← Back</button>
      <div className="rounded-md overflow-hidden" style={{ background: BRAND.navy, border: '1px solid rgba(246,241,231,0.15)' }}>
        <div className="relative aspect-[4/3]" style={{ background: '#0A1A2B' }}>
          {drawing.prize_image_url
            ? <img src={drawing.prize_image_url} alt={drawing.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Gift className="h-16 w-16" style={{ color: BRAND.red }} /></div>}
          <span className="absolute top-3 left-3 font-display text-xs tracking-[0.18em] px-2 py-1 rounded-md" style={{ background: BRAND.red, color: 'white' }}>MONTHLY DRAWING</span>
          {arv && <span className="absolute top-3 right-3 font-display text-sm px-2 py-1 rounded-md" style={{ background: BRAND.cream, color: BRAND.navy }}>ARV {arv}</span>}
        </div>
        <div className="p-4">
          <h1 className="font-display text-3xl leading-tight" style={{ color: BRAND.cream }}>{drawing.title}</h1>
          {drawing.prize_description && <p className="text-sm mt-1 whitespace-pre-line" style={{ color: 'rgba(246,241,231,0.8)' }}>{drawing.prize_description}</p>}
          <div className="mt-4 rounded-md px-3 py-2 flex items-center justify-between" style={{ background: 'rgba(239,62,54,0.15)', border: '1px solid rgba(239,62,54,0.4)' }}>
            <span className="text-[11px] font-display tracking-[0.18em] uppercase" style={{ color: '#FFD166' }}>Ends in</span>
            <CountdownBig start={new Date(drawing.ends_at)} />
          </div>
          <p className="text-[11px] mt-1 text-zinc-500">Ends {fmtMT(drawing.ends_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md p-3 bg-zinc-50 border border-zinc-100">
          <p className="text-[11px] font-display tracking-[0.15em] uppercase text-zinc-500">Your entries</p>
          <p className="font-display text-4xl leading-none mt-1" style={{ color: BRAND.cream }}>
            {isSignedIn ? <CountUp value={stats?.my_entries ?? 0} /> : '—'}
          </p>
          {isSignedIn && <p className="text-[11px] text-zinc-500 mt-1">{stats?.my_listing_entries ?? 0}/{cap} from listings{stats?.my_free_claimed ? ' · +1 free' : ''}{stats?.my_social_entries ? ` · +${stats.my_social_entries} social` : ''}</p>}
        </div>
        <div className="rounded-md p-3 bg-zinc-50 border border-zinc-100">
          <p className="text-[11px] font-display tracking-[0.15em] uppercase text-zinc-500">Total entries</p>
          <p className="font-display text-4xl leading-none mt-1" style={{ color: BRAND.cream }}><CountUp value={stats?.total_entries ?? 0} /></p>
          <p className="text-[11px] text-zinc-500 mt-1">{(stats?.entrants ?? 0).toLocaleString()} collectors</p>
        </div>
      </div>

      <button onClick={isSignedIn ? onListItem : onSignIn} className="w-full rounded-md py-3 font-display text-lg tracking-wide text-white flex items-center justify-center gap-2 op-press" style={{ background: BRAND.red }}>
        <Tag className="h-5 w-5" /> List an item to earn an entry
      </button>
      <p className="text-[11px] text-zinc-500 -mt-1 px-1">Each new listing with a photo and price earns 1 entry, up to {cap} per drawing. Deleted listings lose their entry.</p>
      <button onClick={isSignedIn ? onClaimFree : onSignIn} disabled={isSignedIn && !!stats?.my_free_claimed}
        className="w-full rounded-md py-3 font-display text-lg tracking-wide flex items-center justify-center gap-2 op-press disabled:opacity-60"
        style={{ background: BRAND.cream, color: BRAND.navy }}>
        <Ticket className="h-5 w-5" /> {stats?.my_free_claimed ? 'Free entry claimed' : 'Free entry'}
      </button>
      <p className="text-[11px] text-zinc-500 px-1">No purchase or listing necessary. One free entry per person per drawing.</p>
      {social}
      <a href="/drawing/rules" className="flex items-center justify-center gap-1.5 text-xs underline text-zinc-400 py-2">
        <FileText className="h-3.5 w-3.5" /> Official Rules
      </a>
    </div>
  )
}

// --- Official Rules (template) ----------------------------------------------------
export function DrawingRules() {
  const [d, setD] = useState<Drawing | null>(null)
  useEffect(() => {
    const now = new Date().toISOString()
    supabase.from('drawings').select('*').eq('status', 'scheduled').gt('ends_at', now).order('starts_at').limit(1)
      .then(({ data }) => setD((data?.[0] as Drawing) || null))
  }, [])
  const start = d ? fmtMT(d.starts_at) : '[START DATE, 12:00 AM MT]'
  const end = d ? fmtMT(d.ends_at) : '[END DATE, 11:59 PM MT]'
  const prize = d?.title || '[PRIZE]'
  const arv = fmtArv(d?.prize_arv_cents) || '$[ARV]'
  const cap = d?.max_entries_per_user ?? 10
  const H = ({ children }: { children: React.ReactNode }) => <h2 className="font-display text-xl mt-6 mb-1" style={{ color: BRAND.cream }}>{children}</h2>
  return (
    <div className="min-h-screen" style={{ background: '#0A1A2B', color: '#D8DDD9' }}>
      <div className="max-w-2xl mx-auto px-5 py-10 text-sm leading-relaxed">
        <a href="/drawing" className="text-xs underline text-zinc-400">← Back to the drawing</a>
        <h1 className="font-display text-4xl mt-3" style={{ color: BRAND.cream }}>Outpost Monthly Drawing — Official Rules</h1>
        <p className="mt-2 font-bold" style={{ color: BRAND.cream }}>NO PURCHASE OR LISTING NECESSARY TO ENTER OR WIN. A PURCHASE OR LISTING WILL NOT INCREASE YOUR CHANCES OF WINNING BEYOND THE ENTRY LIMITS BELOW. VOID WHERE PROHIBITED.</p>

        <H>1. Sponsor</H>
        <p>Outpost (getoutpost.net), [SPONSOR LEGAL NAME AND MAILING ADDRESS] ("Sponsor").</p>
        <H>2. Eligibility</H>
        <p>Open to legal residents of the fifty (50) United States and D.C. who are at least eighteen (18) years old [or the age of majority in their state, if older] at the time of entry and have an Outpost account. [EXCLUDED STATES, IF ANY.] Employees of Sponsor and their immediate family members and household members are not eligible. Void where prohibited or restricted by law.</p>
        <H>3. Entry Period</H>
        <p>The drawing begins {start} and ends {end} (the "Entry Period"). Sponsor's clock is the official timekeeper.</p>
        <H>4. How to Enter</H>
        <p><b>Listing entry:</b> while signed in, create a new marketplace listing during the Entry Period that includes at least one photo and a price. Each qualifying listing earns one (1) entry, up to {cap} listing entries per person per drawing. Listings that are deleted, fraudulent, duplicative, or that violate Outpost's Terms of Service do not count and their entries may be removed.</p>
        <p className="mt-2"><b>Free entry (no listing required):</b> while signed in, tap "Free entry" on the drawing page to receive one (1) entry. Limit one free entry per person per drawing. [OPTIONAL: alternative mail-in entry — hand-print your name, email, and phone number on a 3"x5" card and mail to [ADDRESS], postmarked by the end of the Entry Period; limit one per person.]</p>
        <p className="mt-2"><b>Optional social bonus entry:</b> during the Entry Period, publish a public post on Facebook, X, Instagram, or TikTok about Outpost that includes the hashtags #OutpostGiveaway and #contest, then submit the post's link on the drawing page. On Facebook you may post or comment with the hashtag; sharing is not required. Each post approved by Sponsor earns {d?.social_bonus_entries ?? 3} bonus entries, limited to one approved post per platform per person per drawing. Posts must be original, remain public through the winner selection, comply with the platform's terms, and not be misleading or offensive; Sponsor may reject posts at its discretion and remove entries for posts later deleted or found non-compliant. <b>The social method is optional:</b> the free entry above remains available to everyone, and social posting is not required to enter or win.</p>
        <p className="mt-2"><b>Disclosure (FTC):</b> participants who post about Outpost in exchange for bonus entries must clearly disclose that connection, for example by including #contest (or #sweepstakes) in the post. This drawing is not sponsored, endorsed, or administered by, or associated with, Meta (Facebook/Instagram), X Corp., or TikTok, and each platform is released from all liability. [Confirm with counsel: some platforms prohibit requiring shares or tags as an entry condition; this method only asks for an original post or comment.]</p>
        <p className="mt-2">Limit one Outpost account per person. Use of multiple accounts, bots, or automated means will void all of a participant's entries.</p>
        <H>5. Prize</H>
        <p>One (1) prize: {prize}. Approximate retail value (ARV): {arv}. No cash or substitution except by Sponsor, who may substitute a prize of equal or greater value. Taxes are the winner's responsibility. Winner may be required to complete an IRS Form W-9 if the prize value is $600 or more.</p>
        <H>6. Odds</H>
        <p>Odds of winning depend on the total number of eligible entries received during the Entry Period. Each eligible entry (listing, free, or social bonus) has an equal chance of being selected. Maximum per person: {cap} listing entries + 1 free entry + {(d?.social_bonus_entries ?? 3) * 4} social bonus entries.</p>
        <H>7. Winner Selection & Notification</H>
        <p>On or about [DRAW DATE] after the Entry Period ends, Sponsor will select one (1) winning entry in a random drawing from all eligible entries. The potential winner will be notified by email and/or in-app message within [7] days and must respond within [7] days [and sign an affidavit of eligibility/release where lawful], or an alternate winner may be selected. Sponsor ships the prize to a U.S. address at no cost to the winner.</p>
        <H>8. General</H>
        <p>By entering, participants agree to these Official Rules and Sponsor's decisions, which are final. Sponsor may cancel, modify, or suspend the drawing if fraud, technical failure, or any other factor impairs its integrity. Released parties are not responsible for lost, late, or misdirected entries. This drawing is not sponsored, endorsed, or administered by, or associated with, Apple, Google, or any card or comic publisher.</p>
        <H>9. Privacy & Winner List</H>
        <p>Personal information is used per Outpost's <a className="underline" href="/privacy">Privacy Policy</a>. For the winner's name, email [ADDRESS] within 30 days after the drawing ends.</p>

        <p className="mt-8 text-xs p-3 rounded-md" style={{ background: 'rgba(239,62,54,0.12)', border: '1px solid rgba(239,62,54,0.4)' }}>
          Template only, not legal advice. Bracketed items must be completed, and these rules should be reviewed by a qualified attorney before launch. Sweepstakes laws vary by state (e.g. NY and FL have registration/bonding requirements for prizes over $5,000).
        </p>
      </div>
    </div>
  )
}
