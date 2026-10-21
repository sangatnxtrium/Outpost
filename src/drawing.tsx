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
}
export type DrawingStats = { total_entries: number; entrants: number; my_entries: number; my_listing_entries: number; my_free_claimed: boolean }

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
    const s: DrawingStats = { total_entries: Number(r.total_entries || 0), entrants: Number(r.entrants || 0), my_entries: Number(r.my_entries || 0), my_listing_entries: Number(r.my_listing_entries || 0), my_free_claimed: !!r.my_free_claimed }
    setStats(s); return s
  }, [])

  const load = useCallback(async () => {
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('drawings')
      .select('id,title,prize_description,prize_image_url,prize_arv_cents,starts_at,ends_at,status,max_entries_per_user')
      .eq('status', 'scheduled').lte('starts_at', now).gt('ends_at', now)
      .order('starts_at').limit(1)
    // Missing table (migration not run) or any error: hide the feature.
    if (error || !data?.length) { setDrawing(null); setStats(null); return }
    setDrawing(data[0] as Drawing)
    loadStats(data[0].id)
  }, [loadStats])

  useEffect(() => { load() }, [load, userId])

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

  return { drawing, stats, refresh: load, checkForNewEntry, claimFree }
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

export function DrawingPage({ drawing, stats, isSignedIn, onSignIn, onListItem, onClaimFree, onBack }: {
  drawing: Drawing; stats: DrawingStats | null; isSignedIn: boolean
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
          {isSignedIn && <p className="text-[11px] text-zinc-500 mt-1">{stats?.my_listing_entries ?? 0}/{cap} from listings{stats?.my_free_claimed ? ' · +1 free' : ''}</p>}
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
        <p className="mt-2">Limit one Outpost account per person. Use of multiple accounts, bots, or automated means will void all of a participant's entries.</p>
        <H>5. Prize</H>
        <p>One (1) prize: {prize}. Approximate retail value (ARV): {arv}. No cash or substitution except by Sponsor, who may substitute a prize of equal or greater value. Taxes are the winner's responsibility. Winner may be required to complete an IRS Form W-9 if the prize value is $600 or more.</p>
        <H>6. Odds</H>
        <p>Odds of winning depend on the total number of eligible entries received during the Entry Period. Each eligible entry has an equal chance of being selected.</p>
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
