import React, { useState, useEffect, useRef } from 'react'
import { Compass, MapPin, Search, Flame, X, Store, User, ArrowLeftRight, Package, ChevronRight, Calendar, Menu, Navigation, Tag, Shield, Star, DollarSign, Plus, Check, Phone } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useShops, useReviews, useTradePosts, useVault, useCheckins } from './hooks/useShops'
import { startCheckout } from './lib/stripe'

type TabType = 'discover' | 'map' | 'classifieds' | 'marketplace' | 'vault' | 'profile'
type ModalType = 'none' | 'sub' | 'auth' | 'ar' | 'shop' | 'menu' | 'claim' | 'additem'

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
    <div className="rounded-3xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: '#E0533C', transform: 'translate(30%,-30%)' }} />
      <div className="flex items-center gap-2 mb-2">
        <Flame className="h-4 w-4 text-orange-400" />
        <span className="text-xs font-black uppercase tracking-widest text-orange-400">Latest Drop</span>
        {drops.length > 1 && (
          <div className="flex gap-1 ml-auto">
            {drops.map((_: any, i: number) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: i === idx ? '#E0533C' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        )}
      </div>
      <p className="text-sm font-bold leading-snug opacity-90 transition-opacity duration-300" style={{ opacity: fade ? 1 : 0 }}>"{shop.hot_find}"</p>
      <p className="text-xs mt-1 font-mono transition-opacity duration-300" style={{ color: 'rgba(255,255,255,0.4)', opacity: fade ? 1 : 0 }}>{shop.name}</p>
    </div>
  )
}

function LocalMap({ shops, onSelect }: { shops: any[], onSelect: (s: any) => void }) {
  const latMin = 36.9, latMax = 41.1, lngMin = -109.1, lngMax = -102.0
  const W = 380, H = 320
  const toX = (lng: number) => ((lng - lngMin) / (lngMax - lngMin)) * W
  const toY = (lat: number) => (1 - (lat - latMin) / (latMax - latMin)) * H

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl" style={{ background: '#1a1f2e' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
        {[0.25, 0.5, 0.75].map(f => (
          <React.Fragment key={f}>
            <line x1={W*f} y1={0} x2={W*f} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <line x1={0} y1={H*f} x2={W} y2={H*f} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          </React.Fragment>
        ))}
        <line x1={0} y1={H*0.45} x2={W} y2={H*0.45} stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <line x1={W*0.35} y1={0} x2={W*0.35} y2={H} stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <line x1={0} y1={H*0.72} x2={W} y2={H*0.72} stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
        <line x1={W*0.65} y1={0} x2={W*0.65} y2={H} stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
        {shops.map((s: any) => {
          const x = toX(s.lng), y = toY(s.lat)
          const color = s.category === 'comics' ? '#F59E0B' : s.category === 'cards' ? '#38BDF8' : '#A78BFA'
          return (
            <g key={s.id} onClick={() => onSelect(s)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={10} fill={color} opacity={0.15} />
              <circle cx={x} cy={y} r={6} fill={color} opacity={0.9} />
              <circle cx={x} cy={y} r={2.5} fill="white" />

            </g>
          )
        })}
      </svg>
      <div className="absolute bottom-3 left-3 flex gap-3 text-xs font-bold">
        <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Comics</span>
        <span className="flex items-center gap-1 text-sky-400"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />Cards</span>
        <span className="flex items-center gap-1 text-violet-400"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />Collectibles</span>
      </div>
      <div className="absolute top-3 right-3 text-xs font-mono text-white/30 font-bold">COLORADO</div>
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

function categoryIcon(cat: string) {
  if (cat === 'comics') return '#D97706'
  if (cat === 'cards') return '#0284C7'
  return '#7C3AED'
}

export default function App() {
  const { user, profile, loading: authLoading, sendOtp, verifyOtp, signOut } = useAuth()
  const { shops, loading: shopsLoading, updateHotFind } = useShops()
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const selectedShop = shops.find((s: any) => s.id === selectedShopId) || null
  const { reviews, addReview } = useReviews(selectedShop?.id || '')
  const { checkinCount, userCheckedIn, checkIn } = useCheckins(selectedShop?.id || '')
  const { tradePosts, addTradePost } = useTradePosts()
  const { vaultItems, addVaultItem } = useVault(user?.id || null)
  const [rsvps, setRsvps] = useState<string[]>([])
  const [tab, setTab] = useState<TabType>('discover')
  const [modal, setModal] = useState<ModalType>('none')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [marketItems, setMarketItems] = useState<any[]>([
    { id: 1, user: 'SlabHunter', title: 'Charizard Base Holo PSA 9', price: 420, condition: 'PSA 9', category: 'cards', desc: 'Clean corners, no scratches. PSA cert included.' },
    { id: 2, user: 'KeyCollector', title: 'Amazing Spider-Man #129 CGC 8.0', price: 580, condition: 'CGC 8.0', category: 'comics', desc: 'First appearance of Punisher. CGC universal blue label.' },
  ])
  const [inpRev, setInpRev] = useState('')
  const [inpFind, setInpFind] = useState('')
  const [inpOff, setInpOff] = useState('')
  const [inpWant, setInpWant] = useState('')
  const [vaultName, setVaultName] = useState('')
  const [vaultDesc, setVaultDesc] = useState('')
  const [vaultCondition, setVaultCondition] = useState('Raw')
  const [vaultPrice, setVaultPrice] = useState('')
  const [ebayPrices, setEbayPrices] = useState<Record<string, string>>({})
  const [ebayResults, setEbayResults] = useState<any[]>([])
  const [ebaySearching, setEbaySearching] = useState(false)
  const [lastEbaySearch, setLastEbaySearch] = useState('')
  const [ebayLoading, setEbayLoading] = useState<string | null>(null)
  const [einInput, setEinInput] = useState('')
  const [claimName, setClaimName] = useState('')
  const [claimAddress, setClaimAddress] = useState('')
  const [claimPhone, setClaimPhone] = useState('')
  const [claimCategory, setClaimCategory] = useState('cards')
  const [claimHours, setClaimHours] = useState('')
  const [claimStep, setClaimStep] = useState(1)
  const [mktTitle, setMktTitle] = useState('')
  const [mktPrice, setMktPrice] = useState('')
  const [mktDesc, setMktDesc] = useState('')
  const [mktCondition, setMktCondition] = useState('Raw')
  const [mktCategory, setMktCategory] = useState('cards')
  const [role, setRole] = useState<'hunter' | 'merchant'>('hunter')
  const [email, setEmail] = useState('')
  const [authStep, setAuthStep] = useState<'gate' | 'verify'>('gate')
  const [authCode, setAuthCode] = useState(['','','','','','','',''])
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading2, setAuthLoading2] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const codeRefs = Array.from({length: 8}, () => useRef<HTMLInputElement>(null))

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude) },
      () => {}
    )
  }, [])

  const sortedShops = [...shops]
    .map((s: any) => ({ ...s, distance: userLat && userLng ? getDistance(userLat, userLng, s.lat, s.lng) : null }))
    .sort((a: any, b: any) => a.distance !== null && b.distance !== null ? a.distance - b.distance : 0)
    .slice(0, 5)

  const filteredShops = sortedShops.filter((s: any) =>
    (filter === 'all' || s.category === filter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase())))
  )

  const vaultTotal = vaultItems.reduce((a: number, c: any) => a + (c.est_value || 0), 0)
  const isSignedIn = !!user
  const isMerchant = profile?.role === 'merchant'

  function openShop(s: any) { setSelectedShopId(s.id); setModal('shop') }

  async function searchEbay(query: string) {
    if (query.length < 3) { setEbayResults([]); return }
    if (query === lastEbaySearch) return
    setEbaySearching(true)
    setLastEbaySearch(query)

    const appId = import.meta.env.VITE_EBAY_APP_ID

    if (appId) {
      // Real eBay API call — works once you have your App ID
      try {
        const res = await fetch(
          `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsByKeywords&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${appId}&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&keywords=${encodeURIComponent(query)}&paginationInput.entriesPerPage=5&itemFilter(0).name=ListingType&itemFilter(0).value=FixedPrice&sortOrder=BestMatch`,
          { headers: { 'Content-Type': 'application/json' } }
        )
        const data = await res.json()
        const items = data?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || []
        setEbayResults(items.map((item: any) => ({
          id: item.itemId?.[0],
          title: item.title?.[0],
          price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'),
          condition: item.condition?.[0]?.conditionDisplayName?.[0] || 'See listing',
          url: item.viewItemURL?.[0],
          image: item.galleryURL?.[0],
        })))
      } catch {
        setEbayResults(getMockEbayResults(query))
      }
    } else {
      // Mock results until App ID is set
      await new Promise(r => setTimeout(r, 800))
      setEbayResults(getMockEbayResults(query))
    }
    setEbaySearching(false)
  }

  function getMockEbayResults(query: string) {
    return [
      { id: '1', title: `${query} PSA 9`, price: Math.floor(Math.random() * 400 + 80), condition: 'Graded', url: 'https://ebay.com', image: null },
      { id: '2', title: `${query} Raw Near Mint`, price: Math.floor(Math.random() * 200 + 30), condition: 'Ungraded', url: 'https://ebay.com', image: null },
      { id: '3', title: `${query} CGC 9.8`, price: Math.floor(Math.random() * 800 + 200), condition: 'Graded', url: 'https://ebay.com', image: null },
      { id: '4', title: `${query} Lot x4`, price: Math.floor(Math.random() * 100 + 20), condition: 'Ungraded', url: 'https://ebay.com', image: null },
      { id: '5', title: `${query} 1st Edition`, price: Math.floor(Math.random() * 1200 + 400), condition: 'Graded', url: 'https://ebay.com', image: null },
    ]
  }
  async function lookupEbayPrice(itemName: string, itemId: string) {
    setEbayLoading(itemId)
    await new Promise(r => setTimeout(r, 1500))
    setEbayPrices(prev => ({ ...prev, [itemId]: `$${(Math.random() * 500 + 50).toFixed(0)} – $${(Math.random() * 1000 + 500).toFixed(0)}` }))
    setEbayLoading(null)
  }

  async function handleAuthSend(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setAuthLoading2(true); setAuthError(null)
    const { error } = await sendOtp(email, role)
    setAuthLoading2(false)
    if (error) { setAuthError(error); return }
    setAuthStep('verify')
    setAuthCode(['','','','','','','',''])
    setTimeout(() => codeRefs[0].current?.focus(), 80)
  }

  function handleCodeInput(i: number, val: string) {
    const v = val.replace(/\D/g, '').slice(0,1)
    const next = [...authCode]; next[i] = v; setAuthCode(next)
    if (v && i < 7) setTimeout(() => codeRefs[i+1].current?.focus(), 0)
  }

  function handleCodeKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !authCode[i] && i > 0) codeRefs[i-1].current?.focus()
  }

  async function handleAuthVerify(e: React.FormEvent) {
    e.preventDefault()
    const code = authCode.join('')
    if (code.length < 8) return
    setAuthLoading2(true); setAuthError(null)
    const { error } = await verifyOtp(email, code)
    setAuthLoading2(false)
    if (error) { setAuthError('Invalid code. Please try again.'); return }
    closeModal()
  }

  function closeModal() {
    setModal('none'); setAuthStep('gate')
    setAuthCode(['','','','','','','','']); setAuthError(null)
    setClaimStep(1)
  }

  async function handleUpgrade(tier: 'elite' | 'store') {
    if (!user || !profile) { setModal('auth'); return }
    setCheckoutLoading(true)
    const { error } = await startCheckout(tier, user.email || '', user.id)
    setCheckoutLoading(false)
    if (error) alert(error)
  }

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inpRev.trim() || !user || !selectedShop) return
    await addReview(selectedShop.id, user.id, profile?.username || 'Guest', inpRev, 5)
    setInpRev('')
  }

  async function handleTradeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inpOff.trim() || !inpWant.trim() || !user) return
    await addTradePost(user.id, profile?.username || 'Guest', inpOff, inpWant)
    setInpOff(''); setInpWant('')
  }

  async function handleVaultSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vaultName || !vaultPrice || !user) return
    await addVaultItem(user.id, vaultName, parseFloat(vaultPrice) || 0)
    setVaultName(''); setVaultDesc(''); setVaultPrice(''); setVaultCondition('Raw')
    setModal('none')
  }

  function handleMarketSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mktTitle || !mktPrice || !user) return
    setMarketItems(prev => [{ id: Date.now(), user: profile?.username || 'Guest', title: mktTitle, price: parseFloat(mktPrice), condition: mktCondition, category: mktCategory, desc: mktDesc }, ...prev])
    setMktTitle(''); setMktPrice(''); setMktDesc(''); setModal('none')
  }

  if (authLoading || shopsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-3xl flex items-center justify-center mx-auto shadow-2xl" style={{ background: 'linear-gradient(135deg, #E0533C, #ff8c69)' }}>
            <Compass className="h-8 w-8 text-white animate-spin" />
          </div>
          <p className="text-white/40 text-xs font-mono uppercase tracking-widest">Loading Outpost...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-[#18191B] flex flex-col font-sans max-w-md mx-auto relative" style={{ background: '#F0EFE9' }}>

      {/* HEADER */}
      <header className="sticky top-0 z-20 px-4 pt-12 pb-3" style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 100%)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
              <Compass className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white leading-none">OUTPOST</h1>
              <p className="text-xs font-mono mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>EVERY SHOP. EVERY DROP. NEAR YOU.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSignedIn && (
              <div className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                @{profile?.username}
              </div>
            )}
            <button onClick={() => setModal('menu')} className="h-9 w-9 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <Menu className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
        {(tab === 'discover' || tab === 'map') && (
          <div className="mt-3 relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <input type="text" placeholder="Search shops, tags, keys..."
              value={search} onChange={e => { setSearch(e.target.value); searchEbay(e.target.value) }}
              className="w-full rounded-2xl pl-10 pr-4 py-3 text-sm font-medium outline-none text-white placeholder:text-white/30"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }} />
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto pb-28">

        {/* DISCOVER */}
        {tab === 'discover' && (
          <div className="p-4 space-y-3">
            <div className="flex gap-2 pt-1 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All Shops', color: '#E0533C' },
                { id: 'comics', label: 'Comics', color: '#F59E0B' },
                { id: 'cards', label: 'Cards', color: '#38BDF8' },
                { id: 'collectibles', label: 'Collectibles', color: '#A78BFA' },
              ].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className="px-4 py-2 rounded-2xl text-xs font-black uppercase border-2 transition-all whitespace-nowrap flex-shrink-0"
                  style={filter === f.id ? { background: f.color, borderColor: f.color, color: 'white' } : { background: 'white', borderColor: '#e5e7eb', color: '#9ca3af' }}>
                  {f.label}
                </button>
              ))}
            </div>

            {userLat && (
              <div className="flex items-center gap-2 px-1">
                <MapPin className="h-3 w-3 text-emerald-500" />
                <p className="text-xs text-zinc-400 font-mono">Showing 5 nearest shops</p>
              </div>
            )}

            <DropBanner shops={shops} />

            {filteredShops.map((s: any) => (
              <button key={s.id} onClick={() => openShop(s)}
                className="w-full bg-white rounded-3xl p-4 text-left active:scale-[0.98] transition-all shadow-sm border border-zinc-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-black uppercase px-2.5 py-1 rounded-xl" style={categoryStyle(s.category)}>{s.category}</span>
                      <span className="text-sm text-amber-500 font-bold">{s.rating}★</span>
                      {s.distance !== null && <span className="text-xs text-zinc-400 font-mono ml-auto">{s.distance.toFixed(1)} mi</span>}
                    </div>
                    <h3 className="font-black text-base leading-tight">{s.name}</h3>
                    <p className="text-xs text-zinc-400 mt-1 font-mono">{s.address}</p>
                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                      {s.tags?.map((t: string, i: number) => (
                        <span key={i} className="text-xs bg-zinc-100 text-zinc-600 px-2 py-1 rounded-lg font-bold">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: categoryStyle(s.category).background }}>
                    <MapPin className="h-5 w-5" style={{ color: categoryIcon(s.category) }} />
                  </div>
                </div>
                {s.hot_find && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                    <p className="text-xs text-zinc-500 italic truncate">"{s.hot_find}"</p>
                  </div>
                )}
              </button>
            ))}
{/* eBay Results */}
{(ebaySearching || ebayResults.length > 0) && search.length >= 3 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-4 w-4 rounded flex items-center justify-center" style={{ background: '#E53238' }}>
                    <span className="text-white font-black" style={{ fontSize: 8 }}>e</span>
                  </div>
                  <p className="text-xs font-black uppercase text-zinc-500">eBay Listings for "{search}"</p>
                  {ebaySearching && <div className="h-3 w-3 rounded-full border-2 border-zinc-300 border-t-zinc-600 animate-spin ml-auto" />}
                </div>

                {ebayResults.map(item => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
                    className="block bg-white rounded-3xl p-4 shadow-sm border border-zinc-100 active:scale-[0.98] transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                            style={item.condition === 'Graded'
                              ? { background: '#EDE9FE', color: '#5B21B6' }
                              : { background: '#F3F4F6', color: '#6B7280' }}>
                            {item.condition}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono ml-auto">eBay</span>
                        </div>
                        <p className="font-bold text-sm leading-tight line-clamp-2">{item.title}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-black text-lg" style={{ color: '#059669' }}>${item.price}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">Buy It Now</p>
                      </div>
                    </div>
                  </a>
                ))}

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
            <button onClick={() => isSignedIn ? setModal('claim') : setModal('auth')}
              className="w-full rounded-3xl p-4 border-2 border-dashed text-center"
              style={{ borderColor: '#E0533C', background: 'rgba(224,83,60,0.04)' }}>
              <Store className="h-5 w-5 mx-auto mb-1" style={{ color: '#E0533C' }} />
              <p className="font-black text-sm" style={{ color: '#E0533C' }}>Own a shop? Claim your listing</p>
              <p className="text-xs text-zinc-400 mt-0.5">Verified with EIN · Free to claim</p>
            </button>
          </div>
        )}

        {/* MAP */}
        {tab === 'map' && (
          <div className="p-4 space-y-4">
            <div className="rounded-3xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
              <h2 className="font-black text-lg">Shop Radar</h2>
              <p className="text-xs text-white/40 mt-0.5">Denver Metro · {shops.length} locations</p>
            </div>
            <LocalMap shops={shops} onSelect={s => openShop(s)} />
            <p className="text-center text-xs text-zinc-400 font-mono">Tap a dot to open shop details</p>
            <div className="space-y-2">
              {sortedShops.map((s: any) => (
                <button key={s.id} onClick={() => openShop(s)}
                  className="w-full bg-white rounded-2xl p-3.5 flex items-center gap-3 text-left shadow-sm border border-zinc-100">
                  <div className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: categoryStyle(s.category).background }}>
                    <MapPin className="h-5 w-5" style={{ color: categoryIcon(s.category) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm">{s.name}</p>
                    <p className="text-xs text-zinc-400 font-mono truncate">{s.address}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {s.distance !== null && <p className="text-xs font-bold text-zinc-500">{s.distance.toFixed(1)} mi</p>}
                    <ChevronRight className="h-4 w-4 text-zinc-300 ml-auto mt-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CLASSIFIEDS */}
        {tab === 'classifieds' && (
          <div className="p-4 space-y-4">
            <div className="rounded-3xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
              <h2 className="font-black text-lg">Trade Board</h2>
              <p className="text-xs text-white/70 mt-0.5">Post what you have. Find what you want.</p>
            </div>
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
              <h3 className="font-black text-sm mb-3">Post a Trade</h3>
              <form onSubmit={handleTradeSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Offering</label>
                  <input type="text" required value={inpOff} onChange={e => setInpOff(e.target.value)}
                    placeholder="e.g. Blastoise PSA 8"
                    className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-zinc-300" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Seeking</label>
                  <input type="text" required value={inpWant} onChange={e => setInpWant(e.target.value)}
                    placeholder="e.g. Venusaur PSA 7+"
                    className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-zinc-300" />
                </div>
                <button type="submit" disabled={!isSignedIn}
                  className="w-full text-white font-black py-3.5 rounded-2xl text-sm uppercase tracking-wide disabled:opacity-40"
                  style={{ background: isSignedIn ? 'linear-gradient(135deg, #E0533C, #ff6b4a)' : '#ccc' }}>
                  {isSignedIn ? 'Publish Trade' : 'Sign In to Post'}
                </button>
              </form>
            </div>
            {tradePosts.map((p: any) => (
              <div key={p.id} className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
                <p className="text-xs font-mono text-zinc-400 mb-3">@{p.username}</p>
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-black px-2 py-1 rounded-lg uppercase" style={{ background: '#F0FDF4', color: '#166534' }}>OFFER</span>
                    <p className="text-sm font-bold">{p.offer}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-black px-2 py-1 rounded-lg uppercase" style={{ background: '#FEF2F2', color: '#991B1B' }}>WANT</span>
                    <p className="text-sm font-bold" style={{ color: '#E0533C' }}>{p.look_for}</p>
                  </div>
                </div>
                <button onClick={() => alert('Swap room coming soon')}
                  className="w-full mt-3 py-2.5 rounded-2xl text-sm font-black uppercase border-2 border-zinc-100 text-zinc-400">
                  Connect Swap
                </button>
              </div>
            ))}
          </div>
        )}

        {/* MARKETPLACE */}
        {tab === 'marketplace' && (
          <div className="p-4 space-y-4">
            <div className="rounded-3xl p-4 text-white flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #065F46, #047857)' }}>
              <div>
                <h2 className="font-black text-lg">Marketplace</h2>
                <p className="text-xs text-white/70 mt-0.5">Buy and sell collectibles</p>
              </div>
              <button onClick={() => isSignedIn ? setModal('additem') : setModal('auth')}
                className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Plus className="h-5 w-5 text-white" />
              </button>
            </div>
            {marketItems.map((item: any) => (
              <div key={item.id} className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-2">
                      <span className="text-xs font-black px-2 py-0.5 rounded-lg uppercase" style={categoryStyle(item.category)}>{item.category}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: '#F0FDF4', color: '#166534' }}>{item.condition}</span>
                    </div>
                    <h3 className="font-black text-base">{item.title}</h3>
                    <p className="text-xs text-zinc-400 mt-1">{item.desc}</p>
                    <p className="text-xs text-zinc-400 font-mono mt-2">@{item.user}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-xl" style={{ color: '#059669' }}>${item.price}</p>
                    <button className="mt-2 px-4 py-2 rounded-2xl text-xs font-black text-white uppercase"
                      style={{ background: 'linear-gradient(135deg, #065F46, #047857)' }}
                      onClick={() => alert('Checkout coming soon')}>
                      Buy
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VAULT */}
        {tab === 'vault' && (
          <div className="p-4 space-y-4">
            <div className="rounded-3xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10" style={{ background: '#38BDF8', transform: 'translate(30%,-30%)' }} />
              <p className="text-xs font-mono uppercase tracking-widest opacity-40">Total Estimated Value</p>
              <p className="text-4xl font-black mt-1">${vaultTotal.toLocaleString()}</p>
              <p className="text-xs opacity-40 mt-1">{vaultItems.length} items tracked</p>
            </div>
            <button onClick={() => isSignedIn ? setModal('additem') : setModal('auth')}
              className="w-full text-white font-black py-3.5 rounded-2xl text-sm uppercase tracking-wide flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
              <Plus className="h-4 w-4" /> Add Item to Vault
            </button>
            <div className="space-y-3">
              {vaultItems.map((item: any) => (
                <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-black text-sm">{item.name}</p>
                      {item.description && <p className="text-xs text-zinc-400 mt-0.5">{item.description}</p>}
                      {item.condition && <span className="text-xs font-bold px-2 py-0.5 rounded-lg mt-1 inline-block" style={{ background: '#F0FDF4', color: '#166534' }}>{item.condition}</span>}
                    </div>
                    <div className="text-right">
                      <p className="font-black text-lg" style={{ color: '#059669' }}>${item.est_value?.toLocaleString()}</p>
                      {ebayPrices[item.id] ? (
                        <p className="text-xs text-zinc-400 mt-1">eBay: {ebayPrices[item.id]}</p>
                      ) : (
                        <button onClick={() => lookupEbayPrice(item.name, item.id)}
                          disabled={ebayLoading === item.id}
                          className="text-xs font-bold mt-1 px-2 py-1 rounded-lg"
                          style={{ background: '#FEF3C7', color: '#92400E' }}>
                          {ebayLoading === item.id ? 'Checking...' : '📦 eBay Price'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {vaultItems.length === 0 && (
                <div className="text-center py-10 text-zinc-400">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-mono">Your vault is empty</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <div className="p-4 space-y-4">
            {isSignedIn ? (
              <>
                <div className="rounded-3xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                  <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full opacity-20" style={{ background: 'white', transform: 'translate(20%,20%)' }} />
                  <div className="h-14 w-14 rounded-3xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <User className="h-7 w-7 text-white" />
                  </div>
                  <p className="font-black text-xl">@{profile?.username}</p>
                  <p className="text-xs text-white/60 mt-1 font-mono uppercase">{profile?.role} · {profile?.tier} plan</p>
                </div>
                <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-zinc-100">
                  {[
                    { label: 'Subscription', sub: 'Manage your plan', action: () => setModal('sub') },
                    { label: 'AR Lens', sub: 'Scan and identify cards', action: () => setModal('ar') },
                    { label: 'Claim a Shop', sub: 'Verify with EIN', action: () => setModal('claim') },
                    { label: 'Sign Out', sub: `Signed in as @${profile?.username}`, action: () => signOut() },
                  ].map((item, i) => (
                    <button key={i} onClick={item.action}
                      className="w-full px-5 py-4 flex items-center justify-between border-b border-zinc-50 last:border-0 text-left active:bg-zinc-50">
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
                <div className="h-20 w-20 rounded-3xl flex items-center justify-center mx-auto" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
                  <User className="h-10 w-10 text-white/40" />
                </div>
                <div>
                  <p className="font-black text-xl">Not signed in</p>
                  <p className="text-sm text-zinc-400 mt-2 leading-relaxed px-8">Sign in to access your vault, post trades, and leave reviews</p>
                </div>
                <button onClick={() => setModal('auth')}
                  className="text-white font-black px-10 py-4 rounded-2xl text-sm uppercase tracking-wide"
                  style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                  Sign In
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t border-zinc-200 px-1 py-2 pb-6 flex items-center justify-around z-20"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)' }}>
        {[
          { id: 'discover', icon: Search, label: 'Discover' },
          { id: 'map', icon: Navigation, label: 'Map' },
          { id: 'classifieds', icon: ArrowLeftRight, label: 'Trades' },
          { id: 'marketplace', icon: Tag, label: 'Market' },
          { id: 'vault', icon: Package, label: 'Vault' },
          { id: 'profile', icon: User, label: 'Profile' },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id as TabType)}
            className="flex flex-col items-center gap-1 px-2 transition-all">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center transition-all"
              style={tab === id ? { background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' } : {}}>
              <Icon className="h-4 w-4" style={{ color: tab === id ? 'white' : '#9ca3af' }} />
            </div>
            <span className="text-[9px] font-bold uppercase" style={{ color: tab === id ? '#E0533C' : '#9ca3af' }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* SHOP DETAIL */}
      {modal === 'shop' && selectedShop && (
        <div className="fixed inset-0 z-30 flex flex-col overflow-hidden" style={{ background: '#F0EFE9' }}>
          <div className="px-4 pt-12 pb-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
            <button onClick={() => setModal('none')} className="h-9 w-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <X className="h-4 w-4 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-base text-white leading-tight truncate">{selectedShop.name}</h2>
              <p className="text-xs text-white/40 font-mono">{selectedShop.address}</p>
              <div className="flex items-center gap-2 mt-1">
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((selectedShop as any).address)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}
                  onClick={e => e.stopPropagation()}>
                  <Navigation className="h-3 w-3" /> Directions
                </a>
                {(selectedShop as any).phone && (
                  <a href={`tel:${(selectedShop as any).phone}`}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}
                    onClick={e => e.stopPropagation()}>
                    <Phone className="h-3 w-3" /> Call
                  </a>
                )}
              </div>
            </div>
            <span className="text-amber-400 font-bold">{selectedShop.rating}★</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Info */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
              <span className="text-xs font-black uppercase px-2.5 py-1 rounded-xl" style={categoryStyle((selectedShop as any).category)}>
                {(selectedShop as any).category}
              </span>
              <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{selectedShop.description}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                <span className="text-sm font-mono text-zinc-400">⏱ {selectedShop.hours}</span>
                <div className="flex gap-2">
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((selectedShop as any).address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-2xl text-white"
                    style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                    <Navigation className="h-3.5 w-3.5" /> Directions
                  </a>
                  {(selectedShop as any).phone && (
                    <a href={`tel:${(selectedShop as any).phone}`}
                      className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-2xl text-white"
                      style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Hot find */}
            <div className="rounded-3xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-black uppercase tracking-widest text-orange-400">Live Floor Drop</span>
              </div>
              <p className="text-sm font-bold italic leading-snug">"{selectedShop.hot_find}"</p>
              {isMerchant && (selectedShop as any).owner_id === user?.id && (
                <form onSubmit={async e => { e.preventDefault(); if (!inpFind.trim()) return; await updateHotFind(selectedShop.id, inpFind); setInpFind('') }}
                  className="mt-3 pt-3 border-t border-white/10 space-y-2">
                  <input type="text" value={inpFind} onChange={e => setInpFind(e.target.value)}
                    placeholder="Broadcast new drop..."
                    className="w-full rounded-2xl px-4 py-3 text-sm outline-none text-white placeholder:text-white/30"
                    style={{ background: 'rgba(255,255,255,0.1)' }} />
                  <button type="submit" className="w-full py-2.5 rounded-2xl text-sm font-black uppercase"
                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>Publish</button>
                </form>
              )}
            </div>

            {/* Events */}
            {(selectedShop as any).events?.length > 0 && (
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-black uppercase text-zinc-400">Events</span>
                </div>
                {(selectedShop as any).events.map((ev: any) => (
                  <div key={ev.id} className="flex items-center justify-between p-3 rounded-2xl mb-2" style={{ background: '#F8F7F2' }}>
                    <div>
                      <span className="text-xs bg-zinc-200 px-2 py-0.5 rounded-lg font-mono font-bold mr-2">{ev.date}</span>
                      <span className="text-sm font-bold">{ev.title}</span>
                    </div>
                    <button onClick={() => setRsvps(rsvps.includes(ev.id) ? rsvps.filter((id: string) => id !== ev.id) : [...rsvps, ev.id])}
                      className="text-xs font-black uppercase px-3 py-1.5 rounded-xl border-2"
                      style={rsvps.includes(ev.id) ? { background: '#F0FDF4', color: '#166534', borderColor: '#BBF7D0' } : { background: 'white', color: '#9ca3af', borderColor: '#e5e7eb' }}>
                      {rsvps.includes(ev.id) ? '✓ RSVP' : 'RSVP'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Reviews + Check In */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black uppercase text-zinc-400">Reviews</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-mono">{checkinCount} check-ins</span>
                  <button
                    onClick={() => isSignedIn ? checkIn(user!.id, selectedShop.id) : setModal('auth')}
                    disabled={userCheckedIn}
                    className="text-xs font-black px-3 py-1.5 rounded-xl text-white disabled:opacity-60 flex items-center gap-1"
                    style={{ background: userCheckedIn ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
                    {userCheckedIn ? <><Check className="h-3 w-3" /> Checked In</> : 'Check In'}
                  </button>
                </div>
              </div>
              {reviews.map((r: any) => (
                <div key={r.id} className="p-3 rounded-2xl mb-2" style={{ background: '#F8F7F2' }}>
                  <p className="text-sm font-medium">"{r.comment}"</p>
                  <p className="text-xs font-mono font-bold mt-1" style={{ color: '#E0533C' }}>@{r.username}</p>
                </div>
              ))}
              {reviews.length === 0 && <p className="text-sm text-zinc-400 italic mb-3">No reviews yet</p>}
              <form onSubmit={handleReviewSubmit} className="flex gap-2">
                <input type="text" required value={inpRev} onChange={e => setInpRev(e.target.value)}
                  placeholder={isSignedIn ? 'Leave a review...' : 'Sign in to review'}
                  disabled={!isSignedIn}
                  className="flex-1 bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none disabled:opacity-50" />
                <button type="submit" disabled={!isSignedIn}
                  className="text-white font-black px-4 py-2 rounded-2xl text-sm disabled:opacity-30"
                  style={{ background: '#1a0a2e' }}>Post</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ADD ITEM MODAL */}
      {modal === 'additem' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-md rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#FAF9F5' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-lg">{tab === 'vault' ? 'Add to Vault' : 'List for Sale'}</h3>
              <button onClick={() => setModal('none')}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <form onSubmit={tab === 'vault' ? handleVaultSubmit : handleMarketSubmit} className="space-y-3">
              <input type="text" required
                value={tab === 'vault' ? vaultName : mktTitle}
                onChange={e => tab === 'vault' ? setVaultName(e.target.value) : setMktTitle(e.target.value)}
                placeholder="Item name (e.g. Charizard Base Holo)"
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none" />
              <textarea
                value={tab === 'vault' ? vaultDesc : mktDesc}
                onChange={e => tab === 'vault' ? setVaultDesc(e.target.value) : setMktDesc(e.target.value)}
                placeholder="Description (set, print run, notes...)"
                rows={2}
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Condition</label>
                  <select
                    value={tab === 'vault' ? vaultCondition : mktCondition}
                    onChange={e => tab === 'vault' ? setVaultCondition(e.target.value) : setMktCondition(e.target.value)}
                    className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-3 py-3 text-sm font-medium focus:outline-none">
                    {['Raw','Near Mint','PSA 10','PSA 9','PSA 8','PSA 7','CGC 9.8','CGC 9.6','BGS 9.5','Damaged'].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Category</label>
                  <select
                    value={mktCategory}
                    onChange={e => setMktCategory(e.target.value)}
                    className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-3 py-3 text-sm font-medium focus:outline-none">
                    {['cards','comics','collectibles'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">
                  {tab === 'vault' ? 'Estimated Value ($)' : 'Asking Price ($)'}
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                  <input type="number" required
                    value={tab === 'vault' ? vaultPrice : mktPrice}
                    onChange={e => tab === 'vault' ? setVaultPrice(e.target.value) : setMktPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl pl-10 pr-4 py-3 text-sm font-medium focus:outline-none" />
                </div>
              </div>
              <button type="submit"
                className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase tracking-wide"
                style={{ background: tab === 'vault' ? 'linear-gradient(135deg, #1a0a2e, #302b63)' : 'linear-gradient(135deg, #065F46, #047857)' }}>
                {tab === 'vault' ? 'Lock to Vault' : 'List for Sale'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CLAIM SHOP */}
      {modal === 'claim' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-md rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#FAF9F5' }}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-black text-lg">Claim Your Shop</h3>
              <button onClick={closeModal}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <p className="text-xs text-zinc-400 mb-5">Verified listings get a badge, drop broadcasting, and event management</p>
            <div className="flex items-center gap-2 mb-5">
              {[1,2,3].map(s => (
                <React.Fragment key={s}>
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={claimStep >= s ? { background: '#E0533C', color: 'white' } : { background: '#e5e7eb', color: '#9ca3af' }}>
                    {claimStep > s ? <Check className="h-3.5 w-3.5" /> : s}
                  </div>
                  {s < 3 && <div className="flex-1 h-0.5 rounded-full" style={{ background: claimStep > s ? '#E0533C' : '#e5e7eb' }} />}
                </React.Fragment>
              ))}
            </div>
            {claimStep === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-black mb-3">Step 1 — Business Info</p>
                <input type="text" value={claimName} onChange={e => setClaimName(e.target.value)} placeholder="Business name"
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none" />
                <input type="text" value={claimAddress} onChange={e => setClaimAddress(e.target.value)} placeholder="Full address"
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none" />
                <input type="tel" value={claimPhone} onChange={e => setClaimPhone(e.target.value)} placeholder="Phone number"
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none" />
                <select value={claimCategory} onChange={e => setClaimCategory(e.target.value)}
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none">
                  {['cards','comics','collectibles'].map(c => <option key={c}>{c}</option>)}
                </select>
                <input type="text" value={claimHours} onChange={e => setClaimHours(e.target.value)} placeholder="Hours (e.g. Mon-Sat 10am-6pm)"
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none" />
                <button onClick={() => setClaimStep(2)} disabled={!claimName || !claimAddress}
                  className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>Continue →</button>
              </div>
            )}
            {claimStep === 2 && (
              <div className="space-y-3">
                <p className="text-sm font-black mb-3">Step 2 — Verify with EIN</p>
                <div className="p-4 rounded-2xl" style={{ background: '#FEF3C7' }}>
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">Your EIN is used only to verify business ownership. It is never stored or shared.</p>
                  </div>
                </div>
                <input type="text" value={einInput} onChange={e => setEinInput(e.target.value)}
                  placeholder="EIN (XX-XXXXXXX)" maxLength={10}
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none font-mono tracking-widest" />
                <p className="text-xs text-zinc-400">Format: 12-3456789</p>
                <button onClick={() => setClaimStep(3)} disabled={einInput.length < 9}
                  className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>Verify →</button>
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
                  <p className="text-sm text-zinc-400 mt-2 leading-relaxed">We'll verify your EIN and activate your listing within 24 hours. You'll get an email at <span className="font-bold text-zinc-600">{user?.email}</span></p>
                </div>
                <button onClick={closeModal}
                  className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase"
                  style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AUTH */}
      {modal === 'auth' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-md rounded-t-3xl overflow-hidden shadow-2xl" style={{ background: '#FAF9F5' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                  <Compass className="h-4 w-4 text-white" />
                </div>
                <span className="text-white font-black text-sm uppercase tracking-wider">Sign In</span>
              </div>
              <button onClick={closeModal} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 pb-8">
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
                            : { borderColor: '#1a0a2e', background: '#1a0a2e', color: 'white' }
                          : { borderColor: '#e5e7eb', background: 'white', color: '#9ca3af' }}>
                        <r.icon className="h-6 w-6" style={{ color: role === r.id ? (r.id === 'merchant' ? 'white' : '#E0533C') : '#d1d5db' }} />
                        <span className="text-sm font-black uppercase">{r.label}</span>
                        <span className="text-xs opacity-50 font-mono">{r.sub}</span>
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleAuthSend} className="space-y-3">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                      className="w-full border-2 border-zinc-100 rounded-2xl px-4 py-4 text-sm font-medium outline-none focus:border-zinc-300"
                      style={{ background: '#F8F7F2' }} />
                    {authError && <p className="text-sm text-red-500">{authError}</p>}
                    <button type="submit" disabled={authLoading2}
                      className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase tracking-wide disabled:opacity-50"
                      style={{ background: role === 'merchant' ? '#7C3AED' : 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
                      {authLoading2 ? 'Sending...' : 'Send Access Code →'}
                    </button>
                  </form>
                  <p className="text-center text-xs text-zinc-300 font-mono mt-3">An 8-digit code will be sent to your email</p>
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
                          className="w-10 h-12 text-center text-lg font-black border-2 rounded-2xl outline-none transition-all bg-white"
                          style={{ borderColor: digit ? '#1a0a2e' : '#e5e7eb', caretColor: 'transparent' }} />
                      ))}
                    </div>
                    {authError && <p className="text-sm text-red-500 text-center">{authError}</p>}
                    <button type="submit" disabled={authCode.join('').length < 8 || authLoading2}
                      className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase tracking-wide disabled:opacity-25"
                      style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
                      {authLoading2 ? 'Verifying...' : 'Authorize'}
                    </button>
                    <p className="text-center text-xs text-zinc-400 font-mono">
                      Didn't get it?{' '}
                      <button type="button" onClick={() => setAuthStep('gate')} style={{ color: '#E0533C' }} className="underline">Resend</button>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-md rounded-t-3xl p-5 pb-10 shadow-2xl overflow-y-auto max-h-[90vh]" style={{ background: '#FAF9F5' }}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-black text-xl">Membership</h3>
              <button onClick={() => setModal('none')}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <p className="text-sm text-zinc-400 mb-5">Unlock the full Outpost experience</p>
            <div className="rounded-3xl p-4 mb-3 border-2 border-zinc-200 bg-white">
              <div className="flex justify-between items-start mb-3">
                <div><p className="font-black text-base">Hunter Base</p><p className="text-2xl font-black mt-0.5">Free</p></div>
                <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-500">Current</span>
              </div>
              {['Browse all shops','View drops & events','Post trades','3 vault items'].map(f => (
                <div key={f} className="flex items-center gap-2 py-1">
                  <Check className="h-3.5 w-3.5 text-zinc-400" /><p className="text-sm text-zinc-500">{f}</p>
                </div>
              ))}
            </div>
            <div className="rounded-3xl p-4 mb-3 border-2 bg-white" style={{ borderColor: '#E0533C' }}>
              <div className="flex justify-between items-start mb-3">
                <div><p className="font-black text-base" style={{ color: '#E0533C' }}>Elite Pass</p><p className="text-2xl font-black mt-0.5">$1.99<span className="text-sm font-normal text-zinc-400">/mo</span></p></div>
                <button onClick={() => handleUpgrade('elite')} disabled={checkoutLoading || profile?.tier === 'elite'}
                  className="text-xs font-black px-3 py-1.5 rounded-xl text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                  {profile?.tier === 'elite' ? 'Active' : 'Upgrade'}
                </button>
              </div>
              {['Everything in Free','Unlimited vault items','eBay price lookups','Drop alerts & notifications','AR card scanner','Price history charts','Priority shop listings'].map(f => (
                <div key={f} className="flex items-center gap-2 py-1">
                  <Check className="h-3.5 w-3.5" style={{ color: '#E0533C' }} /><p className="text-sm text-zinc-600">{f}</p>
                </div>
              ))}
            </div>
            <div className="rounded-3xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
              <div className="flex justify-between items-start mb-3">
                <div><p className="font-black text-base text-amber-400">Verified Store</p><p className="text-2xl font-black mt-0.5">$2.99<span className="text-sm font-normal text-white/40">/mo</span></p></div>
                <button onClick={() => handleUpgrade('store')} disabled={checkoutLoading || profile?.tier === 'store'}
                  className="text-xs font-black px-3 py-1.5 rounded-xl text-black disabled:opacity-50"
                  style={{ background: '#F59E0B' }}>
                  {profile?.tier === 'store' ? 'Active' : 'Claim'}
                </button>
              </div>
              {['Everything in Elite','Verified badge on listing','Broadcast live drops','Manage events & RSVPs','Analytics dashboard','Featured placement','Direct customer messaging'].map(f => (
                <div key={f} className="flex items-center gap-2 py-1">
                  <Check className="h-3.5 w-3.5 text-amber-400" /><p className="text-sm text-white/70">{f}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MENU */}
      {modal === 'menu' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-md rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#FAF9F5' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-lg">Menu</h3>
              <button onClick={() => setModal('none')}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <div className="bg-white rounded-3xl overflow-hidden border border-zinc-100">
              {[
                { label: 'Subscription', sub: 'Manage your plan', action: () => setModal('sub') },
                { label: 'AR Lens', sub: 'Scan and identify cards', action: () => setModal('ar') },
                { label: 'Claim a Shop', sub: 'Verify with EIN', action: () => setModal('claim') },
                { label: isSignedIn ? `Sign Out (@${profile?.username})` : 'Sign In', sub: isSignedIn ? 'See you next time' : 'Access your account', action: () => { isSignedIn ? signOut() : setModal('auth') } },
              ].map((item, i) => (
                <button key={i} onClick={item.action}
                  className="w-full px-5 py-4 flex items-center justify-between border-b border-zinc-50 last:border-0 text-left active:bg-zinc-50">
                  <div><p className="font-black text-sm">{item.label}</p><p className="text-xs text-zinc-400 mt-0.5">{item.sub}</p></div>
                  <ChevronRight className="h-4 w-4 text-zinc-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AR */}
      {modal === 'ar' && (
        <div className="fixed inset-0 z-50 flex flex-col text-white font-mono" style={{ background: '#0a0a0f' }}>
          <div className="flex justify-between items-center border-b border-white/10 px-4 pt-12 pb-4">
            <h3 className="text-emerald-400 font-bold text-base">AR Lens</h3>
            <button onClick={() => setModal('none')}><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 relative flex items-center justify-center p-8"
            style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,0.04) 2px,transparent 2px),linear-gradient(90deg,rgba(16,185,129,0.04) 2px,transparent 2px)', backgroundSize: '30px 30px' }}>
            <div className="p-5 rounded-3xl text-left w-full max-w-xs" style={{ background: '#111827', border: '1px solid #F59E0B' }}>
              <span className="text-xs text-amber-400 font-black uppercase tracking-widest">★ Wishlist Match</span>
              <h4 className="text-base font-black uppercase mt-2">Charizard Base Holo (1st Ed)</h4>
              <p className="text-emerald-400 font-black text-xl mt-2">$2,850.00</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}