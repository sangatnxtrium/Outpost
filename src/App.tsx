import React, { useState, useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Compass, MapPin, Search, Flame, X, Store, User, ArrowLeftRight, Package, ChevronRight, Calendar, Menu, Navigation, Tag, Shield, ShieldCheck, DollarSign, Plus, Check, Phone, Bell, Heart, Star, BookOpen, Send, Globe, Newspaper, Share2, MessageCircle, ArrowLeft, Trash2 } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useShops, useReviews, useTradePosts, useCheckins, useEvents, useNews, useListings, useFcbd, useFcbdTitles, useNotifications, useAppSettings, useListingOffers, useFollows, useConversations, useMessages, useItemMessages, usePoints, useReferrals, useMyRedemptions, useRewardOffers, useMerchantRewards } from './hooks/useShops'
import { startCheckout } from './lib/stripe'
import { supabase } from './lib/supabase'

type TabType = 'discover' | 'classifieds' | 'marketplace' | 'news' | 'profile' | 'messages'
type ModalType = 'none' | 'sub' | 'auth' | 'notifications' | 'shop' | 'menu' | 'claim' | 'additem' | 'submit' | 'listsale' | 'listingdetail' | 'posttrade' | 'tradedetail' | 'editprofile' | 'setlocation' | 'userprofile'
// A photo slot in the listing/trade forms is either a URL already on the
// post (editing) or a freshly picked File waiting to be uploaded on submit.
type MktPhoto = { kind: 'existing'; url: string } | { kind: 'new'; file: File; preview: string }

// Turns a city_slug like "san-francisco" back into "San Francisco" for display.
// It's a display-only heuristic (there's no stored "proper" city name) so it
// can lose punctuation a real city name has (e.g. "st-marys" -> "St Marys",
// not "St. Marys") — acceptable for a page heading, not used for matching.
function unslugCity(slug: string) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Up-to-3 photo picker used by both the "List an item" and "Post a trade"
// forms. Filled slots show a thumbnail with a remove button; the next open
// slot is a tappable "add" tile (multi-select, so someone can pick 2-3 at
// once); any slots beyond that are just empty placeholders.
function PhotoSlots({ previews, onAdd, onRemove, label }: {
  previews: string[]
  onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: (i: number) => void
  label: string
}) {
  return (
    <div className="flex gap-2">
      {[0, 1, 2].map(i => {
        const preview = previews[i]
        if (preview) {
          return (
            <div key={i} className="relative w-full aspect-square rounded-2xl overflow-hidden border border-zinc-200">
              <img src={preview} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onRemove(i)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center">
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          )
        }
        if (i === previews.length) {
          return (
            <label key={i} className="w-full aspect-square rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center cursor-pointer">
              <div className="text-center text-zinc-400">
                <Plus className="h-5 w-5 mx-auto mb-0.5" />
                <span className="text-[10px]">{previews.length === 0 ? label : 'Add more'}</span>
              </div>
              <input type="file" accept="image/*" multiple onChange={onAdd} className="hidden" />
            </label>
          )
        }
        return <div key={i} className="w-full aspect-square rounded-2xl border-2 border-dashed border-zinc-100" />
      })}
    </div>
  )
}

function DropBanner({ shops }: { shops: any[] }) {
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(true)
  const drops = shops.filter(s => s.hot_find)
  useEffect(() => {
    if (drops.length <= 1) return
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => { setIdx(i => (i + 1) % drops.length); setFade(true) }, 300)
    }, 3000)
    return () => clearInterval(interval)
  }, [drops.length])
  if (!drops.length) return null
  const shop = drops[idx]
  return (
    <div className="rounded-3xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: '#0F9D8A', transform: 'translate(30%,-30%)' }} />
      <div className="flex items-center gap-2 mb-2">
        <Flame className="h-4 w-4 text-orange-400" />
        <span className="text-xs font-black uppercase tracking-widest text-orange-400">Latest Drop</span>
        {drops.length > 1 && (
          <div className="flex gap-1 ml-auto">
            {drops.map((_: any, i: number) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: i === idx ? '#0F9D8A' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        )}
      </div>
      <p className="text-sm font-bold leading-snug opacity-90 transition-opacity duration-300" style={{ opacity: fade ? 1 : 0 }}>"{shop.hot_find}"</p>
      <p className="text-xs mt-1 font-mono transition-opacity duration-300" style={{ color: 'rgba(255,255,255,0.4)', opacity: fade ? 1 : 0 }}>{shop.name}</p>
    </div>
  )
}

function LocalMap({ shops, onSelect, activeId, userLat, userLng }: { shops: any[], onSelect: (s: any) => void, activeId?: string | null, userLat?: number | null, userLng?: number | null }) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})

  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, { zoomControl: true }).setView([userLat || 39.7392, userLng || -104.9903], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 200)
    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    Object.values(markersRef.current).forEach((m: any) => map.removeLayer(m))
    markersRef.current = {}
    const pts: [number, number][] = []
    shops.forEach((s: any) => {
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return
      const icon = L.divIcon({ className: '', html: '<div class="op-pin"></div>', iconSize: [20, 20], iconAnchor: [10, 18], popupAnchor: [0, -16] })
      const m = L.marker([s.lat, s.lng], { icon }).addTo(map)
      m.bindPopup(`<strong>${s.name || ''}</strong><br>${s.address || ''}`)
      m.on('click', () => onSelect(s))
      markersRef.current[s.id] = m
      pts.push([s.lat, s.lng])
    })
    if (userLat && userLng) {
      L.circleMarker([userLat, userLng], { radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map)
    }
    if (pts.length) {
      try { map.fitBounds(pts, { padding: [50, 50], maxZoom: 13 }) } catch { /* noop */ }
    }
  }, [shops])

  useEffect(() => {
    const m = activeId ? markersRef.current[activeId] : null
    if (m) { m.openPopup(); const el = m._icon?.querySelector('.op-pin'); if (el) el.classList.add('on') }
    return () => {
      if (m) { m.closePopup(); const el = m._icon?.querySelector('.op-pin'); if (el) el.classList.remove('on') }
    }
  }, [activeId])

  return <div ref={elRef} className="w-full h-full" style={{ minHeight: 280, position: 'relative', zIndex: 0, isolation: 'isolate' }} />
}

function RadiusPicker({ lat, lng, radiusMiles }: { lat: number, lng: number, radiusMiles: number }) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const dotRef = useRef<any>(null)

  function fit() {
    const map = mapRef.current, circle = circleRef.current
    if (map && circle) { try { map.fitBounds(circle.getBounds(), { padding: [16, 16] }) } catch { /* noop */ } }
  }

  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false }).setView([lat, lng], 9)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    mapRef.current = map
    circleRef.current = L.circle([lat, lng], { radius: radiusMiles * 1609.34, color: '#0F9D8A', weight: 1.5, fillColor: '#0F9D8A', fillOpacity: 0.15 }).addTo(map)
    dotRef.current = L.circleMarker([lat, lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#0F9D8A', fillOpacity: 1 }).addTo(map)
    setTimeout(() => { map.invalidateSize(); fit() }, 150)
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    if (dotRef.current) dotRef.current.setLatLng([lat, lng])
    if (circleRef.current) { circleRef.current.setLatLng([lat, lng]); circleRef.current.setRadius(radiusMiles * 1609.34) }
    fit()
  }, [lat, lng, radiusMiles])

  return <div ref={elRef} className="w-full h-full" style={{ minHeight: 300, position: 'relative', zIndex: 0, isolation: 'isolate' }} />
}

function streetViewUrl(s: any): string | null {
  if (s?.image_url) return s.image_url
  if (typeof s?.lat === 'number' && typeof s?.lng === 'number') {
    return `/api/photo?lat=${s.lat}&lng=${s.lng}`
  }
  return null
}

function ShopThumb({ s, className = '' }: { s: any, className?: string }) {
  const [err, setErr] = useState(false)
  const url = err ? null : streetViewUrl(s)
  if (url) {
    return <img src={url} alt={s?.name || 'Shop'} loading="lazy" onError={() => setErr(true)} className={`${className} object-cover bg-zinc-100`} />
  }
  return <div className={`${className} bg-zinc-100 flex items-center justify-center text-zinc-400`}><Store className="h-6 w-6" /></div>
}

// Reduce precision so a poster's exact location is never stored or shown.
// Rounding to 2 decimals snaps to a ~0.7 mi grid (neighborhood level).
function fuzzCoord(n: number | null | undefined): number | null {
  if (typeof n !== 'number' || Number.isNaN(n)) return null
  return Math.round(n * 100) / 100
}

function fmtDist(d: number | null | undefined): string {
  if (d == null) return ''
  if (d < 1) return '< 1 mi'
  return `~${Math.round(d)} mi`
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (isNaN(t)) return ''
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  const d = Math.floor(s / 86400)
  if (d < 7) return `${d}d ago`
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const STANDING_STYLE: Record<string, { bg: string; fg: string }> = {
  New:         { bg: '#F4F4F5', fg: '#71717A' },
  Member:      { bg: '#E0F2FE', fg: '#0369A1' },
  Established: { bg: '#EDE9FE', fg: '#6D28D9' },
  Trusted:     { bg: '#FEF3C7', fg: '#B45309' },
}

function StandingBadge({ standing, verified, size = 'sm' }: { standing?: string | null; verified?: boolean; size?: 'sm' | 'lg' }) {
  if (!standing) return null
  const st = STANDING_STYLE[standing] || STANDING_STYLE.New
  const pad = size === 'lg' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
  const icon = size === 'lg' ? 'h-3.5 w-3.5' : 'h-3 w-3'
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className={`rounded-full font-bold uppercase tracking-wide ${pad}`} style={{ background: st.bg, color: st.fg }}>{standing}</span>
      {verified && (
        <span className={`inline-flex items-center gap-0.5 rounded-full font-bold uppercase tracking-wide ${pad}`} style={{ background: '#F0FDF4', color: '#166534' }}>
          <ShieldCheck className={icon} /> Verified
        </span>
      )}
    </span>
  )
}

function RatingBadge({ avgRating, count }: { avgRating?: number | null; count?: number | null }) {
  if (!avgRating || !count) return null
  return (
    <span className="inline-flex items-center gap-0.5 align-middle text-[11px] font-semibold text-zinc-500">
      <Star className="h-3 w-3" style={{ fill: '#F59E0B', color: '#F59E0B' }} />
      {avgRating.toFixed(1)} <span className="font-normal text-zinc-400">({count})</span>
    </span>
  )
}

function StarPicker({ value, onChange, size = 'md' }: { value: number; onChange: (n: number) => void; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7'
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star`}>
          <Star className={cls} style={n <= value ? { fill: '#F59E0B', color: '#F59E0B' } : { color: '#d4d4d8' }} />
        </button>
      ))}
    </div>
  )
}

function SellerOfferRow({ offer, onAccept, onDecline, onCounter }: { offer: any; onAccept: () => void; onDecline: () => void; onCounter: (amount: number, message: string) => void }) {
  const [counterOpen, setCounterOpen] = useState(false)
  const [counterAmount, setCounterAmount] = useState('')
  const [counterMessage, setCounterMessage] = useState('')
  return (
    <div className="rounded-2xl border border-zinc-200 p-3 space-y-1.5">
      <p className="text-sm text-zinc-700">${Number(offer.amount).toLocaleString()} <span className="text-xs text-zinc-400 capitalize">· {offer.status}</span></p>
      {offer.message && <p className="text-xs text-zinc-500">"{offer.message}"</p>}
      {offer.status === 'pending' && !counterOpen && (
        <div className="flex gap-2 pt-1">
          <button onClick={onAccept} className="flex-1 py-2 rounded-xl text-xs font-medium text-white" style={{ background: '#059669' }}>Accept</button>
          <button onClick={() => setCounterOpen(true)} className="flex-1 py-2 rounded-xl text-xs font-medium border border-zinc-200 text-zinc-600">Counter</button>
          <button onClick={onDecline} className="flex-1 py-2 rounded-xl text-xs font-medium border border-red-100 text-red-500">Decline</button>
        </div>
      )}
      {offer.status === 'pending' && counterOpen && (
        <div className="space-y-1.5 pt-1">
          <input type="number" min={1} value={counterAmount} onChange={e => setCounterAmount(e.target.value)} placeholder="$ counter amount"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none" />
          <input value={counterMessage} onChange={e => setCounterMessage(e.target.value)} placeholder="Message (optional)"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={() => { const amt = parseFloat(counterAmount); if (amt > 0) { onCounter(amt, counterMessage); setCounterOpen(false) } }}
              disabled={!counterAmount} className="flex-1 py-2 rounded-xl text-xs font-medium text-white disabled:opacity-50" style={{ background: '#0F9D8A' }}>Send counter</button>
            <button onClick={() => setCounterOpen(false)} className="flex-1 py-2 rounded-xl text-xs font-medium border border-zinc-200 text-zinc-500">Cancel</button>
          </div>
        </div>
      )}
      {offer.status === 'countered' && <p className="text-xs text-zinc-400">You countered ${Number(offer.counter_amount).toLocaleString()} — waiting on buyer.</p>}
      {offer.status === 'accepted' && <p className="text-xs text-emerald-600 font-medium">Accepted</p>}
      {(offer.status === 'declined' || offer.status === 'withdrawn') && <p className="text-xs text-zinc-400 capitalize">{offer.status}</p>}
    </div>
  )
}

function ItemMessages({ threads, loading, isOwner, currentUserId, isSignedIn, draft, setDraft, onSend, onOpenConversation, onSignIn }: any) {
  return (
    <div className="pt-4 mt-1 border-t border-zinc-100">
      <p className="font-semibold text-zinc-900 text-sm mb-2">Messages</p>
      {!isSignedIn ? (
        <button onClick={onSignIn} className="text-xs font-medium" style={{ color: '#0F9D8A' }}>Sign in to send a message</button>
      ) : isOwner ? (
        <>
          {loading && <p className="text-xs text-zinc-400">Loading…</p>}
          {!loading && threads.length === 0 && <p className="text-xs text-zinc-400">No messages yet.</p>}
          <div className="space-y-1">
            {threads.map((t: any) => (
              <button key={t.counterpartyId} onClick={() => onOpenConversation(t.counterpartyId)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-zinc-50 text-left transition-all">
                <div className="h-8 w-8 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center flex-shrink-0">
                  {t.profile?.avatar_url
                    ? <img src={t.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    : <User className="h-4 w-4 text-zinc-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">@{t.profile?.username || 'user'}</p>
                  <p className="text-xs text-zinc-400 truncate">{t.messages[t.messages.length - 1]?.body}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {loading && <p className="text-xs text-zinc-400 mb-2">Loading…</p>}
          {!loading && (!threads[0] || threads[0].messages.length === 0) && <p className="text-xs text-zinc-400 mb-2">No messages yet.</p>}
          {threads[0]?.messages.length > 0 && (
            <div className="space-y-2 mb-3">
              {threads[0].messages.map((m: any) => (
                <div key={m.id} className={`flex ${m.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[80%] rounded-2xl px-3 py-1.5 text-sm"
                    style={m.sender_id === currentUserId ? { background: '#0F9D8A', color: 'white' } : { background: '#f4f4f5', color: '#18181b' }}>
                    {m.body}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input value={draft} onChange={(e: any) => setDraft(e.target.value)} placeholder="Hi, I am interested in this item"
              className="flex-1 bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-sm focus:outline-none" />
            <button onClick={() => { if (draft.trim()) { onSend(draft); setDraft('') } }} disabled={!draft.trim()}
              className="h-10 px-4 rounded-full text-sm font-medium text-white disabled:opacity-50 flex-shrink-0" style={{ background: '#0F9D8A' }}>
              Send
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function categoryStyle(cat: string) {
  if (cat === 'comics') return { background: '#FEF3C7', color: '#92400E' }
  if (cat === 'cards') return { background: '#E0F2FE', color: '#0369A1' }
  return { background: '#EDE9FE', color: '#5B21B6' }
}

function Sidebar({ tab, setTab, isSignedIn, profile, setModal, unreadCount, unreadMessages }: any) {
  const items = [
    { id: 'discover', icon: Search, label: 'Discover' },
    { id: 'marketplace', icon: Store, label: 'Marketplace' },
    { id: 'messages', icon: MessageCircle, label: 'Messages' },
    { id: 'news', icon: Newspaper, label: 'News' },
    { id: 'profile', icon: User, label: 'Profile' },
  ]
  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-zinc-200 bg-zinc-50 h-screen sticky top-0 p-4 gap-1 flex-shrink-0">
      <div className="px-2 py-4 mb-2">
        <img src="/logo.png" alt="getOutpost.net" onClick={() => setTab('discover')} className="w-40 h-auto cursor-pointer" />
        <p className="text-[11px] text-zinc-400 mt-2 px-1">Every Shop. Every Drop. Near You.</p>
      </div>
      {items.map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => setTab(id as TabType)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all font-medium text-sm"
          style={tab === id ? { background: '#0F9D8A', color: 'white' } : { color: '#52525b' }}>
          <Icon className="h-4 w-4 flex-shrink-0" />
          {label}
          {id === 'messages' && unreadMessages > 0 && (
            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
              style={{ background: tab === id ? 'rgba(255,255,255,0.3)' : '#0F9D8A' }}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>
          )}
        </button>
      ))}
      <div className="mt-auto space-y-2">
        <button onClick={() => setModal('notifications')}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-bold text-zinc-500 hover:bg-zinc-50 transition-all border border-zinc-100">
          <Bell className="h-4 w-4" />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#0F9D8A' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>
        {isSignedIn ? (
          <div className="px-3 py-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
            <p className="font-black text-sm">@{profile?.username}</p>
            <p className="text-xs text-zinc-400 font-mono">{profile?.role} · {profile?.tier}</p>
          </div>
        ) : (
          <button onClick={() => setModal('auth')}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all"
            style={{ background: '#0F9D8A' }}>
            Sign in
          </button>
        )}
        <button onClick={() => setModal('sub')}
          className="w-full py-2.5 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all">
          Subscription
        </button>
        <a href="https://www.getoutpost.net" target="_blank" rel="noopener noreferrer"
          className="block text-center text-[11px] text-zinc-400 hover:text-zinc-600 pt-1 transition-colors">
          getoutpost.net
        </a>
      </div>
    </aside>
  )
}

export default function App() {
  const { user, profile, loading: authLoading, sendOtp, verifyOtp, signOut, updateProfile } = useAuth()
  const { shops, loading: shopsLoading, updateHotFind, updateShop } = useShops()
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const selectedShop = shops.find((s: any) => s.id === selectedShopId) || null
  const { reviews, addReview } = useReviews(selectedShop?.id || '')
  const { checkinCount, userCheckedIn, checkIn } = useCheckins(selectedShop?.id || '')
  const { tradePosts, loading: tradePostsLoading, addTradePost, updateTradePost, deleteTradePost } = useTradePosts()
  const { events: allEventsData } = useEvents()
  const { articles: newsArticles } = useNews()
  const [newsFilter, setNewsFilter] = useState('All')
  const { listings, loading: listingsLoading, uploadPhoto, createListing, updateListing, deleteListing } = useListings()
  const { items: notifications, unread: unreadCount, refetch: refetchNotifs, markAllRead } = useNotifications(user?.id || null)
  const { following, followingProfiles, toggleFollow } = useFollows(user?.id || null)
  const { balance: opBalance, claimFoundingMember } = usePoints(user?.id || null)
  const { referralCode, referredBy, referredUsers, claimReferral } = useReferrals(user?.id || null)

  // Capture ?ref=CODE from an invite link before it's routed away, and claim
  // it automatically once the visitor signs in (claim_referral() is safe to
  // call more than once — it no-ops if the user already has a referrer).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      sessionStorage.setItem('outpost_ref', ref.toUpperCase())
      params.delete('ref')
      const rest = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (rest ? '?' + rest : ''))
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const pending = sessionStorage.getItem('outpost_ref')
    if (pending) {
      claimReferral(pending).finally(() => sessionStorage.removeItem('outpost_ref'))
    }
  }, [user])
  const { redemptions: myRedemptions } = useMyRedemptions(user?.id || null)
  const { offers: shopRewardOffers, redeemOffer } = useRewardOffers(selectedShop?.id || null)
  const { offers: myShopOffers, pendingRedemptions: myShopPendingRedemptions, createOffer: createRewardOffer, deleteOffer: deleteRewardOffer, confirmCode: confirmRewardCode } = useMerchantRewards(selectedShop?.id || null)
  const [referralCodeInput, setReferralCodeInput] = useState('')
  const [newOfferTitle, setNewOfferTitle] = useState('')
  const [newOfferDesc, setNewOfferDesc] = useState('')
  const [newOfferCost, setNewOfferCost] = useState('500')
  const [newOfferQty, setNewOfferQty] = useState('')
  const [confirmCodeInput, setConfirmCodeInput] = useState('')
  const [redeemedCode, setRedeemedCode] = useState<string | null>(null)
  const { conversations, loading: conversationsLoading, totalUnread: unreadMessages } = useConversations(user?.id || null)
  const { settings: appSettings } = useAppSettings()
  const FCBD_YEAR = parseInt(appSettings.fcbd_year || '') || 2027
  const FCBD_DATE = new Date(`${appSettings.fcbd_date || '2027-05-01'}T00:00:00`)
  const FCBD_DATE_LABEL = FCBD_DATE.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const FCBD_MONTH = FCBD_DATE.toLocaleDateString('en-US', { month: 'long' })
  const fcbdDaysLeft = Math.max(0, Math.ceil((FCBD_DATE.getTime() - Date.now()) / 86400000))
  const { participants: fcbdShops, upsertParticipation, getMyParticipation } = useFcbd(FCBD_YEAR)
  const fcbdShopIds = new Set(fcbdShops.map((p: any) => p.shop_id))
  const fcbdOfferByShop = new Map(fcbdShops.map((p: any) => [p.shop_id, p.offers]))
  const { titles: fcbdTitles } = useFcbdTitles(FCBD_YEAR)
  const [fcbdParticipating, setFcbdParticipating] = useState(true)
  const [fcbdOffers, setFcbdOffers] = useState('')
  const [fcbdSaving, setFcbdSaving] = useState(false)
  const [fcbdSaved, setFcbdSaved] = useState(false)
  const [fcbdLoaded, setFcbdLoaded] = useState(false)
  const [rsvps, setRsvps] = useState<string[]>([])
  const [tab, setTab] = useState<TabType>('discover')
  const [hoverShopId, setHoverShopId] = useState<string | null>(null)
  const [savedShops, setSavedShops] = useState<string[]>([])
  const [savedListings, setSavedListings] = useState<string[]>([])
  const [savedTrades, setSavedTrades] = useState<string[]>([])
  const [myRating, setMyRating] = useState<number | null>(null)
  const [ratingDraft, setRatingDraft] = useState(0)
  const [buyerPickerOpen, setBuyerPickerOpen] = useState(false)
  const [myTradeRating, setMyTradeRating] = useState<number | null>(null)
  const [tradeRatingDraft, setTradeRatingDraft] = useState(0)
  const [tradePartnerPickerOpen, setTradePartnerPickerOpen] = useState(false)
  const [offerFormOpen, setOfferFormOpen] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [standingMap, setStandingMap] = useState<Record<string, any>>({})
  const [showStandingInfo, setShowStandingInfo] = useState(false)
  const [showRewardsInfo, setShowRewardsInfo] = useState(false)
  const [reportedIds, setReportedIds] = useState<string[]>([])
  const [modal, setModal] = useState<ModalType>('none')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onbStep, setOnbStep] = useState(1)
  const [onbInterest, setOnbInterest] = useState<string | null>(null)
  const [radius, setRadius] = useState(10)
  const [activeSection, setActiveSection] = useState<'shops' | 'events' | 'fcbd'>('shops')
  const [urlCity, setUrlCity] = useState<string | null>(null)
  const initialRouteHandled = useRef(false)
  const [discoverView, setDiscoverView] = useState<'list' | 'map'>('list')
  const [eventFilter, setEventFilter] = useState('all')
  const [eventState, setEventState] = useState('all')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [locationDenied, setLocationDenied] = useState(false)
  const [inpRev, setInpRev] = useState('')
  const [inpFind, setInpFind] = useState('')
  const [editingCategories, setEditingCategories] = useState(false)
  const [editingInfo, setEditingInfo] = useState(false)
  const [inpWebsite, setInpWebsite] = useState('')
  const [inpPhone, setInpPhone] = useState('')
  const [inpHours, setInpHours] = useState('')
  const [inpDesc, setInpDesc] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [shopCategories, setShopCategories] = useState<string[]>([])
  const [inpOff, setInpOff] = useState('')
  const [inpWant, setInpWant] = useState('')
  const [ebayResults, setEbayResults] = useState<any[]>([])
  const [ebaySearching, setEbaySearching] = useState(false)
  const [lastEbaySearch, setLastEbaySearch] = useState('')
  const [einInput, setEinInput] = useState('')
  const [submitType, setSubmitType] = useState<'shop' | 'event'>('shop')
  const [submitName, setSubmitName] = useState('')
  const [submitAddress, setSubmitAddress] = useState('')
  const [submitDetails, setSubmitDetails] = useState('')
  const [submitSent, setSubmitSent] = useState(false)
  const [claimName, setClaimName] = useState('')
  const [claimAddress, setClaimAddress] = useState('')
  const [claimPhone, setClaimPhone] = useState('')
  const [claimCategory, setClaimCategory] = useState('cards')
  const [claimCategories, setClaimCategories] = useState<string[]>(['cards'])
  const [claimHours, setClaimHours] = useState('')
  const [claimStep, setClaimStep] = useState(1)
  const [claimShopId, setClaimShopId] = useState<string | null>(null)
  const [existingClaim, setExistingClaim] = useState<any>(null)
  const [claimCheckLoading, setClaimCheckLoading] = useState(false)
  const [mktTitle, setMktTitle] = useState('')
  const [mktPrice, setMktPrice] = useState('')
  const [mktQuantity, setMktQuantity] = useState('1')
  const [mktDesc, setMktDesc] = useState('')
  const [mktCondition, setMktCondition] = useState('Raw')
  const [mktCategory, setMktCategory] = useState('cards')
  const [mktContact, setMktContact] = useState('')
  const [mktPhotos, setMktPhotos] = useState<MktPhoto[]>([])
  const mktPreviewUrls = mktPhotos.map(p => p.kind === 'existing' ? p.url : p.preview)
  const [editingListingId, setEditingListingId] = useState<string | null>(null)
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null)
  const [galleryBusy, setGalleryBusy] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [mktSubmitting, setMktSubmitting] = useState(false)
  const [mktFilter, setMktFilter] = useState('all')
  const [mktSearch, setMktSearch] = useState('')
  const [mktRadius, setMktRadius] = useState<number | 'any'>(50)
  const [locRadius, setLocRadius] = useState(50)
  const [locTarget, setLocTarget] = useState<'community' | 'discover'>('community')
  const [mktSection, setMktSection] = useState<'sale' | 'trade'>('sale')
  const [selectedListing, setSelectedListing] = useState<any>(null)
  const { offers, makeOffer, sellerRespond, buyerRespondToCounter, withdrawOffer } = useListingOffers(selectedListing?.id || '', user?.id || null)
  const [viewedProfileUserId, setViewedProfileUserId] = useState<string | null>(null)
  const [viewedProfile, setViewedProfile] = useState<any>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messageDraft, setMessageDraft] = useState('')
  const { messages: threadMessages, loading: threadLoading, sendMessage: sendThreadMessage } = useMessages(user?.id || null, activeConversationId)
  const [itemMsgDraft, setItemMsgDraft] = useState('')
  const [selectedTrade, setSelectedTrade] = useState<any>(null)
  const { threads: listingMsgThreads, loading: listingMsgLoading, sendItemMessage: sendListingItemMessage } = useItemMessages(user?.id || null, selectedListing?.id || null, 'listing')
  const { threads: tradeMsgThreads, loading: tradeMsgLoading, sendItemMessage: sendTradeItemMessage } = useItemMessages(user?.id || null, selectedTrade?.id || null, 'trade')
  const [showContact, setShowContact] = useState(false)
  const [epName, setEpName] = useState('')
  const [epAvatarFile, setEpAvatarFile] = useState<File | null>(null)
  const [epAvatarPreview, setEpAvatarPreview] = useState('')
  const [epBannerFile, setEpBannerFile] = useState<File | null>(null)
  const [epBannerPreview, setEpBannerPreview] = useState('')
  const [epSaving, setEpSaving] = useState(false)
  const [role, setRole] = useState<'hunter' | 'merchant'>('hunter')
  const [email, setEmail] = useState('')
  const [authStep, setAuthStep] = useState<'gate' | 'verify'>('gate')
  const [authCode, setAuthCode] = useState(['','','','','',''])
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading2, setAuthLoading2] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const codeRefs = Array.from({length: 6}, () => useRef<HTMLInputElement>(null))

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationLoading(false)
      setLocationDenied(true)
      return
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        setLocationLoading(false)
        setLocationDenied(false)
      },
      (err) => {
        console.log('Geolocation error:', err.code, err.message)
        setLocationLoading(false)
        setLocationDenied(true)
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: false }
    )
  }

  useEffect(() => {
    requestLocation()
  }, [])

  useEffect(() => {
    try {
      if (!localStorage.getItem('outpost_onboarded')) setShowOnboarding(true)
    } catch { /* localStorage unavailable */ }
  }, [])

  function finishOnboarding() {
    try { localStorage.setItem('outpost_onboarded', '1') } catch { /* noop */ }
    if (onbInterest) { setFilter(onbInterest); goTab('discover'); setActiveSection('shops') }
    setShowOnboarding(false)
  }

  useEffect(() => {
    if (!user) { setSavedShops([]); setSavedListings([]); setSavedTrades([]); setRsvps([]); return }
    let active = true
    supabase.from('saved_shops').select('shop_id').eq('user_id', user.id).then(({ data }) => {
      if (active && data) setSavedShops(data.map((r: any) => r.shop_id))
    })
    supabase.from('saved_listings').select('listing_id').eq('user_id', user.id).then(({ data }) => {
      if (active && data) setSavedListings(data.map((r: any) => r.listing_id))
    })
    supabase.from('saved_trades').select('trade_id').eq('user_id', user.id).then(({ data }) => {
      if (active && data) setSavedTrades(data.map((r: any) => r.trade_id))
    })
    supabase.from('event_rsvps').select('event_id').eq('user_id', user.id).then(({ data }) => {
      if (active && data) setRsvps(data.map((r: any) => r.event_id))
    })
    // Record one activity row per day (idempotent) — powers "active days" in standing
    const today = new Date().toISOString().slice(0, 10)
    supabase.from('user_activity').upsert({ user_id: user.id, day: today }, { onConflict: 'user_id,day', ignoreDuplicates: true }).then(() => {})
    return () => { active = false }
  }, [user?.id])

  async function loadStanding(ids: (string | null | undefined)[]) {
    const missing = Array.from(new Set(ids.filter((id): id is string => !!id && !(id in standingMap))))
    if (missing.length === 0) return
    const { data } = await supabase
      .from('user_standing')
      .select('user_id, standing, is_verified_seller, score, member_since, avg_rating, ratings_count')
      .in('user_id', missing)
    setStandingMap(prev => {
      const next = { ...prev }
      if (data) for (const row of data) next[row.user_id] = row
      for (const id of missing) if (!(id in next)) next[id] = null // cache misses to avoid refetch
      return next
    })
  }

  async function reportSeller(targetUserId: string) {
    if (!user) { setModal('auth'); return }
    if (!targetUserId || targetUserId === user.id) return
    if (reportedIds.includes(targetUserId)) return
    setReportedIds(prev => [...prev, targetUserId])
    const { error } = await supabase.from('user_reports').insert({ reported_user_id: targetUserId, reporter_id: user.id, reason: 'reported in app' })
    if (error && !/duplicate|unique/i.test(error.message)) {
      setReportedIds(prev => prev.filter(id => id !== targetUserId)) // revert on real failure
    }
  }

  async function toggleSaveShop(shopId: string) {
    const isSaved = savedShops.includes(shopId)
    setSavedShops(isSaved ? savedShops.filter(id => id !== shopId) : [...savedShops, shopId])
    if (!user) return
    if (isSaved) {
      await supabase.from('saved_shops').delete().eq('user_id', user.id).eq('shop_id', shopId)
    } else {
      await supabase.from('saved_shops').upsert({ user_id: user.id, shop_id: shopId })
    }
  }

  async function toggleSaveListing(listingId: string) {
    if (!user) { setModal('auth'); return }
    const isSaved = savedListings.includes(listingId)
    setSavedListings(isSaved ? savedListings.filter(id => id !== listingId) : [...savedListings, listingId])
    if (isSaved) {
      await supabase.from('saved_listings').delete().eq('user_id', user.id).eq('listing_id', listingId)
    } else {
      await supabase.from('saved_listings').upsert({ user_id: user.id, listing_id: listingId })
    }
  }

  async function toggleSaveTrade(tradeId: string) {
    if (!user) { setModal('auth'); return }
    const isSaved = savedTrades.includes(tradeId)
    setSavedTrades(isSaved ? savedTrades.filter(id => id !== tradeId) : [...savedTrades, tradeId])
    if (isSaved) {
      await supabase.from('saved_trades').delete().eq('user_id', user.id).eq('trade_id', tradeId)
    } else {
      await supabase.from('saved_trades').upsert({ user_id: user.id, trade_id: tradeId })
    }
  }

  const [shareCopied, setShareCopied] = useState(false)
  async function shareUrl(path: string, title: string) {
    const url = `https://www.getoutpost.net${path}`
    if (navigator.share) {
      try { await navigator.share({ title, url }); return } catch { /* user cancelled — fall through to nothing */ return }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch { /* clipboard unavailable — nothing more we can do */ }
  }

  async function toggleRsvp(eventId: string) {
    const going = rsvps.includes(eventId)
    setRsvps(going ? rsvps.filter(id => id !== eventId) : [...rsvps, eventId])
    if (!user) return
    if (going) {
      await supabase.from('event_rsvps').delete().eq('user_id', user.id).eq('event_id', eventId)
    } else {
      await supabase.from('event_rsvps').upsert({ user_id: user.id, event_id: eventId })
    }
  }

  const sortedShops = locationLoading ? [] : [...shops]
    .map((s: any) => ({ ...s, distance: userLat && userLng ? getDistance(userLat, userLng, s.lat, s.lng) : null }))
    .sort((a: any, b: any) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance
      if (a.distance !== null) return -1
      if (b.distance !== null) return 1
      return 0
    })
    .filter((s: any) => {
      if (userLat && userLng) return s.distance !== null && s.distance <= radius
      if (locationDenied) return s.address?.includes(', CO') // show Colorado shops if denied
      return false // hide while loading
    })
    .slice(0, 50)

  // On a /city/:citySlug page, show every shop in that city regardless of
  // the visitor's own location/radius (a city landing page shouldn't be
  // empty just because geolocation hasn't resolved yet, or filtered by
  // someone else's radius preference).
  const cityShops = urlCity ? shops.filter((s: any) => s.city_slug === urlCity) : null
  const discoverReady = urlCity ? true : !locationLoading

  const filteredShops = (cityShops ?? sortedShops).filter((s: any) =>
    (filter === 'all' || s.category === filter || (s.categories && s.categories.includes(filter))) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase())))
  )

  const inRadius = (distance: number | null) =>
    mktRadius === 'any' || !userLat || !userLng || (distance != null && distance <= mktRadius)

  const mktQuery = mktSearch.trim().toLowerCase()
  const sortedListings = [...listings]
    .filter((l: any) => l.status === 'active')
    .map((l: any) => ({ ...l, distance: userLat && userLng && l.lat && l.lng ? getDistance(userLat, userLng, l.lat, l.lng) : null }))
    .filter((l: any) => mktFilter === 'all' || l.category === mktFilter)
    .filter((l: any) => inRadius(l.distance))
    .filter((l: any) => !mktQuery || `${l.title || ''} ${l.description || ''} ${l.category || ''} ${l.condition || ''}`.toLowerCase().includes(mktQuery))
    .sort((a: any, b: any) => {
      if (a.distance == null && b.distance == null) return 0
      if (a.distance == null) return 1
      if (b.distance == null) return -1
      return a.distance - b.distance
    })
  const myListings = user ? listings.filter((l: any) => l.user_id === user.id) : []
  const myTrades = user ? tradePosts.filter((t: any) => t.user_id === user.id) : []
  const myEvents = rsvps
    .map((id: string) => allEventsData.find((e: any) => e.id === id))
    .filter(Boolean)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))

  const sortedTrades = [...tradePosts]
    .map((t: any) => ({ ...t, distance: userLat && userLng && t.lat && t.lng ? getDistance(userLat, userLng, t.lat, t.lng) : null }))
    .filter((t: any) => inRadius(t.distance))
    .filter((t: any) => !mktQuery || `${t.offer || ''} ${t.look_for || ''} ${t.username || ''}`.toLowerCase().includes(mktQuery))
    .sort((a: any, b: any) => {
      if (a.distance == null && b.distance == null) return 0
      if (a.distance == null) return 1
      if (b.distance == null) return -1
      return a.distance - b.distance
    })

  const allEvents = allEventsData
  const eventStates = ['all', ...Array.from(new Set(allEventsData.map((ev: any) => ev.state).filter(Boolean))).sort()]
  const filteredEvents = allEvents.filter((ev: any) =>
    (eventFilter === 'all' || ev.category === eventFilter || (ev.categories && ev.categories.includes(eventFilter))) &&
    (eventState === 'all' || ev.state === eventState)
  )

  const isSignedIn = !!user
  const isMerchant = profile?.role === 'merchant'
  const myShop = shops.find((s: any) => s.owner_id === user?.id) || null

  useEffect(() => {
    if (myShop && !fcbdLoaded) {
      getMyParticipation(myShop.id).then((rec: any) => {
        if (rec) {
          setFcbdParticipating(rec.participating)
          setFcbdOffers(rec.offers || '')
        }
        setFcbdLoaded(true)
      })
    }
  }, [myShop, fcbdLoaded])

  async function handleFcbdSave() {
    if (!myShop || !user) return
    setFcbdSaving(true)
    setFcbdSaved(false)
    await upsertParticipation({
      shop_id: myShop.id,
      owner_id: user.id,
      year: FCBD_YEAR,
      participating: fcbdParticipating,
      offers: fcbdOffers.trim() || null,
    })
    setFcbdSaving(false)
    setFcbdSaved(true)
  }

  const TAB_PATHS: Record<TabType, string> = {
    discover: '/', classifieds: '/marketplace', marketplace: '/marketplace',
    news: '/news', profile: '/profile', messages: '/messages',
  }

  // Every setTab(...) that represents real user navigation should go through
  // this instead, so the URL always reflects the visible tab (bookmarking,
  // sharing, and back/forward all depend on that staying true).
  function goTab(id: TabType) {
    setTab(id)
    window.history.pushState({}, '', TAB_PATHS[id] || '/')
  }

  function openShop(s: any) {
    setSelectedShopId(s.id); setModal('shop')
    if (s.city_slug && s.name_slug) {
      window.history.pushState({}, '', `/shop/${s.city_slug}/${s.name_slug}`)
    }
  }

  function closeShop() {
    setModal('none')
    window.history.pushState({}, '', urlCity ? `/city/${urlCity}` : '/')
  }

  function openListing(item: any) {
    setSelectedListing(item); setShowContact(false); setModal('listingdetail')
    if (item.slug) window.history.pushState({}, '', `/marketplace/${item.slug}`)
  }

  function closeListing() {
    setModal('none')
    window.history.pushState({}, '', '/marketplace')
  }

  function openTrade(item: any) {
    setSelectedTrade(item); setModal('tradedetail')
    if (item.slug) window.history.pushState({}, '', `/marketplace/trade/${item.slug}`)
  }

  function closeTrade() {
    setModal('none')
    window.history.pushState({}, '', '/marketplace')
  }

  function applyRouteFromPath(path: string, shopList: any[], listingList: any[], tradeList: any[]) {
    const parts = path.split('/').filter(Boolean)

    if (parts[0] === 'shop' && parts[1] && parts[2]) {
      const match = shopList.find((s: any) => s.city_slug === parts[1] && s.name_slug === parts[2])
      if (match) {
        setUrlCity(parts[1]); setSelectedShopId(match.id); setModal('shop')
        setTab('discover'); setActiveSection('shops')
      }
      return
    }
    if (parts[0] === 'city' && parts[1]) {
      setUrlCity(parts[1]); setModal('none')
      setTab('discover'); setActiveSection('shops')
      return
    }
    if (parts[0] === 'marketplace' && parts[1] === 'trade' && parts[2]) {
      const match = tradeList.find((t: any) => t.slug === parts[2])
      setTab('marketplace'); setMktSection('trade')
      if (match) { setSelectedTrade(match); setModal('tradedetail') } else { setModal('none') }
      return
    }
    if (parts[0] === 'marketplace' && parts[1]) {
      const match = listingList.find((l: any) => l.slug === parts[1])
      setTab('marketplace'); setMktSection('sale')
      if (match) { setSelectedListing(match); setModal('listingdetail') } else { setModal('none') }
      return
    }
    if (parts[0] === 'marketplace') { setTab('marketplace'); setModal('none'); return }
    if (parts[0] === 'news') { setTab('news'); setModal('none'); return }
    if (parts[0] === 'fcbd') { setTab('discover'); setActiveSection('fcbd'); setModal('none'); return }
    if (parts[0] === 'profile') { setTab('profile'); setModal('none'); return }
    if (parts[0] === 'messages') { setTab('messages'); setModal('none'); return }

    // '/' or anything unrecognized
    setUrlCity(null); setModal('none'); setTab('discover')
  }

  // Open the tab/item the URL points to once everything routing can match
  // against has loaded. Only runs once on initial load — after that, in-app
  // navigation (goTab/openShop/openListing/etc.) and the popstate listener
  // below own the URL <-> state sync.
  useEffect(() => {
    if (initialRouteHandled.current) return
    if (shopsLoading || listingsLoading || tradePostsLoading) return
    initialRouteHandled.current = true
    applyRouteFromPath(window.location.pathname, shops, listings, tradePosts)
  }, [shops, shopsLoading, listings, listingsLoading, tradePosts, tradePostsLoading])

  // Browser back/forward
  useEffect(() => {
    function onPopState() { applyRouteFromPath(window.location.pathname, shops, listings, tradePosts) }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [shops, listings, tradePosts])


  async function searchEbay(query: string) {
    if (query.length < 3) { setEbayResults([]); return }
    if (query === lastEbaySearch) return
    setEbaySearching(true)
    setLastEbaySearch(query)

    const appId = import.meta.env.VITE_EBAY_APP_ID

    try {
      if (appId) {
        // Real eBay Browse API
        const res = await fetch(
          `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&category_ids=183454,2536,749&limit=6&sort=bestMatch`,
          {
            headers: {
              'Authorization': `Bearer ${appId}`,
              'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
              'Content-Type': 'application/json',
            }
          }
        )

        if (res.ok) {
          const data = await res.json()
          const items = data.itemSummaries || []
          setEbayResults(items.map((item: any) => ({
            id: item.itemId,
            title: item.title,
            price: parseFloat(item.price?.value || '0'),
            condition: item.condition || 'See listing',
            url: item.itemWebUrl,
            image: item.image?.imageUrl,
          })))
          setEbaySearching(false)
          return
        }
      }
    } catch (err) {
      console.log('eBay API error, using Finding API fallback')
    }

    // Fallback: eBay Finding API (works with App ID directly)
    try {
      const res = await fetch(
        `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsByKeywords&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${appId}&RESPONSE-DATA-FORMAT=JSON&keywords=${encodeURIComponent(query)}&paginationInput.entriesPerPage=6&itemFilter(0).name=ListingType&itemFilter(0).value=FixedPrice&sortOrder=BestMatch`
      )
      const data = await res.json()
      const items = data?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || []
      if (items.length > 0) {
        setEbayResults(items.map((item: any) => ({
          id: item.itemId?.[0],
          title: item.title?.[0],
          price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'),
          condition: item.condition?.[0]?.conditionDisplayName?.[0] || 'See listing',
          url: item.viewItemURL?.[0],
          image: item.galleryURL?.[0],
        })))
        setEbaySearching(false)
        return
      }
    } catch (err) {
      console.log('eBay Finding API error')
    }

    // Final fallback: mock data
    setEbayResults([
      { id: '1', title: `${query} PSA 9`, price: Math.floor(Math.random() * 400 + 80), condition: 'Graded', url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}` },
      { id: '2', title: `${query} Raw Near Mint`, price: Math.floor(Math.random() * 200 + 30), condition: 'Ungraded', url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}` },
      { id: '3', title: `${query} CGC 9.8`, price: Math.floor(Math.random() * 800 + 200), condition: 'Graded', url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}` },
      { id: '4', title: `${query} 1st Edition`, price: Math.floor(Math.random() * 1200 + 400), condition: 'Graded', url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}` },
    ])
    setEbaySearching(false)
  }

  async function handleAuthSend(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setAuthLoading2(true); setAuthError(null)
    const { error } = await sendOtp(email, role)
    setAuthLoading2(false)
    if (error) { setAuthError(error); return }
    setAuthStep('verify')
    setAuthCode(['','','','','',''])
    setTimeout(() => codeRefs[0].current?.focus(), 80)
  }

  function handleCodeInput(i: number, val: string) {
    const v = val.replace(/\D/g, '').slice(0,1)
    const next = [...authCode]; next[i] = v; setAuthCode(next)
    if (v && i < 5) setTimeout(() => codeRefs[i+1].current?.focus(), 0)
  }

  function handleCodeKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !authCode[i] && i > 0) codeRefs[i-1].current?.focus()
  }

  async function handleSwapCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f || !selectedShop || !user) return
    setGalleryBusy(true)
    const url = await uploadPhoto(f, user.id)
    if (url) {
      await updateShop(selectedShop.id, { image_url: url })
    }
    setGalleryBusy(false)
  }

  async function handleAddShopPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f || !selectedShop || !user) return
    const current = (selectedShop as any).gallery || []
    if (current.length >= 5) return
    setGalleryBusy(true)
    const url = await uploadPhoto(f, user.id)
    if (url) {
      const next = [...current, url]
      await updateShop(selectedShop.id, { gallery: next })
    }
    setGalleryBusy(false)
  }

  async function handleRemoveShopPhoto(url: string) {
    if (!selectedShop) return
    const next = ((selectedShop as any).gallery || []).filter((g: string) => g !== url)
    await updateShop(selectedShop.id, { gallery: next })
  }

  async function handleSaveShopInfo() {
    if (!selectedShop) return
    setSavingInfo(true)
    const fields = {
      website: inpWebsite.trim() || null,
      phone: inpPhone.trim() || null,
      hours: inpHours.trim() || null,
      description: inpDesc.trim() || null,
    }
    const { error } = await updateShop(selectedShop.id, fields)
    setSavingInfo(false)
    if (!error) {
      setEditingInfo(false)
    }
  }

  async function handleClaimSubmit() {
    if (!user) return
    setClaimStep(3)
    await supabase.from('shop_claims').insert({
      user_id: user.id,
      username: profile?.username || user.email?.split('@')[0] || 'unknown',
      email: user.email || '',
      shop_id: claimShopId,
      shop_name: claimName,
      shop_address: claimAddress,
      phone: claimPhone,
      category: claimCategory,
      hours: claimHours,
      ein: einInput,
      status: 'pending',
    })
  }

  async function handleAuthVerify(e: React.FormEvent) {
    e.preventDefault()
    const code = authCode.join('')
    if (code.length < 6) return
    setAuthLoading2(true); setAuthError(null)
    const { error } = await verifyOtp(email, code)
    setAuthLoading2(false)
    if (error) { setAuthError('Invalid code. Please try again.'); return }
    closeModal()
  }

  async function openClaimModal(shop?: any) {
    if (!user) { setModal('auth'); return }
    setClaimCheckLoading(true)
    const { data } = await supabase
      .from('shop_claims')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved'])
      .maybeSingle()
    setExistingClaim(data || null)
    if (shop) {
      setClaimShopId(shop.id)
      setClaimName(shop.name || '')
      setClaimAddress(shop.address || '')
      setClaimPhone(shop.phone || '')
      setClaimCategory(shop.category || 'cards')
      setClaimHours(shop.hours || '')
    } else {
      setClaimShopId(null)
    }
    setClaimCheckLoading(false)
    setModal('claim')
  }

  function closeModal() {
    setModal('none'); setAuthStep('gate')
    setAuthCode(['','','','','','']); setAuthError(null)
    setClaimStep(1)
    setExistingClaim(null)
  }

  async function handleUpgrade(tier: 'elite' | 'store') {
    if (!user || !profile) { setModal('auth'); return }
    setCheckoutLoading(true)
    const { error, upgraded } = await startCheckout(tier, user.email || '', user.id)
    setCheckoutLoading(false)
    if (error) { alert(error); return }
    if (upgraded) {
      alert(`🎉 You're now on the ${tier === 'elite' ? 'Elite' : 'Verified Store'} plan — free until 2028!`)
      setModal('none')
      window.location.reload()
    }
  }

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inpRev.trim() || !user || !selectedShop) return
    if ((selectedShop as any).owner_id === user.id) return
    const { error } = await addReview(selectedShop.id, user.id, profile?.username || 'Guest', inpRev, 5)
    if (error) { alert(error); return }
    setInpRev('')
  }

  async function handleTradeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inpOff.trim() || !inpWant.trim() || !user) return
    const urls: string[] = []
    for (const p of mktPhotos) {
      if (p.kind === 'existing') { urls.push(p.url); continue }
      const url = await uploadPhoto(p.file, user.id)
      if (url) urls.push(url)
    }
    if (editingTradeId) {
      await updateTradePost(editingTradeId, { offer: inpOff, look_for: inpWant, image_url: urls[0] || null, gallery: urls.slice(1) })
      setEditingTradeId(null)
    } else {
      await addTradePost(user.id, profile?.username || 'Guest', inpOff, inpWant, urls[0] || null, fuzzCoord(userLat), fuzzCoord(userLng), urls.slice(1))
    }
    setInpOff(''); setInpWant(''); setMktPhotos([]); setModal('none')
  }

  function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || [])
    if (picked.length === 0) return
    const room = 3 - mktPhotos.length
    const accepted = picked.slice(0, room)
    setMktPhotos(prev => [...prev, ...accepted.map(file => ({ kind: 'new' as const, file, preview: URL.createObjectURL(file) }))])
    e.target.value = ''
  }

  function removeMktPhoto(i: number) {
    setMktPhotos(prev => prev.filter((_, idx) => idx !== i))
  }

  useEffect(() => {
    setRatingDraft(0)
    setBuyerPickerOpen(false)
    setOfferFormOpen(false)
    setOfferAmount('')
    setOfferMessage('')
    setItemMsgDraft('')
    if (!user || !selectedListing?.id) { setMyRating(null); return }
    let active = true
    supabase.from('user_ratings').select('rating').eq('rater_id', user.id).eq('listing_id', selectedListing.id).maybeSingle()
      .then(({ data }: any) => { if (active) setMyRating(data?.rating ?? null) })
    return () => { active = false }
  }, [selectedListing?.id, user?.id])

  useEffect(() => {
    setTradeRatingDraft(0)
    setTradePartnerPickerOpen(false)
    setItemMsgDraft('')
    if (!user || !selectedTrade?.id) { setMyTradeRating(null); return }
    let active = true
    supabase.from('user_ratings').select('rating').eq('rater_id', user.id).eq('trade_id', selectedTrade.id).maybeSingle()
      .then(({ data }: any) => { if (active) setMyTradeRating(data?.rating ?? null) })
    return () => { active = false }
  }, [selectedTrade?.id, user?.id])

  useEffect(() => {
    if (!viewedProfileUserId) { setViewedProfile(null); return }
    let active = true
    supabase.from('profiles').select('id, username, display_name, avatar_url, banner_url').eq('id', viewedProfileUserId).maybeSingle()
      .then(({ data }: any) => { if (active) setViewedProfile(data) })
    loadStanding([viewedProfileUserId])
    return () => { active = false }
  }, [viewedProfileUserId])

  function openUserProfile(userId: string) {
    if (!userId) return
    setViewedProfileUserId(userId)
    setModal('userprofile')
  }

  function closeUserProfile() {
    setModal('none')
    setViewedProfileUserId(null)
  }

  function messageSeller(recipientId: string, draft?: string) {
    if (!user) { setModal('auth'); return }
    if (!recipientId || recipientId === user.id) return
    setActiveConversationId(recipientId)
    setMessageDraft(draft || '')
    setModal('none')
    goTab('messages')
  }

  async function submitRating(ratedUserId: string, target: { listingId?: string; tradeId?: string }, rating: number) {
    if (!user || !ratedUserId) return
    const payload: any = { rater_id: user.id, rated_user_id: ratedUserId, rating }
    if (target.listingId) payload.listing_id = target.listingId
    if (target.tradeId) payload.trade_id = target.tradeId
    const onConflict = target.listingId ? 'rater_id,listing_id' : 'rater_id,trade_id'
    const { error } = await supabase.from('user_ratings').upsert(payload, { onConflict })
    if (!error) {
      if (target.listingId) setMyRating(rating); else setMyTradeRating(rating)
      setStandingMap(prev => { const next = { ...prev }; delete next[ratedUserId]; return next })
      loadStanding([ratedUserId])
    }
  }

  async function toggleListingSold(item: any) {
    if (item.status === 'sold') {
      await updateListing(item.id, { status: 'active', buyer_id: null })
      setSelectedListing({ ...item, status: 'active', buyer_id: null })
    } else {
      setBuyerPickerOpen(true)
    }
  }

  async function confirmListingSold(item: any, buyerId: string | null) {
    await updateListing(item.id, { status: 'sold', buyer_id: buyerId })
    setSelectedListing({ ...item, status: 'sold', buyer_id: buyerId })
    setBuyerPickerOpen(false)
  }

  async function confirmTradeCompleted(item: any, partnerId: string | null) {
    await updateTradePost(item.id, { completed_with: partnerId })
    setSelectedTrade({ ...item, completed_with: partnerId })
    setTradePartnerPickerOpen(false)
  }

  function openListingEdit(item: any) {
    setEditingListingId(item.id)
    setMktTitle(item.title || ''); setMktPrice(String(item.price ?? ''))
    setMktDesc(item.description || ''); setMktCondition(item.condition || 'Raw')
    setMktCategory(item.category || 'cards'); setMktContact(item.contact || '')
    setMktQuantity(String(item.quantity ?? 1))
    const existing: MktPhoto[] = [item.image_url, ...(item.gallery || [])]
      .filter(Boolean).map((url: string) => ({ kind: 'existing' as const, url }))
    setMktPhotos(existing)
    setModal('listsale')
  }

  function openTradeEdit(item: any) {
    setEditingTradeId(item.id)
    setInpOff(item.offer || ''); setInpWant(item.look_for || '')
    const existing: MktPhoto[] = [item.image_url, ...(item.gallery || [])]
      .filter(Boolean).map((url: string) => ({ kind: 'existing' as const, url }))
    setMktPhotos(existing)
    setModal('posttrade')
  }

  useEffect(() => {
    if (modal === 'notifications') {
      refetchNotifs()
      markAllRead()
    }
  }, [modal])

  function openEditProfile() {
    setEpName(profile?.display_name || '')
    setEpAvatarFile(null); setEpAvatarPreview('')
    setEpBannerFile(null); setEpBannerPreview('')
    setModal('editprofile')
  }
  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setEpAvatarFile(f); setEpAvatarPreview(URL.createObjectURL(f))
  }
  function onPickBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setEpBannerFile(f); setEpBannerPreview(URL.createObjectURL(f))
  }
  async function handleSaveProfile() {
    if (!user) return
    setEpSaving(true)
    const fields: any = {}
    if (epName.trim()) fields.display_name = epName.trim()
    if (epAvatarFile) { const url = await uploadPhoto(epAvatarFile, user.id); if (url) fields.avatar_url = url }
    if (epBannerFile) { const url = await uploadPhoto(epBannerFile, user.id); if (url) fields.banner_url = url }
    if (Object.keys(fields).length > 0) await updateProfile(fields)
    setEpSaving(false)
    setModal('none')
  }

  async function handleListingSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mktTitle || !mktPrice || !user) return
    setMktSubmitting(true)
    const urls: string[] = []
    for (const p of mktPhotos) {
      if (p.kind === 'existing') { urls.push(p.url); continue }
      const url = await uploadPhoto(p.file, user.id)
      if (url) urls.push(url)
    }
    const fields = {
      title: mktTitle,
      description: mktDesc,
      price: parseFloat(mktPrice),
      quantity: parseInt(mktQuantity) || 1,
      category: mktCategory,
      condition: mktCondition,
      image_url: urls[0] || '',
      gallery: urls.slice(1),
      contact: mktContact,
    }
    const ok = editingListingId
      ? await updateListing(editingListingId, fields)
      : await createListing({
          ...fields,
          user_id: user.id,
          username: profile?.username || 'seller',
          lat: fuzzCoord(userLat),
          lng: fuzzCoord(userLng),
          status: 'active',
        })
    setMktSubmitting(false)
    if (ok) {
      setEditingListingId(null)
      setMktTitle(''); setMktPrice(''); setMktDesc(''); setMktContact(''); setMktQuantity('1')
      setMktPhotos([]); setModal('none')
    }
  }

  useEffect(() => {
    const ids: (string | null | undefined)[] = [user?.id]
    sortedListings.forEach((l: any) => ids.push(l.user_id))
    sortedTrades.forEach((t: any) => ids.push(t.user_id))
    if (selectedListing?.user_id) ids.push(selectedListing.user_id)
    if (selectedTrade?.user_id) ids.push(selectedTrade.user_id)
    if (selectedShop?.owner_id) ids.push(selectedShop.owner_id)
    loadStanding(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, sortedListings.length, sortedTrades.length, selectedListing?.id, selectedTrade?.id, selectedShopId])

  if (authLoading || shopsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0A0B0C, #1A1E1C)' }}>
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-3xl flex items-center justify-center mx-auto" style={{ background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>
            <Compass className="h-8 w-8 text-white animate-spin" />
          </div>
          <p className="text-white/40 text-xs font-mono uppercase tracking-widest">Loading Outpost...</p>
        </div>
      </div>
    )
  }

  const ShopCard = ({ s }: { s: any }) => {
    const cats = s.categories?.length > 0 ? s.categories : (s.category ? [s.category] : [])
    const isSaved = savedShops.includes(s.id)
    return (
      <div
        onMouseEnter={() => setHoverShopId(s.id)}
        onMouseLeave={() => setHoverShopId(null)}
        onClick={() => openShop(s)}
        className="relative bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden text-left cursor-pointer transition-all hover:shadow-md">
        <div className="relative">
          <ShopThumb s={s} className="w-full aspect-[4/3]" />
          <button
            onClick={(e) => { e.stopPropagation(); toggleSaveShop(s.id) }}
            aria-label={isSaved ? 'Saved' : 'Save shop'}
            className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm">
            <Heart className="h-[18px] w-[18px] transition-colors" style={isSaved ? { color: '#0F9D8A', fill: '#0F9D8A' } : { color: '#52525b' }} />
          </button>
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
            {s.hot_find && (
              <span className="text-[11px] text-white px-2 py-1 rounded-full inline-flex items-center gap-1 shadow-sm" style={{ background: '#0F9D8A' }}>
                <Flame className="h-3 w-3" /> Hot find
              </span>
            )}
            {fcbdShopIds.has(s.id) && (
              <span className="text-[11px] text-white px-2 py-1 rounded-full inline-flex items-center gap-1 shadow-sm" style={{ background: '#1d4ed8' }}>
                <BookOpen className="h-3 w-3" /> FCBD
              </span>
            )}
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-[15px] leading-snug text-zinc-900 truncate">{s.name}</h3>
          <div className="flex items-center gap-1.5 text-[13px] text-zinc-500 mt-0.5">
            {s.rating != null && <span className="flex items-center gap-0.5"><Star className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />{s.rating}</span>}
            {s.distance !== null && s.distance !== undefined && <span>· {s.distance.toFixed(1)} mi</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {cats.slice(0, 3).map((cat: string) => (
              <span key={cat} className="text-[11px] text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full capitalize">{cat}</span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-[#18191B] font-sans" style={{ background: '#FAFAF9' }}>
      {showOnboarding && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#0A0B0C' }}>
          <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full text-center">
            {onbStep === 1 ? (
              <>
                <img src="/logo.png" alt="Outpost" className="w-44 mb-6" />
                <h1 className="text-2xl font-black text-zinc-900">Find collectibles near you</h1>
                <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
                  Outpost shows card shops, comic stores, drops, and deals around you. Turn on location so we can sort everything by distance.
                </p>
                <button onClick={() => { requestLocation(); setOnbStep(2) }}
                  className="mt-8 w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2" style={{ background: '#0F9D8A' }}>
                  <Navigation className="h-4 w-4" /> Use my location
                </button>
                <button onClick={() => setOnbStep(2)} className="mt-3 text-sm text-zinc-400">Not now</button>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-black text-zinc-900">What do you collect?</h1>
                <p className="text-sm text-zinc-500 mt-2">Pick one to personalize your feed. You can change it anytime.</p>
                <div className="grid grid-cols-2 gap-3 w-full mt-8">
                  {[
                    { id: 'cards', label: 'Cards' },
                    { id: 'comics', label: 'Comics' },
                    { id: 'collectibles', label: 'Collectibles' },
                    { id: 'toys', label: 'Toys' },
                  ].map(c => (
                    <button key={c.id} onClick={() => setOnbInterest(onbInterest === c.id ? null : c.id)}
                      className="py-4 rounded-2xl text-sm font-bold border-2 transition-all"
                      style={onbInterest === c.id ? { borderColor: '#0F9D8A', background: 'rgba(15,157,138,0.06)', color: '#0F9D8A' } : { borderColor: '#e4e4e7', background: 'white', color: '#52525b' }}>
                      {c.label}
                    </button>
                  ))}
                </div>
                <button onClick={finishOnboarding}
                  className="mt-8 w-full py-3.5 rounded-2xl text-sm font-bold text-white" style={{ background: '#0F9D8A' }}>
                  {onbInterest ? `Explore ${onbInterest}` : 'Explore all shops'}
                </button>
                <button onClick={finishOnboarding} className="mt-3 text-sm text-zinc-400">Skip</button>
              </>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 pb-10">
            <div className="h-1.5 rounded-full transition-all" style={{ width: onbStep === 1 ? 20 : 8, background: onbStep === 1 ? '#0F9D8A' : '#d4d4d8' }} />
            <div className="h-1.5 rounded-full transition-all" style={{ width: onbStep === 2 ? 20 : 8, background: onbStep === 2 ? '#0F9D8A' : '#d4d4d8' }} />
          </div>
        </div>
      )}
      <div className="flex min-h-screen">
        <Sidebar tab={tab} setTab={goTab} isSignedIn={isSignedIn} profile={profile} setModal={setModal} unreadCount={unreadCount} unreadMessages={unreadMessages} />

        {shareCopied && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] bg-zinc-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg">
            Link copied!
          </div>
        )}

        {lightboxUrl && (
          <div onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out">
            <button onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
            <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-full object-contain rounded-lg cursor-default" />
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-screen max-w-2xl mx-auto w-full md:max-w-none">

          {/* HEADER */}
          <header className="sticky top-0 z-20 px-4 pt-10 pb-3 md:pt-3 md:pb-3 border-b border-zinc-200 bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between gap-2 md:hidden">
              <div className="min-w-0 flex-1">
                <img src="/logo.png" alt="getOutpost.net" onClick={() => goTab('discover')} className="h-[75px] w-auto cursor-pointer" />
                <p className="text-[15px] mt-0.5 whitespace-nowrap text-zinc-400">Every Shop. Every Drop. Near You.</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isSignedIn && (
                  <div className="px-3 py-1.5 rounded-lg font-medium text-xs text-white" style={{ background: '#0F9D8A' }}>
                    @{profile?.username}
                  </div>
                )}
                <button onClick={() => setModal('menu')} aria-label="Menu" className="h-8 w-8 rounded-lg flex items-center justify-center border border-zinc-200 bg-zinc-50">
                  <Menu className="h-4 w-4 text-zinc-600" />
                </button>
              </div>
            </div>
            <div className="hidden md:flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-400" />
                <input type="text" placeholder="Search shops, cities, tags"
                  value={search} onChange={e => { setSearch(e.target.value); searchEbay(e.target.value) }}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-full pl-10 pr-4 py-2.5 text-sm outline-none focus:border-zinc-400 focus:bg-zinc-50 transition-colors" />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setModal('notifications')} aria-label="Notifications" className="relative h-9 w-9 rounded-full flex items-center justify-center border border-zinc-200 bg-zinc-50 hover:bg-zinc-50 transition-all">
                  <Bell className="h-4 w-4 text-zinc-500" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#0F9D8A' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </button>
                <button onClick={() => setModal('sub')} className="px-4 py-2 rounded-full text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-all">
                  {!isSignedIn ? 'Pro' : profile?.tier === 'store' ? 'Store' : profile?.tier === 'elite' ? 'Elite' : isMerchant ? 'Merchant' : 'Pro'}
                </button>
                <button onClick={() => isSignedIn ? goTab('profile') : setModal('auth')} className="px-4 py-2 rounded-full text-xs font-medium text-white transition-all" style={{ background: '#0F9D8A' }}>
                  {isSignedIn ? `@${profile?.username}` : 'Sign in'}
                </button>
              </div>
            </div>
            {tab === 'discover' && (
              <div className="mt-3 relative md:hidden">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
                <input type="text" placeholder="Search shops, cities, tags"
                  value={search} onChange={e => { setSearch(e.target.value); searchEbay(e.target.value) }}
                  className="w-full rounded-full pl-10 pr-4 py-3 text-sm outline-none bg-zinc-50 border border-zinc-200 focus:border-zinc-400 focus:bg-zinc-50 transition-colors" />
              </div>
            )}
          </header>

          <main className="flex-1 overflow-y-auto pb-28 md:pb-8">

            {/* DISCOVER */}
            {tab === 'discover' && (
              <div className="p-4 space-y-4">
                {/* Section toggle */}
                <div className="inline-flex rounded-full border border-zinc-200 p-0.5 bg-zinc-50">
                  <button onClick={() => setActiveSection('shops')}
                    className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all"
                    style={activeSection === 'shops' ? { background: '#0F9D8A', color: 'white' } : { color: '#52525b' }}>
                    Shops
                  </button>
                  <button onClick={() => setActiveSection('events')}
                    className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all"
                    style={activeSection === 'events' ? { background: '#0F9D8A', color: 'white' } : { color: '#52525b' }}>
                    Events
                  </button>
                  <button onClick={() => setActiveSection('fcbd')}
                    className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all"
                    style={activeSection === 'fcbd' ? { background: '#0F9D8A', color: 'white' } : { color: '#52525b' }}>
                    FCBD
                  </button>
                </div>

                {/* Category filter pills - shops only */}
                {activeSection === 'shops' && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'comics', label: 'Comics' },
                      { id: 'cards', label: 'Cards' },
                      { id: 'collectibles', label: 'Collectibles' },
                      { id: 'toys', label: 'Toys' },
                    ].map(f => (
                      <button key={f.id} onClick={() => setFilter(f.id)}
                        className="px-4 py-1.5 rounded-full text-[13px] font-medium border transition-all whitespace-nowrap flex-shrink-0"
                        style={filter === f.id ? { background: '#0F9D8A', borderColor: '#0F9D8A', color: 'white' } : { background: 'white', borderColor: '#e4e4e7', color: '#52525b' }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Radius selector + List/Map view toggle - only for shops */}
                {activeSection === 'shops' && (
                  <div className="flex items-center gap-2 px-0.5">
                    <button onClick={() => { setLocTarget('discover'); setLocRadius(radius); setModal('setlocation') }}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-700">
                      <Navigation className="h-4 w-4" style={{ color: '#0F9D8A' }} />
                      Within {radius} miles
                      <span className="text-xs font-medium" style={{ color: '#0F9D8A' }}>· Change</span>
                    </button>
                    <div className="ml-auto inline-flex rounded-full border border-zinc-200 p-0.5 bg-zinc-50 flex-shrink-0">
                      <button onClick={() => setDiscoverView('list')}
                        className="px-3 py-1 rounded-full text-xs font-bold transition-all"
                        style={discoverView === 'list' ? { background: '#0F9D8A', color: 'white' } : { color: '#52525b' }}>List</button>
                      <button onClick={() => setDiscoverView('map')}
                        className="px-3 py-1 rounded-full text-xs font-bold transition-all"
                        style={discoverView === 'map' ? { background: '#0F9D8A', color: 'white' } : { color: '#52525b' }}>Map</button>
                    </div>
                  </div>
                )}
                {activeSection === 'shops' && urlCity && (
                  <div className="flex items-center justify-between gap-3 px-0.5">
                    <p className="text-sm text-zinc-600">
                      Showing shops in <span className="font-bold">{unslugCity(urlCity)}</span>
                    </p>
                    <button
                      onClick={() => { setUrlCity(null); window.history.pushState({}, '', '/') }}
                      className="text-xs font-medium underline flex-shrink-0" style={{ color: '#0F9D8A' }}>
                      View all shops
                    </button>
                  </div>
                )}
                {activeSection === 'shops' && discoverView === 'map' && (
                  <div className="rounded-2xl overflow-hidden border border-zinc-200 h-[56vh] md:h-[64vh]">
                    <LocalMap shops={filteredShops} onSelect={s => openShop(s)} activeId={hoverShopId} userLat={userLat} userLng={userLng} />
                  </div>
                )}
                {activeSection === 'shops' && !urlCity && <DropBanner shops={shops} />}
                {activeSection === 'shops' && !discoverReady && (
                  <div className="text-center py-12">
                    <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-zinc-400 font-mono">Finding shops near you...</p>
                  </div>
                )}
                {activeSection === 'shops' && discoverReady && filteredShops.length === 0 && !locationDenied && (
                  <div className="text-center py-12 text-zinc-400">
                    <MapPin className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-mono">
                      {urlCity ? `No shops found in ${unslugCity(urlCity)}` : `No shops found within ${radius} miles`}
                    </p>
                    {!urlCity && <p className="text-xs mt-1">Try increasing your radius</p>}
                  </div>
                )}
                {activeSection === 'shops' && discoverReady && filteredShops.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredShops.map((s: any) => <ShopCard key={s.id} s={s} />)}
                  </div>
                )}
                {activeSection === 'shops' && (ebaySearching || ebayResults.length > 0) && search.length >= 3 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <div className="h-4 w-4 rounded flex items-center justify-center" style={{ background: '#E53238' }}>
                        <span className="text-white font-black" style={{ fontSize: 8 }}>e</span>
                      </div>
                      <p className="text-xs font-black uppercase text-zinc-500">eBay Listings for "{search}"</p>
                      {ebaySearching && <div className="h-3 w-3 rounded-full border-2 border-zinc-300 border-t-zinc-600 animate-spin ml-auto" />}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      {ebayResults.map(item => (
                        <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
                          className="block bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100 hover:shadow-md transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-lg inline-block mb-2"
                                style={item.condition === 'Graded' ? { background: '#EDE9FE', color: '#5B21B6' } : { background: '#F3F4F6', color: '#6B7280' }}>
                                {item.condition}
                              </span>
                              <p className="font-bold text-sm leading-tight">{item.title}</p>
                            </div>
                            <p className="font-black text-base flex-shrink-0" style={{ color: '#059669' }}>${item.price}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                    {ebayResults.length > 0 && (
                      <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(search)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="block text-center py-3 rounded-2xl text-sm font-black border-2"
                        style={{ borderColor: '#E53238', color: '#E53238' }}>
                        See all results on eBay →
                      </a>
                    )}
                  </div>
                )}
                {/* Events section */}
                {activeSection === 'events' && (
                  <div className="space-y-3">
                    <div className="rounded-3xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
                      <h2 className="font-black text-lg">Upcoming Events</h2>
                      <p className="text-xs text-white/70 mt-0.5">Card shows, tournaments, signings near you</p>
                    </div>
                    {/* Event category filter */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {[
                        { id: 'all', label: 'All', color: '#7C3AED' },
                        { id: 'cards', label: 'Cards', color: '#38BDF8' },
                        { id: 'comics', label: 'Comics', color: '#F59E0B' },
                        { id: 'collectibles', label: 'Collectibles', color: '#A78BFA' },
                        { id: 'toys', label: 'Toys', color: '#10B981' },
                      ].map(f => (
                        <button key={f.id} onClick={() => setEventFilter(f.id)}
                          className="px-4 py-2 rounded-2xl text-xs font-black uppercase border-2 transition-all whitespace-nowrap flex-shrink-0"
                          style={eventFilter === f.id ? { background: f.color, borderColor: f.color, color: 'white' } : { background: 'white', borderColor: '#e5e7eb', color: '#9ca3af' }}>
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {/* State dropdown */}
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                      <select
                        value={eventState}
                        onChange={e => setEventState(e.target.value)}
                        className="flex-1 bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-2.5 text-sm font-black outline-none focus:border-zinc-300">
                        {eventStates.map((state: string) => (
                          <option key={state} value={state}>
                            {state === 'all' ? '🇺🇸 All States' : state}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Results count */}
                    <p className="text-xs text-zinc-400 font-mono px-1">
                      {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} {eventState !== 'all' ? `in ${eventState}` : 'nationwide'}
                    </p>
                    {filteredEvents.length === 0 ? (
                      <div className="text-center py-10 text-zinc-400">
                        <Calendar className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-mono">No events yet</p>
                        <button onClick={() => setModal('submit')}
                          className="mt-3 text-xs font-black px-4 py-2 rounded-xl text-white"
                          style={{ background: '#7C3AED' }}>
                          Submit an Event
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredEvents.map((ev: any) => (
                          <div key={ev.id} className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1">
                                <div className="flex gap-2 flex-wrap mb-2">
                                  {(ev.categories || [ev.category]).map((cat: string) => (
                                    <span key={cat} className="text-xs font-black px-2 py-0.5 rounded-lg uppercase"
                                      style={cat === 'comics' ? { background: '#FEF3C7', color: '#92400E' }
                                        : cat === 'cards' ? { background: '#E0F2FE', color: '#0369A1' }
                                        : cat === 'toys' ? { background: '#D1FAE5', color: '#065F46' }
                                        : { background: '#EDE9FE', color: '#5B21B6' }}>
                                      {cat}
                                    </span>
                                  ))}
                                </div>
                                <p className="font-black text-base">{ev.title}</p>
                                <p className="text-xs text-zinc-400 mt-1">{ev.location || ev.shops?.name}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="text-xs bg-zinc-100 px-2 py-1 rounded-lg font-mono font-bold block">{ev.date}</span>
                                {ev.spots && <p className="text-xs text-zinc-400 mt-1">{ev.spots} spots</p>}
                              </div>
                            </div>
                            {ev.description && <p className="text-xs text-zinc-500 leading-relaxed">{ev.description}</p>}
                            <button onClick={() => toggleRsvp(ev.id)}
                              className="w-full mt-3 py-2.5 rounded-2xl text-xs font-black uppercase border-2 transition-all"
                              style={rsvps.includes(ev.id) ? { background: '#F0FDF4', color: '#166534', borderColor: '#BBF7D0' } : { background: 'white', color: '#9ca3af', borderColor: '#e5e7eb' }}>
                              {rsvps.includes(ev.id) ? '✓ Going' : 'RSVP'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'shops' && (
                  <button onClick={() => isSignedIn ? openClaimModal() : setModal('auth')}
                    className="w-full rounded-3xl p-4 border-2 border-dashed text-center"
                    style={{ borderColor: '#0F9D8A', background: 'rgba(15,157,138,0.04)' }}>
                    <Store className="h-5 w-5 mx-auto mb-1" style={{ color: '#0F9D8A' }} />
                    <p className="font-black text-sm" style={{ color: '#0F9D8A' }}>Own a shop? Claim your listing</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Verified with EIN · Free to claim</p>
                  </button>
                )}

                <button onClick={() => setModal('submit')}
                  className="w-full rounded-3xl p-4 border-2 border-dashed text-center"
                  style={{ borderColor: '#7C3AED', background: 'rgba(124,58,237,0.04)' }}>
                  <Plus className="h-5 w-5 mx-auto mb-1" style={{ color: '#7C3AED' }} />
                  <p className="font-black text-sm" style={{ color: '#7C3AED' }}>{activeSection === 'shops' ? 'Submit a Shop or Event' : 'Submit an Event'}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">We'll review and add it to Outpost</p>
                </button>

            {/* FCBD */}
            {activeSection === 'fcbd' && (
              <div className="space-y-4 max-w-3xl">
                <div className="rounded-3xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>
                  <BookOpen className="absolute -right-4 -top-4 h-28 w-28 opacity-10" />
                  <p className="text-xs uppercase tracking-widest opacity-80">Free Comic Book Day</p>
                  <h2 className="text-2xl font-bold mt-1">FCBD {FCBD_YEAR}</h2>
                  <p className="text-sm opacity-90 mt-1">{FCBD_DATE_LABEL} · date tentative</p>
                  <div className="mt-4 inline-flex items-baseline gap-2 bg-white/20 rounded-full px-4 py-1.5">
                    <span className="text-xl font-bold">{fcbdDaysLeft}</span>
                    <span className="text-xs opacity-90">days to go</span>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-zinc-900 mb-2">Showcased comics {fcbdTitles.length > 0 && `(${fcbdTitles.length})`}</p>
                  {fcbdTitles.length === 0 ? (
                    <div className="text-center py-10 text-zinc-400 bg-zinc-50 rounded-3xl border border-zinc-100">
                      <BookOpen className="h-9 w-9 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">The {FCBD_YEAR} lineup hasn't been posted yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                      {fcbdTitles.map((t: any) => (
                        <div key={t.id} className="bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden">
                          <div className="aspect-[2/3] bg-zinc-100">
                            {t.image_url
                              ? <img src={t.image_url} alt={t.title} loading="lazy" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-zinc-300"><BookOpen className="h-8 w-8" /></div>}
                          </div>
                          <div className="p-2">
                            <p className="text-[12px] font-medium text-zinc-900 leading-tight line-clamp-2">{t.title}</p>
                            {t.publisher && <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{t.publisher}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {myShop && (
                  <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-3 flex items-center gap-2 text-sm text-zinc-500">
                    <BookOpen className="h-4 w-4 flex-shrink-0" style={{ color: '#1d4ed8' }} />
                    <span>Manage your shop's FCBD participation from your <button onClick={() => goTab('profile')} className="font-medium underline" style={{ color: '#0F9D8A' }}>Profile</button>.</span>
                  </div>
                )}

                <div>
                  <p className="font-semibold text-zinc-900 mb-2">Participating shops {fcbdShops.length > 0 && `(${fcbdShops.length})`}</p>
                  {fcbdShops.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400 bg-zinc-50 rounded-3xl border border-zinc-100">
                      <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No shops have signed up yet.</p>
                      <p className="text-xs mt-1">Check back as {FCBD_MONTH} {FCBD_YEAR} approaches.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fcbdShops.map((p: any) => {
                        const s = p.shops || {}
                        const dist = userLat && userLng && s.lat && s.lng ? getDistance(userLat, userLng, s.lat, s.lng) : null
                        return (
                          <div key={p.id} onClick={() => openShop(shops.find((x: any) => x.id === p.shop_id) || s)}
                            className="bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden cursor-pointer hover:shadow-md transition-all flex">
                            <div className="w-24 flex-shrink-0 bg-zinc-100">
                              {s.image_url
                                ? <img src={s.image_url} alt={s.name} loading="lazy" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-zinc-300"><Store className="h-7 w-7" /></div>}
                            </div>
                            <div className="p-3 flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="font-semibold text-zinc-900 truncate">{s.name}</h3>
                                {dist != null && <span className="text-xs text-zinc-400 flex-shrink-0">{dist.toFixed(1)} mi</span>}
                              </div>
                              {p.offers && <p className="text-[13px] mt-1 line-clamp-2" style={{ color: '#0F9D8A' }}><span className="font-medium">Offer: </span>{p.offers}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
              </div>
            )}


            {/* MARKETPLACE */}
            {tab === 'marketplace' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex rounded-full border border-zinc-200 p-0.5 bg-zinc-50">
                    <button onClick={() => setMktSection('sale')}
                      className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all"
                      style={mktSection === 'sale' ? { background: '#0F9D8A', color: 'white' } : { color: '#52525b' }}>For Sale</button>
                    <button onClick={() => setMktSection('trade')}
                      className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all"
                      style={mktSection === 'trade' ? { background: '#0F9D8A', color: 'white' } : { color: '#52525b' }}>Trades</button>
                  </div>
                  <button onClick={() => isSignedIn ? (setMktPhotos([]), setEditingListingId(null), setEditingTradeId(null), setModal(mktSection === 'sale' ? 'listsale' : 'posttrade')) : setModal('auth')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white flex-shrink-0"
                    style={{ background: '#0F9D8A' }}>
                    <Plus className="h-4 w-4" /> {mktSection === 'sale' ? 'List an item' : 'Post a trade'}
                  </button>
                </div>

                <div className="relative">
                  <Search className="h-4 w-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input value={mktSearch} onChange={e => setMktSearch(e.target.value)}
                    placeholder={mktSection === 'sale' ? 'Search items for sale…' : 'Search trades…'}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-10 pr-10 py-2.5 text-sm focus:outline-none" />
                  {mktSearch && (
                    <button onClick={() => setMktSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <button onClick={() => { setLocTarget('community'); setLocRadius(typeof mktRadius === 'number' ? mktRadius : 50); setModal('setlocation') }}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl border border-zinc-200 bg-zinc-50">
                  <span className="flex items-center gap-2 text-sm text-zinc-700">
                    <Navigation className="h-4 w-4" style={{ color: '#0F9D8A' }} />
                    {mktRadius === 'any' ? 'Anywhere' : `Within ${mktRadius} miles`}
                  </span>
                  <span className="text-xs font-medium" style={{ color: '#0F9D8A' }}>Change</span>
                </button>
                {!userLat && mktRadius !== 'any' && (
                  <p className="text-xs text-zinc-400">Set your location to see items near you.</p>
                )}

              {mktSection === 'sale' ? (
              <>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'cards', label: 'Cards' },
                    { id: 'comics', label: 'Comics' },
                    { id: 'collectibles', label: 'Collectibles' },
                    { id: 'toys', label: 'Toys' },
                  ].map(f => (
                    <button key={f.id} onClick={() => setMktFilter(f.id)}
                      className="px-4 py-1.5 rounded-full text-[13px] font-medium border transition-all whitespace-nowrap flex-shrink-0"
                      style={mktFilter === f.id ? { background: '#0F9D8A', borderColor: '#0F9D8A', color: 'white' } : { background: 'white', borderColor: '#e4e4e7', color: '#52525b' }}>
                      {f.label}
                    </button>
                  ))}
                </div>

                {sortedListings.length === 0 ? (
                  <div className="text-center py-16 text-zinc-400">
                    <Tag className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No listings yet. Be the first to list something.</p>
                    <button onClick={() => isSignedIn ? (setMktPhotos([]), setEditingListingId(null), setModal('listsale')) : setModal('auth')}
                      className="mt-4 px-5 py-2 rounded-full text-sm font-medium text-white" style={{ background: '#0F9D8A' }}>
                      List an item
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {sortedListings.map((item: any) => (
                      <div key={item.id} onClick={() => openListing(item)}
                        className="bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden cursor-pointer transition-all hover:shadow-md text-left">
                        <div className="aspect-square bg-zinc-100">
                          {item.image_url
                            ? <img src={item.image_url} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-zinc-300"><Package className="h-10 w-10" /></div>}
                        </div>
                        <div className="p-3">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-zinc-900" style={{ color: '#0F9D8A' }}>${Number(item.price).toLocaleString()}</p>
                            {item.quantity > 1 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500">Qty: {item.quantity}</span>}
                          </div>
                          <h3 className="text-[14px] text-zinc-900 leading-snug truncate mt-0.5">{item.title}</h3>
                          <div className="flex items-center gap-1.5 text-[12px] text-zinc-500 mt-1">
                            {item.condition && <span className="bg-zinc-100 px-1.5 py-0.5 rounded">{item.condition}</span>}
                            {item.distance != null && <span>· {fmtDist(item.distance)}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
              ) : (
              <>
                {sortedTrades.length === 0 ? (
                  <div className="text-center py-16 text-zinc-400">
                    <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No trades posted yet. Put up what you have.</p>
                    <button onClick={() => isSignedIn ? (setMktPhotos([]), setEditingTradeId(null), setModal('posttrade')) : setModal('auth')}
                      className="mt-4 px-5 py-2 rounded-full text-sm font-medium text-white" style={{ background: '#0F9D8A' }}>Post a trade</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {sortedTrades.map((p: any) => (
                      <button key={p.id} onClick={() => openTrade(p)}
                        className="w-full text-left bg-zinc-50 rounded-2xl border border-zinc-200 p-4 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-xs text-zinc-400 truncate">@{p.username}</p>
                            <StandingBadge standing={standingMap[p.user_id]?.standing} verified={standingMap[p.user_id]?.is_verified_seller} />
                          </div>
                          {p.distance != null && <span className="text-[11px] text-zinc-400 flex-shrink-0">{fmtDist(p.distance)}</span>}
                        </div>
                        {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="w-full h-32 object-cover rounded-xl mb-3" />}
                        <div className="space-y-2">
                          <div className="flex gap-2 items-start">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: '#F0FDF4', color: '#166534' }}>HAS</span>
                            <p className="text-[13px] font-medium text-zinc-900">{p.offer}</p>
                          </div>
                          <div className="flex gap-2 items-start">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: '#FEF2F2', color: '#991B1B' }}>WANTS</span>
                            <p className="text-[13px] font-medium" style={{ color: '#0F9D8A' }}>{p.look_for}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
              )}
              </div>
            )}

            {/* NEWS */}
            {tab === 'news' && (
              <div className="p-4 space-y-4 max-w-3xl">
                <div>
                  <h2 className="font-black text-2xl">News</h2>
                  <p className="text-sm text-zinc-400 mt-0.5">Collectibles, comics, TCG &amp; pop culture headlines.</p>
                </div>

                {(() => {
                  const cats = Array.from(new Set(newsArticles.map((a: any) => a.category).filter(Boolean)))
                  const filtered = newsFilter === 'All' ? newsArticles : newsArticles.filter((a: any) => a.category === newsFilter)
                  return (
                    <>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {['All', ...cats].map((c: string) => (
                          <button key={c} onClick={() => setNewsFilter(c)}
                            className="px-3.5 py-1.5 rounded-full text-xs font-bold flex-shrink-0 border transition-all"
                            style={newsFilter === c ? { background: '#18181b', borderColor: '#18181b', color: 'white' } : { background: 'white', borderColor: '#e4e4e7', color: '#52525b' }}>
                            {c}
                          </button>
                        ))}
                      </div>

                      {filtered.length === 0 ? (
                        <div className="text-center py-16 text-zinc-400">
                          <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p className="text-sm">No headlines yet. Check back soon.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {filtered.map((a: any) => {
                            const desc = (a.description || '').trim()
                            const showDesc = desc && !/[<>]|href=|https?:\/\//i.test(desc) && desc.toLowerCase() !== (a.title || '').toLowerCase()
                            return (
                            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                              className="block bg-zinc-50 rounded-2xl border border-zinc-200 p-4 hover:shadow-md transition-all">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                {a.source_name && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: '#F4F4F5', color: '#3f3f46' }}>{a.source_name}</span>}
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: '#FEF3C7', color: '#92400E' }}>{a.category}</span>
                                <span className="text-[11px] text-zinc-400">{timeAgo(a.published_at)}</span>
                              </div>
                              <p className="font-bold text-[15px] leading-snug text-zinc-900">{a.title}</p>
                              {showDesc && <p className="text-xs text-zinc-500 leading-relaxed mt-1.5 line-clamp-2">{desc}</p>}
                              <p className="text-[11px] font-medium mt-2" style={{ color: '#0F9D8A' }}>Read full story →</p>
                            </a>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            {/* PROFILE */}
            {tab === 'messages' && (
              <div className="max-w-lg">
                {!isSignedIn ? (
                  <div className="p-4 text-center text-sm text-zinc-400 pt-10">Sign in to see your messages.</div>
                ) : activeConversationId ? (
                  <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
                    <div className="px-4 py-3 flex items-center gap-3 border-b border-zinc-100 flex-shrink-0">
                      <button onClick={() => setActiveConversationId(null)}><ArrowLeft className="h-5 w-5 text-zinc-500" /></button>
                      {(() => {
                        const conv = conversations.find((c: any) => c.counterpartyId === activeConversationId)
                        return (
                          <button onClick={() => openUserProfile(activeConversationId)} className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center flex-shrink-0">
                              {conv?.profile?.avatar_url
                                ? <img src={conv.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                                : <User className="h-4 w-4 text-zinc-400" />}
                            </div>
                            <span className="font-semibold text-sm text-zinc-900">@{conv?.profile?.username || '…'}</span>
                          </button>
                        )
                      })()}
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                      {threadLoading && <p className="text-xs text-zinc-400 text-center">Loading…</p>}
                      {!threadLoading && threadMessages.length === 0 && <p className="text-xs text-zinc-400 text-center pt-8">Say hello 👋</p>}
                      {threadMessages.map((m: any) => (
                        <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                          <div className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm"
                            style={m.sender_id === user?.id ? { background: '#0F9D8A', color: 'white' } : { background: '#f4f4f5', color: '#18181b' }}>
                            {m.body}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-zinc-100 flex items-center gap-2 flex-shrink-0">
                      <input value={messageDraft} onChange={e => setMessageDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && messageDraft.trim()) { sendThreadMessage(messageDraft); setMessageDraft('') } }}
                        placeholder="Message…" className="flex-1 bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-sm focus:outline-none" />
                      <button onClick={() => { if (messageDraft.trim()) { sendThreadMessage(messageDraft); setMessageDraft('') } }}
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: '#0F9D8A' }}>
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <h2 className="text-xl font-semibold text-zinc-900 mb-3">Messages</h2>
                    {conversationsLoading && <p className="text-xs text-zinc-400">Loading…</p>}
                    {!conversationsLoading && conversations.length === 0 && (
                      <p className="text-sm text-zinc-400 pt-6 text-center">No messages yet. Message a seller from a listing to start a conversation.</p>
                    )}
                    <div className="space-y-1">
                      {conversations.map((c: any) => (
                        <button key={c.counterpartyId} onClick={() => setActiveConversationId(c.counterpartyId)}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-zinc-50 text-left transition-all">
                          <div className="h-11 w-11 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center flex-shrink-0">
                            {c.profile?.avatar_url
                              ? <img src={c.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                              : <User className="h-5 w-5 text-zinc-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-sm text-zinc-900 truncate">@{c.profile?.username || 'user'}</p>
                              {c.unread > 0 && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: '#0F9D8A' }} />}
                            </div>
                            <p className={`text-xs truncate ${c.unread > 0 ? 'text-zinc-700 font-medium' : 'text-zinc-400'}`}>
                              {c.lastMessage.sender_id === user?.id ? 'You: ' : ''}{c.lastMessage.body}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'profile' && (
              <div className="p-4 space-y-4 max-w-lg">
                {isSignedIn ? (
                  <>
                    <div className="rounded-3xl p-5 text-white relative overflow-hidden"
                      style={profile?.banner_url
                        ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : { background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>
                      {profile?.banner_url
                        ? <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)' }} />
                        : <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full opacity-20" style={{ background: 'white', transform: 'translate(20%,20%)' }} />}
                      <button onClick={openEditProfile} className="absolute top-4 right-4 z-10 text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }}>Edit</button>
                      <div className="relative">
                        <div className="h-14 w-14 rounded-3xl flex items-center justify-center mb-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                          {profile?.avatar_url
                            ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                            : <User className="h-7 w-7 text-white" />}
                        </div>
                        <p className="font-black text-xl">{profile?.display_name || `@${profile?.username}`}</p>
                        {profile?.display_name && <p className="text-sm text-white/70">@{profile?.username}</p>}
                        <p className="text-xs text-white/60 mt-1 font-mono uppercase">{profile?.role} · {profile?.tier} plan</p>
                      </div>
                    </div>

                    {user && (
                      <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-black uppercase text-zinc-400">Community Standing</p>
                          <button onClick={() => setShowStandingInfo(v => !v)} className="text-xs font-medium" style={{ color: '#0F9D8A' }}>How it works</button>
                        </div>
                        <StandingBadge standing={standingMap[user.id]?.standing || 'New'} verified={standingMap[user.id]?.is_verified_seller} size="lg" />
                        <RatingBadge avgRating={standingMap[user.id]?.avg_rating} count={standingMap[user.id]?.ratings_count} />
                        {showStandingInfo && (
                          <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2 text-xs text-zinc-500 leading-relaxed">
                            <p>Your standing shows how established you are on Outpost. It's a sign of real participation — not a guarantee about any deal. Always meet in a safe, public place.</p>
                            <p>It grows with time on Outpost, days you're active, real listings and trades you post, helping out in Q&amp;A, and a complete profile. Owning an EIN-verified shop earns a <span className="font-semibold text-emerald-700">Verified</span> mark.</p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <StandingBadge standing="New" /><StandingBadge standing="Member" /><StandingBadge standing="Established" /><StandingBadge standing="Trusted" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {user && (
                      <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100 mb-3">
                        <div className="grid grid-cols-4 gap-2 pb-3 mb-3 border-b border-zinc-100">
                          {[
                            ['Sold', standingMap[user.id]?.sold_count],
                            ['Bought', standingMap[user.id]?.bought_count],
                            ['Followers', standingMap[user.id]?.followers_count],
                            ['Following', standingMap[user.id]?.following_count],
                          ].map(([label, val]: any) => (
                            <div key={label} className="text-center">
                              <p className="text-lg font-bold text-zinc-900">{val ?? 0}</p>
                              <p className="text-[11px] text-zinc-400">{label}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs font-black uppercase text-zinc-400 mb-2">Following</p>
                        {followingProfiles.length === 0 ? (
                          <p className="text-xs text-zinc-400">You're not following anyone yet — tap a seller's @username to follow them.</p>
                        ) : (
                          <div className="space-y-1">
                            {followingProfiles.map((p: any) => (
                              <button key={p.id} onClick={() => openUserProfile(p.id)}
                                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-zinc-50 text-left transition-all">
                                <div className="h-9 w-9 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center flex-shrink-0">
                                  {p.avatar_url
                                    ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                                    : <User className="h-4 w-4 text-zinc-400" />}
                                </div>
                                <span className="text-sm font-medium text-zinc-900">@{p.username}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {user && profile && !profile.is_founding_member && (
                      <button onClick={async () => {
                          const { number, error } = await claimFoundingMember()
                          if (error) alert(error)
                          else alert(`Welcome, Founding Member #${number}! Lifetime free ${profile.role === 'merchant' ? 'Store' : 'Elite'}, forever.`)
                        }}
                        className="w-full text-left rounded-3xl p-4 shadow-sm mb-3 text-white relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>
                        <p className="text-xs font-black uppercase text-white/60">Limited · 1,000 spots</p>
                        <p className="font-black text-base mt-1">Become a Founding Member</p>
                        <p className="text-xs text-white/70 mt-1">Lifetime free {profile.role === 'merchant' ? 'Store tier' : 'Elite'} and a serial-numbered badge on your profile — forever.</p>
                      </button>
                    )}

                    {user && profile?.is_founding_member && (
                      <div className="rounded-3xl p-4 shadow-sm mb-3 text-white relative overflow-hidden flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>
                        <Shield className="h-8 w-8 flex-shrink-0" />
                        <div>
                          <p className="font-black text-sm">Founding Member #{profile.founding_member_number}</p>
                          <p className="text-xs text-white/70">Lifetime {profile.tier === 'store' ? 'Store' : 'Elite'}, forever</p>
                        </div>
                      </div>
                    )}

                    {user && (
                      <div className="rounded-3xl p-4 shadow-sm border border-zinc-100 mb-3 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black uppercase text-white/50">Outpost Rewards</p>
                          <button onClick={() => setShowRewardsInfo(v => !v)} className="text-[11px] font-bold text-white/60 underline">How it works</button>
                        </div>
                        <p className="text-3xl font-black mt-1">{opBalance.toLocaleString()} <span className="text-sm font-bold text-white/60">OP</span></p>
                        {showRewardsInfo && (
                          <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5 text-xs text-white/70 leading-relaxed">
                            <p><span className="font-bold text-white">Earning OP:</span> right now, invite friends — you get 500 OP the moment they join with your code, and another 500 OP the first time they check into a shop (we verify they're actually there before it counts).</p>
                            <p><span className="font-bold text-white">Spending OP:</span> participating shops post their own rewards on their shop page — a free pack, a discount, whatever they choose. Tap Redeem, and you'll get a one-time code to show staff in person.</p>
                            <p><span className="font-bold text-white">Founding Member:</span> the first 1,000 people to claim it get a lifetime free paid tier (Elite, or Store if you own a shop) and a serial-numbered badge, forever.</p>
                          </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-white/10">
                          <p className="text-xs font-bold text-white/70 mb-1">Invite a friend — earn 500 OP when they join, another 500 when they visit their first shop</p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 font-mono text-sm tracking-widest">{referralCode || '…'}</div>
                            <button onClick={() => referralCode && shareUrl(`/?ref=${referralCode}`, 'Join me on Outpost')}
                              className="px-3 py-2 rounded-xl text-xs font-black text-white flex-shrink-0" style={{ background: '#0F9D8A' }}>
                              {shareCopied ? 'Copied!' : 'Share'}
                            </button>
                          </div>
                          {referredUsers.length > 0 && (
                            <p className="text-xs text-white/50 mt-2">{referredUsers.length} friend{referredUsers.length !== 1 ? 's' : ''} joined using your invite</p>
                          )}
                        </div>

                        {!referredBy && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-xs font-bold text-white/70 mb-2">Have a friend's invite code?</p>
                            <div className="flex items-center gap-2">
                              <input value={referralCodeInput} onChange={e => setReferralCodeInput(e.target.value.toUpperCase())}
                                placeholder="ABCD123" maxLength={7}
                                className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono tracking-widest text-white placeholder:text-white/30 outline-none" />
                              <button onClick={async () => {
                                  const { error } = await claimReferral(referralCodeInput)
                                  if (error) alert(error)
                                  else { setReferralCodeInput(''); alert('Code applied!') }
                                }}
                                disabled={referralCodeInput.length < 6}
                                className="px-3 py-2 rounded-xl text-xs font-black text-white disabled:opacity-40 flex-shrink-0" style={{ background: '#059669' }}>
                                Apply
                              </button>
                            </div>
                          </div>
                        )}

                        {myRedemptions.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-xs font-bold text-white/70 mb-2">My redemptions</p>
                            <div className="space-y-1.5">
                              {myRedemptions.slice(0, 5).map((r: any) => (
                                <div key={r.id} className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate">{r.reward_offers?.title || 'Reward'}</p>
                                    <p className="text-[11px] text-white/50 truncate">{r.shops?.name}</p>
                                  </div>
                                  {r.status === 'pending' ? (
                                    <span className="text-sm font-mono font-black tracking-widest flex-shrink-0 ml-2" style={{ color: '#fca997' }}>{r.code}</span>
                                  ) : (
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 flex-shrink-0 ml-2">{r.status}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {myShop && (
                      <button onClick={() => openShop(myShop)}
                        className="w-full bg-zinc-50 rounded-3xl p-4 text-left shadow-sm border border-zinc-100 mb-3 hover:shadow-md transition-all">
                        <p className="text-xs font-black uppercase text-zinc-400 mb-2">My Shop</p>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#FEF3C7" }}>
                            <Store className="h-5 w-5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm">{myShop.name}</p>
                            <p className="text-xs text-zinc-400 font-mono truncate">{myShop.address}</p>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: "#F0FDF4" }}>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-xs font-black text-emerald-600">Verified</span>
                          </div>
                        </div>
                        {myShop.hot_find && (
                          <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center gap-2">
                            <Flame className="h-3 w-3 text-orange-400 flex-shrink-0" />
                            <p className="text-xs text-zinc-500 italic truncate">"{myShop.hot_find}"</p>
                          </div>
                        )}
                      </button>
                    )}

                    {myShop && (
                      <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen className="h-4 w-4" style={{ color: '#1d4ed8' }} />
                          <p className="font-black text-sm">Free Comic Book Day {FCBD_YEAR}</p>
                        </div>
                        <p className="text-xs text-zinc-400 mb-3">Tell shoppers if {myShop.name} is taking part.</p>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-sm text-zinc-700">We're participating</span>
                          <button onClick={() => { setFcbdParticipating(!fcbdParticipating); setFcbdSaved(false) }}
                            className="relative w-12 h-7 rounded-full transition-colors flex-shrink-0"
                            style={{ background: fcbdParticipating ? '#0F9D8A' : '#d4d4d8' }}>
                            <span className="absolute top-1 h-5 w-5 rounded-full bg-zinc-50 transition-all" style={{ left: fcbdParticipating ? '24px' : '4px' }} />
                          </button>
                        </div>
                        {fcbdParticipating && (
                          <textarea value={fcbdOffers} onChange={e => { setFcbdOffers(e.target.value); setFcbdSaved(false) }} rows={3}
                            placeholder="Your FCBD sales, discounts & in-store specials (e.g. 20% off back issues, free grab bags, raffle, creator signing)"
                            className="w-full mt-2 bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none resize-none" />
                        )}
                        <button onClick={handleFcbdSave} disabled={fcbdSaving}
                          className="w-full mt-3 py-2.5 rounded-2xl text-sm font-medium text-white disabled:opacity-60" style={{ background: '#0F9D8A' }}>
                          {fcbdSaving ? 'Saving…' : fcbdSaved ? 'Saved ✓' : 'Save'}
                        </button>
                      </div>
                    )}

                    {myEvents.length > 0 && (
                      <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
                        <p className="text-xs font-black uppercase text-zinc-400 mb-3">Upcoming Events</p>
                        <div className="space-y-2">
                          {myEvents.map((ev: any) => (
                            <button key={ev.id} onClick={() => { goTab('discover'); setActiveSection('events') }}
                              className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-left hover:bg-zinc-50 transition-all" style={{ background: '#131615' }}>
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-zinc-900 truncate">{ev.title}</p>
                                <p className="text-xs text-zinc-400 truncate">{ev.location || ev.shops?.name || ''}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs bg-zinc-200 px-2 py-1 rounded-lg font-mono font-bold">{ev.date}</span>
                                <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg" style={{ background: '#F0FDF4', color: '#166534' }}>Going</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {savedShops.length > 0 && (
                      <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
                        <p className="text-xs font-black uppercase text-zinc-400 mb-3">Saved Shops</p>
                        <div className="grid grid-cols-3 gap-2">
                          {savedShops.map((id: string) => shops.find((s: any) => s.id === id)).filter(Boolean).map((s: any) => (
                            <button key={s.id} onClick={() => openShop(s)} className="text-left">
                              <div className="aspect-square rounded-xl bg-zinc-100 overflow-hidden">
                                <ShopThumb s={s} className="w-full h-full" />
                              </div>
                              <p className="text-[11px] font-medium truncate mt-1 text-zinc-700">{s.name}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {(myListings.length > 0 || myTrades.length > 0) && (
                      <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
                        <p className="text-xs font-black uppercase text-zinc-400 mb-3">My Listings &amp; Trades</p>
                        {myListings.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {myListings.map((l: any) => (
                              <button key={l.id} onClick={() => openListing(l)} className="text-left">
                                <div className="relative aspect-square rounded-xl bg-zinc-100 overflow-hidden">
                                  {l.image_url
                                    ? <img src={l.image_url} alt={l.title} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-zinc-300"><Package className="h-6 w-6" /></div>}
                                  {l.status === 'sold' && (
                                    <span className="absolute top-1 left-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-zinc-800/90 text-white">Sold</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                  <p className="text-[11px] font-medium truncate" style={{ color: '#0F9D8A' }}>${Number(l.price).toLocaleString()}</p>
                                  {l.quantity > 1 && <span className="text-[9px] font-semibold px-1 py-0.5 rounded-full bg-zinc-100 text-zinc-500 shrink-0">x{l.quantity}</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {myTrades.length > 0 && (
                          <div className="space-y-1.5">
                            {myTrades.map((t: any) => (
                              <div key={t.id} className="text-xs text-zinc-600 bg-zinc-50 rounded-xl px-3 py-2">
                                <span className="font-medium text-emerald-700">HAS</span> {t.offer} · <span className="font-medium" style={{ color: '#0F9D8A' }}>WANTS</span> {t.look_for}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-zinc-50 rounded-3xl overflow-hidden shadow-sm border border-zinc-100">
                      {[
                        { label: "Subscription", sub: "Manage your plan", action: () => setModal("sub") },
                        { label: "Notifications", sub: "Drops, events and alerts", action: () => setModal("notifications") },
                        { label: myShop ? "Manage Shop" : "Claim a Shop", sub: myShop ? "Edit your listing" : "Verify with EIN", action: () => myShop ? openShop(myShop) : openClaimModal() },
                        { label: "Submit Shop or Event", sub: "Suggest a listing for review", action: () => setModal("submit") },
                        { label: "Sign Out", sub: `Signed in as @${profile?.username}`, action: () => signOut() },
                      ].map((item, i) => (
                        <button key={i} onClick={item.action}
                          className="w-full px-5 py-4 flex items-center justify-between border-b border-zinc-50 last:border-0 text-left hover:bg-zinc-50 transition-all">
                          <div>
                            <p className="font-black text-sm">{item.label}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">{item.sub}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-zinc-300" />
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 space-y-5">
                    <div className="h-20 w-20 rounded-3xl flex items-center justify-center mx-auto" style={{ background: 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
                      <User className="h-10 w-10 text-white/40" />
                    </div>
                    <div>
                      <p className="font-black text-xl">Not signed in</p>
                      <p className="text-sm text-zinc-400 mt-2 leading-relaxed">Sign in to post trades, list items for sale, and leave reviews</p>
                    </div>
                    <button onClick={() => setModal('auth')}
                      className="text-white font-black px-10 py-4 rounded-2xl text-sm uppercase"
                      style={{ background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>
                      Sign In
                    </button>
                  </div>
                )}

                <div className="pt-2 pb-1 text-center">
                  <div className="flex items-center justify-center gap-3 text-xs text-zinc-400">
                    <button onClick={() => window.open('/privacy', '_blank')} className="hover:text-zinc-600 transition-colors">Privacy Policy</button>
                    <span className="text-zinc-300">·</span>
                    <button onClick={() => window.open('/terms', '_blank')} className="hover:text-zinc-600 transition-colors">Terms of Service</button>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-2">Outpost · Find collectibles near you</p>
                </div>
              </div>
            )}
          </main>

          {/* MOBILE BOTTOM NAV */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-zinc-200 px-1 py-2 pb-6 flex items-center justify-around z-20"
            style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)' }}>
            {[
              { id: 'discover', icon: Search, label: 'Discover' },
              { id: 'marketplace', icon: Store, label: 'Marketplace' },
              { id: 'messages', icon: MessageCircle, label: 'Chat' },
              { id: 'news', icon: Newspaper, label: 'News' },
              { id: 'profile', icon: User, label: 'Profile' },
            ].map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => goTab(id as TabType)}
                className="flex flex-col items-center gap-1 px-2 transition-all relative">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center transition-all relative"
                  style={tab === id ? { background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' } : {}}>
                  <Icon className="h-4 w-4" style={{ color: tab === id ? 'white' : '#9ca3af' }} />
                  {id === 'messages' && unreadMessages > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center" style={{ background: '#0F9D8A' }}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>
                  )}
                </div>
                <span className="text-[9px] font-bold uppercase" style={{ color: tab === id ? '#0F9D8A' : '#9ca3af' }}>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* SHOP DETAIL */}
      {modal === 'shop' && selectedShop && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden md:inset-y-0 md:right-0 md:left-56" style={{ background: '#F0EFE9' }}>
          <div className="px-4 pt-12 md:pt-4 pb-4 flex items-center gap-3 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
            <button onClick={closeShop} className="h-9 w-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <X className="h-4 w-4 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-base text-white leading-tight truncate">{selectedShop.name}</h2>
              <p className="text-xs text-white/40 font-mono">{selectedShop.address}</p>
              <div className="flex items-center gap-2 mt-1">
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((selectedShop as any).address)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
                  <Navigation className="h-3 w-3" /> Directions
                </a>
                {(selectedShop as any).phone && (
                  <a href={`tel:${(selectedShop as any).phone}`}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}>
                    <Phone className="h-3 w-3" /> Call
                  </a>
                )}
              </div>
            </div>
            <span className="text-amber-400 font-bold">{selectedShop.rating}★</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 md:max-w-2xl md:mx-auto md:w-full">
            <div className="relative">
              <div onClick={() => (selectedShop as any).image_url && setLightboxUrl((selectedShop as any).image_url)}
                className={(selectedShop as any).image_url ? 'cursor-pointer' : ''}>
                <ShopThumb s={selectedShop} className="h-44 w-full rounded-3xl border border-zinc-200" />
              </div>
              {isMerchant && (selectedShop as any).owner_id === user?.id && (
                <label className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white cursor-pointer shadow-lg" style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <Plus className="h-3.5 w-3.5" />{galleryBusy ? 'Uploading…' : 'Change cover'}
                  <input type="file" accept="image/*" onChange={handleSwapCover} className="hidden" disabled={galleryBusy} />
                </label>
              )}
            </div>
            {(selectedShop as any).gallery?.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {(selectedShop as any).gallery.map((g: string, i: number) => (
                  <img key={i} src={g} alt="" onClick={() => setLightboxUrl(g)}
                    className="aspect-square object-cover rounded-2xl border border-zinc-200 cursor-pointer hover:opacity-90 transition-opacity" />
                ))}
              </div>
            )}
            {typeof (selectedShop as any).lat === 'number' && typeof (selectedShop as any).lng === 'number' && (
              <div className="rounded-3xl overflow-hidden border border-zinc-200">
                <LocalMap shops={[selectedShop]} onSelect={() => {}} />
              </div>
            )}
            <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
              <div className="flex gap-2 flex-wrap">
                {((selectedShop as any).categories?.length > 0 ? (selectedShop as any).categories : [(selectedShop as any).category]).map((cat: string) => (
                  <span key={cat} className="text-xs font-black uppercase px-2.5 py-1 rounded-xl" style={categoryStyle(cat)}>{cat}</span>
                ))}
              </div>
              <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{selectedShop.description}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                <span className="text-sm font-mono text-zinc-400">⏱ {selectedShop.hours}</span>
                <div className="flex gap-2">
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((selectedShop as any).address)}`}
                    target="_blank" rel="noopener noreferrer" aria-label="Directions"
                    className="h-11 w-11 flex items-center justify-center rounded-2xl text-white"
                    style={{ background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>
                    <Navigation className="h-4 w-4" />
                  </a>
                  {(selectedShop as any).phone && (
                    <a href={`tel:${(selectedShop as any).phone}`} aria-label="Call"
                      className="h-11 w-11 flex items-center justify-center rounded-2xl text-white"
                      style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  {(selectedShop as any).website && (
                    <a href={(selectedShop as any).website.startsWith('http') ? (selectedShop as any).website : `https://${(selectedShop as any).website}`}
                      target="_blank" rel="noopener noreferrer" aria-label="Website"
                      className="h-11 w-11 flex items-center justify-center rounded-2xl text-white"
                      style={{ background: '#27272a' }}>
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            {fcbdShopIds.has(selectedShop.id) && (
              <div className="rounded-3xl p-4 border" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" style={{ color: '#1d4ed8' }} />
                  <p className="font-black text-sm" style={{ color: '#1d4ed8' }}>FCBD {FCBD_YEAR} participant</p>
                </div>
                {fcbdOfferByShop.get(selectedShop.id) && (
                  <p className="text-sm text-zinc-700 mt-2 whitespace-pre-wrap">{String(fcbdOfferByShop.get(selectedShop.id))}</p>
                )}
              </div>
            )}
            {isMerchant && !(selectedShop as any).owner_id && (
              <button onClick={async () => {
                if (!confirm(`Claim ${selectedShop.name} as your shop?`)) return
                await supabase.from('shops').update({ owner_id: user?.id }).eq('id', selectedShop.id)
                alert('Shop claimed! You can now post drops and manage your listing.')
                window.location.reload()
              }}
                className="w-full rounded-3xl p-4 border-2 border-dashed text-center"
                style={{ borderColor: '#059669', background: 'rgba(5,150,105,0.04)' }}>
                <Store className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                <p className="font-black text-sm text-emerald-600">This is my shop — Claim it</p>
                <p className="text-xs text-zinc-400 mt-0.5">Tap to link this listing to your account</p>
              </button>
            )}

            {(selectedShop.hot_find || (isMerchant && (selectedShop as any).owner_id === user?.id)) && (
              <div className="rounded-3xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-4 w-4 text-orange-400" />
                  <span className="text-xs font-black uppercase tracking-widest text-orange-400">Live Floor Drop</span>
                </div>
                {selectedShop.hot_find && (
                  <p className="text-sm font-bold italic mb-2">"{selectedShop.hot_find}"</p>
                )}
                {isMerchant && (selectedShop as any).owner_id === user?.id && (
                  <form onSubmit={async e => { e.preventDefault(); if (!inpFind.trim()) return; await updateHotFind(selectedShop.id, inpFind); setInpFind('') }}
                    className="space-y-2">
                    <input type="text" value={inpFind} onChange={e => setInpFind(e.target.value)}
                      placeholder="Broadcast new drop..."
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none text-white placeholder:text-white/30"
                      style={{ background: 'rgba(255,255,255,0.1)' }} />
                    <button type="submit" className="w-full py-2.5 rounded-2xl text-sm font-black uppercase text-white"
                      style={{ background: 'rgba(255,255,255,0.2)' }}>Publish Drop</button>
                  </form>
                )}
              </div>
            )}
            {isSignedIn && !(selectedShop as any).owner_id && (
              <button onClick={() => openClaimModal(selectedShop)}
                className="w-full rounded-3xl p-4 border-2 border-dashed text-center"
                style={{ borderColor: '#0F9D8A', background: 'rgba(15,157,138,0.04)' }}>
                <Store className="h-5 w-5 mx-auto mb-1" style={{ color: '#0F9D8A' }} />
                <p className="font-black text-sm" style={{ color: '#0F9D8A' }}>Own this shop? Claim it</p>
                <p className="text-xs text-zinc-400 mt-0.5">Verify to edit details &amp; get the owner badge</p>
              </button>
            )}

            {isMerchant && (selectedShop as any).owner_id === user?.id && (
              <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black uppercase text-zinc-400">Shop Details</p>
                  <button onClick={() => {
                    if (!editingInfo) {
                      setInpWebsite((selectedShop as any).website || '')
                      setInpPhone((selectedShop as any).phone || '')
                      setInpHours((selectedShop as any).hours || '')
                      setInpDesc((selectedShop as any).description || '')
                    }
                    setEditingInfo(!editingInfo)
                  }}
                    className="text-xs font-black px-3 py-1.5 rounded-xl"
                    style={{ background: editingInfo ? '#0F9D8A' : '#f3f4f6', color: editingInfo ? 'white' : '#6b7280' }}>
                    {editingInfo ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                {editingInfo ? (
                  <div className="space-y-2.5">
                    <input value={inpWebsite} onChange={e => setInpWebsite(e.target.value)}
                      placeholder="Website (https://…)" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none" />
                    <input value={inpPhone} onChange={e => setInpPhone(e.target.value)}
                      placeholder="Phone" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none" />
                    <input value={inpHours} onChange={e => setInpHours(e.target.value)}
                      placeholder="Hours (e.g. Mon–Sat 11–7)" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none" />
                    <textarea value={inpDesc} onChange={e => setInpDesc(e.target.value)} rows={3}
                      placeholder="Short description of your shop" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none resize-none" />
                    <button onClick={handleSaveShopInfo} disabled={savingInfo}
                      className="w-full py-2.5 rounded-2xl text-xs font-black uppercase text-white disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                      {savingInfo ? 'Saving…' : 'Save Details'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-sm text-zinc-600">
                    {(selectedShop as any).website
                      ? <p>🌐 <a href={(selectedShop as any).website.startsWith('http') ? (selectedShop as any).website : `https://${(selectedShop as any).website}`} target="_blank" rel="noopener noreferrer" className="underline break-all" style={{ color: '#0F9D8A' }}>{(selectedShop as any).website}</a></p>
                      : <p className="text-zinc-400">No website yet — tap Edit to add yours.</p>}
                    {(selectedShop as any).phone && <p>📞 {(selectedShop as any).phone}</p>}
                    {(selectedShop as any).hours && <p>🕑 {(selectedShop as any).hours}</p>}
                  </div>
                )}
              </div>
            )}

            {isMerchant && (selectedShop as any).owner_id === user?.id && (
              <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black uppercase text-zinc-400">Shop Photos</p>
                  <span className="text-xs text-zinc-400 font-mono">{((selectedShop as any).gallery || []).length}/5</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {((selectedShop as any).gallery || []).map((g: string, i: number) => (
                    <div key={i} className="relative aspect-square">
                      <img src={g} alt="" className="w-full h-full object-cover rounded-2xl border border-zinc-200" />
                      <button onClick={() => handleRemoveShopPhoto(g)}
                        className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-zinc-50 shadow border border-zinc-200 flex items-center justify-center">
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  ))}
                  {((selectedShop as any).gallery || []).length < 5 && (
                    <label className="aspect-square rounded-2xl border-2 border-dashed border-zinc-200 flex items-center justify-center cursor-pointer">
                      {galleryBusy
                        ? <span className="text-[10px] text-zinc-400">Uploading…</span>
                        : <Plus className="h-5 w-5 text-zinc-400" />}
                      <input type="file" accept="image/*" onChange={handleAddShopPhoto} className="hidden" disabled={galleryBusy} />
                    </label>
                  )}
                </div>
              </div>
            )}

            {isMerchant && (selectedShop as any).owner_id === user?.id && (
              <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black uppercase text-zinc-400">Shop Categories</p>
                  <button onClick={() => { setEditingCategories(!editingCategories); setShopCategories((selectedShop as any).categories || []) }}
                    className="text-xs font-black px-3 py-1.5 rounded-xl"
                    style={{ background: editingCategories ? '#0F9D8A' : '#f3f4f6', color: editingCategories ? 'white' : '#6b7280' }}>
                    {editingCategories ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                {editingCategories ? (
                  <div className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {['cards','comics','collectibles','toys'].map(cat => (
                        <button key={cat} type="button"
                          onClick={() => setShopCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                          className="px-3 py-2 rounded-xl text-xs font-black uppercase border-2 transition-all"
                          style={shopCategories.includes(cat)
                            ? cat === 'cards' ? { background: '#E0F2FE', borderColor: '#0284C7', color: '#0284C7' }
                            : cat === 'comics' ? { background: '#FEF3C7', borderColor: '#D97706', color: '#D97706' }
                            : cat === 'toys' ? { background: '#D1FAE5', borderColor: '#059669', color: '#059669' }
                            : { background: '#EDE9FE', borderColor: '#7C3AED', color: '#7C3AED' }
                            : { background: 'white', borderColor: '#e5e7eb', color: '#9ca3af' }}>
                          {cat === 'cards' ? '🃏' : cat === 'comics' ? '📚' : cat === 'toys' ? '🧸' : '🏆'} {cat}
                        </button>
                      ))}
                    </div>
                    <button onClick={async () => {
                      await supabase.from('shops').update({ categories: shopCategories }).eq('id', selectedShop.id)
                      setEditingCategories(false)
                    }}
                      className="w-full py-2.5 rounded-2xl text-xs font-black uppercase text-white"
                      style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                      Save Categories
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {((selectedShop as any).categories?.length > 0 ? (selectedShop as any).categories : [(selectedShop as any).category]).map((cat: string) => (
                      <span key={cat} className="text-xs font-black px-2.5 py-1 rounded-xl uppercase"
                        style={cat === 'comics' ? { background: '#FEF3C7', color: '#92400E' }
                          : cat === 'cards' ? { background: '#E0F2FE', color: '#0369A1' }
                          : cat === 'toys' ? { background: '#D1FAE5', color: '#065F46' }
                          : { background: '#EDE9FE', color: '#5B21B6' }}>
                        {cat}
                      </span>
                    ))}
                    {!(selectedShop as any).categories?.length && (
                      <p className="text-xs text-zinc-400">No categories set — tap Edit to add</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {(selectedShop as any).events?.length > 0 && (
              <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-black uppercase text-zinc-400">Events</span>
                </div>
                {(selectedShop as any).events.map((ev: any) => (
                  <div key={ev.id} className="flex items-center justify-between p-3 rounded-2xl mb-2" style={{ background: '#131615' }}>
                    <div>
                      <span className="text-xs bg-zinc-200 px-2 py-0.5 rounded-lg font-mono font-bold mr-2">{ev.date}</span>
                      <span className="text-sm font-bold">{ev.title}</span>
                    </div>
                    <button onClick={() => toggleRsvp(ev.id)}
                      className="text-xs font-black uppercase px-3 py-1.5 rounded-xl border-2"
                      style={rsvps.includes(ev.id) ? { background: '#F0FDF4', color: '#166534', borderColor: '#BBF7D0' } : { background: 'white', color: '#9ca3af', borderColor: '#e5e7eb' }}>
                      {rsvps.includes(ev.id) ? '✓ RSVP' : 'RSVP'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedShop.owner_id === user?.id ? (
              <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black uppercase text-zinc-400">Manage Rewards</p>
                  <span className="text-[10px] text-zinc-400 font-mono">Outpost Rewards Accepted Here</span>
                </div>

                {myShopPendingRedemptions.length > 0 && (
                  <div className="mb-3 p-3 rounded-2xl" style={{ background: '#FEF3C7' }}>
                    <p className="text-xs font-black text-amber-900 mb-1">{myShopPendingRedemptions.length} pending redemption{myShopPendingRedemptions.length !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-amber-800">Ask the customer for their 6-digit code and enter it below to confirm.</p>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <input value={confirmCodeInput} onChange={e => setConfirmCodeInput(e.target.value.toUpperCase())}
                    placeholder="Customer's code" maxLength={6}
                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest outline-none" />
                  <button onClick={async () => {
                      const { error } = await confirmRewardCode(confirmCodeInput)
                      if (error) alert(error)
                      else { setConfirmCodeInput(''); alert('Redemption confirmed!') }
                    }}
                    disabled={confirmCodeInput.length < 6}
                    className="px-4 py-2.5 rounded-xl text-xs font-black text-white disabled:opacity-40 flex-shrink-0"
                    style={{ background: '#059669' }}>
                    Confirm
                  </button>
                </div>

                <div className="space-y-2 mb-3">
                  {myShopOffers.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between p-3 rounded-2xl" style={{ background: '#131615' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{o.title}</p>
                        <p className="text-xs text-zinc-400">{o.points_cost.toLocaleString()} OP{o.quantity_available != null ? ` · ${o.quantity_available - o.quantity_redeemed} left` : ''}{!o.active ? ' · inactive' : ''}</p>
                      </div>
                      <button onClick={() => deleteRewardOffer(o.id)} className="text-red-400 flex-shrink-0"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {myShopOffers.length === 0 && <p className="text-xs text-zinc-400">No reward offers yet — post one below.</p>}
                </div>

                <div className="pt-3 border-t border-zinc-100 space-y-2">
                  <input value={newOfferTitle} onChange={e => setNewOfferTitle(e.target.value)}
                    placeholder="Reward (e.g. Free booster pack, 10% off)" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <textarea value={newOfferDesc} onChange={e => setNewOfferDesc(e.target.value)}
                    placeholder="Details (optional)" rows={2} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none resize-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min={1} value={newOfferCost} onChange={e => setNewOfferCost(e.target.value)}
                      placeholder="OP cost" className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                    <input type="number" min={1} value={newOfferQty} onChange={e => setNewOfferQty(e.target.value)}
                      placeholder="Qty available (blank = unlimited)" className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  </div>
                  <button onClick={async () => {
                      if (!newOfferTitle.trim() || !newOfferCost) return
                      const { error } = await createRewardOffer({
                        title: newOfferTitle.trim(),
                        description: newOfferDesc.trim(),
                        points_cost: parseInt(newOfferCost) || 0,
                        quantity_available: newOfferQty ? parseInt(newOfferQty) : null,
                      })
                      if (error) alert(error)
                      else { setNewOfferTitle(''); setNewOfferDesc(''); setNewOfferCost('500'); setNewOfferQty('') }
                    }}
                    className="w-full py-2.5 rounded-2xl text-xs font-black uppercase text-white" style={{ background: '#0F9D8A' }}>
                    Post Reward
                  </button>
                </div>
              </div>
            ) : shopRewardOffers.filter((o: any) => o.active).length > 0 && (
              <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-black uppercase text-zinc-400">Outpost Rewards Accepted Here</span>
                </div>
                <div className="space-y-2">
                  {shopRewardOffers.filter((o: any) => o.active).map((o: any) => {
                    const soldOut = o.quantity_available != null && o.quantity_redeemed >= o.quantity_available
                    const affordable = opBalance >= o.points_cost
                    return (
                      <div key={o.id} className="flex items-center justify-between p-3 rounded-2xl" style={{ background: '#131615' }}>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{o.title}</p>
                          {o.description && <p className="text-xs text-zinc-400 truncate">{o.description}</p>}
                          <p className="text-xs font-bold mt-0.5" style={{ color: '#0F9D8A' }}>{o.points_cost.toLocaleString()} OP</p>
                        </div>
                        <button onClick={async () => {
                            if (!isSignedIn) { setModal('auth'); return }
                            const { code, error } = await redeemOffer(o.id)
                            if (error) alert(error)
                            else if (code) { setRedeemedCode(code); alert(`Redeemed! Show this code to staff: ${code}`) }
                          }}
                          disabled={soldOut || !affordable}
                          className="px-3 py-2 rounded-xl text-xs font-black text-white disabled:opacity-40 flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
                          {soldOut ? 'Sold out' : !affordable ? 'Not enough OP' : 'Redeem'}
                        </button>
                      </div>
                    )
                  })}
                </div>
                {redeemedCode && (
                  <div className="mt-3 p-3 rounded-2xl text-center" style={{ background: '#131615' }}>
                    <p className="text-[10px] text-white/50 uppercase font-black">Show this to staff</p>
                    <p className="text-2xl font-black tracking-widest text-white mt-1">{redeemedCode}</p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-zinc-50 rounded-3xl p-4 shadow-sm border border-zinc-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black uppercase text-zinc-400">Reviews</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-mono">{checkinCount} check-ins</span>
                  <button onClick={async () => {
                      if (!isSignedIn) { setModal('auth'); return }
                      const { error } = await checkIn(userLat, userLng)
                      if (error) alert(error)
                    }}
                    disabled={userCheckedIn}
                    className="text-xs font-black px-3 py-1.5 rounded-xl text-white disabled:opacity-60 flex items-center gap-1"
                    style={{ background: userCheckedIn ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
                    {userCheckedIn ? <><Check className="h-3 w-3" /> Checked In</> : 'Check In'}
                  </button>
                </div>
              </div>
              {reviews.map((r: any) => (
                <div key={r.id} className="p-3 rounded-2xl mb-2" style={{ background: '#131615' }}>
                  <p className="text-sm font-medium">"{r.comment}"</p>
                  <p className="text-xs font-mono font-bold mt-1" style={{ color: '#0F9D8A' }}>@{r.username}</p>
                </div>
              ))}
              {reviews.length === 0 && <p className="text-sm text-zinc-400 italic mb-3">No reviews yet</p>}
              {(selectedShop as any).owner_id === user?.id ? (
                <p className="text-xs text-zinc-400 italic">You can't review your own shop.</p>
              ) : (
                <form onSubmit={handleReviewSubmit} className="flex gap-2">
                  <input type="text" required value={inpRev} onChange={e => setInpRev(e.target.value)}
                    placeholder={isSignedIn ? 'Leave a review...' : 'Sign in to review'}
                    disabled={!isSignedIn}
                    className="flex-1 bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none disabled:opacity-50" />
                  <button type="submit" disabled={!isSignedIn}
                    className="text-white font-black px-4 py-2 rounded-2xl text-sm disabled:opacity-30"
                    style={{ background: '#131615' }}>Post</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LIST AN ITEM */}
      {modal === 'listsale' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-10 shadow-2xl max-h-[92vh] overflow-y-auto" style={{ background: '#0A0B0C' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-semibold text-lg">{editingListingId ? 'Edit listing' : 'List an item'}</h3>
              <button onClick={() => { setEditingListingId(null); setMktPhotos([]); setModal('none') }}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <form onSubmit={handleListingSubmit} className="space-y-3">
              <PhotoSlots previews={mktPreviewUrls} onAdd={onPickPhotos} onRemove={removeMktPhoto} label="Add photos" />
              <input type="text" required value={mktTitle} onChange={e => setMktTitle(e.target.value)}
                placeholder="What are you selling?" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                  <input type="number" required value={mktPrice} onChange={e => setMktPrice(e.target.value)}
                    placeholder="Price" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none" />
                </div>
                <input type="number" min={1} value={mktQuantity} onChange={e => setMktQuantity(e.target.value)}
                  placeholder="Qty" className="w-24 bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-3 text-sm focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={mktCategory} onChange={e => setMktCategory(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-3 text-sm focus:outline-none capitalize">
                  {['cards','comics','collectibles','toys'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={mktCondition} onChange={e => setMktCondition(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-3 text-sm focus:outline-none">
                  {['Raw','Near Mint','New','Used','PSA 10','PSA 9','PSA 8','CGC 9.8','CGC 9.6','BGS 9.5','Damaged'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <textarea value={mktDesc} onChange={e => setMktDesc(e.target.value)}
                placeholder="Description — condition details, what's included…" rows={2} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none resize-none" />
              <input type="text" value={mktContact} onChange={e => setMktContact(e.target.value)}
                placeholder="How buyers reach you (phone, email, IG…)" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
              <button type="submit" disabled={mktSubmitting}
                className="w-full text-white font-medium py-3.5 rounded-2xl text-sm disabled:opacity-60" style={{ background: '#0F9D8A' }}>
                {mktSubmitting ? 'Saving…' : (editingListingId ? 'Save changes' : 'Post listing')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* USER PROFILE (public seller profile) */}
      {modal === 'userprofile' && viewedProfileUserId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" onClick={closeUserProfile}>
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto bg-zinc-50" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-end">
                <button onClick={closeUserProfile}><X className="h-5 w-5 text-zinc-400" /></button>
              </div>
              <div className="flex flex-col items-center text-center gap-2 -mt-6">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center border border-zinc-200">
                  {viewedProfile?.avatar_url
                    ? <img src={viewedProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                    : <User className="h-8 w-8 text-zinc-300" />}
                </div>
                <p className="text-lg font-semibold text-zinc-900">@{viewedProfile?.username || '…'}</p>
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <StandingBadge standing={standingMap[viewedProfileUserId]?.standing} verified={standingMap[viewedProfileUserId]?.is_verified_seller} />
                  <RatingBadge avgRating={standingMap[viewedProfileUserId]?.avg_rating} count={standingMap[viewedProfileUserId]?.ratings_count} />
                </div>
                {standingMap[viewedProfileUserId]?.member_since && (
                  <p className="text-xs text-zinc-400">
                    Joined {new Date(standingMap[viewedProfileUserId].member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 py-3 border-y border-zinc-100">
                {[
                  ['Sold', standingMap[viewedProfileUserId]?.sold_count],
                  ['Bought', standingMap[viewedProfileUserId]?.bought_count],
                  ['Followers', standingMap[viewedProfileUserId]?.followers_count],
                  ['Following', standingMap[viewedProfileUserId]?.following_count],
                ].map(([label, val]: any) => (
                  <div key={label} className="text-center">
                    <p className="text-lg font-bold text-zinc-900">{val ?? 0}</p>
                    <p className="text-[11px] text-zinc-400">{label}</p>
                  </div>
                ))}
              </div>

              {user && user.id !== viewedProfileUserId && (
                <div className="flex gap-2">
                  <button onClick={() => toggleFollow(viewedProfileUserId)}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-medium"
                    style={following.includes(viewedProfileUserId) ? { border: '1px solid #e4e4e7', color: '#52525b' } : { background: '#059669', color: 'white' }}>
                    {following.includes(viewedProfileUserId) ? 'Following' : 'Follow'}
                  </button>
                  <button onClick={() => messageSeller(viewedProfileUserId)}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-medium text-white" style={{ background: '#0F9D8A' }}>
                    Start a chat
                  </button>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-zinc-900 mb-2">Items from this seller</p>
                {(() => {
                  const items = [
                    ...listings.filter((l: any) => l.user_id === viewedProfileUserId && l.status === 'active').map((l: any) => ({ ...l, _kind: 'listing' as const })),
                    ...tradePosts.filter((t: any) => t.user_id === viewedProfileUserId && !t.completed_with).map((t: any) => ({ ...t, _kind: 'trade' as const })),
                  ]
                  if (items.length === 0) return <p className="text-xs text-zinc-400">No active items right now.</p>
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((it: any) => (
                        <button key={`${it._kind}-${it.id}`} onClick={() => { closeUserProfile(); if (it._kind === 'listing') openListing(it); else openTrade(it) }}
                          className="text-left rounded-2xl border border-zinc-200 overflow-hidden">
                          <div className="aspect-square bg-zinc-100">
                            {it.image_url
                              ? <img src={it.image_url} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-zinc-300"><Package className="h-8 w-8" /></div>}
                          </div>
                          <div className="p-2">
                            {it._kind === 'listing'
                              ? <div className="flex items-center gap-1">
                                  <p className="text-sm font-semibold" style={{ color: '#0F9D8A' }}>${Number(it.price).toLocaleString()}</p>
                                  {it.quantity > 1 && <span className="text-[9px] font-semibold px-1 py-0.5 rounded-full bg-zinc-100 text-zinc-500">Qty: {it.quantity}</span>}
                                </div>
                              : <p className="text-[11px] font-semibold text-emerald-700">TRADE</p>}
                            <p className="text-xs text-zinc-700 truncate">{it._kind === 'listing' ? it.title : it.offer}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LISTING DETAIL */}
      {modal === 'listingdetail' && selectedListing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" onClick={closeListing}>
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto bg-zinc-50" onClick={e => e.stopPropagation()}>
            <div className="relative">
              {selectedListing.image_url
                ? <img src={selectedListing.image_url} alt={selectedListing.title} onClick={() => setLightboxUrl(selectedListing.image_url)} className="w-full aspect-square object-cover cursor-zoom-in" />
                : <div className="w-full aspect-square bg-zinc-100 flex items-center justify-center text-zinc-300"><Package className="h-12 w-12" /></div>}
              <div className="absolute top-3 left-3 flex gap-2">
                <button onClick={() => toggleSaveListing(selectedListing.id)} aria-label="Save"
                  className="h-9 w-9 rounded-full bg-white/90 flex items-center justify-center shadow">
                  <Heart className="h-4 w-4" style={savedListings.includes(selectedListing.id) ? { fill: '#0F9D8A', color: '#0F9D8A' } : { color: '#52525b' }} />
                </button>
                <button onClick={() => shareUrl(`/marketplace/${selectedListing.slug}`, selectedListing.title)} aria-label="Share"
                  className="h-9 w-9 rounded-full bg-white/90 flex items-center justify-center shadow">
                  <Share2 className="h-4 w-4 text-zinc-600" />
                </button>
              </div>
              <button onClick={closeListing} className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 flex items-center justify-center shadow"><X className="h-5 w-5 text-zinc-600" /></button>
            </div>
            {selectedListing.gallery?.length > 0 && (
              <div className="flex gap-2 px-5 pt-3">
                {selectedListing.gallery.map((g: string, i: number) => (
                  <img key={i} src={g} alt="" onClick={() => setLightboxUrl(g)} className="h-16 w-16 rounded-xl object-cover cursor-zoom-in border border-zinc-200" />
                ))}
              </div>
            )}
            <div className="p-5 space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-semibold" style={{ color: '#0F9D8A' }}>${Number(selectedListing.price).toLocaleString()}</p>
                  {selectedListing.quantity > 1 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">Qty: {selectedListing.quantity}</span>
                  )}
                  {selectedListing.status === 'sold' && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-white">Sold</span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mt-0.5">{selectedListing.title}</h3>
                <div className="flex items-center gap-2 text-[13px] text-zinc-500 mt-1 flex-wrap">
                  {selectedListing.condition && <span className="bg-zinc-100 px-2 py-0.5 rounded-full">{selectedListing.condition}</span>}
                  {selectedListing.category && <span className="bg-zinc-100 px-2 py-0.5 rounded-full capitalize">{selectedListing.category}</span>}
                  {selectedListing.distance != null && <span>· {fmtDist(selectedListing.distance)} away</span>}
                </div>
              </div>
              {selectedListing.description && <p className="text-sm text-zinc-600 whitespace-pre-wrap">{selectedListing.description}</p>}
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 flex-wrap">Listed by <button onClick={() => openUserProfile(selectedListing.user_id)} className="hover:underline text-zinc-500 font-medium">@{selectedListing.username}</button> <StandingBadge standing={standingMap[selectedListing.user_id]?.standing} verified={standingMap[selectedListing.user_id]?.is_verified_seller} /> <RatingBadge avgRating={standingMap[selectedListing.user_id]?.avg_rating} count={standingMap[selectedListing.user_id]?.ratings_count} /></p>
              {user && selectedListing.user_id && selectedListing.user_id !== user.id && (
                <button onClick={() => reportSeller(selectedListing.user_id)} disabled={reportedIds.includes(selectedListing.user_id)}
                  className="text-[11px] text-zinc-400 hover:text-red-500 transition-colors mt-1 disabled:text-zinc-300">
                  {reportedIds.includes(selectedListing.user_id) ? '✓ Reported — thanks' : '⚑ Report seller'}
                </button>
              )}

              {user?.id === selectedListing.user_id ? (
                <div className="space-y-2">
                  <button onClick={() => toggleListingSold(selectedListing)}
                    className="w-full py-3 rounded-2xl text-sm font-medium text-white"
                    style={{ background: selectedListing.status === 'sold' ? '#52525b' : '#059669' }}>
                    {selectedListing.status === 'sold' ? 'Mark as available' : 'Mark as sold'}
                  </button>
                  {buyerPickerOpen && (
                    <div className="rounded-2xl border border-zinc-200 p-3 space-y-1.5">
                      <p className="text-xs font-medium text-zinc-500 mb-1">Who bought it? (lets you rate each other)</p>
                      {listingMsgThreads.length === 0 && <p className="text-xs text-zinc-400 px-3 pb-1">No one has messaged you about this listing yet.</p>}
                      {listingMsgThreads.map((t: any) => (
                        <button key={t.counterpartyId} onClick={() => confirmListingSold(selectedListing, t.counterpartyId)}
                          className="w-full text-left px-3 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-sm text-zinc-700">@{t.profile?.username || 'user'}</button>
                      ))}
                      <button onClick={() => confirmListingSold(selectedListing, null)} className="w-full text-left px-3 py-2 rounded-xl text-sm text-zinc-400">Skip</button>
                    </div>
                  )}
                  {selectedListing.status === 'sold' && selectedListing.buyer_id && (
                    myRating ? (
                      <p className="text-xs text-zinc-400 text-center">You rated the buyer {myRating}★. Thanks!</p>
                    ) : (
                      <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-3 flex flex-col items-center gap-2">
                        <p className="text-xs font-medium text-zinc-500">Rate the buyer</p>
                        <StarPicker value={ratingDraft} onChange={n => { setRatingDraft(n); submitRating(selectedListing.buyer_id, { listingId: selectedListing.id }, n) }} />
                      </div>
                    )
                  )}
                  {offers.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-500">Offers</p>
                      {offers.map((o: any) => (
                        <SellerOfferRow key={o.id} offer={o}
                          onAccept={() => sellerRespond(o.id, 'accepted')}
                          onDecline={() => sellerRespond(o.id, 'declined')}
                          onCounter={(amt, msg) => sellerRespond(o.id, 'countered', amt, msg)} />
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => openListingEdit(selectedListing)}
                      className="flex-1 py-3 rounded-2xl text-sm font-medium border border-zinc-200 text-zinc-700">
                      Edit listing
                    </button>
                    <button onClick={() => { deleteListing(selectedListing.id); closeListing() }}
                      className="flex-1 py-3 rounded-2xl text-sm font-medium border border-red-200 text-red-600">
                      Delete listing
                    </button>
                  </div>
                </div>
              ) : selectedListing.status !== 'sold' ? (
                <div className="flex gap-2">
                  {showContact ? (
                    <div className="flex-1 rounded-2xl bg-zinc-50 border border-zinc-200 p-3 text-center flex flex-col justify-center">
                      <p className="text-[11px] text-zinc-400 mb-0.5">Contact</p>
                      <p className="text-xs font-medium text-zinc-900 break-words">{selectedListing.contact || 'No contact info provided.'}</p>
                    </div>
                  ) : (
                    <button onClick={() => setShowContact(true)}
                      className="flex-1 py-3 rounded-2xl text-sm font-medium text-white flex items-center justify-center gap-2" style={{ background: '#0F9D8A' }}>
                      <Phone className="h-4 w-4" /> Contact seller
                    </button>
                  )}
                  <button onClick={() => { if (!user) { setModal('auth'); return } setOfferFormOpen(v => !v) }}
                    className="flex-1 py-3 rounded-2xl text-sm font-medium text-white flex items-center justify-center gap-1.5" style={{ background: '#0F9D8A' }}>
                    <DollarSign className="h-3.5 w-3.5" /> Make an Offer
                  </button>
                </div>
              ) : showContact ? (
                <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 text-center">
                  <p className="text-xs text-zinc-400 mb-1">Contact the seller</p>
                  <p className="text-sm font-medium text-zinc-900 break-words">{selectedListing.contact || 'No contact info provided.'}</p>
                </div>
              ) : (
                <button onClick={() => setShowContact(true)}
                  className="w-full py-3.5 rounded-2xl text-sm font-medium text-white flex items-center justify-center gap-2" style={{ background: '#0F9D8A' }}>
                  <Phone className="h-4 w-4" /> Contact seller
                </button>
              )}

              {user && user.id !== selectedListing.user_id && (() => {
                const myOffer = offers.find((o: any) => o.buyer_id === user.id)
                return (
                  <div className="space-y-2">
                    {offerFormOpen && (!myOffer || myOffer.status === 'declined' || myOffer.status === 'withdrawn') && (
                      <div className="rounded-2xl border border-zinc-200 p-3 space-y-2">
                        <p className="text-xs font-medium text-zinc-500">Your offer</p>
                        <input type="number" min={1} value={offerAmount} onChange={e => setOfferAmount(e.target.value)} placeholder="$ amount"
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
                        <textarea value={offerMessage} onChange={e => setOfferMessage(e.target.value)} rows={2} placeholder="Add a message (optional)"
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" />
                        <button onClick={async () => {
                            const amt = parseFloat(offerAmount)
                            if (!amt || amt <= 0) return
                            const { error } = await makeOffer(user.id, amt, offerMessage)
                            if (!error) { setOfferFormOpen(false); setOfferAmount(''); setOfferMessage('') }
                          }}
                          disabled={!offerAmount}
                          className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: '#0F9D8A' }}>
                          Send offer
                        </button>
                      </div>
                    )}
                    {myOffer && myOffer.status === 'pending' && (
                      <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-3 flex items-center justify-between">
                        <p className="text-sm text-zinc-700">Your offer: <span className="font-semibold">${Number(myOffer.amount).toLocaleString()}</span> · pending</p>
                        <button onClick={() => withdrawOffer(myOffer.id)} className="text-xs text-red-500 font-medium flex-shrink-0">Withdraw</button>
                      </div>
                    )}
                    {myOffer && myOffer.status === 'countered' && (
                      <div className="rounded-2xl p-3 space-y-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                        <p className="text-sm text-zinc-700">Seller countered: <span className="font-semibold">${Number(myOffer.counter_amount).toLocaleString()}</span></p>
                        {myOffer.counter_message && <p className="text-xs text-zinc-500">"{myOffer.counter_message}"</p>}
                        <div className="flex gap-2">
                          <button onClick={() => buyerRespondToCounter(myOffer.id, true)} className="flex-1 py-2 rounded-xl text-sm font-medium text-white" style={{ background: '#059669' }}>Accept</button>
                          <button onClick={() => buyerRespondToCounter(myOffer.id, false)} className="flex-1 py-2 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-600">Decline</button>
                        </div>
                      </div>
                    )}
                    {myOffer && myOffer.status === 'accepted' && (
                      <p className="text-xs text-emerald-600 text-center font-medium">✓ Offer accepted at ${Number(myOffer.amount).toLocaleString()}</p>
                    )}
                    {myOffer && (myOffer.status === 'declined' || myOffer.status === 'withdrawn') && !offerFormOpen && (
                      <p className="text-xs text-zinc-400 text-center">Your offer was {myOffer.status}. <button onClick={() => setOfferFormOpen(true)} className="underline">Make a new offer</button></p>
                    )}
                  </div>
                )
              })()}

              {user && selectedListing.buyer_id === user.id && (
                myRating ? (
                  <p className="text-xs text-zinc-400 text-center">You rated the seller {myRating}★. Thanks!</p>
                ) : (
                  <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-3 flex flex-col items-center gap-2">
                    <p className="text-xs font-medium text-zinc-500">Rate the seller</p>
                    <StarPicker value={ratingDraft} onChange={n => { setRatingDraft(n); submitRating(selectedListing.user_id, { listingId: selectedListing.id }, n) }} />
                  </div>
                )
              )}

              <ItemMessages
                threads={listingMsgThreads} loading={listingMsgLoading}
                isOwner={user?.id === selectedListing.user_id} currentUserId={user?.id} isSignedIn={isSignedIn}
                draft={itemMsgDraft} setDraft={setItemMsgDraft}
                onSend={(body: string) => sendListingItemMessage(selectedListing.user_id, body)}
                onOpenConversation={(id: string) => { setActiveConversationId(id); closeListing(); goTab('messages') }}
                onSignIn={() => setModal('auth')}
              />
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROFILE */}
      {modal === 'editprofile' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-10 shadow-2xl max-h-[92vh] overflow-y-auto" style={{ background: '#0A0B0C' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-semibold text-lg">Edit profile</h3>
              <button onClick={() => setModal('none')}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Banner image</label>
                <label className="block cursor-pointer">
                  <div className="h-24 rounded-2xl overflow-hidden bg-zinc-100 flex items-center justify-center"
                    style={(epBannerPreview || profile?.banner_url) ? { backgroundImage: `url(${epBannerPreview || profile?.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                    {!(epBannerPreview || profile?.banner_url) && <span className="text-xs text-zinc-400"><Plus className="h-5 w-5 mx-auto mb-0.5" />Add a banner</span>}
                  </div>
                  <input type="file" accept="image/*" onChange={onPickBanner} className="hidden" />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer flex-shrink-0">
                  <div className="h-16 w-16 rounded-2xl overflow-hidden bg-zinc-100 flex items-center justify-center">
                    {(epAvatarPreview || profile?.avatar_url)
                      ? <img src={epAvatarPreview || profile?.avatar_url || ''} alt="" className="h-full w-full object-cover" />
                      : <User className="h-6 w-6 text-zinc-400" />}
                  </div>
                  <input type="file" accept="image/*" onChange={onPickAvatar} className="hidden" />
                </label>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Display name</label>
                  <input value={epName} onChange={e => setEpName(e.target.value)} placeholder={profile?.username || 'Your name'}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none" />
                </div>
              </div>
              <p className="text-xs text-zinc-400">Tap the square to change your avatar. Your @{profile?.username} handle stays the same.</p>
              <button onClick={handleSaveProfile} disabled={epSaving}
                className="w-full py-3.5 rounded-2xl text-sm font-medium text-white disabled:opacity-60" style={{ background: '#0F9D8A' }}>
                {epSaving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SET LOCATION */}
      {modal === 'setlocation' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto" style={{ background: '#0A0B0C' }}>
            <div className="px-5 py-4 flex items-center justify-between border-b border-zinc-100">
              <h3 className="font-semibold text-lg">Set location</h3>
              <button onClick={() => setModal('none')}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-zinc-200" style={{ height: 300 }}>
                {userLat && userLng ? (
                  <RadiusPicker lat={userLat} lng={userLng} radiusMiles={locRadius} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-2 bg-zinc-100">
                    <Navigation className="h-7 w-7 opacity-30" />
                    <p className="text-sm">No location set</p>
                  </div>
                )}
                <button onClick={requestLocation} aria-label="Use my location"
                  className="absolute top-3 right-3 h-10 w-10 rounded-full bg-zinc-50 shadow-lg flex items-center justify-center z-[400]">
                  <Navigation className="h-4 w-4" style={{ color: locationLoading ? '#9ca3af' : '#0F9D8A' }} />
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-zinc-700">Distance</span>
                  <span className="text-sm font-bold px-2.5 py-0.5 rounded-lg text-white" style={{ background: '#0F9D8A' }}>{locRadius} miles</span>
                </div>
                <input type="range" min={1} max={100} value={locRadius} onChange={e => setLocRadius(parseInt(e.target.value))}
                  className="w-full accent-[#0F9D8A]" style={{ accentColor: '#0F9D8A' }} disabled={!userLat} />
                <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5"><span>1 mi</span><span>100 mi</span></div>
              </div>

              <div className="flex gap-2">
                {locTarget === 'community' && (
                  <button onClick={() => { setMktRadius('any'); setModal('none') }}
                    className="flex-1 py-3 rounded-2xl text-sm font-medium border border-zinc-200 bg-zinc-50 text-zinc-700">
                    Search anywhere
                  </button>
                )}
                <button onClick={() => { if (locTarget === 'discover') setRadius(locRadius); else setMktRadius(locRadius); setModal('none') }} disabled={!userLat}
                  className="flex-1 py-3 rounded-2xl text-sm font-medium text-white disabled:opacity-50" style={{ background: '#0F9D8A' }}>
                  Apply
                </button>
              </div>
              {!userLat && <p className="text-xs text-zinc-400 text-center">Tap the location button above to use your current location.</p>}
            </div>
          </div>
        </div>
      )}

      {/* TRADE DETAIL */}
      {modal === 'tradedetail' && selectedTrade && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto" style={{ background: '#0A0B0C' }}>
            <div className="px-5 py-4 flex items-center justify-between gap-2 border-b border-zinc-100">
              <p className="font-semibold text-zinc-900 flex items-center gap-1.5 flex-wrap min-w-0">Trade · <button onClick={() => openUserProfile(selectedTrade.user_id)} className="hover:underline">@{selectedTrade.username}</button>{selectedTrade.distance != null ? ` · ${fmtDist(selectedTrade.distance)}` : ''} <StandingBadge standing={standingMap[selectedTrade.user_id]?.standing} verified={standingMap[selectedTrade.user_id]?.is_verified_seller} /> <RatingBadge avgRating={standingMap[selectedTrade.user_id]?.avg_rating} count={standingMap[selectedTrade.user_id]?.ratings_count} /></p>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleSaveTrade(selectedTrade.id)} aria-label="Save" className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-zinc-100">
                  <Heart className="h-4 w-4" style={savedTrades.includes(selectedTrade.id) ? { fill: '#0F9D8A', color: '#0F9D8A' } : { color: '#9ca3af' }} />
                </button>
                <button onClick={() => shareUrl(`/marketplace/trade/${selectedTrade.slug}`, `Trade: ${selectedTrade.offer}`)} aria-label="Share" className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-zinc-100">
                  <Share2 className="h-4 w-4 text-zinc-500" />
                </button>
                {user && selectedTrade.user_id && selectedTrade.user_id !== user.id && (
                  <button onClick={() => reportSeller(selectedTrade.user_id)} disabled={reportedIds.includes(selectedTrade.user_id)}
                    className="text-[11px] text-zinc-400 hover:text-red-500 transition-colors disabled:text-zinc-300 px-1">
                    {reportedIds.includes(selectedTrade.user_id) ? '✓' : '⚑'}
                  </button>
                )}
                <button onClick={closeTrade}><X className="h-5 w-5 text-zinc-400" /></button>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {selectedTrade.image_url && <img src={selectedTrade.image_url} alt="" onClick={() => setLightboxUrl(selectedTrade.image_url)} className="w-full rounded-2xl max-h-72 object-cover cursor-zoom-in" />}
              {selectedTrade.gallery?.length > 0 && (
                <div className="flex gap-2">
                  {selectedTrade.gallery.map((g: string, i: number) => (
                    <img key={i} src={g} alt="" onClick={() => setLightboxUrl(g)} className="h-16 w-16 rounded-xl object-cover cursor-zoom-in border border-zinc-200" />
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {selectedTrade.completed_with && (
                  <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-white">Traded</span>
                )}
                <div className="flex gap-2 items-start">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: '#F0FDF4', color: '#166534' }}>HAS</span>
                  <p className="text-sm font-medium text-zinc-900">{selectedTrade.offer}</p>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: '#FEF2F2', color: '#991B1B' }}>WANTS</span>
                  <p className="text-sm font-medium" style={{ color: '#0F9D8A' }}>{selectedTrade.look_for}</p>
                </div>
              </div>

              {user?.id === selectedTrade.user_id ? (
                <div className="space-y-2">
                  <button onClick={() => { if (selectedTrade.completed_with) { confirmTradeCompleted(selectedTrade, null) } else { setTradePartnerPickerOpen(true) } }}
                    className="w-full py-2.5 rounded-2xl text-xs font-medium text-white"
                    style={{ background: selectedTrade.completed_with ? '#52525b' : '#059669' }}>
                    {selectedTrade.completed_with ? 'Undo trade complete' : 'Mark as traded'}
                  </button>
                  {tradePartnerPickerOpen && (
                    <div className="rounded-2xl border border-zinc-200 p-3 space-y-1.5">
                      <p className="text-xs font-medium text-zinc-500 mb-1">Who'd you trade with? (lets you rate each other)</p>
                      {tradeMsgThreads.length === 0 && <p className="text-xs text-zinc-400 px-3 pb-1">No one has messaged you about this trade yet.</p>}
                      {tradeMsgThreads.map((t: any) => (
                        <button key={t.counterpartyId} onClick={() => confirmTradeCompleted(selectedTrade, t.counterpartyId)}
                          className="w-full text-left px-3 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-sm text-zinc-700">@{t.profile?.username || 'user'}</button>
                      ))}
                      <button onClick={() => setTradePartnerPickerOpen(false)} className="w-full text-left px-3 py-2 rounded-xl text-sm text-zinc-400">Cancel</button>
                    </div>
                  )}
                  {selectedTrade.completed_with && (
                    myTradeRating ? (
                      <p className="text-xs text-zinc-400 text-center">You rated your trade partner {myTradeRating}★. Thanks!</p>
                    ) : (
                      <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-3 flex flex-col items-center gap-2">
                        <p className="text-xs font-medium text-zinc-500">Rate your trade partner</p>
                        <StarPicker size="sm" value={tradeRatingDraft} onChange={n => { setTradeRatingDraft(n); submitRating(selectedTrade.completed_with, { tradeId: selectedTrade.id }, n) }} />
                      </div>
                    )
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => openTradeEdit(selectedTrade)}
                      className="flex-1 py-2.5 rounded-2xl text-xs font-medium text-zinc-600 border border-zinc-200">
                      Edit trade
                    </button>
                    <button onClick={async () => { await deleteTradePost(selectedTrade.id); closeTrade() }}
                      className="flex-1 py-2.5 rounded-2xl text-xs font-medium text-red-500 border border-red-100">
                      Delete this trade
                    </button>
                  </div>
                </div>
              ) : user && selectedTrade.completed_with === user.id ? (
                myTradeRating ? (
                  <p className="text-xs text-zinc-400 text-center">You rated @{selectedTrade.username} {myTradeRating}★. Thanks!</p>
                ) : (
                  <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-3 flex flex-col items-center gap-2">
                    <p className="text-xs font-medium text-zinc-500">Rate @{selectedTrade.username}</p>
                    <StarPicker size="sm" value={tradeRatingDraft} onChange={n => { setTradeRatingDraft(n); submitRating(selectedTrade.user_id, { tradeId: selectedTrade.id }, n) }} />
                  </div>
                )
              ) : null}

              <ItemMessages
                threads={tradeMsgThreads} loading={tradeMsgLoading}
                isOwner={user?.id === selectedTrade.user_id} currentUserId={user?.id} isSignedIn={isSignedIn}
                draft={itemMsgDraft} setDraft={setItemMsgDraft}
                onSend={(body: string) => sendTradeItemMessage(selectedTrade.user_id, body)}
                onOpenConversation={(id: string) => { setActiveConversationId(id); closeTrade(); goTab('messages') }}
                onSignIn={() => setModal('auth')}
              />
            </div>
          </div>
        </div>
      )}

      {/* POST A TRADE */}
      {modal === 'posttrade' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#0A0B0C' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-semibold text-lg">{editingTradeId ? 'Edit trade' : 'Post a trade'}</h3>
              <button onClick={() => { setEditingTradeId(null); setMktPhotos([]); setModal('none') }}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <form onSubmit={handleTradeSubmit} className="space-y-3">
              <PhotoSlots previews={mktPreviewUrls} onAdd={onPickPhotos} onRemove={removeMktPhoto} label="Add photos (optional)" />
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">You have</label>
                <input type="text" required value={inpOff} onChange={e => setInpOff(e.target.value)}
                  placeholder="e.g. Blastoise PSA 8" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">You want</label>
                <input type="text" required value={inpWant} onChange={e => setInpWant(e.target.value)}
                  placeholder="e.g. Venusaur PSA 7+" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
              </div>
              <button type="submit" disabled={!isSignedIn}
                className="w-full text-white font-medium py-3.5 rounded-2xl text-sm disabled:opacity-50" style={{ background: '#0F9D8A' }}>
                {!isSignedIn ? 'Sign in to post' : editingTradeId ? 'Save changes' : 'Post trade'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CLAIM */}
      {modal === 'claim' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#0A0B0C' }}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-black text-lg">Claim Your Shop</h3>
              <button onClick={closeModal}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <p className="text-xs text-zinc-400 mb-5">Verified listings get a badge, drop broadcasting, and event management</p>

            {existingClaim ? (
              <div className="text-center py-6 space-y-4">
                <div className="h-14 w-14 rounded-3xl flex items-center justify-center mx-auto"
                  style={{ background: existingClaim.status === 'approved' ? '#F0FDF4' : '#FEF3C7' }}>
                  <Check className="h-7 w-7" style={{ color: existingClaim.status === 'approved' ? '#16a34a' : '#d97706' }} />
                </div>
                <div>
                  <p className="font-black text-lg">{existingClaim.status === 'approved' ? 'Shop Claimed!' : 'Claim Pending'}</p>
                  <p className="font-bold text-sm text-zinc-600 mt-1">{existingClaim.shop_name}</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {existingClaim.status === 'approved'
                      ? 'Your shop is verified and live on Outpost.'
                      : 'Your claim is being reviewed. We will email you within 24 hours.'}
                  </p>
                </div>
                <button onClick={closeModal} className="w-full text-white font-black py-3.5 rounded-2xl text-sm uppercase"
                  style={{ background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>Close</button>
              </div>
            ) : claimCheckLoading ? (
              <div className="text-center py-8">
                <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin mx-auto" />
              </div>
            ) : null}

            {!existingClaim && !claimCheckLoading && (
            <div>
            <div className="flex items-center gap-2 mb-5">
              {[1,2,3].map(s => (
                <React.Fragment key={s}>
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={claimStep >= s ? { background: '#0F9D8A', color: 'white' } : { background: '#e5e7eb', color: '#9ca3af' }}>
                    {claimStep > s ? <Check className="h-3.5 w-3.5" /> : s}
                  </div>
                  {s < 3 && <div className="flex-1 h-0.5 rounded-full" style={{ background: claimStep > s ? '#0F9D8A' : '#e5e7eb' }} />}
                </React.Fragment>
              ))}
            </div>
            {claimStep === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-black mb-3">Step 1 — Business Info</p>
                <input type="text" value={claimName} onChange={e => setClaimName(e.target.value)} placeholder="Business name"
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
                <input type="text" value={claimAddress} onChange={e => setClaimAddress(e.target.value)} placeholder="Full address"
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
                <input type="tel" value={claimPhone} onChange={e => setClaimPhone(e.target.value)} placeholder="Phone number"
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase">Categories (select all that apply)</label>
                  <div className="flex gap-2 flex-wrap">
                    {['cards','comics','collectibles','toys'].map(cat => (
                      <button key={cat} type="button"
                        onClick={() => setClaimCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                        className="px-3 py-2 rounded-xl text-xs font-black uppercase border-2 transition-all"
                        style={claimCategories.includes(cat)
                          ? cat === 'cards' ? { background: '#E0F2FE', borderColor: '#0284C7', color: '#0284C7' }
                          : cat === 'comics' ? { background: '#FEF3C7', borderColor: '#D97706', color: '#D97706' }
                          : cat === 'toys' ? { background: '#D1FAE5', borderColor: '#059669', color: '#059669' }
                          : { background: '#EDE9FE', borderColor: '#7C3AED', color: '#7C3AED' }
                          : { background: 'white', borderColor: '#e5e7eb', color: '#9ca3af' }}>
                        {cat === 'cards' ? '🃏' : cat === 'comics' ? '📚' : cat === 'toys' ? '🧸' : '🏆'} {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <input type="text" value={claimHours} onChange={e => setClaimHours(e.target.value)} placeholder="Hours"
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
                <button onClick={() => setClaimStep(2)} disabled={!claimName || !claimAddress}
                  className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>Continue →</button>
              </div>
            )}
            {claimStep === 2 && (
              <div className="space-y-3">
                <p className="text-sm font-black mb-3">Step 2 — Verify with EIN</p>
                <div className="p-4 rounded-2xl" style={{ background: '#FEF3C7' }}>
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">Your EIN is used only to verify business ownership. Never stored or shared.</p>
                  </div>
                </div>
                <input type="text" value={einInput} onChange={e => setEinInput(e.target.value)}
                  placeholder="EIN (XX-XXXXXXX)" maxLength={10}
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-mono tracking-widest focus:outline-none" />
                <button onClick={handleClaimSubmit} disabled={einInput.length < 9}
                  className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>Verify →</button>
                <button onClick={() => setClaimStep(1)} className="w-full text-zinc-400 text-sm font-bold py-2">← Back</button>
              </div>
            )}
            {claimStep === 3 && (
              <div className="text-center space-y-4 py-4">
                <div className="h-16 w-16 rounded-3xl flex items-center justify-center mx-auto" style={{ background: '#F0FDF4' }}>
                  <Check className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <p className="font-black text-xl">Claim Submitted!</p>
                  <p className="text-sm text-zinc-400 mt-2">We'll verify your EIN within 24 hours and email you at <span className="font-bold text-zinc-600">{user?.email}</span></p>
                </div>
                <button onClick={closeModal} className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase"
                  style={{ background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>Done</button>
              </div>
            )}
            </div>
            )}
          </div>
        </div>
      )}

      {/* AUTH */}
      {modal === 'auth' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>
                  <Compass className="h-4 w-4 text-white" />
                </div>
                <span className="text-white font-black text-sm uppercase tracking-wider">Sign In</span>
              </div>
              <button onClick={closeModal} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 pb-8" style={{ background: '#0A0B0C' }}>
              {authStep === 'gate' && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { id: 'hunter', icon: User, label: 'Hunter', sub: 'Browse & collect' },
                      { id: 'merchant', icon: Store, label: 'Merchant', sub: 'Manage store' },
                    ].map(r => (
                      <button key={r.id} onClick={() => setRole(r.id as any)}
                        className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all"
                        style={role === r.id
                          ? r.id === 'merchant' ? { borderColor: '#7C3AED', background: '#7C3AED', color: 'white' }
                            : { borderColor: '#131615', background: '#131615', color: 'white' }
                          : { borderColor: '#e5e7eb', background: 'white', color: '#9ca3af' }}>
                        <r.icon className="h-6 w-6" style={{ color: role === r.id ? (r.id === 'merchant' ? 'white' : '#0F9D8A') : '#d1d5db' }} />
                        <span className="text-sm font-black uppercase">{r.label}</span>
                        <span className="text-xs opacity-50 font-mono">{r.sub}</span>
                      </button>
                    ))}
                  </div>
                  {role === 'merchant' && (
                    <div className="mb-5 p-4 rounded-2xl" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                      <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: '#7C3AED' }}>Why sign up as a Merchant</p>
                      <ul className="space-y-1.5">
                        {[
                          'Free storefront — get discovered by local collectors searching your city',
                          'Drive foot traffic with GPS check-ins and post rewards to bring hunters back',
                          'List items for sale or trade directly in the marketplace',
                          'Message buyers and traders directly, no middleman',
                          'Get featured on local event and convention pages',
                        ].map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-zinc-500">
                            <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#7C3AED' }} />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <form onSubmit={handleAuthSend} className="space-y-3">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                      className="w-full border-2 border-zinc-100 rounded-2xl px-4 py-4 text-sm font-medium outline-none focus:border-zinc-300"
                      style={{ background: '#131615' }} />
                    {authError && <p className="text-sm text-red-500">{authError}</p>}
                    <button type="submit" disabled={authLoading2}
                      className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase disabled:opacity-50"
                      style={{ background: role === 'merchant' ? '#7C3AED' : 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
                      {authLoading2 ? 'Sending...' : 'Send Access Code →'}
                    </button>
                  </form>
                  <p className="text-center text-xs text-zinc-300 font-mono mt-3">A 6-digit code will be sent to your email</p>
                </>
              )}
              {authStep === 'verify' && (
                <>
                  <button onClick={() => setAuthStep('gate')} className="text-xs font-mono font-bold text-zinc-400 mb-4 flex items-center gap-1">← Back</button>
                  <div className="mb-5">
                    <p className="font-black text-lg mb-1">Check your inbox</p>
                    <p className="text-sm text-zinc-400">Code sent to <span className="text-zinc-700 font-bold">{email}</span></p>
                  </div>
                  <form onSubmit={handleAuthVerify} className="space-y-4">
                    <div className="flex gap-2 justify-center">
                      {authCode.map((digit, i) => (
                        <input key={i} ref={codeRefs[i]} type="text" inputMode="numeric" maxLength={1} value={digit}
                          onChange={e => handleCodeInput(i, e.target.value)}
                          onKeyDown={e => handleCodeKey(i, e)}
                          className="w-11 h-13 text-center text-xl font-black border-2 rounded-2xl outline-none transition-all bg-zinc-50"
                          style={{ borderColor: digit ? '#131615' : '#e5e7eb', caretColor: 'transparent', height: '3.25rem' }} />
                      ))}
                    </div>
                    {authError && <p className="text-sm text-red-500 text-center">{authError}</p>}
                    <button type="submit" disabled={authCode.join('').length < 6 || authLoading2}
                      className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase disabled:opacity-25"
                      style={{ background: 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
                      {authLoading2 ? 'Verifying...' : 'Authorize'}
                    </button>
                    <p className="text-center text-xs text-zinc-400 font-mono">
                      Didn't get it?{' '}
                      <button type="button" onClick={() => setAuthStep('gate')} style={{ color: '#0F9D8A' }} className="underline">Resend</button>
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBSCRIPTION */}
      {modal === 'sub' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-lg md:rounded-3xl rounded-t-3xl p-5 pb-10 shadow-2xl overflow-y-auto max-h-[90vh]" style={{ background: '#0A0B0C' }}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-black text-xl">Membership</h3>
              <button onClick={() => setModal('none')}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <p className="text-sm text-zinc-400 mb-3">Unlock the full Outpost experience</p>
            <div className="mb-4 p-3 rounded-2xl flex items-center gap-2" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <span className="text-lg">🎉</span>
              <div>
                <p className="text-xs font-black text-emerald-700">Free Until 2028</p>
                <p className="text-xs text-emerald-600 mt-0.5">All plans are free until January 2028 — for everyone, no matter when you sign up. No credit card needed.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-3xl p-4 border-2 border-zinc-200 bg-zinc-50">
                <p className="font-black text-base">Hunter Base</p>
                <p className="text-2xl font-black mt-0.5 mb-3">Free</p>
                {['Browse all shops & photos','Drops & events','Post trades & listings','Contact sellers'].map(f => (
                  <div key={f} className="flex items-center gap-2 py-1"><Check className="h-3.5 w-3.5 text-zinc-400" /><p className="text-sm text-zinc-500">{f}</p></div>
                ))}
                <button onClick={() => setModal('none')} className="w-full mt-3 py-2.5 rounded-2xl text-xs font-black uppercase bg-zinc-100 text-zinc-500">Current</button>
              </div>
              <div className="rounded-3xl p-4 border-2 bg-zinc-50" style={{ borderColor: '#0F9D8A' }}>
                <p className="font-black text-base" style={{ color: '#0F9D8A' }}>Elite Pass</p>
                <p className="text-2xl font-black mt-0.5 mb-1">$1.99<span className="text-sm font-normal text-zinc-400">/mo</span></p>
                <p className="text-xs font-black text-emerald-600 mb-3">FREE during launch</p>
                {['Everything in Free','Save favorite shops','Activity notifications','Customize your profile'].map(f => (
                  <div key={f} className="flex items-center gap-2 py-1"><Check className="h-3.5 w-3.5" style={{ color: '#0F9D8A' }} /><p className="text-sm text-zinc-600">{f}</p></div>
                ))}
                <button onClick={() => handleUpgrade('elite')} disabled={checkoutLoading || profile?.tier === 'elite'}
                  className="w-full mt-3 py-2.5 rounded-2xl text-xs font-black uppercase text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>
                  {profile?.tier === 'elite' ? 'Active' : 'Get Free'}
                </button>
              </div>
              <div className="rounded-3xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
                <p className="font-black text-base text-amber-400">Verified Store</p>
                <p className="text-2xl font-black mt-0.5 mb-1">$2.99<span className="text-sm font-normal text-white/40">/mo</span></p>
                <p className="text-xs font-black text-emerald-400 mb-3">FREE during launch</p>
                {['Everything in Elite','Verified badge','Edit your shop details','Add up to 5 shop photos','Set your cover photo','Highlight a hot find','FCBD participating badge'].map(f => (
                  <div key={f} className="flex items-center gap-2 py-1"><Check className="h-3.5 w-3.5 text-amber-400" /><p className="text-sm text-white/70">{f}</p></div>
                ))}
                <button onClick={() => { openClaimModal() }} disabled={profile?.tier === 'store'}
                  className="w-full mt-3 py-2.5 rounded-2xl text-xs font-black uppercase text-black disabled:opacity-50"
                  style={{ background: '#F59E0B' }}>
                  {profile?.tier === 'store' ? 'Active' : 'Claim Free'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MENU */}
      {modal === 'menu' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center md:hidden">
          <div className="w-full max-w-md rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#0A0B0C' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-lg">Menu</h3>
              <button onClick={() => setModal('none')}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <div className="bg-zinc-50 rounded-3xl overflow-hidden border border-zinc-100">
              {[
                { label: 'Subscription', sub: 'Manage your plan', action: () => setModal('sub') },
                { label: 'Notifications', sub: 'Drops, events and alerts', action: () => setModal('notifications') },
                { label: 'Claim a Shop', sub: 'Verify with EIN', action: () => openClaimModal() },
                { label: 'Submit Shop or Event', sub: 'Suggest a listing for review', action: () => setModal('submit') },
                { label: isSignedIn ? `Sign Out (@${profile?.username})` : 'Sign In', sub: isSignedIn ? 'See you next time' : 'Access your account', action: () => { isSignedIn ? signOut() : setModal('auth') } },
                { label: 'Privacy Policy', sub: 'How we handle your data', action: () => window.open('/privacy', '_blank') },
                { label: 'Terms of Service', sub: 'Rules and guidelines', action: () => window.open('/terms', '_blank') },
              ].map((item, i) => (
                <button key={i} onClick={item.action}
                  className="w-full px-5 py-4 flex items-center justify-between border-b border-zinc-50 last:border-0 text-left">
                  <div><p className="font-black text-sm">{item.label}</p><p className="text-xs text-zinc-400 mt-0.5">{item.sub}</p></div>
                  <ChevronRight className="h-4 w-4 text-zinc-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* SUBMIT SHOP OR EVENT */}
      {modal === 'submit' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#0A0B0C' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-lg">Submit for Review</h3>
              <button onClick={() => { setModal('none'); setSubmitSent(false); setSubmitName(''); setSubmitAddress(''); setSubmitDetails('') }}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            {submitSent ? (
              <div className="text-center py-6 space-y-3">
                <div className="h-16 w-16 rounded-3xl flex items-center justify-center mx-auto" style={{ background: '#F0FDF4' }}>
                  <Check className="h-8 w-8 text-emerald-600" />
                </div>
                <p className="font-black text-xl">Submitted!</p>
                <p className="text-sm text-zinc-400">We'll review your submission and add it to Outpost within 48 hours.</p>
                <button onClick={() => { setModal('none'); setSubmitSent(false); setSubmitName(''); setSubmitAddress(''); setSubmitDetails('') }}
                  className="w-full text-white font-black py-3.5 rounded-2xl text-sm uppercase"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>Done</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {(['shop', 'event'] as const).map(t => (
                    <button key={t} onClick={() => setSubmitType(t)}
                      className="py-3 rounded-2xl text-xs font-black uppercase border-2 transition-all"
                      style={submitType === t ? { background: '#7C3AED', borderColor: '#7C3AED', color: 'white' } : { background: 'white', borderColor: '#e5e7eb', color: '#9ca3af' }}>
                      {t === 'shop' ? '🏪 New Shop' : '📅 New Event'}
                    </button>
                  ))}
                </div>
                <input type="text" value={submitName} onChange={e => setSubmitName(e.target.value)}
                  placeholder={submitType === 'shop' ? 'Shop name' : 'Event name'}
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none" />
                <input type="text" value={submitAddress} onChange={e => setSubmitAddress(e.target.value)}
                  placeholder={submitType === 'shop' ? 'Address' : 'Location / venue'}
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none" />
                <textarea value={submitDetails} onChange={e => setSubmitDetails(e.target.value)}
                  placeholder={submitType === 'shop' ? 'What do they sell? Hours? Website?' : 'Date, time, description...'}
                  rows={3}
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none resize-none" />
                <button
                  onClick={async () => {
                    if (!submitName.trim()) return
                    await supabase.from('shop_claims').insert({
                      user_id: user?.id || '00000000-0000-0000-0000-000000000000',
                      username: profile?.username || 'anonymous',
                      email: user?.email || 'anonymous',
                      shop_name: submitName,
                      shop_address: submitAddress,
                      phone: '',
                      category: submitType === 'event' ? 'event' : 'cards',
                      hours: submitDetails,
                      ein: 'SUBMISSION',
                      status: 'pending',
                    })
                    setSubmitSent(true)
                  }}
                  disabled={!submitName.trim()}
                  className="w-full text-white font-black py-3.5 rounded-2xl text-sm uppercase disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
                  Submit for Review
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {modal === 'notifications' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden" style={{ background: '#0A0B0C' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #131615, #1A1E1C)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F9D8A, #14B8A6)' }}>
                  <Bell className="h-4 w-4 text-white" />
                </div>
                <span className="text-white font-black text-sm uppercase tracking-wider">Notifications</span>
              </div>
              <button onClick={() => setModal('none')} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="divide-y divide-zinc-100 max-h-[70vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-14 text-zinc-400">
                  <Bell className="h-9 w-9 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No notifications yet.</p>
                </div>
              ) : notifications.map((n: any) => {
                const mins = Math.floor((Date.now() - new Date(n.created_at).getTime()) / 60000)
                const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`
                return (
                  <div key={n.id} className="flex items-start gap-3 px-5 py-4" style={{ background: !n.read ? 'rgba(15,157,138,0.04)' : 'white' }}>
                    <div className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg"
                      style={{ background: !n.read ? 'rgba(15,157,138,0.1)' : '#F3F4F6' }}>{n.type === 'reply' ? '💬' : n.type === 'reward' ? '🎁' : '❓'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-black text-sm">{n.title}</p>
                        {!n.read && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#0F9D8A' }} />}
                      </div>
                      {n.body && <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{n.body}</p>}
                      <p className="text-xs text-zinc-300 font-mono mt-1">{ago}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-4 border-t border-zinc-100">
              <button onClick={() => setModal('none')} className="w-full py-3 rounded-2xl text-sm font-black text-zinc-400 border-2 border-zinc-100">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}