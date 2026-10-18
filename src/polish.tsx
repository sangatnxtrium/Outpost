// UI polish helpers: toasts, celebrations, count-ups, countdowns, tilt cards,
// skeletons and the Founding Member progress/reveal. Kept dependency-light:
// canvas-confetti (~4 KB gz) is loaded lazily only when something celebrates.
import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'

export const BRAND = { red: '#EF3E36', redHi: '#FF6B5E', navy: '#113150', cream: '#F6F1E7' }

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const finePointer = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

// ---------------------------------------------------------------- toasts
type ToastKind = 'success' | 'error' | 'info'
type ToastItem = { id: number; msg: string; kind: ToastKind }
let toastSeq = 0
const listeners = new Set<(t: ToastItem) => void>()
export function toast(msg: unknown, kind: ToastKind = 'info') {
  const t = { id: ++toastSeq, msg: String(msg ?? ''), kind }
  listeners.forEach(l => l(t))
}
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    const on = (t: ToastItem) => {
      setItems(xs => [...xs.slice(-2), t])
      setTimeout(() => setItems(xs => xs.filter(x => x.id !== t.id)), t.kind === 'error' ? 5000 : 3500)
    }
    listeners.add(on)
    return () => { listeners.delete(on) }
  }, [])
  return (
    <div className="fixed z-[100] left-1/2 -translate-x-1/2 top-4 flex flex-col gap-2 w-[min(92vw,420px)] pointer-events-none" role="status" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className="op-toast pointer-events-auto rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl border flex items-start gap-2"
          onClick={() => setItems(xs => xs.filter(x => x.id !== t.id))}
          style={t.kind === 'error'
            ? { background: '#2A0E10', borderColor: BRAND.red, color: '#FFD9D6' }
            : t.kind === 'success'
              ? { background: BRAND.cream, borderColor: BRAND.cream, color: BRAND.navy }
              : { background: BRAND.navy, borderColor: '#2A5378', color: BRAND.cream }}>
          <span aria-hidden>{t.kind === 'error' ? '⚠️' : t.kind === 'success' ? '🎉' : '📍'}</span>
          <span className="flex-1">{t.msg}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- celebrate
export async function celebrate(opts: { big?: boolean } = {}) {
  try { navigator.vibrate?.(opts.big ? [20, 40, 60] : 30) } catch { /* unsupported */ }
  if (prefersReducedMotion()) return
  const { default: confetti } = await import('canvas-confetti')
  const colors = [BRAND.red, BRAND.cream, BRAND.navy, '#FFD166']
  confetti({ particleCount: opts.big ? 160 : 90, spread: opts.big ? 100 : 70, origin: { y: 0.7 }, colors, disableForReducedMotion: true, zIndex: 120 })
  if (opts.big) setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors, zIndex: 120 }), 200)
  if (opts.big) setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors, zIndex: 120 }), 350)
}

// ---------------------------------------------------------------- count-up
export function CountUp({ value, duration = 900, className, style }: { value: number; duration?: number; className?: string; style?: React.CSSProperties }) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0)
  const from = useRef(0)
  useEffect(() => {
    if (prefersReducedMotion()) { setShown(value); return }
    const start = performance.now(); const a = from.current; let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(a + (value - a) * eased))
      if (p < 1) raf = requestAnimationFrame(step); else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className={className} style={style}>{shown.toLocaleString()}</span>
}

// Floating "+N" pill that rises and fades.
export function PlusPill({ text }: { text: string }) {
  return <span className="op-plus pointer-events-none absolute -top-2 right-0 text-xs font-display px-2 py-0.5 rounded-full" style={{ background: BRAND.cream, color: BRAND.navy }}>{text}</span>
}

// ---------------------------------------------------------------- countdown
// Event start: event date (local) + optional "7:00 PM" time from eventMeta.
export function eventStart(dateIso: string, time?: string) {
  const d = new Date(dateIso + 'T00:00:00')
  const m = time?.match(/(\d{1,2}):(\d{2}) ([AP]M)/)
  if (m) { let h = Number(m[1]) % 12; if (m[3] === 'PM') h += 12; d.setHours(h, Number(m[2])) }
  return d
}
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(i) }, [ms])
  return now
}
const pad = (n: number) => String(n).padStart(2, '0')
// Compact chip: "LIVE" on the day, "in 3h 12m" / "in 2d 4h" up to two weeks out.
export function CountdownChip({ start, end }: { start: Date; end?: Date }) {
  const now = useNow(30000)
  const diff = start.getTime() - now
  const endT = (end ?? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59)).getTime()
  if (diff <= 0 && now <= endT) return <span className="op-live text-[10px] font-display px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: BRAND.red, color: 'white' }}><i className="op-dot" />LIVE</span>
  if (diff <= 0 || diff > 14 * 864e5) return null
  const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, mi = Math.floor(diff / 6e4) % 60
  return <span className="text-[11px] font-display px-1.5 py-0.5 rounded tabular-nums inline-block" style={{ background: 'rgba(246,241,231,0.12)', color: BRAND.cream }}>in {d ? `${d}d ${h}h` : `${h}h ${mi}m`}</span>
}
// Big ticking timer "2d 04:13:22".
export function CountdownBig({ start }: { start: Date }) {
  const now = useNow(1000)
  const diff = Math.max(0, start.getTime() - now)
  if (!diff) return <span className="font-display text-2xl" style={{ color: BRAND.cream }}>Happening now</span>
  const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, mi = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1000) % 60
  return (
    <span className="font-display tabular-nums flex items-baseline gap-1" style={{ color: BRAND.cream }}>
      {d > 0 && <><span className="text-2xl">{d}</span><span className="text-xs opacity-60 mr-1">d</span></>}
      <span className="text-2xl">{pad(h)}:{pad(mi)}:{pad(s)}</span>
    </span>
  )
}

// ---------------------------------------------------------------- tilt card
// Pointer tilt + holo sheen on mouse/trackpad; press-scale on touch; no motion
// at all when the user prefers reduced motion (CSS handles the rest).
export function TiltCard({ children, className = '', onClick, onMouseEnter, onMouseLeave }: {
  children: React.ReactNode; className?: string; onClick?: () => void; onMouseEnter?: () => void; onMouseLeave?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const enabled = useRef(finePointer() && !prefersReducedMotion())
  const move = (e: React.PointerEvent) => {
    if (!enabled.current || e.pointerType !== 'mouse' || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    ref.current.style.setProperty('--rx', `${(0.5 - y) * 8}deg`)
    ref.current.style.setProperty('--ry', `${(x - 0.5) * 10}deg`)
    ref.current.style.setProperty('--mx', `${x * 100}%`)
    ref.current.style.setProperty('--my', `${y * 100}%`)
  }
  const leave = () => {
    ref.current?.style.setProperty('--rx', '0deg'); ref.current?.style.setProperty('--ry', '0deg')
    onMouseLeave?.()
  }
  return (
    <div ref={ref} onPointerMove={move} onMouseEnter={onMouseEnter} onPointerLeave={leave} onClick={onClick}
      className={`op-card ${className}`}>
      {children}
      <span className="op-holo" aria-hidden />
    </div>
  )
}

// ---------------------------------------------------------------- skeletons
export function SkeletonGrid({ n = 6, square = false }: { n?: number; square?: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-50">
          <div className={`op-skel ${square ? 'aspect-square' : 'aspect-[4/3]'}`} />
          <div className="p-3 space-y-2"><div className="op-skel h-4 w-3/4 rounded" /><div className="op-skel h-3 w-1/3 rounded" /><div className="op-skel h-4 w-1/2 rounded-full" /></div>
        </div>
      ))}
    </div>
  )
}
export function SkeletonRows({ n = 5 }: { n?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 flex gap-3">
          <div className="op-skel h-14 w-14 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2 py-1"><div className="op-skel h-4 w-5/6 rounded" /><div className="op-skel h-3 w-1/3 rounded" /></div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- founding
// Real count of claimed Founding spots. Uses a head-only exact count on
// profiles (anon-readable under current RLS) and the cap from app_settings.
// Returns null on any error so the UI can hide the bar instead of faking it.
export function useFoundingCount() {
  const [state, setState] = useState<{ claimed: number; cap: number } | null>(null)
  const load = async () => {
    const [c, s] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_founding_member', true),
      supabase.from('app_settings').select('value').eq('key', 'founding_members_cap').maybeSingle(),
    ])
    if (c.error || c.count == null) { setState(null); return }
    const cap = Number(s.data?.value) || 1000
    setState({ claimed: Math.min(c.count, cap), cap })
  }
  useEffect(() => { load() }, [])
  return { founding: state, refetchFounding: load }
}
export function FoundingProgress({ claimed, cap, light = false }: { claimed: number; cap: number; light?: boolean }) {
  const pct = Math.max(2, Math.min(100, (claimed / cap) * 100))
  const left = cap - claimed
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[11px] font-display tracking-wide mb-1" style={{ color: light ? BRAND.navy : BRAND.cream }}>
        <span><CountUp value={claimed} /> / {cap.toLocaleString()} claimed</span>
        <span>{left > 0 ? `${left.toLocaleString()} left` : 'All claimed'}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: light ? 'rgba(17,49,80,0.15)' : 'rgba(246,241,231,0.18)' }}>
        <div className="op-bar h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${BRAND.cream}, #FFD166)` }} />
      </div>
    </div>
  )
}
export function FoundingReveal({ number, tier, onClose }: { number: number; tier: string; onClose: () => void }) {
  useEffect(() => { celebrate({ big: true }) }, [])
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 op-fade" style={{ background: 'rgba(5,15,28,0.85)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="op-reveal relative w-full max-w-xs aspect-[5/7] rounded-3xl p-6 text-center flex flex-col items-center justify-center overflow-hidden shadow-2xl"
        style={{ background: `linear-gradient(150deg, ${BRAND.red}, #B8211B 55%, ${BRAND.navy})`, border: `3px solid ${BRAND.cream}` }}
        onClick={e => e.stopPropagation()}>
        <span className="op-holo op-holo-on" aria-hidden />
        <img src="/icon-192.png" alt="" className="h-16 w-16 rounded-2xl mb-4 shadow-lg" />
        <p className="font-display text-sm tracking-[0.25em]" style={{ color: BRAND.cream }}>FOUNDING MEMBER</p>
        <p className="font-display text-7xl leading-none my-3" style={{ color: BRAND.cream }}>#{String(number).padStart(4, '0')}</p>
        <p className="text-sm text-white/85">Lifetime free {tier}. Forever.</p>
        <button onClick={onClose} className="mt-6 font-display tracking-wide px-6 py-2.5 rounded-full" style={{ background: BRAND.cream, color: BRAND.navy }}>LET'S GO</button>
      </div>
    </div>
  )
}
