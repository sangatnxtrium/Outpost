import React, { useState, useEffect, useRef } from 'react'
import { Compass, MapPin, Search, Flame, X, Store, User, ArrowLeftRight, Package, Bell, ChevronRight, Star, Calendar, Menu } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useShops, useReviews, useTradePosts, useVault } from './hooks/useShops'
import { startCheckout } from './lib/stripe'

type TabType = 'discover' | 'classifieds' | 'vault' | 'profile'
type ModalType = 'none' | 'sub' | 'auth' | 'ar' | 'shop' | 'menu'

export default function App() {
  const { user, profile, loading: authLoading, sendOtp, verifyOtp, signOut } = useAuth()
  const { shops, loading: shopsLoading, updateHotFind } = useShops()
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const selectedShop = shops.find(s => s.id === selectedShopId) || null
  const { reviews, addReview } = useReviews(selectedShop?.id || '')
  const { tradePosts, addTradePost } = useTradePosts()
  const { vaultItems, addVaultItem } = useVault(user?.id || null)
  const [rsvps, setRsvps] = useState<string[]>([])
  const [tab, setTab] = useState<TabType>('discover')
  const [modal, setModal] = useState<ModalType>('none')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [inpName, setInpName] = useState('')
  const [inpVal, setInpVal] = useState('')
  const [inpRev, setInpRev] = useState('')
  const [inpFind, setInpFind] = useState('')
  const [inpOff, setInpOff] = useState('')
  const [inpWant, setInpWant] = useState('')
  const [role, setRole] = useState<'hunter' | 'merchant'>('hunter')
  const [email, setEmail] = useState('')
  const [authStep, setAuthStep] = useState<'gate' | 'verify'>('gate')
  const [authCode, setAuthCode] = useState(['','','','','','','',''])
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading2, setAuthLoading2] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const codeRefs = Array.from({length: 8}, () => useRef<HTMLInputElement>(null))

  const filteredShops = shops.filter((s: any) =>
    (filter === 'all' || s.category === filter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase())))
  )
  const vaultTotal = vaultItems.reduce((a: number, c: any) => a + c.est_value, 0)
  const isSignedIn = !!user
  const isMerchant = profile?.role === 'merchant'

  function openShop(id: string) {
    setSelectedShopId(id)
    setModal('shop')
  }

  async function handleAuthSend(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setAuthLoading2(true)
    setAuthError(null)
    const { error } = await sendOtp(email, role)
    setAuthLoading2(false)
    if (error) { setAuthError(error); return }
    setAuthStep('verify')
    setAuthCode(['','','','','','','',''])
    setTimeout(() => codeRefs[0].current?.focus(), 80)
  }

  function handleCodeInput(i: number, val: string) {
    const v = val.replace(/\D/g, '').slice(0, 1)
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
    if (!inpName || !inpVal || !user) return
    await addVaultItem(user.id, inpName, parseFloat(inpVal) || 0)
    setInpName(''); setInpVal('')
  }

  if (authLoading || shopsLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 bg-[#E0533C] rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg">
            <Compass className="h-6 w-6 animate-spin" />
          </div>
          <p className="text-[11px] font-mono uppercase tracking-widest opacity-40">Loading Outpost...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F4EF] text-[#18191B] flex flex-col font-sans max-w-md mx-auto relative">

      {/* ── TOP BAR ── */}
      <header className="bg-[#FAF9F5] border-b border-zinc-200 px-4 pt-12 pb-3 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-[#E0533C] rounded-xl flex items-center justify-center shadow-sm">
              <Compass className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight leading-none">OUTPOST</h1>
              <p className="text-[7px] opacity-30 font-mono mt-0.5">EVERY SHOP. EVERY DROP. NEAR YOU.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setModal('auth')} className="h-8 w-8 bg-zinc-100 border border-zinc-200 rounded-xl flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-zinc-500" />
            </button>
            <button onClick={() => setModal('menu')} className="h-8 w-8 bg-zinc-100 border border-zinc-200 rounded-xl flex items-center justify-center">
              <Menu className="h-3.5 w-3.5 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Search — only on discover tab */}
        {tab === 'discover' && (
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search shops, tags, keys..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-zinc-100 border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-[12px] focus:outline-none focus:border-zinc-400"
            />
          </div>
        )}
      </header>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-24">

        {/* ══ DISCOVER ══ */}
        {tab === 'discover' && (
          <div className="p-4 space-y-3">
            {/* Filter pills */}
            <div className="flex gap-2">
              {['all','comics','cards'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all ${filter === f ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-400 border-zinc-200'}`}>
                  {f}
                </button>
              ))}
            </div>

            {/* Shop cards */}
            {filteredShops.map((s: any) => (
              <button key={s.id} onClick={() => openShop(s.id)}
                className="w-full bg-white border border-zinc-200 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md ${s.category === 'comics' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                        {s.category}
                      </span>
                      <span className="text-[9px] text-amber-500 font-bold">{s.rating}★</span>
                    </div>
                    <h3 className="font-black text-[13px] leading-tight">{s.name}</h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{s.address}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {s.tags?.map((t: string, i: number) => (
                        <span key={i} className="text-[8px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-md font-mono font-bold">{t}</span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-300 flex-shrink-0 mt-1" />
                </div>

                {/* Hot find strip */}
                {s.hot_find && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-2">
                    <Flame className="h-3 w-3 text-[#E0533C] flex-shrink-0" />
                    <p className="text-[10px] text-zinc-500 italic truncate">"{s.hot_find}"</p>
                  </div>
                )}
              </button>
            ))}

            {filteredShops.length === 0 && (
              <div className="text-center py-12 text-zinc-400">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-[11px] font-mono">No shops found</p>
              </div>
            )}
          </div>
        )}

        {/* ══ CLASSIFIEDS ══ */}
        {tab === 'classifieds' && (
          <div className="p-4 space-y-4">
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
              <h3 className="font-black text-[#E0533C] text-xs uppercase mb-3">Post a Trade</h3>
              <form onSubmit={handleTradeSubmit} className="space-y-2.5">
                <div>
                  <label className="block text-[8px] uppercase text-zinc-400 font-bold mb-1">Offering</label>
                  <input type="text" required value={inpOff} onChange={e => setInpOff(e.target.value)}
                    placeholder="e.g. Blastoise PSA 8"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-[12px] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[8px] uppercase text-zinc-400 font-bold mb-1">Seeking</label>
                  <input type="text" required value={inpWant} onChange={e => setInpWant(e.target.value)}
                    placeholder="e.g. Venusaur PSA 7+"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-[12px] focus:outline-none" />
                </div>
                <button type="submit" disabled={!isSignedIn}
                  className="w-full bg-[#E0533C] text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-wider disabled:opacity-40">
                  {isSignedIn ? 'Publish Trade' : 'Sign In to Post'}
                </button>
              </form>
            </div>

            <div className="space-y-3">
              {tradePosts.map((p: any) => (
                <div key={p.id} className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-[9px] font-mono text-zinc-400 mb-2">@{p.username}</p>
                  <div className="space-y-1.5">
                    <div className="flex gap-2 items-center">
                      <span className="text-[8px] font-black bg-zinc-100 px-1.5 py-0.5 rounded font-mono uppercase">OFFER</span>
                      <p className="text-[12px] font-medium">{p.offer}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-[8px] font-black bg-[#E0533C]/10 text-[#E0533C] px-1.5 py-0.5 rounded font-mono uppercase">WANT</span>
                      <p className="text-[12px] font-medium text-[#E0533C]">{p.look_for}</p>
                    </div>
                  </div>
                  <button onClick={() => alert('Swap room coming soon')}
                    className="w-full mt-3 py-2 border border-zinc-200 rounded-xl text-[10px] font-black uppercase text-zinc-500">
                    Connect Swap
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ VAULT ══ */}
        {tab === 'vault' && (
          <div className="p-4 space-y-4">
            <div className="bg-zinc-900 rounded-2xl p-4 text-white">
              <p className="text-[9px] font-mono uppercase opacity-40">Total Estimated Value</p>
              <p className="text-3xl font-black mt-1">${vaultTotal.toLocaleString()}</p>
              <p className="text-[9px] opacity-40 mt-1">{vaultItems.length} items</p>
            </div>

            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
              <h3 className="font-black text-xs uppercase mb-3">Add Item</h3>
              <form onSubmit={handleVaultSubmit} className="space-y-2.5">
                <input type="text" required value={inpName} onChange={e => setInpName(e.target.value)}
                  placeholder="Item name"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-[12px] focus:outline-none" />
                <input type="number" required value={inpVal} onChange={e => setInpVal(e.target.value)}
                  placeholder="Estimated value ($)"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-[12px] focus:outline-none" />
                <button type="submit" disabled={!isSignedIn}
                  className="w-full bg-zinc-900 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-wider disabled:opacity-40">
                  {isSignedIn ? 'Lock Item' : 'Sign In First'}
                </button>
              </form>
            </div>

            <div className="space-y-2">
              {vaultItems.map((item: any) => (
                <div key={item.id} className="bg-white border border-zinc-200 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                  <p className="font-bold text-[13px]">{item.name}</p>
                  <p className="text-emerald-600 font-black">${item.est_value.toLocaleString()}</p>
                </div>
              ))}
              {vaultItems.length === 0 && (
                <div className="text-center py-8 text-zinc-400">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-[11px] font-mono">Your vault is empty</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ PROFILE ══ */}
        {tab === 'profile' && (
          <div className="p-4 space-y-4">
            {isSignedIn ? (
              <>
                <div className="bg-zinc-900 rounded-2xl p-5 text-white">
                  <div className="h-12 w-12 bg-[#E0533C] rounded-2xl flex items-center justify-center mb-3">
                    <User className="h-6 w-6" />
                  </div>
                  <p className="font-black text-lg">@{profile?.username}</p>
                  <p className="text-[10px] opacity-40 font-mono uppercase mt-0.5">{profile?.role} · {profile?.tier} plan</p>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                  {[
                    ['Subscription', () => setModal('sub')],
                    ['AR Lens', () => setModal('ar')],
                    ['Sign Out', () => signOut()],
                  ].map(([label, action]: any) => (
                    <button key={label} onClick={action}
                      className="w-full px-4 py-3.5 flex items-center justify-between border-b border-zinc-100 last:border-0 text-left">
                      <span className="font-bold text-[13px]">{label}</span>
                      <ChevronRight className="h-4 w-4 text-zinc-300" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 space-y-4">
                <div className="h-16 w-16 bg-zinc-100 rounded-3xl flex items-center justify-center mx-auto">
                  <User className="h-8 w-8 text-zinc-300" />
                </div>
                <div>
                  <p className="font-black text-base">Not signed in</p>
                  <p className="text-[11px] text-zinc-400 mt-1">Sign in to access your vault, post trades, and leave reviews</p>
                </div>
                <button onClick={() => setModal('auth')}
                  className="bg-zinc-900 text-white font-black px-8 py-3 rounded-2xl uppercase text-[10px] tracking-wider">
                  Sign In
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-zinc-200 px-2 py-2 pb-6 flex items-center justify-around z-20">
        {[
          { id: 'discover', icon: Search, label: 'Discover' },
          { id: 'classifieds', icon: ArrowLeftRight, label: 'Trades' },
          { id: 'vault', icon: Package, label: 'Vault' },
          { id: 'profile', icon: User, label: 'Profile' },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id as TabType)}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-all ${tab === id ? 'text-[#E0533C]' : 'text-zinc-400'}`}>
            <Icon className={`h-5 w-5 ${tab === id ? 'stroke-[2.5px]' : ''}`} />
            <span className={`text-[9px] font-bold uppercase ${tab === id ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
          </button>
        ))}
      </nav>

      {/* ══ SHOP DETAIL MODAL ══ */}
      {modal === 'shop' && selectedShop && (
        <div className="fixed inset-0 bg-[#FAF9F5] z-30 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-zinc-200 px-4 pt-12 pb-3 flex items-center gap-3">
            <button onClick={() => setModal('none')} className="h-8 w-8 bg-zinc-100 rounded-xl flex items-center justify-center">
              <X className="h-4 w-4 text-zinc-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-[13px] leading-tight truncate">{selectedShop.name}</h2>
              <p className="text-[9px] text-zinc-400 font-mono">{selectedShop.address}</p>
            </div>
            <span className="text-amber-500 font-bold text-[11px]">{selectedShop.rating}★</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Info card */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
              <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md ${(selectedShop as any).category === 'comics' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                {(selectedShop as any).category}
              </span>
              <p className="mt-2 text-[12px] text-zinc-600 leading-relaxed">{selectedShop.description}</p>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-zinc-100">
                <span className="text-[9px] font-mono text-zinc-400">⏱ {selectedShop.hours}</span>
              </div>
            </div>

            {/* Hot find */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="h-3.5 w-3.5 text-[#E0533C]" />
                <span className="text-[8px] font-black uppercase text-[#E0533C] font-mono">Live Floor Drop</span>
              </div>
              <p className="text-[13px] font-medium italic">"{selectedShop.hot_find}"</p>
              {isMerchant && (selectedShop as any).owner_id === user?.id && (
                <form onSubmit={async e => { e.preventDefault(); if (!inpFind.trim()) return; await updateHotFind(selectedShop.id, inpFind); setInpFind('') }}
                  className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
                  <input type="text" value={inpFind} onChange={e => setInpFind(e.target.value)}
                    placeholder="Broadcast new drop..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-[11px] focus:outline-none" />
                  <button type="submit" className="w-full bg-purple-700 text-white font-black py-2 rounded-xl text-[9px] uppercase">Publish Drop</button>
                </form>
              )}
            </div>

            {/* Events */}
            {(selectedShop as any).events?.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-3">
                  <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-[8px] font-black uppercase font-mono text-zinc-400">Events</span>
                </div>
                <div className="space-y-2">
                  {(selectedShop as any).events.map((ev: any) => (
                    <div key={ev.id} className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-xl">
                      <div>
                        <span className="text-[8px] bg-zinc-200 px-1.5 py-0.5 rounded font-mono font-bold mr-1.5">{ev.date}</span>
                        <span className="text-[11px] font-bold">{ev.title}</span>
                      </div>
                      <button onClick={() => setRsvps(rsvps.includes(ev.id) ? rsvps.filter((id: string) => id !== ev.id) : [...rsvps, ev.id])}
                        className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border ${rsvps.includes(ev.id) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white border-zinc-200'}`}>
                        {rsvps.includes(ev.id) ? '✓ RSVP' : 'RSVP'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
              <p className="text-[8px] font-black uppercase font-mono text-zinc-400 mb-3">Reviews</p>
              <div className="space-y-2 mb-3">
                {reviews.map((r: any) => (
                  <div key={r.id} className="p-3 bg-zinc-50 rounded-xl">
                    <p className="text-[11px] font-medium">"{r.comment}"</p>
                    <p className="text-[8px] text-[#E0533C] font-mono font-bold mt-1">@{r.username}</p>
                  </div>
                ))}
                {reviews.length === 0 && <p className="text-[10px] text-zinc-400 italic">No reviews yet</p>}
              </div>
              <form onSubmit={handleReviewSubmit} className="flex gap-2">
                <input type="text" required value={inpRev} onChange={e => setInpRev(e.target.value)}
                  placeholder={isSignedIn ? 'Leave a review...' : 'Sign in to review'}
                  disabled={!isSignedIn}
                  className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-[11px] focus:outline-none disabled:opacity-50" />
                <button type="submit" disabled={!isSignedIn}
                  className="bg-zinc-900 text-white font-bold px-4 py-2 rounded-xl text-[10px] disabled:opacity-30">Post</button>
              </form>
            </div>

            {/* Map */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-center shadow-sm"
              style={{ backgroundImage: 'radial-gradient(#D6D3C4 1px,transparent 0)', backgroundSize: '16px 16px', minHeight: 120 }}>
              <div className="text-center p-2 bg-white border border-zinc-200 rounded-xl shadow-sm font-mono text-[9px] font-bold">
                <MapPin className="h-5 w-5 text-[#E0533C] mx-auto animate-bounce mb-1" />
                {(selectedShop as any).lat} / {(selectedShop as any).lng}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ AUTH MODAL ══ */}
      {modal === 'auth' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-md bg-[#FAF9F5] rounded-t-3xl overflow-hidden shadow-2xl">
            <div className="bg-zinc-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-[#E0533C] rounded-lg flex items-center justify-center">
                  <Compass className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-white font-black text-[11px] tracking-widest uppercase">Sign In to Outpost</span>
              </div>
              <button onClick={closeModal} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-5 pb-8">
              {authStep === 'gate' && (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <button onClick={() => setRole('hunter')}
                      className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${role === 'hunter' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-400'}`}>
                      <User className={`h-5 w-5 ${role === 'hunter' ? 'text-[#E0533C]' : ''}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Hunter</span>
                      <span className="text-[8px] opacity-50 font-mono">Browse & collect</span>
                    </button>
                    <button onClick={() => setRole('merchant')}
                      className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${role === 'merchant' ? 'border-purple-700 bg-purple-700 text-white' : 'border-zinc-200 bg-white text-zinc-400'}`}>
                      <Store className={`h-5 w-5 ${role === 'merchant' ? 'text-white' : ''}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Merchant</span>
                      <span className="text-[8px] opacity-50 font-mono">Manage store</span>
                    </button>
                  </div>
                  <form onSubmit={handleAuthSend} className="space-y-3">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full bg-white border-2 border-zinc-200 focus:border-zinc-900 rounded-2xl px-4 py-3.5 text-[13px] outline-none transition-colors font-medium" />
                    {authError && <p className="text-[10px] text-red-500">{authError}</p>}
                    <button type="submit" disabled={authLoading2}
                      className={`w-full font-black py-4 rounded-2xl uppercase text-[11px] tracking-widest disabled:opacity-50 ${role === 'merchant' ? 'bg-purple-700 text-white' : 'bg-zinc-900 text-white'}`}>
                      {authLoading2 ? 'Sending...' : 'Send Access Code →'}
                    </button>
                  </form>
                  <p className="text-center text-[9px] text-zinc-300 font-mono mt-3">An 8-digit code will be sent to your email</p>
                </>
              )}
              {authStep === 'verify' && (
                <>
                  <button onClick={() => setAuthStep('gate')} className="text-[9px] font-mono font-bold text-zinc-400 mb-4 flex items-center gap-1">← Back</button>
                  <div className="mb-5">
                    <p className="font-black text-base mb-0.5">Check your inbox</p>
                    <p className="text-[11px] text-zinc-400">Code sent to <span className="text-zinc-700 font-bold">{email}</span></p>
                  </div>
                  <form onSubmit={handleAuthVerify} className="space-y-4">
                    <div className="flex gap-1.5 justify-center">
                      {authCode.map((digit, i) => (
                        <input key={i} ref={codeRefs[i]} type="text" inputMode="numeric" maxLength={1} value={digit}
                          onChange={e => handleCodeInput(i, e.target.value)}
                          onKeyDown={e => handleCodeKey(i, e)}
                          className={`w-10 h-12 text-center text-lg font-black border-2 rounded-xl outline-none transition-all bg-white ${digit ? 'border-zinc-900 text-zinc-900' : 'border-zinc-200 text-zinc-300'} focus:border-[#E0533C]`}
                          style={{ caretColor: 'transparent' }} />
                      ))}
                    </div>
                    {authError && <p className="text-[10px] text-red-500 text-center">{authError}</p>}
                    <button type="submit" disabled={authCode.join('').length < 8 || authLoading2}
                      className={`w-full font-black py-4 rounded-2xl uppercase text-[11px] tracking-widest disabled:opacity-25 ${role === 'merchant' ? 'bg-purple-700 text-white' : 'bg-zinc-900 text-white'}`}>
                      {authLoading2 ? 'Verifying...' : 'Authorize'}
                    </button>
                    <p className="text-center text-[9px] text-zinc-300 font-mono">
                      Didn't get it?{' '}
                      <button type="button" onClick={() => setAuthStep('gate')} className="text-[#E0533C] underline">Resend</button>
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ SUBSCRIPTION MODAL ══ */}
      {modal === 'sub' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-md bg-[#FAF9F5] rounded-t-3xl p-5 pb-8 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-sm uppercase">Membership</h3>
              <button onClick={() => setModal('none')}><X className="h-4 w-4 text-zinc-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between">
                <div><p className="font-black text-[13px]">Hunter Base</p><p className="text-[10px] text-zinc-400">Basic access</p></div>
                <div className="text-right"><p className="font-black text-lg">Free</p><button onClick={() => setModal('none')} className="text-[9px] uppercase font-bold text-zinc-400">Current</button></div>
              </div>
              <div className="bg-white border-2 border-[#E0533C] rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div><p className="font-black text-[13px] text-[#E0533C]">Elite Pass</p><p className="text-[10px] text-zinc-400">Price alerts + AR scan</p></div>
                <div className="text-right"><p className="font-black text-lg">$1.99<span className="text-xs font-normal text-zinc-400">/mo</span></p>
                  <button onClick={() => handleUpgrade('elite')} disabled={checkoutLoading} className="text-[9px] uppercase font-bold text-[#E0533C]">{checkoutLoading ? '...' : 'Upgrade'}</button></div>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-4 flex items-center justify-between text-white">
                <div><p className="font-black text-[13px] text-amber-400">Verified Store</p><p className="text-[10px] text-white/40">Merchant dashboard</p></div>
                <div className="text-right"><p className="font-black text-lg">$2.99<span className="text-xs font-normal text-white/40">/mo</span></p>
                  <button onClick={() => handleUpgrade('store')} disabled={checkoutLoading} className="text-[9px] uppercase font-bold text-amber-400">{checkoutLoading ? '...' : 'Claim'}</button></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MENU MODAL ══ */}
      {modal === 'menu' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-md bg-[#FAF9F5] rounded-t-3xl p-5 pb-8 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-sm uppercase">Menu</h3>
              <button onClick={() => setModal('none')}><X className="h-4 w-4 text-zinc-400" /></button>
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
              {[
                ['Subscription', () => { setModal('sub') }],
                ['AR Lens', () => { setModal('ar') }],
                [isSignedIn ? `Sign Out (@${profile?.username})` : 'Sign In', () => { isSignedIn ? signOut() : setModal('auth') }],
              ].map(([label, action]: any) => (
                <button key={label} onClick={action}
                  className="w-full px-4 py-4 flex items-center justify-between border-b border-zinc-100 last:border-0">
                  <span className="font-bold text-[13px]">{label}</span>
                  <ChevronRight className="h-4 w-4 text-zinc-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ AR MODAL ══ */}
      {modal === 'ar' && (
        <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col text-white font-mono">
          <div className="flex justify-between items-center border-b border-white/10 px-4 pt-12 pb-3">
            <h3 className="text-emerald-400 font-bold">AR Lens</h3>
            <button onClick={() => setModal('none')}><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-zinc-900"
            style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,0.04) 2px,transparent 2px),linear-gradient(90deg,rgba(16,185,129,0.04) 2px,transparent 2px)', backgroundSize: '30px 30px' }}>
            <div className="p-4 bg-neutral-900 border border-amber-500 rounded-2xl text-left max-w-xs mx-4">
              <span className="text-[8px] text-amber-400 font-bold">★ WISHLIST MATCH</span>
              <h4 className="text-sm font-bold uppercase mt-1">Charizard Base Holo (1st Ed)</h4>
              <p className="text-emerald-400 font-black mt-2">VALUE: $2,850.00</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
