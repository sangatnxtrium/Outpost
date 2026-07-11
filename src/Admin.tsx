import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Shield, Store, Users, Trash2, Edit2, Check, X, RefreshCw, Search, Flame, BarChart2, MessageSquare, ArrowLeftRight, Calendar, Plus, Package } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, BarChart, Bar } from 'recharts'


class AdminErrorBoundary extends React.Component<{children: any}, {error: string}> {
  constructor(props: any) {
    super(props)
    this.state = { error: '' }
  }
  static getDerivedStateFromError(error: any) {
    return { error: error?.message || 'Unknown error' }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', background: '#1a0a2e', minHeight: '100vh', color: 'white' }}>
          <h2 style={{ color: '#E0533C', marginBottom: 12 }}>Admin Error</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, wordBreak: 'break-all' }}>{this.state.error}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '8px 16px', background: '#E0533C', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const ADMIN_EMAILS = ['sangtruong@gmail.com']

type Tab = 'dashboard' | 'shops' | 'users' | 'reviews' | 'trades' | 'events' | 'claims' | 'marketplace' | 'fcbd'

export default function Admin() {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [authStep, setAuthStep] = useState<'email' | 'code'>('email')
  const [emailInput, setEmailInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [tab, setTab] = useState<Tab>('dashboard')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const [shops, setShops] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [claims, setClaims] = useState<any[]>([])
  const [marketItems, setMarketItems] = useState<any[]>([])
  const [checkins, setCheckins] = useState(0)
  const [fcbdYear, setFcbdYear] = useState(2027)
  const [fcbdDateStr, setFcbdDateStr] = useState('2027-05-01')
  const [savingFcbd, setSavingFcbd] = useState(false)
  const [fcbdTitles, setFcbdTitles] = useState<any[]>([])
  const [fcbdParticipants, setFcbdParticipants] = useState<any[]>([])
  const [ftTitle, setFtTitle] = useState('')
  const [ftPublisher, setFtPublisher] = useState('')
  const [ftImage, setFtImage] = useState('')
  const [ftSaving, setFtSaving] = useState(false)
  const [editingEvent, setEditingEvent] = useState<any>(null)
  const [eventFields, setEventFields] = useState<any>({})
  const [addingEvent, setAddingEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: "", date: "", location: "", city: "", state: "", description: "", categories: ["cards"] })
  const [addingShop, setAddingShop] = useState(false)
  const [newShop, setNewShop] = useState({ name: "", address: "", city: "", state: "", category: "cards", lat: "", lng: "", phone: "", website: "" })

  const [editShop, setEditShop] = useState<any>(null)
  const [editFields, setEditFields] = useState<any>({})
  const [dropShop, setDropShop] = useState<any>(null)
  const [dropText, setDropText] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email && ADMIN_EMAILS.includes(session.user.email)) {
        setAuthed(true)
        setAdminEmail(session.user.email)
      }
      setChecking(false)
    })
  }, [])

  useEffect(() => {
    if (authed) fetchAll()
  }, [authed])

  async function saveFcbdSettings() {
    setSavingFcbd(true)
    const { error } = await supabase.from('app_settings').upsert([
      { key: 'fcbd_year', value: String(fcbdYear), updated_at: new Date().toISOString() },
      { key: 'fcbd_date', value: fcbdDateStr, updated_at: new Date().toISOString() },
    ])
    setSavingFcbd(false)
    if (error) { alert(error.message); return }
    fetchAll()
  }

  async function addFcbdComic() {
    if (!ftTitle.trim()) return
    setFtSaving(true)
    const { error } = await supabase.from('fcbd_titles').insert({
      year: fcbdYear,
      title: ftTitle.trim(),
      publisher: ftPublisher.trim() || null,
      image_url: ftImage.trim() || null,
    })
    setFtSaving(false)
    if (error) { alert(error.message); return }
    const ft = await supabase.from('fcbd_titles').select('*').eq('year', fcbdYear).order('created_at')
    setFcbdTitles(ft.data || [])
    setFtTitle(''); setFtPublisher(''); setFtImage('')
  }

  async function deleteFcbdComic(id: string) {
    const { error } = await supabase.from('fcbd_titles').delete().eq('id', id)
    if (error) { alert(error.message); return }
    setFcbdTitles(fcbdTitles.filter(x => x.id !== id))
  }

  async function addEvent() {
    if (!newEvent.title.trim() || !newEvent.date) { alert('Title and date are required'); return }
    const { error } = await supabase.from('events').insert({ ...newEvent })
    if (error) { alert(error.message); return }
    setAddingEvent(false)
    setNewEvent({ title: "", date: "", location: "", city: "", state: "", description: "", categories: ["cards"] })
    const e = await supabase.from('events').select('*, shops(name)').order('date')
    setEvents(e.data || [])
  }

  async function addShop() {
    if (!newShop.name.trim()) { alert('Shop name is required'); return }
    const payload: any = {
      name: newShop.name.trim(),
      address: newShop.address.trim() || null,
      city: newShop.city.trim() || null,
      state: newShop.state.trim() || null,
      category: newShop.category,
      phone: newShop.phone.trim() || null,
      website: newShop.website.trim() || null,
      lat: newShop.lat ? parseFloat(newShop.lat) : null,
      lng: newShop.lng ? parseFloat(newShop.lng) : null,
    }
    const { error } = await supabase.from('shops').insert(payload)
    if (error) { alert(error.message); return }
    setAddingShop(false)
    setNewShop({ name: "", address: "", city: "", state: "", category: "cards", lat: "", lng: "", phone: "", website: "" })
    const s = await supabase.from('shops').select('*').order('name')
    setShops(s.data || [])
  }

  async function saveEvent() {
    await supabase.from('events').update(eventFields).eq('id', editingEvent.id)
    setEvents(events.map(e => e.id === editingEvent.id ? { ...e, ...eventFields } : e))
    setEditingEvent(null)
    setEventFields({})
  }

    // Supabase caps any single .select() at 1000 rows by default. Every fetch
    // below used to hit that cap silently (e.g. Shops showed 1000 when there
    // were 5,800+) — this pages through with .range() until a page comes back
    // shorter than the page size, so admin always sees every row.
    async function fetchAllRows(queryFactory: () => any, pageSize = 1000) {
      let all: any[] = []
      let from = 0
      while (true) {
        const { data, error } = await queryFactory().range(from, from + pageSize - 1)
        if (error) { console.error('fetchAllRows error', error); break }
        all = all.concat(data || [])
        if (!data || data.length < pageSize) break
        from += pageSize
      }
      return all
    }

    async function fetchAll() {
    setLoading(true)
    try {
      const [s, u, r, t, e, c] = await Promise.all([
        fetchAllRows(() => supabase.from('shops').select('*').order('name')),
        fetchAllRows(() => supabase.from('profiles').select('*').order('created_at', { ascending: false })),
        fetchAllRows(() => supabase.from('reviews').select('*').order('created_at', { ascending: false })),
        fetchAllRows(() => supabase.from('trade_posts').select('*').order('created_at', { ascending: false })),
        fetchAllRows(() => supabase.from('events').select('*, shops(name)').order('date')),
        fetchAllRows(() => supabase.from('shop_claims').select('*').order('created_at', { ascending: false })),
      ])
      setShops(s)
      setUsers(u)
      setReviews(r)
      setTrades(t)
      setEvents(e)
      setClaims(c)
      const { count: checkinCount } = await supabase.from('checkins').select('*', { count: 'exact', head: true })
      setCheckins(checkinCount || 0)
      const stg = await supabase.from('app_settings').select('*')
      const sm: Record<string, string> = {}
      ;(stg.data || []).forEach((r: any) => { sm[r.key] = r.value })
      const yr = parseInt(sm.fcbd_year || '') || 2027
      setFcbdYear(yr)
      setFcbdDateStr(sm.fcbd_date || '2027-05-01')
      const ft = await supabase.from('fcbd_titles').select('*').eq('year', yr).order('created_at')
      setFcbdTitles(ft.data || [])
      const fp = await supabase.from('fcbd_participation').select('*, shops(name)').eq('year', yr).eq('participating', true).order('updated_at', { ascending: false })
      setFcbdParticipants(fp.data || [])
      const li = await fetchAllRows(() => supabase.from('listings').select('*').order('created_at', { ascending: false }))
      setMarketItems(li)
    } catch (err) {
      console.error('fetchAll error', err)
    }
    setLoading(false)
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!ADMIN_EMAILS.includes(emailInput)) { setAuthError('Not authorized'); return }
    setAuthLoading(true); setAuthError('')
    const { error } = await supabase.auth.signInWithOtp({ email: emailInput })
    setAuthLoading(false)
    if (error) { setAuthError(error.message); return }
    setAuthStep('code')
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true); setAuthError('')
    const { error } = await supabase.auth.verifyOtp({ email: emailInput, token: codeInput, type: 'email' })
    setAuthLoading(false)
    if (error) { setAuthError('Invalid code'); return }
    setAuthed(true)
    setAdminEmail(emailInput)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAuthed(false)
  }

  async function deleteItem(table: string, id: string, setter: any, items: any[]) {
    await supabase.from(table).delete().eq('id', id)
    setter(items.filter((i: any) => i.id !== id))
  }

  async function saveShop() {
    if (!editShop) return
    await supabase.from('shops').update(editFields).eq('id', editShop.id)
    setShops(shops.map(s => s.id === editShop.id ? { ...s, ...editFields } : s))
    setEditShop(null); setEditFields({})
  }

  async function publishDrop() {
    if (!dropShop || !dropText.trim()) return
    await supabase.from('shops').update({ hot_find: dropText }).eq('id', dropShop.id)
    setShops(shops.map(s => s.id === dropShop.id ? { ...s, hot_find: dropText } : s))
    setDropShop(null); setDropText('')
  }

  async function updateUserTier(id: string, tier: string) {
    await supabase.from('profiles').update({ tier }).eq('id', id)
    setUsers(users.map(u => u.id === id ? { ...u, tier } : u))
  }

  async function approveClaim(claim: any) {
    // Resolve the exact shop being claimed. Prefer the shop_id captured at claim
    // time; fall back to a best-effort name match for older/registration claims.
    let targetShopId = claim.shop_id || null
    if (!targetShopId && claim.shop_name) {
      const { data: matches } = await supabase
        .from('shops').select('id,owner_id').ilike('name', `%${claim.shop_name}%`).limit(1)
      if (matches && matches.length) targetShopId = matches[0].id
    }

    if (targetShopId) {
      const { data: shop } = await supabase
        .from('shops').select('owner_id').eq('id', targetShopId).maybeSingle()
      if (shop?.owner_id && shop.owner_id !== claim.user_id) {
        alert('That shop is already owned by another account. Reject this claim, or reassign ownership manually before approving.')
        return
      }
      await supabase.from('shops').update({ owner_id: claim.user_id }).eq('id', targetShopId)
    } else {
      await supabase.from('shops').insert({
        name: claim.shop_name, address: claim.shop_address, phone: claim.phone,
        category: claim.category, hours: claim.hours, owner_id: claim.user_id,
        hot_find: '', rating: 5.0, tags: [], lat: 39.7392, lng: -104.9903,
        description: `${claim.shop_name} — verified Colorado collectibles shop.`,
      })
    }

    await supabase.from('shop_claims').update({ status: 'approved' }).eq('id', claim.id)
    await supabase.from('profiles').update({ role: 'merchant', tier: 'store' }).eq('id', claim.user_id)
    setClaims(claims.map(c => c.id === claim.id ? { ...c, status: 'approved' } : c))
    fetchAll()
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return
    await supabase.from('profiles').delete().eq('id', id)
    setUsers(users.filter(u => u.id !== id))
  }

  async function banUser(id: string, banned: boolean) {
    await supabase.from('profiles').update({ banned: !banned }).eq('id', id)
    setUsers(users.map(u => u.id === id ? { ...u, banned: !banned } : u))
  }

  async function updateUserRole(id: string, role: string) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setUsers(users.map(u => u.id === id ? { ...u, role } : u))
  }

  async function rejectClaim(id: string) {
    await supabase.from('shop_claims').update({ status: 'rejected' }).eq('id', id)
    setClaims(claims.map(c => c.id === id ? { ...c, status: 'rejected' } : c))
  }

  const pendingClaims = claims.filter(c => c.status === 'pending').length
  const filteredMarket = (marketItems || []).filter((m: any) => m.title?.toLowerCase().includes(search.toLowerCase()) || m.username?.toLowerCase().includes(search.toLowerCase()))
  const eliteCount = users.filter(u => u.tier === 'elite').length
  const storeCount = users.filter(u => u.tier === 'store').length
  const mrr = ((eliteCount * 1.99) + (storeCount * 2.99)).toFixed(0)

  // Week-over-week comparison, used by the Dashboard's line chart + delta
  // stat cards. Outpost has no payment/order data (sellers arrange payment
  // themselves), so these track real signals we do have: signups, listings,
  // trades and reviews created per day.
  function weeklyCompare(items: any[], dateField = 'created_at') {
    const days: string[] = []
    const thisWeek: number[] = []
    const priorWeek: number[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - i); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
      const priorStart = new Date(dayStart); priorStart.setDate(priorStart.getDate() - 7)
      const priorEnd = new Date(priorStart); priorEnd.setDate(priorEnd.getDate() + 1)
      const countIn = (start: Date, end: Date) => items.filter((x: any) => {
        const t = x[dateField] ? new Date(x[dateField]).getTime() : NaN
        return t >= start.getTime() && t < end.getTime()
      }).length
      days.push(dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
      thisWeek.push(countIn(dayStart, dayEnd))
      priorWeek.push(countIn(priorStart, priorEnd))
    }
    const thisTotal = thisWeek.reduce((a, b) => a + b, 0)
    const priorTotal = priorWeek.reduce((a, b) => a + b, 0)
    const deltaPct = priorTotal > 0 ? Math.round(((thisTotal - priorTotal) / priorTotal) * 100) : null
    return { days, thisWeek, priorWeek, thisTotal, priorTotal, deltaPct }
  }

  const signupsWeek = weeklyCompare(users)
  const listingsWeek = weeklyCompare(marketItems)
  const tradesWeek = weeklyCompare(trades)
  const reviewsWeek = weeklyCompare(reviews)

  const signupsChartData = signupsWeek.days.map((d, i) => ({ day: d, 'This week': signupsWeek.thisWeek[i], 'Prior week': signupsWeek.priorWeek[i] }))
  const activityChartData = signupsWeek.days.map((d, i) => ({ day: d, Listings: listingsWeek.thisWeek[i], Trades: tradesWeek.thisWeek[i] }))
  const topListings = [...marketItems].filter((l: any) => l.price != null).sort((a: any, b: any) => Number(b.price) - Number(a.price)).slice(0, 5)

  const fShops = shops.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.address?.toLowerCase().includes(search.toLowerCase()))
  const fUsers = users.filter(u => u.username?.toLowerCase().includes(search.toLowerCase()))
  const fReviews = reviews.filter(r => r.comment?.toLowerCase().includes(search.toLowerCase()) || r.username?.toLowerCase().includes(search.toLowerCase()))
  const fTrades = trades.filter(t => t.offer?.toLowerCase().includes(search.toLowerCase()) || t.look_for?.toLowerCase().includes(search.toLowerCase()))
  const fEvents = events.filter(e => e.title?.toLowerCase().includes(search.toLowerCase()))
  const fClaims = claims.filter(c => c.shop_name?.toLowerCase().includes(search.toLowerCase()) || c.username?.toLowerCase().includes(search.toLowerCase()))

  const TABS = [
    { id: 'dashboard', icon: BarChart2, label: 'Dashboard' },
    { id: 'shops', icon: Store, label: `Shops (${shops.length})` },
    { id: 'users', icon: Users, label: `Users (${users.length})` },
    { id: 'reviews', icon: MessageSquare, label: `Reviews (${reviews.length})` },
    { id: 'trades', icon: ArrowLeftRight, label: `Trades (${trades.length})` },
    { id: 'events', icon: Calendar, label: `Events (${events.length})` },
    { id: 'claims', icon: Shield, label: `Claims (${pendingClaims})` },
    { id: 'marketplace', icon: Package, label: `Listings (${marketItems.length})` },
    { id: 'fcbd', icon: Calendar, label: `FCBD (${fcbdTitles.length})` },
  ]

  function catStyle(cat: string) {
    if (cat === 'comics') return { background: '#FEF3C7', color: '#92400E' }
    if (cat === 'cards') return { background: '#E0F2FE', color: '#0369A1' }
    return { background: '#EDE9FE', color: '#5B21B6' }
  }

  // Loading
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
        <div className="text-center">
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
            <Shield className="h-6 w-6 text-white animate-pulse" />
          </div>
          <p className="text-white/40 text-xs font-mono uppercase">Loading...</p>
        </div>
      </div>
    )
  }

  // Login
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-base">Outpost Admin</h1>
              <p className="text-xs text-zinc-400">Restricted access</p>
            </div>
          </div>
          {authStep === 'email' ? (
            <form onSubmit={sendCode} className="space-y-3">
              <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                placeholder="Admin email"
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none" />
              {authError && <p className="text-xs text-red-500">{authError}</p>}
              <button type="submit" disabled={authLoading}
                className="w-full text-white font-black py-3 rounded-2xl text-sm uppercase disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
                {authLoading ? 'Sending...' : 'Send Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-3">
              <p className="text-xs text-zinc-400">Code sent to <span className="font-bold text-zinc-700">{emailInput}</span></p>
              <input type="text" value={codeInput} onChange={e => setCodeInput(e.target.value)}
                placeholder="8-digit code" inputMode="numeric"
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-mono tracking-widest outline-none" />
              {authError && <p className="text-xs text-red-500">{authError}</p>}
              <button type="submit" disabled={authLoading}
                className="w-full text-white font-black py-3 rounded-2xl text-sm uppercase disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                {authLoading ? 'Verifying...' : 'Enter Admin'}
              </button>
              <button type="button" onClick={() => setAuthStep('email')} className="w-full text-zinc-400 text-xs py-2">← Back</button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // Admin panel
  return (
    <AdminErrorBoundary>
    <div className="min-h-screen font-sans" style={{ background: '#F0EFE9' }}>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-black text-sm leading-none">OUTPOST ADMIN</p>
              <p className="text-[10px] text-zinc-400 truncate max-w-[150px]">{adminEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={fetchAll} className="h-8 w-8 rounded-xl bg-zinc-100 flex items-center justify-center">
              <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <a href="/" className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-600">← App</a>
            <button onClick={signOut} className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-white"
              style={{ background: '#1a0a2e' }}>
              Out
            </button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-zinc-100 px-3 py-2 flex gap-2 overflow-x-auto sticky top-14 z-10">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id as Tab)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap flex-shrink-0 transition-all"
            style={tab === id ? { background: 'linear-gradient(135deg, #E0533C, #ff6b4a)', color: 'white' } : { background: '#f4f4f5', color: '#6b7280' }}>
            <Icon className="h-3 w-3" />{label}
          </button>
        ))}
      </div>

      <main className="p-4 space-y-4 pb-10">

        {/* Search */}
        {tab !== 'dashboard' && (
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
            <input type="text" placeholder={`Search ${tab}...`} value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none shadow-sm" />
          </div>
        )}

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-black text-xl">Dashboard</h2>
              <p className="text-xs text-zinc-400 mt-0.5">{shops.length.toLocaleString()} shops · {users.length.toLocaleString()} users · last refreshed {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
            </div>

            {/* Hero week-over-week cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'New signups (7d)', value: signupsWeek.thisTotal, deltaPct: signupsWeek.deltaPct },
                { label: 'New listings (7d)', value: listingsWeek.thisTotal, deltaPct: listingsWeek.deltaPct },
                { label: 'New trades (7d)', value: tradesWeek.thisTotal, deltaPct: tradesWeek.deltaPct },
                { label: 'New reviews (7d)', value: reviewsWeek.thisTotal, deltaPct: reviewsWeek.deltaPct },
              ].map(({ label, value, deltaPct }) => (
                <div key={label} className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">{label}</p>
                  <p className="text-3xl font-black mt-1">{value.toLocaleString()}</p>
                  {deltaPct === null ? (
                    <p className="text-xs text-zinc-400 mt-1">no prior-week data</p>
                  ) : (
                    <p className="text-xs font-bold mt-1" style={{ color: deltaPct >= 0 ? '#059669' : '#DC2626' }}>
                      {deltaPct >= 0 ? '+' : ''}{deltaPct}% vs prior 7d
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Totals row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Shops', value: shops.length, color: '#E0533C', icon: Store },
                { label: 'Check-ins', value: checkins, color: '#059669', icon: BarChart2 },
                { label: 'Est. MRR', value: `$${mrr}`, color: '#059669', icon: BarChart2 },
                { label: 'Pending Claims', value: pendingClaims, color: '#F59E0B', icon: Shield },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="bg-white rounded-2xl p-3 border border-zinc-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-zinc-400 uppercase">{label}</p>
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: color + '20' }}>
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                    </div>
                  </div>
                  <p className="text-2xl font-black">{value}</p>
                </div>
              ))}
            </div>

            {/* Daily signups line chart */}
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4">
              <p className="font-black text-sm mb-1">Daily new signups — this week vs prior week</p>
              <div className="h-64 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={signupsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f4f4f5', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="This week" stroke="#E0533C" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Prior week" stroke="#d4d4d8" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top listings table */}
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-100 font-black text-sm">Top listings by price</div>
                {topListings.length === 0 ? (
                  <p className="text-center text-zinc-400 py-8 text-sm font-mono">No listings yet</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-black uppercase text-zinc-400 border-b border-zinc-50">
                        <th className="px-4 py-2 font-black">Listing</th>
                        <th className="px-4 py-2 font-black">Price</th>
                        <th className="px-4 py-2 font-black">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topListings.map((l: any) => (
                        <tr key={l.id} className="border-b border-zinc-50 last:border-0">
                          <td className="px-4 py-2.5 truncate max-w-[160px]">{l.title}</td>
                          <td className="px-4 py-2.5 font-bold" style={{ color: '#E0533C' }}>${Number(l.price).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-zinc-400">{l.quantity || 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Listings vs trades stacked bar */}
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4">
                <p className="font-black text-sm mb-1">New listings vs new trades (7d)</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f4f4f5', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Listings" stackId="a" fill="#E0533C" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Trades" stackId="a" fill="#fca997" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 font-black text-sm">Recent Users</div>
              {users.slice(0, 5).map(u => (
                <div key={u.id} className="px-4 py-3 flex items-center justify-between border-b border-zinc-50 last:border-0">
                  <p className="font-bold text-sm">@{u.username}</p>
                  <span className="text-xs font-black px-2 py-0.5 rounded-lg"
                    style={u.tier === 'elite' ? { background: '#EDE9FE', color: '#5B21B6' }
                      : u.tier === 'store' ? { background: '#FEF3C7', color: '#92400E' }
                      : { background: '#F3F4F6', color: '#6B7280' }}>
                    {u.tier}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SHOPS */}
        {tab === 'shops' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-xl">Shops ({fShops.length})</h2>
              <button onClick={() => setAddingShop(!addingShop)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black text-white"
                style={{ background: addingShop ? '#71717a' : '#E0533C' }}>
                {addingShop ? <><X className="h-3 w-3" /> Cancel</> : <><Plus className="h-3 w-3" /> Add shop</>}
              </button>
            </div>
            {addingShop && (
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 space-y-2">
                <input value={newShop.name} onChange={e => setNewShop({ ...newShop, name: e.target.value })}
                  placeholder="Shop name" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                <input value={newShop.address} onChange={e => setNewShop({ ...newShop, address: e.target.value })}
                  placeholder="Address" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={newShop.city} onChange={e => setNewShop({ ...newShop, city: e.target.value })}
                    placeholder="City" className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <input value={newShop.state} onChange={e => setNewShop({ ...newShop, state: e.target.value })}
                    placeholder="State" className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={newShop.lat} onChange={e => setNewShop({ ...newShop, lat: e.target.value })}
                    placeholder="Latitude" className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <input value={newShop.lng} onChange={e => setNewShop({ ...newShop, lng: e.target.value })}
                    placeholder="Longitude" className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={newShop.category} onChange={e => setNewShop({ ...newShop, category: e.target.value })}
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none">
                    {['cards', 'comics', 'collectibles', 'toys'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input value={newShop.phone} onChange={e => setNewShop({ ...newShop, phone: e.target.value })}
                    placeholder="Phone" className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
                <input value={newShop.website} onChange={e => setNewShop({ ...newShop, website: e.target.value })}
                  placeholder="Website" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                <button onClick={addShop} className="w-full py-2 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1" style={{ background: '#059669' }}>
                  <Check className="h-3 w-3" /> Create shop
                </button>
              </div>
            )}
            {fShops.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4">
                {editShop?.id === s.id ? (
                  <div className="space-y-2">
                    <input value={editFields.name || ''} onChange={e => setEditFields({ ...editFields, name: e.target.value })}
                      placeholder="Name" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                    <input value={editFields.hot_find || ''} onChange={e => setEditFields({ ...editFields, hot_find: e.target.value })}
                      placeholder="Hot find" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                    <input value={editFields.hours || ''} onChange={e => setEditFields({ ...editFields, hours: e.target.value })}
                      placeholder="Hours" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                    <select value={editFields.category || ''} onChange={e => setEditFields({ ...editFields, category: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none">
                      {['cards','comics','collectibles'].map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input type="number" step="0.1" min="1" max="5" value={editFields.rating || ''} onChange={e => setEditFields({ ...editFields, rating: parseFloat(e.target.value) })}
                      placeholder="Rating" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                    <div className="flex gap-2">
                      <button onClick={saveShop} className="flex-1 py-2 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1"
                        style={{ background: '#059669' }}><Check className="h-3 w-3" /> Save</button>
                      <button onClick={() => { setEditShop(null); setEditFields({}) }} className="flex-1 py-2 rounded-xl text-xs font-black bg-zinc-100 text-zinc-600">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black px-2 py-0.5 rounded-lg uppercase" style={catStyle(s.category)}>{s.category}</span>
                          <span className="text-xs text-amber-500 font-bold">{s.rating}★</span>
                        </div>
                        <p className="font-black text-sm">{s.name}</p>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate">{s.address}</p>
                        {s.hot_find && <p className="text-xs text-zinc-400 italic mt-1 truncate">🔥 "{s.hot_find}"</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => { setDropShop(s); setDropText(s.hot_find || '') }}
                          className="text-orange-400"><Flame className="h-4 w-4" /></button>
                        <button onClick={() => { setEditShop(s); setEditFields({ name: s.name, hot_find: s.hot_find, hours: s.hours, category: s.category, rating: s.rating }) }}
                          className="text-zinc-400"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => deleteItem('shops', s.id, setShops, shops)}
                          className="text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && (
          <div className="space-y-3">
            <h2 className="font-black text-xl">Users ({fUsers.length})</h2>
            {fUsers.map(u => (
              <div key={u.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-sm">@{u.username}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                      style={u.role === 'merchant' ? { background: '#EDE9FE', color: '#5B21B6' } : { background: '#F3F4F6', color: '#6B7280' }}>
                      {u.role}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">{new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select value={u.role || 'hunter'} onChange={e => updateUserRole(u.id, e.target.value)}
                    className="text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-2 py-1.5 outline-none font-bold">
                    {['hunter','merchant'].map(r => <option key={r}>{r}</option>)}
                  </select>
                  <select value={u.tier} onChange={e => updateUserTier(u.id, e.target.value)}
                    className="text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-2 py-1.5 outline-none font-bold">
                    {['free','elite','store'].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <button onClick={() => banUser(u.id, u.banned)}
                    className="text-xs font-black px-2 py-1.5 rounded-xl transition-all"
                    style={u.banned ? { background: '#FEF2F2', color: '#991B1B' } : { background: '#F3F4F6', color: '#6B7280' }}>
                    {u.banned ? 'Banned' : 'Ban'}
                  </button>
                  <button onClick={() => deleteUser(u.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REVIEWS */}
        {tab === 'reviews' && (
          <div className="space-y-3">
            <h2 className="font-black text-xl">Reviews ({fReviews.length})</h2>
            {fReviews.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium italic">"{r.comment}"</p>
                  <p className="text-xs font-mono font-bold mt-1" style={{ color: '#E0533C' }}>@{r.username}</p>
                  <p className="text-xs text-zinc-300 font-mono mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => deleteItem('reviews', r.id, setReviews, reviews)} className="text-red-400 flex-shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TRADES */}
        {tab === 'trades' && (
          <div className="space-y-3">
            <h2 className="font-black text-xl">Trades ({fTrades.length})</h2>
            {fTrades.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-zinc-400 mb-1">@{t.username}</p>
                  <div className="flex gap-2 items-center mb-1">
                    <span className="text-xs font-black px-1.5 py-0.5 rounded-lg" style={{ background: '#F0FDF4', color: '#166534' }}>OFFER</span>
                    <p className="text-sm font-bold truncate">{t.offer}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-black px-1.5 py-0.5 rounded-lg" style={{ background: '#FEF2F2', color: '#991B1B' }}>WANT</span>
                    <p className="text-sm font-bold truncate" style={{ color: '#E0533C' }}>{t.look_for}</p>
                  </div>
                </div>
                <button onClick={() => deleteItem('trade_posts', t.id, setTrades, trades)} className="text-red-400 flex-shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* EVENTS */}
        {tab === 'events' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-xl">Events ({fEvents.length})</h2>
              <button onClick={() => setAddingEvent(!addingEvent)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black text-white"
                style={{ background: addingEvent ? '#71717a' : '#E0533C' }}>
                {addingEvent ? <><X className="h-3 w-3" /> Cancel</> : <><Plus className="h-3 w-3" /> Add event</>}
              </button>
            </div>
            {addingEvent && (
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 space-y-2">
                <input value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Title" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                <input type="date" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                <input value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Location / venue" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={newEvent.city} onChange={e => setNewEvent({ ...newEvent, city: e.target.value })}
                    placeholder="City" className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <input value={newEvent.state} onChange={e => setNewEvent({ ...newEvent, state: e.target.value })}
                    placeholder="State" className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
                <textarea value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Description" rows={2} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none resize-none" />
                <button onClick={addEvent} className="w-full py-2 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1" style={{ background: '#059669' }}>
                  <Check className="h-3 w-3" /> Create event
                </button>
              </div>
            )}
            {fEvents.map(ev => (
              <div key={ev.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm">{ev.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{ev.shops?.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded-lg font-mono font-bold">{ev.date}</span>
                      <span className="text-xs text-zinc-400">{ev.spots} spots</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => { setEditingEvent(ev); setEventFields({ title: ev.title, date: ev.date, location: ev.location, description: ev.description }) }}
                      className="text-zinc-400 hover:text-zinc-700">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteItem('events', ev.id, setEvents, events)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              {editingEvent?.id === ev.id && (
                <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
                  <input value={eventFields.title || ''} onChange={e => setEventFields({...eventFields, title: e.target.value})}
                    placeholder="Title" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <input type="date" value={eventFields.date || ''} onChange={e => setEventFields({...eventFields, date: e.target.value})}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <input value={eventFields.location || ''} onChange={e => setEventFields({...eventFields, location: e.target.value})}
                    placeholder="Location" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <textarea value={eventFields.description || ''} onChange={e => setEventFields({...eventFields, description: e.target.value})}
                    placeholder="Description" rows={2}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none resize-none" />
                  <div className="flex gap-2">
                    <button onClick={saveEvent} className="flex-1 py-2 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1"
                      style={{ background: '#059669' }}><Check className="h-3 w-3" /> Save</button>
                    <button onClick={() => { setEditingEvent(null); setEventFields({}) }}
                      className="flex-1 py-2 rounded-xl text-xs font-black bg-zinc-100 text-zinc-600">Cancel</button>
                  </div>
                </div>
              )}
              </div>
            ))}
          {fEvents.length === 0 && <p className="text-center text-zinc-400 py-8 text-sm font-mono">No events yet</p>}
          </div>
        )}

        {/* CLAIMS */}
        {tab === 'claims' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-xl">Claims ({fClaims.length})</h2>
              {pendingClaims > 0 && (
                <span className="text-xs font-black px-2 py-1 rounded-lg text-white" style={{ background: '#F59E0B' }}>
                  {pendingClaims} pending
                </span>
              )}
            </div>
            {fClaims.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-black text-sm">{c.shop_name}</p>
                      <span className="text-xs font-black px-2 py-0.5 rounded-lg"
                        style={c.status === 'approved' ? { background: '#F0FDF4', color: '#166534' }
                          : c.status === 'rejected' ? { background: '#FEF2F2', color: '#991B1B' }
                          : { background: '#FEF3C7', color: '#92400E' }}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">{c.shop_address}</p>
                    <p className="text-xs text-zinc-400 font-mono">@{c.username} · {c.email}</p>
                    <p className="text-xs text-zinc-400">{c.category} · {c.hours}</p>
                    {c.phone && <p className="text-xs text-zinc-400">{c.phone}</p>}
                    <p className="text-xs text-zinc-300 font-mono mt-1">EIN: {c.ein}</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: c.shop_id ? '#059669' : '#9ca3af' }}>
                      {c.shop_id ? '✓ Linked to an existing listing' : '○ No listing link — will match by name or create new'}
                    </p>
                  </div>
                </div>
                {c.status === 'pending' && (
                  <div className="flex gap-2 pt-3 border-t border-zinc-100">
                    <button onClick={() => approveClaim(c)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1"
                      style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button onClick={() => rejectClaim(c.id)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-black border-2 border-red-200 text-red-500 flex items-center justify-center gap-1">
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
            {fClaims.length === 0 && (
              <div className="text-center py-12 text-zinc-400">
                <Shield className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-mono">No claims yet</p>
              </div>
            )}
          </div>
        )}

      </main>

            {/* MARKETPLACE */}
          {tab === 'marketplace' && (
            <div className="space-y-3">
              <h2 className="font-black text-xl">Listings ({filteredMarket.length})</h2>
              {filteredMarket.map((item: any) => (
                <div key={item.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-zinc-400 mb-1">@{item.username}</p>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-black text-sm truncate">{item.title}</p>
                        {item.status === 'sold' && (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full bg-zinc-800 text-white flex-shrink-0">Sold</span>
                        )}
                        {item.quantity > 1 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-zinc-100 text-zinc-500 flex-shrink-0">Qty: {item.quantity}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: '#E0533C' }}>${Number(item.price).toLocaleString()}</span>
                        {item.category && <span className="text-xs font-bold px-2 py-0.5 rounded-lg capitalize" style={{ background: '#F0FDF4', color: '#166634' }}>{item.category}</span>}
                        {item.condition && <span className="text-xs text-zinc-400">{item.condition}</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteItem('listings', item.id, setMarketItems, marketItems)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredMarket.length === 0 && <p className="text-center text-zinc-400 py-8 text-sm font-mono">No listings yet</p>}
            </div>
          )}

    {/* FCBD */}
          {tab === 'fcbd' && (
            <div className="space-y-4">
              <h2 className="font-black text-xl">Free Comic Book Day {fcbdYear}</h2>

              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 space-y-2.5">
                <p className="text-sm font-black">Event date &amp; year</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-zinc-400">Year</label>
                    <input type="number" value={fcbdYear} onChange={e => setFcbdYear(parseInt(e.target.value) || 2027)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Date</label>
                    <input type="date" value={fcbdDateStr} onChange={e => setFcbdDateStr(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  </div>
                </div>
                <button onClick={saveFcbdSettings} disabled={savingFcbd}
                  className="w-full py-2.5 rounded-xl text-xs font-black uppercase text-white disabled:opacity-60" style={{ background: '#1d4ed8' }}>
                  {savingFcbd ? 'Saving…' : 'Save date & year'}
                </button>
                <p className="text-xs text-zinc-400">Changing the year switches which comics &amp; participating shops are shown, everywhere in the app.</p>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 space-y-2.5">
                <p className="text-sm font-black">Add a showcased comic</p>
                <input value={ftTitle} onChange={e => setFtTitle(e.target.value)} placeholder="Comic title"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={ftPublisher} onChange={e => setFtPublisher(e.target.value)} placeholder="Publisher"
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <input value={ftImage} onChange={e => setFtImage(e.target.value)} placeholder="Cover image URL"
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
                <button onClick={addFcbdComic} disabled={ftSaving}
                  className="w-full py-2 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1 disabled:opacity-60"
                  style={{ background: '#E0533C' }}><Plus className="h-3 w-3" /> {ftSaving ? 'Adding…' : 'Add comic'}</button>
              </div>

              <div>
                <p className="text-sm font-black mb-2">Showcased comics ({fcbdTitles.length})</p>
                {fcbdTitles.length === 0 ? (
                  <p className="text-center text-zinc-400 py-8 text-sm font-mono">No comics added yet</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {fcbdTitles.map((t: any) => (
                      <div key={t.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                        <div className="aspect-[2/3] bg-zinc-100">
                          {t.image_url ? <img src={t.image_url} alt={t.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300"><Package className="h-7 w-7" /></div>}
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-black leading-tight">{t.title}</p>
                          {t.publisher && <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{t.publisher}</p>}
                          <button onClick={() => deleteFcbdComic(t.id)} className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><Trash2 className="h-3 w-3" /> Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-black mb-2">Participating shops ({fcbdParticipants.length})</p>
                {fcbdParticipants.length === 0 ? (
                  <p className="text-center text-zinc-400 py-8 text-sm font-mono">No shops signed up yet</p>
                ) : (
                  <div className="space-y-2">
                    {fcbdParticipants.map((p: any) => (
                      <div key={p.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-3">
                        <p className="font-black text-sm">{p.shops?.name || 'Shop'}</p>
                        {p.offers && <p className="text-xs text-zinc-500 mt-0.5">{p.offers}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

    {/* DROP MODAL */}
      {dropShop && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-md rounded-t-3xl p-5 pb-10 shadow-2xl" style={{ background: '#FAF9F5' }}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-black text-lg">Publish Drop</h3>
                <p className="text-xs text-zinc-400 truncate max-w-[260px]">{dropShop.name}</p>
              </div>
              <button onClick={() => { setDropShop(null); setDropText('') }}><X className="h-5 w-5 text-zinc-400" /></button>
            </div>
            {dropShop.hot_find && (
              <div className="mb-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                <p className="text-xs font-bold text-zinc-400 mb-1 uppercase">Current</p>
                <p className="text-sm italic text-zinc-600">"{dropShop.hot_find}"</p>
              </div>
            )}
            <textarea value={dropText} onChange={e => setDropText(e.target.value)}
              placeholder="New drop text..."
              rows={3}
              className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none resize-none mb-3" />
            <button onClick={publishDrop} disabled={!dropText.trim()}
              className="w-full text-white font-black py-3.5 rounded-2xl text-sm uppercase flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
              <Flame className="h-4 w-4" /> Publish Drop
            </button>
          </div>
        </div>
      )}
    </div>
    </AdminErrorBoundary>
  )
}