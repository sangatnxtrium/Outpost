import React, { useState, useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Compass, MapPin, Search, Flame, X, Store, User, ArrowLeftRight, Package, ChevronRight, Calendar, Menu, Navigation, Tag, Shield, DollarSign, Plus, Check, Phone, Bell, Heart, Star, BookOpen } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useShops, useReviews, useTradePosts, useCheckins, useEvents, useListings, useFcbd, useFcbdTitles } from './hooks/useShops'
import { startCheckout } from './lib/stripe'
import { supabase } from './lib/supabase'

type TabType = 'discover' | 'map' | 'classifieds' | 'marketplace' | 'fcbd' | 'profile'
type ModalType = 'none' | 'sub' | 'auth' | 'notifications' | 'shop' | 'menu' | 'claim' | 'additem' | 'submit'

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

function streetViewUrl(s: any, size = '480x360'): string | null {
  if (s?.image_url) return s.image_url
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY
  if (key && typeof s?.lat === 'number' && typeof s?.lng === 'number') {
    return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${s.lat},${s.lng}&fov=80&source=outdoor&key=${key}`
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

function categoryIconColor(cat: string) {
  if (cat === 'comics') return '#D97706'
  if (cat === 'cards') return '#0284C7'
  return '#7C3AED'
}

function Sidebar({ tab, setTab, isSignedIn, profile, setModal }: any) {
  const items = [
    { id: 'discover', icon: Search, label: 'Discover' },
    { id: 'map', icon: Navigation, label: 'Map' },
    { id: 'marketplace', icon: Tag, label: 'Marketplace' },
    { id: 'fcbd', icon: BookOpen, label: 'FCBD' },
    { id: 'profile', icon: User, label: 'Profile' },
  ]
  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-zinc-200 bg-white h-screen sticky top-0 p-4 gap-1 flex-shrink-0">
      <div className="px-2 py-4 mb-2">
        <img src="/logo.png" alt="getOutpost.net" className="w-40 h-auto" />
        <p className="text-[11px] text-zinc-400 mt-2 px-1">Every Shop. Every Drop. Near You.</p>
      </div>
      {items.map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => setTab(id as TabType)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all font-medium text-sm"
          style={tab === id ? { background: '#E0533C', color: 'white' } : { color: '#52525b' }}>
          <Icon className="h-4 w-4 flex-shrink-0" />
          {label}
        </button>
      ))}
      <div className="mt-auto space-y-2">
        <button onClick={() => setModal('notifications')}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-bold text-zinc-500 hover:bg-zinc-50 transition-all border border-zinc-100">
          <Bell className="h-4 w-4" />
          Notifications
        </button>
        {isSignedIn ? (
          <div className="px-3 py-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
            <p className="font-black text-sm">@{profile?.username}</p>
            <p className="text-xs text-zinc-400 font-mono">{profile?.role} · {profile?.tier}</p>
          </div>
        ) : (
          <button onClick={() => setModal('auth')}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all"
            style={{ background: '#E0533C' }}>
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
  const { user, profile, loading: authLoading, sendOtp, verifyOtp, signOut } = useAuth()
  const { shops, loading: shopsLoading, updateHotFind, updateShop } = useShops()
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const selectedShop = shops.find((s: any) => s.id === selectedShopId) || null
  const { reviews, addReview } = useReviews(selectedShop?.id || '')
  const { checkinCount, userCheckedIn, checkIn } = useCheckins(selectedShop?.id || '')
  const { tradePosts, addTradePost } = useTradePosts()
  const { events: allEventsData } = useEvents()
  const { listings, uploadPhoto, createListing, deleteListing } = useListings()
  const FCBD_YEAR = 2027
  const FCBD_DATE = new Date('2027-05-01T00:00:00')
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
  const [modal, setModal] = useState<ModalType>('none')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [radius, setRadius] = useState(10)
  const [activeSection, setActiveSection] = useState<'shops' | 'events'>('shops')
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
  const [existingClaim, setExistingClaim] = useState<any>(null)
  const [claimCheckLoading, setClaimCheckLoading] = useState(false)
  const [mktTitle, setMktTitle] = useState('')
  const [mktPrice, setMktPrice] = useState('')
  const [mktDesc, setMktDesc] = useState('')
  const [mktCondition, setMktCondition] = useState('Raw')
  const [mktCategory, setMktCategory] = useState('cards')
  const [mktContact, setMktContact] = useState('')
  const [mktFile, setMktFile] = useState<File | null>(null)
  const [mktPreview, setMktPreview] = useState<string>('')
  const [mktSubmitting, setMktSubmitting] = useState(false)
  const [mktFilter, setMktFilter] = useState('all')
  const [mktSection, setMktSection] = useState<'sale' | 'trade'>('sale')
  const [selectedListing, setSelectedListing] = useState<any>(null)
  const [showContact, setShowContact] = useState(false)
  const [role, setRole] = useState<'hunter' | 'merchant'>('hunter')
  const [email, setEmail] = useState('')
  const [authStep, setAuthStep] = useState<'gate' | 'verify'>('gate')
  const [authCode, setAuthCode] = useState(['','','','','',''])
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading2, setAuthLoading2] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const codeRefs = Array.from({length: 6}, () => useRef<HTMLInputElement>(null))

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLoading(false)
      setLocationDenied(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        setLocationLoading(false)
      },
      (err) => {
        console.log('Geolocation error:', err.code, err.message)
        setLocationLoading(false)
        setLocationDenied(true)
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: false }
    )
  }, [])

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

  const filteredShops = sortedShops.filter((s: any) =>
    (filter === 'all' || s.category === filter || (s.categories && s.categories.includes(filter))) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase())))
  )

  const sortedListings = [...listings]
    .map((l: any) => ({ ...l, distance: userLat && userLng && l.lat && l.lng ? getDistance(userLat, userLng, l.lat, l.lng) : null }))
    .filter((l: any) => mktFilter === 'all' || l.category === mktFilter)
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

  function openShop(s: any) { setSelectedShopId(s.id); setModal('shop') }


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
      setSelectedShop({ ...selectedShop, ...fields })
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

  async function openClaimModal() {
    if (!user) { setModal('auth'); return }
    setClaimCheckLoading(true)
    const { data } = await supabase
      .from('shop_claims')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved'])
      .single()
    setExistingClaim(data || null)
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
      alert(`🎉 You're now on the ${tier === 'elite' ? 'Elite' : 'Verified Store'} plan — free for 6 months!`)
      setModal('none')
      window.location.reload()
    }
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
    setInpOff(''); setInpWant(''); setModal('none')
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setMktFile(f)
    setMktPreview(URL.createObjectURL(f))
  }

  async function handleListingSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mktTitle || !mktPrice || !user) return
    setMktSubmitting(true)
    let imageUrl = ''
    if (mktFile) {
      const url = await uploadPhoto(mktFile, user.id)
      if (url) imageUrl = url
    }
    const ok = await createListing({
      user_id: user.id,
      username: profile?.username || 'seller',
      title: mktTitle,
      description: mktDesc,
      price: parseFloat(mktPrice),
      category: mktCategory,
      condition: mktCondition,
      image_url: imageUrl,
      contact: mktContact,
      lat: userLat,
      lng: userLng,
      status: 'active',
    })
    setMktSubmitting(false)
    if (ok) {
      setMktTitle(''); setMktPrice(''); setMktDesc(''); setMktContact('')
      setMktFile(null); setMktPreview(''); setModal('none')
    }
  }

  if (authLoading || shopsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63)' }}>
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-3xl flex items-center justify-center mx-auto" style={{ background: 'linear-gradient(135deg, #E0533C, #ff8c69)' }}>
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
        className="relative bg-white rounded-2xl border border-zinc-200 overflow-hidden text-left cursor-pointer transition-all hover:shadow-md">
        <div className="relative">
          <ShopThumb s={s} className="w-full aspect-[4/3]" />
          <button
            onClick={(e) => { e.stopPropagation(); setSavedShops(isSaved ? savedShops.filter((id: string) => id !== s.id) : [...savedShops, s.id]) }}
            aria-label={isSaved ? 'Saved' : 'Save shop'}
            className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm">
            <Heart className="h-[18px] w-[18px] transition-colors" style={isSaved ? { color: '#E0533C', fill: '#E0533C' } : { color: '#52525b' }} />
          </button>
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
            {s.hot_find && (
              <span className="text-[11px] text-white px-2 py-1 rounded-full inline-flex items-center gap-1 shadow-sm" style={{ background: '#E0533C' }}>
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
      <div className="flex min-h-screen">
        <Sidebar tab={tab} setTab={setTab} isSignedIn={isSignedIn} profile={profile} setModal={setModal} />

        <div className="flex-1 flex flex-col min-h-screen max-w-2xl mx-auto w-full md:max-w-none">

          {/* HEADER */}
          <header className="sticky top-0 z-20 px-4 pt-10 pb-3 md:pt-3 md:pb-3 border-b border-zinc-200 bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between gap-2 md:hidden">
              <div className="min-w-0 flex-1">
                <img src="/logo.png" alt="getOutpost.net" className="h-[75px] w-auto" />
                <p className="text-[15px] mt-0.5 whitespace-nowrap text-zinc-400">Every Shop. Every Drop. Near You.</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isSignedIn && (
                  <div className="px-3 py-1.5 rounded-lg font-medium text-xs text-white" style={{ background: '#E0533C' }}>
                    @{profile?.username}
                  </div>
                )}
                <button onClick={() => setModal('menu')} aria-label="Menu" className="h-8 w-8 rounded-lg flex items-center justify-center border border-zinc-200 bg-white">
                  <Menu className="h-4 w-4 text-zinc-600" />
                </button>
              </div>
            </div>
            <div className="hidden md:flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-400" />
                <input type="text" placeholder="Search shops, cities, tags"
                  value={search} onChange={e => { setSearch(e.target.value); searchEbay(e.target.value) }}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-full pl-10 pr-4 py-2.5 text-sm outline-none focus:border-zinc-400 focus:bg-white transition-colors" />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setModal('notifications')} aria-label="Notifications" className="h-9 w-9 rounded-full flex items-center justify-center border border-zinc-200 bg-white hover:bg-zinc-50 transition-all">
                  <Bell className="h-4 w-4 text-zinc-500" />
                </button>
                <button onClick={() => setModal('sub')} className="px-4 py-2 rounded-full text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-all">Pro</button>
                <button onClick={() => isSignedIn ? signOut() : setModal('auth')} className="px-4 py-2 rounded-full text-xs font-medium text-white transition-all" style={{ background: '#E0533C' }}>
                  {isSignedIn ? `@${profile?.username}` : 'Sign in'}
                </button>
              </div>
            </div>
            {(tab === 'discover' || tab === 'map') && (
              <div className="mt-3 relative md:hidden">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
                <input type="text" placeholder="Search shops, cities, tags"
                  value={search} onChange={e => { setSearch(e.target.value); searchEbay(e.target.value) }}
                  className="w-full rounded-full pl-10 pr-4 py-3 text-sm outline-none bg-zinc-50 border border-zinc-200 focus:border-zinc-400 focus:bg-white transition-colors" />
              </div>
            )}
          </header>

          <main className="flex-1 overflow-y-auto pb-28 md:pb-8">

            {/* DISCOVER */}
            {tab === 'discover' && (
              <div className="p-4 space-y-4">
                {/* Section toggle */}
                <div className="inline-flex rounded-full border border-zinc-200 p-0.5 bg-white">
                  <button onClick={() => setActiveSection('shops')}
                    className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all"
                    style={activeSection === 'shops' ? { background: '#E0533C', color: 'white' } : { color: '#52525b' }}>
                    Shops
                  </button>
                  <button onClick={() => setActiveSection('events')}
                    className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all"
                    style={activeSection === 'events' ? { background: '#E0533C', color: 'white' } : { color: '#52525b' }}>
                    Events
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
                        style={filter === f.id ? { background: '#E0533C', borderColor: '#E0533C', color: 'white' } : { background: 'white', borderColor: '#e4e4e7', color: '#52525b' }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Radius selector + view map - only for shops */}
                {activeSection === 'shops' && userLat && (
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="text-xs text-zinc-400 flex-shrink-0">Within</span>
                    <div className="flex gap-1">
                      {[10, 25, 50, 100].map(r => (
                        <button key={r} onClick={() => setRadius(r)}
                          className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                          style={radius === r ? { background: '#27272a', color: 'white' } : { background: '#f4f4f5', color: '#71717a' }}>
                          {r}mi
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setTab('map')}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white flex-shrink-0"
                      style={{ background: '#E0533C' }}>
                      <Navigation className="h-3.5 w-3.5" /> Map
                    </button>
                  </div>
                )}
                {activeSection === 'shops' && <DropBanner shops={shops} />}
                {activeSection === 'shops' && locationLoading && (
                  <div className="text-center py-12">
                    <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-zinc-400 font-mono">Finding shops near you...</p>
                  </div>
                )}
                {activeSection === 'shops' && !locationLoading && filteredShops.length === 0 && !locationDenied && (
                  <div className="text-center py-12 text-zinc-400">
                    <MapPin className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-mono">No shops found within {radius} miles</p>
                    <p className="text-xs mt-1">Try increasing your radius</p>
                  </div>
                )}
                {activeSection === 'shops' && !locationLoading && filteredShops.length > 0 && (
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
                          className="block bg-white rounded-3xl p-4 shadow-sm border border-zinc-100 hover:shadow-md transition-all">
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
                        className="flex-1 bg-white border-2 border-zinc-100 rounded-2xl px-4 py-2.5 text-sm font-black outline-none focus:border-zinc-300">
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
                          <div key={ev.id} className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
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
                            <button onClick={() => setRsvps(rsvps.includes(ev.id) ? rsvps.filter((id: string) => id !== ev.id) : [...rsvps, ev.id])}
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
                    style={{ borderColor: '#E0533C', background: 'rgba(224,83,60,0.04)' }}>
                    <Store className="h-5 w-5 mx-auto mb-1" style={{ color: '#E0533C' }} />
                    <p className="font-black text-sm" style={{ color: '#E0533C' }}>Own a shop? Claim your listing</p>
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
              </div>
            )}

            {/* MAP */}
            {tab === 'map' && (
              <>
                {/* Desktop: list + map split */}
                <div className="hidden md:flex md:h-[calc(100vh-57px)]">
                  <div className="w-[400px] flex-shrink-0 overflow-y-auto border-r border-zinc-200 p-4 space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-900">Shops near you</h2>
                      <p className="text-xs text-zinc-400 mt-0.5">{filteredShops.length} {filteredShops.length === 1 ? 'shop' : 'shops'}{userLat ? ` · within ${radius} mi` : ''}</p>
                    </div>
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
                          style={filter === f.id ? { background: '#E0533C', borderColor: '#E0533C', color: 'white' } : { background: 'white', borderColor: '#e4e4e7', color: '#52525b' }}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                    {filteredShops.length === 0 ? (
                      <div className="text-center py-12 text-zinc-400">
                        <MapPin className="h-9 w-9 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No shops in range. Try a wider radius.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {filteredShops.map((s: any) => <ShopCard key={s.id} s={s} />)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 h-full">
                    <LocalMap shops={filteredShops} onSelect={s => openShop(s)} activeId={hoverShopId} userLat={userLat} userLng={userLng} />
                  </div>
                </div>

                {/* Mobile: map first, then list */}
                <div className="md:hidden p-4 space-y-3">
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
                        style={filter === f.id ? { background: '#E0533C', borderColor: '#E0533C', color: 'white' } : { background: 'white', borderColor: '#e4e4e7', color: '#52525b' }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-zinc-200 h-[56vh]">
                    <LocalMap shops={filteredShops} onSelect={s => openShop(s)} userLat={userLat} userLng={userLng} />
                  </div>
                  <p className="text-xs text-zinc-400 px-0.5">{filteredShops.length} {filteredShops.length === 1 ? 'shop' : 'shops'} nearby — tap a pin, or browse below</p>
                  {filteredShops.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400">
                      <MapPin className="h-9 w-9 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No shops in range. Try a wider radius.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredShops.map((s: any) => <ShopCard key={s.id} s={s} />)}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* MARKETPLACE */}
            {tab === 'marketplace' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex rounded-full border border-zinc-200 p-0.5 bg-white">
                    <button onClick={() => setMktSection('sale')}
                      className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all"
                      style={mktSection === 'sale' ? { background: '#E0533C', color: 'white' } : { color: '#52525b' }}>For Sale</button>
                    <button onClick={() => setMktSection('trade')}
                      className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all"
                      style={mktSection === 'trade' ? { background: '#E0533C', color: 'white' } : { color: '#52525b' }}>Trades</button>
                  </div>
                  <button onClick={() => isSignedIn ? setModal(mktSection === 'sale' ? 'listsale' : 'posttrade') : setModal('auth')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white flex-shrink-0"
                    style={{ background: '#E0533C' }}>
                    <Plus className="h-4 w-4" /> {mktSection === 'sale' ? 'List an item' : 'Post a trade'}
                  </button>
                </div>
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
                      style={mktFilter === f.id ? { background: '#E0533C', borderColor: '#E0533C', color: 'white' } : { background: 'white', borderColor: '#e4e4e7', color: '#52525b' }}>
                      {f.label}
                    </button>
                  ))}
                </div>

                {sortedListings.length === 0 ? (
                  <div className="text-center py-16 text-zinc-400">
                    <Tag className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No listings yet. Be the first to list something.</p>
                    <button onClick={() => isSignedIn ? setModal('listsale') : setModal('auth')}
                      className="mt-4 px-5 py-2 rounded-full text-sm font-medium text-white" style={{ background: '#E0533C' }}>
                      List an item
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {sortedListings.map((item: any) => (
                      <div key={item.id} onClick={() => { setSelectedListing(item); setShowContact(false); setModal('listingdetail') }}
                        className="bg-white rounded-2xl border border-zinc-200 overflow-hidden cursor-pointer transition-all hover:shadow-md text-left">
                        <div className="aspect-square bg-zinc-100">
                          {item.image_url
                            ? <img src={item.image_url} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-zinc-300"><Package className="h-10 w-10" /></div>}
                        </div>
                        <div className="p-3">
                          <p className="font-semibold text-zinc-900" style={{ color: '#E0533C' }}>${Number(item.price).toLocaleString()}</p>
                          <h3 className="text-[14px] text-zinc-900 leading-snug truncate mt-0.5">{item.title}</h3>
                          <div className="flex items-center gap-1.5 text-[12px] text-zinc-500 mt-1">
                            {item.condition && <span className="bg-zinc-100 px-1.5 py-0.5 rounded">{item.condition}</span>}
                            {item.distance != null && <span>· {item.distance.toFixed(1)} mi</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
              ) : (
              <>
                {tradePosts.length === 0 ? (
                  <div className="text-center py-16 text-zinc-400">
                    <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No trades posted yet. Put up what you have.</p>
                    <button onClick={() => isSignedIn ? setModal('posttrade') : setModal('auth')}
                      className="mt-4 px-5 py-2 rounded-full text-sm font-medium text-white" style={{ background: '#E0533C' }}>Post a trade</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {tradePosts.map((p: any) => (
                      <div key={p.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
                        <p className="text-xs text-zinc-400 mb-3">@{p.username}</p>
                        <div className="space-y-2">
                          <div className="flex gap-2 items-start">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: '#F0FDF4', color: '#166534' }}>HAS</span>
                            <p className="text-[13px] font-medium text-zinc-900">{p.offer}</p>
                          </div>
                          <div className="flex gap-2 items-start">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: '#FEF2F2', color: '#991B1B' }}>WANTS</span>
                            <p className="text-[13px] font-medium" style={{ color: '#E0533C' }}>{p.look_for}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
              )}
              </div>
            )}

            {/* FCBD */}
            {tab === 'fcbd' && (
              <div className="p-4 space-y-4 max-w-3xl">
                <div className="rounded-3xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                  <BookOpen className="absolute -right-4 -top-4 h-28 w-28 opacity-10" />
                  <p className="text-xs uppercase tracking-widest opacity-80">Free Comic Book Day</p>
                  <h2 className="text-2xl font-bold mt-1">FCBD {FCBD_YEAR}</h2>
                  <p className="text-sm opacity-90 mt-1">May 1, {FCBD_YEAR} · date tentative</p>
                  <div className="mt-4 inline-flex items-baseline gap-2 bg-white/20 rounded-full px-4 py-1.5">
                    <span className="text-xl font-bold">{fcbdDaysLeft}</span>
                    <span className="text-xs opacity-90">days to go</span>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-zinc-900 mb-2">Showcased comics {fcbdTitles.length > 0 && `(${fcbdTitles.length})`}</p>
                  {fcbdTitles.length === 0 ? (
                    <div className="text-center py-10 text-zinc-400 bg-white rounded-3xl border border-zinc-100">
                      <BookOpen className="h-9 w-9 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">The {FCBD_YEAR} lineup hasn't been posted yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                      {fcbdTitles.map((t: any) => (
                        <div key={t.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
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
                  <div className="bg-white rounded-2xl border border-zinc-200 p-3 flex items-center gap-2 text-sm text-zinc-500">
                    <BookOpen className="h-4 w-4 flex-shrink-0" style={{ color: '#1d4ed8' }} />
                    <span>Manage your shop's FCBD participation from your <button onClick={() => setTab('profile')} className="font-medium underline" style={{ color: '#E0533C' }}>Profile</button>.</span>
                  </div>
                )}

                <div>
                  <p className="font-semibold text-zinc-900 mb-2">Participating shops {fcbdShops.length > 0 && `(${fcbdShops.length})`}</p>
                  {fcbdShops.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400 bg-white rounded-3xl border border-zinc-100">
                      <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No shops have signed up yet.</p>
                      <p className="text-xs mt-1">Check back as May {FCBD_YEAR} approaches.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fcbdShops.map((p: any) => {
                        const s = p.shops || {}
                        const dist = userLat && userLng && s.lat && s.lng ? getDistance(userLat, userLng, s.lat, s.lng) : null
                        return (
                          <div key={p.id} onClick={() => openShop(shops.find((x: any) => x.id === p.shop_id) || s)}
                            className="bg-white rounded-2xl border border-zinc-200 overflow-hidden cursor-pointer hover:shadow-md transition-all flex">
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
                              {p.offers && <p className="text-[13px] mt-1 line-clamp-2" style={{ color: '#E0533C' }}><span className="font-medium">Offer: </span>{p.offers}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PROFILE */}
            {tab === 'profile' && (
              <div className="p-4 space-y-4 max-w-lg">
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
                    {myShop && (
                      <button onClick={() => openShop(myShop)}
                        className="w-full bg-white rounded-3xl p-4 text-left shadow-sm border border-zinc-100 mb-3 hover:shadow-md transition-all">
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
                      <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen className="h-4 w-4" style={{ color: '#1d4ed8' }} />
                          <p className="font-black text-sm">Free Comic Book Day {FCBD_YEAR}</p>
                        </div>
                        <p className="text-xs text-zinc-400 mb-3">Tell shoppers if {myShop.name} is taking part.</p>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-sm text-zinc-700">We're participating</span>
                          <button onClick={() => { setFcbdParticipating(!fcbdParticipating); setFcbdSaved(false) }}
                            className="relative w-12 h-7 rounded-full transition-colors flex-shrink-0"
                            style={{ background: fcbdParticipating ? '#E0533C' : '#d4d4d8' }}>
                            <span className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: fcbdParticipating ? '24px' : '4px' }} />
                          </button>
                        </div>
                        {fcbdParticipating && (
                          <textarea value={fcbdOffers} onChange={e => { setFcbdOffers(e.target.value); setFcbdSaved(false) }} rows={3}
                            placeholder="Your FCBD sales, discounts & in-store specials (e.g. 20% off back issues, free grab bags, raffle, creator signing)"
                            className="w-full mt-2 bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none resize-none" />
                        )}
                        <button onClick={handleFcbdSave} disabled={fcbdSaving}
                          className="w-full mt-3 py-2.5 rounded-2xl text-sm font-medium text-white disabled:opacity-60" style={{ background: '#E0533C' }}>
                          {fcbdSaving ? 'Saving…' : fcbdSaved ? 'Saved ✓' : 'Save'}
                        </button>
                      </div>
                    )}

                    <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-zinc-100">
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
                    <div className="h-20 w-20 rounded-3xl flex items-center justify-center mx-auto" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
                      <User className="h-10 w-10 text-white/40" />
                    </div>
                    <div>
                      <p className="font-black text-xl">Not signed in</p>
                      <p className="text-sm text-zinc-400 mt-2 leading-relaxed">Sign in to post trades, list items for sale, and leave reviews</p>
                    </div>
                    <button onClick={() => setModal('auth')}
                      className="text-white font-black px-10 py-4 rounded-2xl text-sm uppercase"
                      style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                      Sign In
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* MOBILE BOTTOM NAV */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-zinc-200 px-1 py-2 pb-6 flex items-center justify-around z-20"
            style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)' }}>
            {[
              { id: 'discover', icon: Search, label: 'Discover' },
              { id: 'map', icon: Navigation, label: 'Map' },
              { id: 'marketplace', icon: Tag, label: 'Market' },
              { id: 'fcbd', icon: BookOpen, label: 'FCBD' },
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
        </div>
      </div>

      {/* SHOP DETAIL */}
      {modal === 'shop' && selectedShop && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden md:inset-y-0 md:right-0 md:left-56" style={{ background: '#F0EFE9' }}>
          <div className="px-4 pt-12 md:pt-4 pb-4 flex items-center gap-3 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
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
            <ShopThumb s={selectedShop} className="h-44 w-full rounded-3xl border border-zinc-200" />
            {typeof (selectedShop as any).lat === 'number' && typeof (selectedShop as any).lng === 'number' && (
              <div className="rounded-3xl overflow-hidden border border-zinc-200">
                <LocalMap shops={[selectedShop]} onSelect={() => {}} />
              </div>
            )}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
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
                  {(selectedShop as any).website && (
                    <a href={(selectedShop as any).website.startsWith('http') ? (selectedShop as any).website : `https://${(selectedShop as any).website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-2xl text-white"
                      style={{ background: '#27272a' }}>
                      🌐 Website
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
              <div className="rounded-3xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
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
            {isMerchant && (selectedShop as any).owner_id === user?.id && (
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
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
                    style={{ background: editingInfo ? '#E0533C' : '#f3f4f6', color: editingInfo ? 'white' : '#6b7280' }}>
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
                      ? <p>🌐 <a href={(selectedShop as any).website.startsWith('http') ? (selectedShop as any).website : `https://${(selectedShop as any).website}`} target="_blank" rel="noopener noreferrer" className="underline break-all" style={{ color: '#E0533C' }}>{(selectedShop as any).website}</a></p>
                      : <p className="text-zinc-400">No website yet — tap Edit to add yours.</p>}
                    {(selectedShop as any).phone && <p>📞 {(selectedShop as any).phone}</p>}
                    {(selectedShop as any).hours && <p>🕑 {(selectedShop as any).hours}</p>}
                  </div>
                )}
              </div>
            )}

            {isMerchant && (selectedShop as any).owner_id === user?.id && (
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black uppercase text-zinc-400">Shop Categories</p>
                  <button onClick={() => { setEditingCategories(!editingCategories); setShopCategories((selectedShop as any).categories || []) }}
                    className="text-xs font-black px-3 py-1.5 rounded-xl"
                    style={{ background: editingCategories ? '#E0533C' : '#f3f4f6', color: editingCategories ? 'white' : '#6b7280' }}>
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
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black uppercase text-zinc-400">Reviews</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-mono">{checkinCount} check-ins</span>
                  <button onClick={() => isSignedIn ? checkIn(user!.id, selectedShop.id) : setModal('auth')}
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

      {/* LIST AN ITEM */}
      {modal === 'listsale' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-10 shadow-2xl max-h-[92vh] overflow-y-auto" style={{ background: '#FAF9F5' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-semibold text-lg">List an item</h3>
              <button onClick={() => setModal('none')}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <form onSubmit={handleListingSubmit} className="space-y-3">
              <label className="block">
                <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-zinc-200 bg-white flex items-center justify-center overflow-hidden cursor-pointer">
                  {mktPreview
                    ? <img src={mktPreview} alt="" className="w-full h-full object-cover" />
                    : <div className="text-center text-zinc-400"><Plus className="h-6 w-6 mx-auto mb-1" /><span className="text-xs">Add a photo</span></div>}
                </div>
                <input type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
              </label>
              <input type="text" required value={mktTitle} onChange={e => setMktTitle(e.target.value)}
                placeholder="What are you selling?" className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                <input type="number" required value={mktPrice} onChange={e => setMktPrice(e.target.value)}
                  placeholder="Price" className="w-full bg-white border border-zinc-200 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={mktCategory} onChange={e => setMktCategory(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-2xl px-3 py-3 text-sm focus:outline-none capitalize">
                  {['cards','comics','collectibles','toys'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={mktCondition} onChange={e => setMktCondition(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-2xl px-3 py-3 text-sm focus:outline-none">
                  {['Raw','Near Mint','New','Used','PSA 10','PSA 9','PSA 8','CGC 9.8','CGC 9.6','BGS 9.5','Damaged'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <textarea value={mktDesc} onChange={e => setMktDesc(e.target.value)}
                placeholder="Description — condition details, what's included…" rows={2} className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none resize-none" />
              <input type="text" value={mktContact} onChange={e => setMktContact(e.target.value)}
                placeholder="How buyers reach you (phone, email, IG…)" className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
              <button type="submit" disabled={mktSubmitting}
                className="w-full text-white font-medium py-3.5 rounded-2xl text-sm disabled:opacity-60" style={{ background: '#E0533C' }}>
                {mktSubmitting ? 'Posting…' : 'Post listing'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LISTING DETAIL */}
      {modal === 'listingdetail' && selectedListing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" onClick={() => setModal('none')}>
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto bg-white" onClick={e => e.stopPropagation()}>
            <div className="relative">
              {selectedListing.image_url
                ? <img src={selectedListing.image_url} alt={selectedListing.title} className="w-full aspect-square object-cover" />
                : <div className="w-full aspect-square bg-zinc-100 flex items-center justify-center text-zinc-300"><Package className="h-12 w-12" /></div>}
              <button onClick={() => setModal('none')} className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 flex items-center justify-center shadow"><X className="h-5 w-5 text-zinc-600" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className="text-2xl font-semibold" style={{ color: '#E0533C' }}>${Number(selectedListing.price).toLocaleString()}</p>
                <h3 className="text-lg font-semibold text-zinc-900 mt-0.5">{selectedListing.title}</h3>
                <div className="flex items-center gap-2 text-[13px] text-zinc-500 mt-1 flex-wrap">
                  {selectedListing.condition && <span className="bg-zinc-100 px-2 py-0.5 rounded-full">{selectedListing.condition}</span>}
                  {selectedListing.category && <span className="bg-zinc-100 px-2 py-0.5 rounded-full capitalize">{selectedListing.category}</span>}
                  {selectedListing.distance != null && <span>· {selectedListing.distance.toFixed(1)} mi away</span>}
                </div>
              </div>
              {selectedListing.description && <p className="text-sm text-zinc-600 whitespace-pre-wrap">{selectedListing.description}</p>}
              <p className="text-xs text-zinc-400">Listed by @{selectedListing.username}</p>
              {user?.id === selectedListing.user_id ? (
                <button onClick={() => { deleteListing(selectedListing.id); setModal('none') }}
                  className="w-full py-3 rounded-2xl text-sm font-medium border border-red-200 text-red-600">
                  Delete listing
                </button>
              ) : showContact ? (
                <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 text-center">
                  <p className="text-xs text-zinc-400 mb-1">Contact the seller</p>
                  <p className="text-sm font-medium text-zinc-900 break-words">{selectedListing.contact || 'No contact info provided.'}</p>
                </div>
              ) : (
                <button onClick={() => setShowContact(true)}
                  className="w-full py-3.5 rounded-2xl text-sm font-medium text-white flex items-center justify-center gap-2" style={{ background: '#E0533C' }}>
                  <Phone className="h-4 w-4" /> Contact seller
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POST A TRADE */}
      {modal === 'posttrade' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#FAF9F5' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-semibold text-lg">Post a trade</h3>
              <button onClick={() => setModal('none')}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <form onSubmit={handleTradeSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">You have</label>
                <input type="text" required value={inpOff} onChange={e => setInpOff(e.target.value)}
                  placeholder="e.g. Blastoise PSA 8" className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">You want</label>
                <input type="text" required value={inpWant} onChange={e => setInpWant(e.target.value)}
                  placeholder="e.g. Venusaur PSA 7+" className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none" />
              </div>
              <button type="submit" disabled={!isSignedIn}
                className="w-full text-white font-medium py-3.5 rounded-2xl text-sm disabled:opacity-50" style={{ background: '#E0533C' }}>
                {isSignedIn ? 'Post trade' : 'Sign in to post'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CLAIM */}
      {modal === 'claim' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#FAF9F5' }}>
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
                  style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>Close</button>
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
                  style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>Continue →</button>
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
                  <p className="text-sm text-zinc-400 mt-2">We'll verify your EIN within 24 hours and email you at <span className="font-bold text-zinc-600">{user?.email}</span></p>
                </div>
                <button onClick={closeModal} className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase"
                  style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>Done</button>
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
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                  <Compass className="h-4 w-4 text-white" />
                </div>
                <span className="text-white font-black text-sm uppercase tracking-wider">Sign In</span>
              </div>
              <button onClick={closeModal} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 pb-8" style={{ background: '#FAF9F5' }}>
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
                      className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase disabled:opacity-50"
                      style={{ background: role === 'merchant' ? '#7C3AED' : 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
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
                          className="w-11 h-13 text-center text-xl font-black border-2 rounded-2xl outline-none transition-all bg-white"
                          style={{ borderColor: digit ? '#1a0a2e' : '#e5e7eb', caretColor: 'transparent', height: '3.25rem' }} />
                      ))}
                    </div>
                    {authError && <p className="text-sm text-red-500 text-center">{authError}</p>}
                    <button type="submit" disabled={authCode.join('').length < 6 || authLoading2}
                      className="w-full text-white font-black py-4 rounded-2xl text-sm uppercase disabled:opacity-25"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="w-full max-w-lg md:rounded-3xl rounded-t-3xl p-5 pb-10 shadow-2xl overflow-y-auto max-h-[90vh]" style={{ background: '#FAF9F5' }}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-black text-xl">Membership</h3>
              <button onClick={() => setModal('none')}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <p className="text-sm text-zinc-400 mb-3">Unlock the full Outpost experience</p>
            <div className="mb-4 p-3 rounded-2xl flex items-center gap-2" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <span className="text-lg">🎉</span>
              <div>
                <p className="text-xs font-black text-emerald-700">Free for Your First 6 Months</p>
                <p className="text-xs text-emerald-600 mt-0.5">All plans are free for 6 months from when you signed up. No credit card needed.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-3xl p-4 border-2 border-zinc-200 bg-white">
                <p className="font-black text-base">Hunter Base</p>
                <p className="text-2xl font-black mt-0.5 mb-3">Free</p>
                {['Browse all shops & photos','Drops & events','Post trades & listings','Contact sellers'].map(f => (
                  <div key={f} className="flex items-center gap-2 py-1"><Check className="h-3.5 w-3.5 text-zinc-400" /><p className="text-sm text-zinc-500">{f}</p></div>
                ))}
                <button onClick={() => setModal('none')} className="w-full mt-3 py-2.5 rounded-2xl text-xs font-black uppercase bg-zinc-100 text-zinc-500">Current</button>
              </div>
              <div className="rounded-3xl p-4 border-2 bg-white" style={{ borderColor: '#E0533C' }}>
                <p className="font-black text-base" style={{ color: '#E0533C' }}>Elite Pass</p>
                <p className="text-2xl font-black mt-0.5 mb-1">$1.99<span className="text-sm font-normal text-zinc-400">/mo</span></p>
                <p className="text-xs font-black text-emerald-600 mb-3">FREE during launch</p>
                {['Everything in Free','eBay price lookups','Drop notifications','Price charts','Save favorite shops'].map(f => (
                  <div key={f} className="flex items-center gap-2 py-1"><Check className="h-3.5 w-3.5" style={{ color: '#E0533C' }} /><p className="text-sm text-zinc-600">{f}</p></div>
                ))}
                <button onClick={() => handleUpgrade('elite')} disabled={checkoutLoading || profile?.tier === 'elite'}
                  className="w-full mt-3 py-2.5 rounded-2xl text-xs font-black uppercase text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                  {profile?.tier === 'elite' ? 'Active' : 'Get Free'}
                </button>
              </div>
              <div className="rounded-3xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
                <p className="font-black text-base text-amber-400">Verified Store</p>
                <p className="text-2xl font-black mt-0.5 mb-1">$2.99<span className="text-sm font-normal text-white/40">/mo</span></p>
                <p className="text-xs font-black text-emerald-400 mb-3">FREE during launch</p>
                {['Everything in Elite','Verified badge','Edit your shop details','FCBD participating badge','Broadcast drops','Manage events','Analytics','Featured placement'].map(f => (
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
          <div className="w-full max-w-md rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#FAF9F5' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-lg">Menu</h3>
              <button onClick={() => setModal('none')}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            <div className="bg-white rounded-3xl overflow-hidden border border-zinc-100">
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
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#FAF9F5' }}>
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
          <div className="w-full max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden" style={{ background: '#FAF9F5' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                  <Bell className="h-4 w-4 text-white" />
                </div>
                <span className="text-white font-black text-sm uppercase tracking-wider">Notifications</span>
              </div>
              <button onClick={() => setModal('none')} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="divide-y divide-zinc-100 max-h-[70vh] overflow-y-auto">
              {[
                { icon: '🔥', title: 'New Drop Nearby', body: 'Mile High Comics just posted: Amazing Spider-Man #300 CGC 9.4', time: '2m ago', unread: true },
                { icon: '📅', title: 'Event Reminder', body: 'Regional Pokemon Box Tournament starts tomorrow', time: '1h ago', unread: true },
                { icon: '🏷️', title: 'New Marketplace Listing', body: 'Charizard Base Holo PSA 9 listed for $420', time: '3h ago', unread: false },
                { icon: '🔥', title: 'New Drop Nearby', body: 'Denver Card Shop just posted: 1986 Fleer Michael Jordan Rookie PSA 8', time: '5h ago', unread: false },
                { icon: '⭐', title: 'Welcome to Outpost', body: 'Your account is set up. Start exploring shops near you.', time: '10h ago', unread: false },
              ].map((n, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-4" style={{ background: n.unread ? 'rgba(224,83,60,0.04)' : 'white' }}>
                  <div className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ background: n.unread ? 'rgba(224,83,60,0.1)' : '#F3F4F6' }}>{n.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-sm">{n.title}</p>
                      {n.unread && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#E0533C' }} />}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-xs text-zinc-300 font-mono mt-1">{n.time}</p>
                  </div>
                </div>
              ))}
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