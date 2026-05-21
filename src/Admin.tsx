import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { BarChart2, Users, Store, Star, Trash2, Edit2, Check, X, LogOut, Shield, TrendingUp, Package, MessageSquare, ArrowLeftRight, ChevronDown, ChevronUp, Search, RefreshCw } from 'lucide-react'

// ── Auth guard ───────────────────────────────────────────────────────────────
const ADMIN_EMAILS = ['sangtruong@gmail.com'] // Add your email here

type AdminTab = 'dashboard' | 'shops' | 'users' | 'reviews' | 'trades' | 'marketplace'

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-zinc-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase text-zinc-400">{label}</p>
        <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: color + '20' }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black">{value}</p>
    </div>
  )
}

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authStep, setAuthStep] = useState<'email' | 'code'>('email')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [tab, setTab] = useState<AdminTab>('dashboard')

  // Data
  const [shops, setShops] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [checkins, setCheckins] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Edit state
  const [editingShop, setEditingShop] = useState<any>(null)
  const [editFields, setEditFields] = useState<any>({})

  // Check if already authed via session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email && ADMIN_EMAILS.includes(session.user.email)) {
        setAuthed(true)
        setAuthEmail(session.user.email)
      }
    })
  }, [])

  useEffect(() => {
    if (authed) fetchAll()
  }, [authed])

  async function fetchAll() {
    setLoading(true)
    const [shopsRes, usersRes, reviewsRes, tradesRes, checkinsRes] = await Promise.all([
      supabase.from('shops').select('*').order('name'),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('trade_posts').select('*').order('created_at', { ascending: false }),
      supabase.from('checkins').select('*'),
    ])
    setShops(shopsRes.data || [])
    setUsers(usersRes.data || [])
    setReviews(reviewsRes.data || [])
    setTrades(tradesRes.data || [])
    setCheckins(checkinsRes.data || [])
    setLoading(false)
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!ADMIN_EMAILS.includes(authEmail)) {
      setAuthError('This email is not authorized as admin.')
      return
    }
    setAuthLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email: authEmail })
    setAuthLoading(false)
    if (error) { setAuthError(error.message); return }
    setAuthStep('code')
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email: authEmail, token: authCode, type: 'email' })
    setAuthLoading(false)
    if (error) { setAuthError('Invalid code. Try again.'); return }
    setAuthed(true)
  }

  async function deleteShop(id: string) {
    if (!confirm('Delete this shop? This cannot be undone.')) return
    await supabase.from('shops').delete().eq('id', id)
    setShops(shops.filter(s => s.id !== id))
  }

  async function saveShop(id: string) {
    await supabase.from('shops').update(editFields).eq('id', id)
    setShops(shops.map(s => s.id === id ? { ...s, ...editFields } : s))
    setEditingShop(null)
    setEditFields({})
  }

  async function deleteReview(id: string) {
    await supabase.from('reviews').delete().eq('id', id)
    setReviews(reviews.filter(r => r.id !== id))
  }

  async function deleteTrade(id: string) {
    await supabase.from('trade_posts').delete().eq('id', id)
    setTrades(trades.filter(t => t.id !== id))
  }

  async function updateUserTier(id: string, tier: string) {
    await supabase.from('profiles').update({ tier }).eq('id', id)
    setUsers(users.map(u => u.id === id ? { ...u, tier } : u))
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAuthed(false)
  }

  // ── Login screen ─────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg">Outpost Admin</h1>
              <p className="text-xs text-zinc-400">Restricted access</p>
            </div>
          </div>

          {authStep === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-3">
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                placeholder="Admin email"
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-zinc-300" />
              {authError && <p className="text-xs text-red-500">{authError}</p>}
              <button type="submit" disabled={authLoading}
                className="w-full text-white font-black py-3 rounded-2xl text-sm uppercase disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
                {authLoading ? 'Sending...' : 'Send Access Code'}
              </button>
            </form>
          )}

          {authStep === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-3">
              <p className="text-xs text-zinc-400 mb-2">Code sent to <span className="font-bold text-zinc-700">{authEmail}</span></p>
              <input type="text" value={authCode} onChange={e => setAuthCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none font-mono tracking-widest" />
              {authError && <p className="text-xs text-red-500">{authError}</p>}
              <button type="submit" disabled={authLoading}
                className="w-full text-white font-black py-3 rounded-2xl text-sm uppercase disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
                {authLoading ? 'Verifying...' : 'Enter Admin Panel'}
              </button>
              <button type="button" onClick={() => setAuthStep('email')} className="w-full text-zinc-400 text-xs py-2">← Back</button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalRevenue = users.filter(u => u.tier !== 'free').length * 1.99
  const eliteCount = users.filter(u => u.tier === 'elite').length
  const storeCount = users.filter(u => u.tier === 'store').length

  const filteredShops = shops.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.address?.toLowerCase().includes(search.toLowerCase()))
  const filteredUsers = users.filter(u => u.username?.toLowerCase().includes(search.toLowerCase()))
  const filteredReviews = reviews.filter(r => r.comment?.toLowerCase().includes(search.toLowerCase()) || r.username?.toLowerCase().includes(search.toLowerCase()))
  const filteredTrades = trades.filter(t => t.offer?.toLowerCase().includes(search.toLowerCase()) || t.look_for?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="min-h-screen font-sans" style={{ background: '#F0EFE9' }}>
      {/* Header */}
      <header className="sticky top-0 z-20 px-4 py-3 border-b border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E0533C, #ff6b4a)' }}>
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-black text-sm">OUTPOST ADMIN</h1>
              <p className="text-xs text-zinc-400 truncate max-w-[140px]">{authEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={fetchAll} className="h-8 w-8 rounded-xl bg-zinc-100 flex items-center justify-center">
              <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <a href="/" className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-600">← App</a>
            <button onClick={signOut} className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1"
              style={{ background: 'linear-gradient(135deg, #1a0a2e, #302b63)' }}>
              <LogOut className="h-3 w-3" /> Out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col">
        {/* Mobile tab bar */}
        <div className="flex overflow-x-auto gap-2 px-4 py-3 bg-white border-b border-zinc-100 sticky top-[57px] z-10">
          {[
            { id: 'dashboard', icon: BarChart2, label: 'Dashboard' },
            { id: 'shops', icon: Store, label: `Shops (${shops.length})` },
            { id: 'users', icon: Users, label: `Users (${users.length})` },
            { id: 'reviews', icon: MessageSquare, label: `Reviews (${reviews.length})` },
            { id: 'trades', icon: ArrowLeftRight, label: `Trades (${trades.length})` },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id as AdminTab)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap flex-shrink-0 transition-all"
              style={tab === id ? { background: 'linear-gradient(135deg, #E0533C, #ff6b4a)', color: 'white' } : { background: '#f4f4f5', color: '#6b7280' }}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Main */}
        <main className="flex-1 p-4 space-y-4">

          {/* Search bar */}
          {tab !== 'dashboard' && (
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
              <input type="text" placeholder={`Search ${tab}...`} value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-zinc-400 shadow-sm" />
            </div>
          )}

          {/* DASHBOARD */}
          {tab === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="font-black text-xl">Dashboard</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total Shops" value={shops.length} icon={Store} color="#E0533C" />
                <StatCard label="Total Users" value={users.length} icon={Users} color="#7C3AED" />
                <StatCard label="Reviews" value={reviews.length} icon={Star} color="#F59E0B" />
                <StatCard label="Check-ins" value={checkins.length} icon={TrendingUp} color="#059669" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Elite Subs" value={eliteCount} icon={Package} color="#0284C7" />
                <StatCard label="Store Subs" value={storeCount} icon={Shield} color="#D97706" />
                <StatCard label="Trade Posts" value={trades.length} icon={ArrowLeftRight} color="#E0533C" />
                <StatCard label="Est. MRR" value={`$${((eliteCount * 1.99) + (storeCount * 2.99)).toFixed(0)}`} icon={TrendingUp} color="#059669" />
              </div>

              {/* Recent users */}
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100 font-black text-sm">Recent Sign Ups</div>
                {users.slice(0, 5).map(u => (
                  <div key={u.id} className="px-5 py-3 flex items-center justify-between border-b border-zinc-50 last:border-0">
                    <div>
                      <p className="font-bold text-sm">@{u.username}</p>
                      <p className="text-xs text-zinc-400 font-mono">{u.role}</p>
                    </div>
                    <span className="text-xs font-black px-2 py-1 rounded-lg"
                      style={u.tier === 'elite' ? { background: '#EDE9FE', color: '#5B21B6' }
                        : u.tier === 'store' ? { background: '#FEF3C7', color: '#92400E' }
                        : { background: '#F3F4F6', color: '#6B7280' }}>
                      {u.tier}
                    </span>
                  </div>
                ))}
              </div>

              {/* Recent reviews */}
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100 font-black text-sm">Recent Reviews</div>
                {reviews.slice(0, 5).map(r => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between border-b border-zinc-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">"{r.comment}"</p>
                      <p className="text-xs text-zinc-400 font-mono">@{r.username}</p>
                    </div>
                    <button onClick={() => deleteReview(r.id)} className="ml-3 text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SHOPS */}
          {tab === 'shops' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-xl">Shops ({filteredShops.length})</h2>
              </div>
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto -mx-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs font-bold uppercase text-zinc-400">
                        <th className="text-left px-5 py-3">Name</th>
                        <th className="text-left px-5 py-3">Category</th>
                        <th className="text-left px-5 py-3">Rating</th>
                        <th className="text-left px-5 py-3">City</th>
                        <th className="text-left px-5 py-3">Hot Find</th>
                        <th className="text-right px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShops.map(s => (
                        <React.Fragment key={s.id}>
                          <tr className="border-b border-zinc-50 hover:bg-zinc-50 transition-all">
                            <td className="px-5 py-3 font-bold">{s.name}</td>
                            <td className="px-5 py-3">
                              <span className="text-xs font-black px-2 py-0.5 rounded-lg"
                                style={s.category === 'comics' ? { background: '#FEF3C7', color: '#92400E' }
                                  : s.category === 'cards' ? { background: '#E0F2FE', color: '#0369A1' }
                                  : { background: '#EDE9FE', color: '#5B21B6' }}>
                                {s.category}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-amber-500 font-bold">{s.rating}★</td>
                            <td className="px-5 py-3 text-zinc-400 text-xs font-mono">{s.address?.split(',')[1]?.trim()}</td>
                            <td className="px-5 py-3 text-zinc-400 text-xs italic truncate max-w-[200px]">{s.hot_find || '—'}</td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => { setEditingShop(s.id); setEditFields({ name: s.name, hot_find: s.hot_find, hours: s.hours, category: s.category, rating: s.rating, description: s.description }) }}
                                  className="text-zinc-400 hover:text-zinc-700 transition-colors">
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button onClick={() => deleteShop(s.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {editingShop === s.id && (
                            <tr className="bg-zinc-50 border-b border-zinc-100">
                              <td colSpan={6} className="px-5 py-4">
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <label className="block text-xs font-bold text-zinc-400 mb-1">Name</label>
                                    <input value={editFields.name || ''} onChange={e => setEditFields({ ...editFields, name: e.target.value })}
                                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-zinc-400 mb-1">Category</label>
                                    <select value={editFields.category || ''} onChange={e => setEditFields({ ...editFields, category: e.target.value })}
                                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none">
                                      {['cards', 'comics', 'collectibles'].map(c => <option key={c}>{c}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-zinc-400 mb-1">Hot Find</label>
                                    <input value={editFields.hot_find || ''} onChange={e => setEditFields({ ...editFields, hot_find: e.target.value })}
                                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-zinc-400 mb-1">Hours</label>
                                    <input value={editFields.hours || ''} onChange={e => setEditFields({ ...editFields, hours: e.target.value })}
                                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-zinc-400 mb-1">Rating</label>
                                    <input type="number" step="0.1" min="1" max="5" value={editFields.rating || ''} onChange={e => setEditFields({ ...editFields, rating: parseFloat(e.target.value) })}
                                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-zinc-400 mb-1">Description</label>
                                    <input value={editFields.description || ''} onChange={e => setEditFields({ ...editFields, description: e.target.value })}
                                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => saveShop(s.id)} className="px-4 py-2 rounded-xl text-xs font-black text-white flex items-center gap-1"
                                    style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                                    <Check className="h-3 w-3" /> Save
                                  </button>
                                  <button onClick={() => { setEditingShop(null); setEditFields({}) }} className="px-4 py-2 rounded-xl text-xs font-black bg-zinc-200 text-zinc-600 flex items-center gap-1">
                                    <X className="h-3 w-3" /> Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* USERS */}
          {tab === 'users' && (
            <div className="space-y-3">
              <h2 className="font-black text-xl">Users ({filteredUsers.length})</h2>
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs font-bold uppercase text-zinc-400">
                      <th className="text-left px-5 py-3">Username</th>
                      <th className="text-left px-5 py-3">Role</th>
                      <th className="text-left px-5 py-3">Tier</th>
                      <th className="text-left px-5 py-3">Joined</th>
                      <th className="text-right px-5 py-3">Change Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-all">
                        <td className="px-5 py-3 font-bold">@{u.username}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                            style={u.role === 'merchant' ? { background: '#EDE9FE', color: '#5B21B6' } : { background: '#F3F4F6', color: '#6B7280' }}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-black px-2 py-0.5 rounded-lg"
                            style={u.tier === 'elite' ? { background: '#EDE9FE', color: '#5B21B6' }
                              : u.tier === 'store' ? { background: '#FEF3C7', color: '#92400E' }
                              : { background: '#F3F4F6', color: '#6B7280' }}>
                            {u.tier}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-zinc-400 text-xs font-mono">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <select value={u.tier} onChange={e => updateUserTier(u.id, e.target.value)}
                            className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 outline-none font-bold">
                            {['free', 'elite', 'store'].map(t => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REVIEWS */}
          {tab === 'reviews' && (
            <div className="space-y-3">
              <h2 className="font-black text-xl">Reviews ({filteredReviews.length})</h2>
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs font-bold uppercase text-zinc-400">
                      <th className="text-left px-5 py-3">User</th>
                      <th className="text-left px-5 py-3">Comment</th>
                      <th className="text-left px-5 py-3">Rating</th>
                      <th className="text-left px-5 py-3">Date</th>
                      <th className="text-right px-5 py-3">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReviews.map(r => (
                      <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-all">
                        <td className="px-5 py-3 font-bold text-xs">@{r.username}</td>
                        <td className="px-5 py-3 text-zinc-600 italic max-w-xs truncate">"{r.comment}"</td>
                        <td className="px-5 py-3 text-amber-500 font-bold">{r.rating}★</td>
                        <td className="px-5 py-3 text-zinc-400 text-xs font-mono">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => deleteReview(r.id)} className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TRADES */}
          {tab === 'trades' && (
            <div className="space-y-3">
              <h2 className="font-black text-xl">Trade Posts ({filteredTrades.length})</h2>
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs font-bold uppercase text-zinc-400">
                      <th className="text-left px-5 py-3">User</th>
                      <th className="text-left px-5 py-3">Offering</th>
                      <th className="text-left px-5 py-3">Seeking</th>
                      <th className="text-left px-5 py-3">Date</th>
                      <th className="text-right px-5 py-3">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map(t => (
                      <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-all">
                        <td className="px-5 py-3 font-bold text-xs">@{t.username}</td>
                        <td className="px-5 py-3 font-medium">{t.offer}</td>
                        <td className="px-5 py-3 font-medium" style={{ color: '#E0533C' }}>{t.look_for}</td>
                        <td className="px-5 py-3 text-zinc-400 text-xs font-mono">{new Date(t.created_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => deleteTrade(t.id)} className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
