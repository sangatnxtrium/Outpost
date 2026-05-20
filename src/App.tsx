import React, { useState, useEffect, useRef } from 'react'
import { Compass, MapPin, Search, Flame, X, Store, User } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useShops, useReviews, useTradePosts, useVault } from './hooks/useShops'
import { startCheckout } from './lib/stripe'

type ViewMode = 'radar' | 'classifieds'
type ModalType = 'none' | 'sub' | 'auth' | 'ar' | 'vault'

export default function App() {
  const { user, profile, loading: authLoading, sendOtp, verifyOtp, signOut } = useAuth()
  const { shops, loading: shopsLoading, updateHotFind } = useShops()
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const selectedShop = shops.find(s => s.id === selectedShopId) || shops[0] || null
  const { reviews, addReview } = useReviews(selectedShop?.id || '')
  const { tradePosts, addTradePost } = useTradePosts()
  const { vaultItems, addVaultItem } = useVault(user?.id || null)
  const [rsvps, setRsvps] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('radar')
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
  const [authCode, setAuthCode] = useState(['', '', '', '', '', ''])
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading2, setAuthLoading2] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const codeRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  useEffect(() => {
    if (shops.length > 0 && !selectedShopId) setSelectedShopId(shops[0].id)
  }, [shops])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success') {
      setModal('sub')
      window.history.replaceState({}, '', '/')
    }
  }, [])

  async function handleAuthSend(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setAuthLoading2(true)
    setAuthError(null)
    const { error } = await sendOtp(email, role)
    setAuthLoading2(false)
    if (error) { setAuthError(error); return }
    setAuthStep('verify')
    setAuthCode(['', '', '', '', '', ''])
    setTimeout(() => codeRefs[0].current?.focus(), 80)
  }

  function handleCodeInput(i: number, val: string) {
    const v = val.replace(/\D/g, '').slice(0, 1)
    const next = [...authCode]
    next[i] = v
    setAuthCode(next)
    if (v && i < 5) setTimeout(() => codeRefs[i + 1].current?.focus(), 0)
  }

  function handleCodeKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !authCode[i] && i > 0) codeRefs[i - 1].current?.focus()
  }

  async function handleAuthVerify(e: React.FormEvent) {
    e.preventDefault()
    const code = authCode.join('')
    if (code.length < 6) return
    setAuthLoading2(true)
    setAuthError(null)
    const { error } = await verifyOtp(email, code)
    setAuthLoading2(false)
    if (error) { setAuthError('Invalid code. Please try again.'); return }
    closeModal()
  }

  function closeModal() {
    setModal('none')
    setAuthStep('gate')
    setAuthCode(['', '', '', '', '', ''])
    setAuthError(null)
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
    setInpOff('')
    setInpWant('')
  }

  async function handleVaultSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inpName || !inpVal || !user) return
    await addVaultItem(user.id, inpName, parseFloat(inpVal) || 0)
    setInpName('')
    setInpVal('')
  }

  async function handleHotFind(e: React.FormEvent) {
    e.preventDefault()
    if (!inpFind.trim() || !selectedShop) return
    await updateHotFind(selectedShop.id, inpFind)
    setInpFind('')
  }

  const filteredShops = shops.filter(s =>
    (filter === 'all' || s.category === filter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some(t => t.toLowerCase().includes(search.toLowerCase())))
  )

  const vaultTotal = vaultItems.reduce((a, c) => a + c.est_value, 0)
  const isMerchant = profile?.role === 'merchant'
  const isSignedIn = !!user

  if (authLoading || shopsLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 bg-[#E0533C] rounded-lg flex items-center justify-center text-white mx-auto">
            <Compass className="h-4 w-4 animate-spin" />
          </div>
          <p className="text-[10px] font-mono uppercase opacity-40">Loading Outpost...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#18191B] flex flex-col font-sans text-xs">

      <header className="border-b bg-[#FAF9F5] px-6 py-3 flex items-center justify-between sticky top-0 z-30 font-bold">
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 bg-[#E0533C] rounded-lg flex items-center justify-center text-white">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-black">OUTPOST</h1>
            <p className="text-[8px] opacity-40">EVERY SHOP. EVERY DROP. NEAR YOU.</p>
          </div>
        </div>
        <div className="flex bg-[#F3F2EC] p-0.5 rounded-lg border text-[10px]">
          <button onClick={() => setViewMode('radar')} className={`px-3 py-1 rounded ${viewMode === 'radar' ? 'bg-white' : 'opacity-40'}`}>Radar Grid</button>
          <button onClick={() => setViewMode('classifieds')} className={`px-3 py-1 rounded ${viewMode === 'classifieds' ? 'bg-white' : 'opacity-40'}`}>Classifieds</button>
        </div>
        <div className="flex items-center space-x-1 text-[10px]">
          <button onClick={() => setModal('sub')} className="px-2.5 py-1 bg-amber-500 text-white rounded-lg">Subscription</button>
          <button onClick={() => setModal('ar')} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg">AR Lens</button>
          <button onClick={() => isSignedIn ? signOut() : setModal('auth')} className="px-2.5 py-1 bg-zinc-900 text-white rounded-lg">
            {isSignedIn ? `@${profile?.username} (${profile?.role})` : 'Sign In'}
          </button>
          <button onClick={() => setModal('vault')} className="px-2.5 py-1 bg-[#F3F2EC] rounded-lg">Vault ({vaultItems.length})</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {viewMode === 'radar' ? (
          <>
            <aside className="w-full md:w-64 border-r bg-[#FAF9F5] flex flex-col overflow-y-auto p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3 w-3 opacity-30" />
                <input type="text" placeholder="Search keys, tags, shops..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-[#F3F2EC] rounded-lg pl-8 pr-2 py-1 text-[#18191B]" />
              </div>
              <div className="flex gap-1 text-[9px] font-bold uppercase">
                {['all', 'comics', 'cards'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`flex-1 py-0.5 border rounded ${filter === f ? 'bg-zinc-800 text-white' : ''}`}>{f}</button>
                ))}
              </div>
              <div className="space-y-2 pt-2">
                {filteredShops.map(s => (
                  <div key={s.id} onClick={() => setSelectedShopId(s.id)} className={`p-2.5 border rounded-xl text-left cursor-pointer ${selectedShop?.id === s.id ? 'border-zinc-800 bg-[#F3F2EC]' : ''}`}>
                    <div className="flex justify-between font-bold"><h4>{s.name}</h4><span>{s.rating}★</span></div>
                    <div className="flex gap-1 mt-1">{s.tags.map((t, i) => (<span key={i} className="text-[7px] bg-zinc-200 px-1 rounded font-mono uppercase font-black">{t}</span>))}</div>
                  </div>
                ))}
              </div>
            </aside>

            {selectedShop && (
              <main className="flex-1 bg-[#F3F2EC]/30 p-4 flex flex-col gap-4 overflow-y-auto text-left">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-white border rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-[7px] font-bold text-[#E0533C] bg-[#E0533C]/5 border px-1.5 py-0.5 rounded mb-1 inline-block">OUTPOST LOCATION</span>
                      <h2 className="text-base font-black uppercase tracking-tight">{selectedShop.name}</h2>
                      <p className="opacity-40 text-[11px]">{selectedShop.address}</p>
                      <p className="mt-2 text-zinc-600">{selectedShop.description}</p>
                    </div>
                    <p className="pt-2 border-t mt-4 font-mono opacity-50 text-[10px]">Hours: {selectedShop.hours}</p>
                  </div>
                  <div className="bg-white border rounded-xl p-4 flex items-center justify-center min-h-[140px]" style={{ backgroundImage: 'radial-gradient(#D6D3C4 1px,transparent 0)', backgroundSize: '16px 16px' }}>
                    <div className="text-center p-2 bg-[#FAF9F5] border rounded-lg shadow-sm font-mono text-[9px] font-bold">
                      <MapPin className="h-4 w-4 text-[#E0533C] mx-auto animate-bounce mb-0.5" />
                      LAT:{selectedShop.lat}/LNG:{selectedShop.lng}
                    </div>
                  </div>
                  <div className="bg-white border rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center text-[#E0533C] font-mono text-[8px] font-bold gap-0.5 mb-1">
                        <Flame className="h-3 w-3" /><span>LIVE HIGHLIGHT</span>
                      </div>
                      <h4 className="font-black uppercase">Floor Stock Drop</h4>
                      <p className="bg-[#FAF9F5] border rounded-lg p-2.5 mt-1 italic font-medium">"{selectedShop.hot_find}"</p>
                    </div>
                    {isMerchant && selectedShop.owner_id === user?.id && (
                      <form onSubmit={handleHotFind} className="mt-2 space-y-1 bg-purple-50/50 p-1.5 border border-purple-100 rounded-lg">
                        <input type="text" value={inpFind} onChange={e => setInpFind(e.target.value)} placeholder="Broadcast new counter drop..." className="w-full p-1 border text-[10px] rounded" />
                        <button type="submit" className="w-full bg-purple-700 text-white font-mono text-[8px] py-1 rounded uppercase font-bold">Publish Drop</button>
                      </form>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                  <div className="lg:col-span-2 bg-white border rounded-xl p-4 space-y-3">
                    <div className="border-b pb-1 font-mono font-bold uppercase opacity-40">Hobby Guild Events & Tournament Calendar</div>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                      {(selectedShop.events || []).map(ev => (
                        <div key={ev.id} className="p-2 bg-[#FAF9F5] border rounded-lg flex items-center justify-between text-[11px]">
                          <div><span className="text-[8px] bg-zinc-200 px-1 rounded font-mono font-bold mr-1">{ev.date}</span><strong>{ev.title}</strong></div>
                          <button onClick={() => setRsvps(rsvps.includes(ev.id) ? rsvps.filter(id => id !== ev.id) : [...rsvps, ev.id])} className={`px-2 py-0.5 border text-[9px] rounded font-bold uppercase ${rsvps.includes(ev.id) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white'}`}>
                            {rsvps.includes(ev.id) ? '✓ RSVP Linked' : 'RSVP Pass'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border rounded-xl p-4 font-mono">
                    <div className="border-b pb-1 uppercase opacity-40 text-[9px] font-bold">Asset Index Valuation</div>
                    <p className="font-sans font-bold uppercase mt-2">Charizard Base Holo</p>
                    <p className="text-[#E0533C] font-black text-sm mt-1">$320.00</p>
                  </div>
                </div>

                <div className="bg-white border rounded-xl p-4 space-y-3">
                  <div className="border-b pb-1 font-mono font-bold uppercase opacity-40">Collector Feedback Matrix</div>
                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto">
                    {reviews.map(r => (
                      <div key={r.id} className="p-2 bg-[#FAF9F5] border rounded-lg font-medium">
                        "{r.comment}"<span className="text-[8px] text-[#E0533C] font-mono font-bold block mt-0.5">@{r.username}</span>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleReviewSubmit} className="flex gap-2 border-t pt-2">
                    <input type="text" required value={inpRev} onChange={e => setInpRev(e.target.value)} placeholder={isSignedIn ? 'Type feedback...' : '🔒 Sign in to leave feedback'} disabled={!isSignedIn} className="flex-1 bg-white border p-1.5 text-xs rounded-lg disabled:opacity-50" />
                    <button type="submit" disabled={!isSignedIn} className="bg-zinc-900 text-white font-bold px-3 py-1 rounded-lg uppercase text-[10px] disabled:opacity-30">Post</button>
                  </form>
                </div>
              </main>
            )}
          </>
        ) : (
          <main className="flex-1 bg-[#F3F2EC]/30 p-4 flex flex-col lg:flex-row gap-4 overflow-y-auto text-left">
            <div className="w-full lg:w-64 bg-white border rounded-xl p-4 self-start">
              <h3 className="font-black uppercase border-b pb-1 text-[#E0533C]">Manifest Trade Post</h3>
              <form onSubmit={handleTradeSubmit} className="space-y-3 mt-3 font-medium">
                <div>
                  <label className="block text-[8px] uppercase text-zinc-400 font-bold mb-0.5">Offered Asset</label>
                  <input type="text" required value={inpOff} onChange={e => setInpOff(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-1.5" />
                </div>
                <div>
                  <label className="block text-[8px] uppercase text-zinc-400 font-bold mb-0.5">Looking For</label>
                  <input type="text" required value={inpWant} onChange={e => setInpWant(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-1.5" />
                </div>
                <button type="submit" disabled={!isSignedIn} className="w-full bg-[#E0533C] text-white font-bold py-2 rounded-xl uppercase text-[10px] disabled:opacity-40">
                  {isSignedIn ? 'Publish Trade' : 'Sign In to Post'}
                </button>
              </form>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-max">
              {tradePosts.map(p => (
                <div key={p.id} className="bg-white border rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <span className="text-[8px] font-mono font-bold text-zinc-400">@ {p.username}</span>
                    <div className="mt-1.5">
                      <p><strong>OFFER:</strong> {p.offer}</p>
                      <p className="text-[#E0533C]"><strong>WANT:</strong> {p.look_for}</p>
                    </div>
                  </div>
                  <button onClick={() => alert('Swap room link loaded')} className="w-full bg-zinc-50 py-1 rounded border mt-3 font-mono font-bold uppercase text-[9px]">Connect Swap</button>
                </div>
              ))}
            </div>
          </main>
        )}
      </div>

      {modal === 'auth' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#FAF9F5] border rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-zinc-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-[#E0533C] rounded-md flex items-center justify-center">
                  <Compass className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-white font-black text-[11px] tracking-widest uppercase">Sign In</span>
              </div>
              <button onClick={closeModal} className="text-white/30 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5">
              {authStep === 'gate' && (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <button onClick={() => setRole('hunter')} className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${role === 'hunter' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-400 hover:border-zinc-400'}`}>
                      <User className={`h-4 w-4 ${role === 'hunter' ? 'text-[#E0533C]' : ''}`} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Hunter</span>
                      <span className="text-[7px] opacity-50 font-mono">Browse &amp; collect</span>
                    </button>
                    <button onClick={() => setRole('merchant')} className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${role === 'merchant' ? 'border-purple-700 bg-purple-700 text-white' : 'border-zinc-200 bg-white text-zinc-400 hover:border-purple-300'}`}>
                      <Store className={`h-4 w-4 ${role === 'merchant' ? 'text-white' : ''}`} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Merchant</span>
                      <span className="text-[7px] opacity-50 font-mono">Manage your store</span>
                    </button>
                  </div>
                  <form onSubmit={handleAuthSend} className="space-y-3">
                    <div>
                      <label className="block text-[8px] font-bold uppercase text-zinc-400 mb-1.5 font-mono tracking-wider">
                        {role === 'hunter' ? 'Hunter Email' : 'Store Email'}
                      </label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={role === 'hunter' ? 'hunter@domain.com' : 'store@domain.com'} className="w-full bg-white border-2 border-zinc-200 focus:border-zinc-900 rounded-xl px-3 py-2.5 text-[11px] outline-none transition-colors font-medium placeholder:opacity-30" />
                    </div>
                    {authError && <p className="text-[10px] text-red-500 font-medium">{authError}</p>}
                    <button type="submit" disabled={authLoading2} className={`w-full font-black py-2.5 rounded-xl uppercase text-[10px] tracking-widest transition-colors disabled:opacity-50 ${role === 'merchant' ? 'bg-purple-700 hover:bg-purple-800 text-white' : 'bg-zinc-900 hover:bg-zinc-800 text-white'}`}>
                      {authLoading2 ? 'Sending...' : 'Send Access Code →'}
                    </button>
                  </form>
                  <p className="text-center text-[8px] text-zinc-300 font-mono mt-4">A 6-digit code will be sent to your email</p>
                </>
              )}
              {authStep === 'verify' && (
                <>
                  <button onClick={() => setAuthStep('gate')} className="text-[8px] font-mono font-bold text-zinc-400 hover:text-zinc-700 mb-4 flex items-center gap-1 transition-colors">← Back</button>
                  <div className="mb-5">
                    <p className="font-black text-sm mb-0.5">Check your inbox</p>
                    <p className="text-[10px] text-zinc-400">Code sent to <span className="text-zinc-700 font-bold">{email}</span></p>
                  </div>
                  <form onSubmit={handleAuthVerify} className="space-y-4">
                    <div className="flex gap-2 justify-center">
                      {authCode.map((digit, i) => (
                        <input key={i} ref={codeRefs[i]} type="text" inputMode="numeric" maxLength={1} value={digit}
                          onChange={e => handleCodeInput(i, e.target.value)}
                          onKeyDown={e => handleCodeKey(i, e)}
                          className={`w-10 h-12 text-center text-lg font-black border-2 rounded-xl outline-none transition-all bg-white ${digit ? 'border-zinc-900 text-zinc-900' : 'border-zinc-200 text-zinc-300'} focus:border-[#E0533C] focus:scale-105`}
                          style={{ caretColor: 'transparent' }} />
                      ))}
                    </div>
                    {authError && <p className="text-[10px] text-red-500 text-center font-medium">{authError}</p>}
                    <button type="submit" disabled={authCode.join('').length < 6 || authLoading2} className={`w-full font-black py-2.5 rounded-xl uppercase text-[10px] tracking-widest transition-all disabled:opacity-25 disabled:cursor-not-allowed ${role === 'merchant' ? 'bg-purple-700 hover:bg-purple-800 text-white' : 'bg-zinc-900 hover:bg-zinc-800 text-white'}`}>
                      {authLoading2 ? 'Verifying...' : 'Authorize Link'}
                    </button>
                    <p className="text-center text-[8px] text-zinc-300 font-mono">
                      Didn't receive it?{' '}
                      <button type="button" onClick={() => setAuthStep('gate')} className="text-[#E0533C] underline">Resend code</button>
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {modal === 'sub' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#FAF9F5] border rounded-xl shadow-2xl p-5 relative text-left">
            <X onClick={() => setModal('none')} className="absolute top-4 right-4 h-4 w-4 cursor-pointer opacity-30" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-medium mt-4 text-[11px]">
              <div className="bg-white border rounded-xl p-3 flex flex-col justify-between">
                <div><h4 className="font-mono opacity-40">Hunter Base</h4><p className="text-base font-black mt-1">Free</p></div>
                <button onClick={() => setModal('none')} className="w-full border py-1.5 rounded uppercase font-bold mt-2">{profile?.tier === 'free' ? 'Current Plan' : 'Downgrade'}</button>
              </div>
              <div className="bg-white border-2 border-[#E0533C] rounded-xl p-3 flex flex-col justify-between shadow-sm">
                <div><h4 className="font-mono text-[#E0533C]">Elite Pass</h4><p className="text-base font-black mt-1">$1.99<span className="text-xs font-normal opacity-40">/mo</span></p></div>
                <button onClick={() => handleUpgrade('elite')} disabled={checkoutLoading || profile?.tier === 'elite'} className="w-full bg-[#E0533C] text-white py-1.5 rounded uppercase font-bold mt-2 disabled:opacity-50">
                  {profile?.tier === 'elite' ? 'Current Plan' : checkoutLoading ? 'Loading...' : 'Upgrade'}
                </button>
              </div>
              <div className="bg-zinc-900 rounded-xl p-3 flex flex-col justify-between text-white">
                <div><h4 className="font-mono text-amber-500">Verified Store</h4><p className="text-base font-black mt-1">$2.99<span className="text-xs font-normal opacity-40">/mo</span></p></div>
                <button onClick={() => handleUpgrade('store')} disabled={checkoutLoading || profile?.tier === 'store'} className="w-full bg-white text-black py-1.5 rounded uppercase font-bold mt-2 disabled:opacity-50">
                  {profile?.tier === 'store' ? 'Current Plan' : checkoutLoading ? 'Loading...' : 'Claim Slot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === 'ar' && (
        <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col p-4 text-white font-mono">
          <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-4">
            <h3 className="text-emerald-400 font-bold">AR Lens Feeds</h3>
            <X onClick={() => setModal('none')} className="h-4 w-4 cursor-pointer" />
          </div>
          <div className="flex-1 rounded-xl border border-white/10 relative overflow-hidden flex items-center justify-center bg-zinc-900" style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,0.04) 2px,transparent 2px),linear-gradient(90deg,rgba(16,185,129,0.04) 2px,transparent 2px)', backgroundSize: '30px 30px' }}>
            <div className="absolute top-[35%] p-3 bg-neutral-900 border border-amber-500 rounded-xl text-left max-w-xs">
              <span className="text-[7px] text-amber-400 font-bold">★ WISHLIST MATCH</span>
              <h4 className="text-xs font-bold uppercase truncate mt-0.5">Charizard Base Holo (1st Ed)</h4>
              <p className="text-emerald-400 font-black mt-1 text-[10px]">VALUE: $2,850.00</p>
            </div>
          </div>
        </div>
      )}

      {modal === 'vault' && (
        <div className="fixed inset-6 bg-white border rounded-xl shadow-2xl p-5 z-40 flex flex-col justify-between overflow-y-auto text-left">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-1 font-mono font-bold uppercase opacity-40">
              <h3>Active Vault Ledger</h3>
              <p className="text-emerald-600">${vaultTotal.toFixed(2)}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <form onSubmit={handleVaultSubmit} className="p-3 bg-zinc-50 border rounded-xl space-y-2">
                <input type="text" required value={inpName} onChange={e => setInpName(e.target.value)} placeholder="Item Title" className="w-full bg-white border p-1 rounded text-[#18191B]" />
                <input type="number" required value={inpVal} onChange={e => setInpVal(e.target.value)} placeholder="Price ($)" className="w-full bg-white border p-1 rounded text-[#18191B]" />
                <button type="submit" disabled={!isSignedIn} className="w-full bg-[#E0533C] text-white font-bold py-1 rounded font-mono uppercase disabled:opacity-40">
                  {isSignedIn ? 'Lock Item' : 'Sign In First'}
                </button>
              </form>
              <div className="md:col-span-2 space-y-1 max-h-[140px] overflow-y-auto">
                {vaultItems.map(item => (
                  <div key={item.id} className="p-2 bg-[#FAF9F5] border rounded-lg flex justify-between font-mono">
                    <span>{item.name}</span>
                    <span className="text-emerald-600 font-bold">${item.est_value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => setModal('none')} className="bg-[#F3F2EC] font-bold px-4 py-1.5 rounded-lg self-end mt-4">Close</button>
        </div>
      )}
    </div>
  )
}