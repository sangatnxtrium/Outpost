import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useShops() {
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchShops() }, [])

  async function fetchShops() {
    setLoading(true)
    // Fetch all shops in batches of 1000
    let allShops: any[] = []
    let from = 0
    const batchSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from('shops')
        .select('id, name, address, category, categories, hot_find, rating, tags, lat, lng, hours, description, phone, website, owner_id, image_url, gallery, city_slug, name_slug')
        .order('rating', { ascending: false })
        .order('id', { ascending: true }) // stable tiebreaker — without this, rows with tied ratings
        // (very common here) can land in more than one page and get fetched/rendered twice
        .range(from, from + batchSize - 1)
      if (error) { setError(error.message); break }
      if (!data || data.length === 0) break
      allShops = [...allShops, ...data]
      if (data.length < batchSize) break
      from += batchSize
    }
    setShops(allShops)
    setLoading(false)
  }

  async function updateHotFind(shopId: string, hotFind: string) {
    const { error } = await supabase
      .from('shops')
      .update({ hot_find: hotFind })
      .eq('id', shopId)
    if (!error) fetchShops()
    return { error: error?.message || null }
  }

  async function updateShop(shopId: string, fields: any) {
    const { error } = await supabase
      .from('shops')
      .update(fields)
      .eq('id', shopId)
    if (!error) fetchShops()
    return { error: error?.message || null }
  }

  return { shops, loading, error, refetch: fetchShops, updateHotFind, updateShop }
}

export function useReviews(shopId: string) {
  const [reviews, setReviews] = useState<any[]>([])

  useEffect(() => {
    if (!shopId) return
    supabase
      .from('reviews')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setReviews(data || []))
  }, [shopId])

  async function addReview(shopId: string, userId: string, username: string, comment: string, rating: number) {
    const { data, error } = await supabase
      .from('reviews')
      .insert({ shop_id: shopId, user_id: userId, username, comment, rating })
      .select()
      .single()
    if (data) setReviews(prev => [data, ...prev])
    return { error: error?.message || null }
  }

  return { reviews, addReview }
}

export function useTradePosts() {
  const [tradePosts, setTradePosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('trade_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTradePosts(data || []); setLoading(false) })
  }, [])

  async function addTradePost(userId: string, username: string, offer: string, lookFor: string, imageUrl?: string | null, lat?: number | null, lng?: number | null, gallery?: string[]) {
    const { data, error } = await supabase
      .from('trade_posts')
      .insert({ user_id: userId, username, offer, look_for: lookFor, image_url: imageUrl || null, lat: lat ?? null, lng: lng ?? null, gallery: gallery || [] })
      .select()
      .single()
    if (data) setTradePosts(prev => [data, ...prev])
    return { error: error?.message || null }
  }

  async function deleteTradePost(id: string) {
    await supabase.from('trade_posts').delete().eq('id', id)
    setTradePosts(prev => prev.filter((t: any) => t.id !== id))
  }

  async function updateTradePost(id: string, fields: any): Promise<boolean> {
    const { data, error } = await supabase.from('trade_posts').update(fields).eq('id', id).select().single()
    if (error) { console.error('updateTradePost:', error.message); return false }
    if (data) setTradePosts(prev => prev.map((t: any) => t.id === id ? data : t))
    return true
  }

  async function fetchTradeComments(tradeId: string) {
    const { data } = await supabase
      .from('trade_comments')
      .select('*')
      .eq('trade_id', tradeId)
      .order('created_at', { ascending: true })
    return data || []
  }

  async function addTradeComment(payload: any) {
    const { error } = await supabase.from('trade_comments').insert(payload)
    return { error: error?.message || null }
  }

  async function deleteTradeComment(id: string) {
    await supabase.from('trade_comments').delete().eq('id', id)
  }

  return { tradePosts, loading, addTradePost, updateTradePost, deleteTradePost, fetchTradeComments, addTradeComment, deleteTradeComment }
}

// Offers on a single listing. RLS on listing_offers naturally scopes what
// comes back: the seller sees every offer on their own listing, a buyer sees
// only their own (one row per (listing, buyer) — a repeat offer after a
// decline/withdrawal reuses that same row via upsert instead of a new one).
export function useListingOffers(listingId: string, userId: string | null) {
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOffers = () => {
    if (!listingId || !userId) { setOffers([]); setLoading(false); return }
    setLoading(true)
    supabase
      .from('listing_offers')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setOffers(data || []); setLoading(false) })
  }

  useEffect(() => { fetchOffers() }, [listingId, userId])

  async function makeOffer(buyerId: string, amount: number, message: string) {
    const { error } = await supabase
      .from('listing_offers')
      .upsert(
        { listing_id: listingId, buyer_id: buyerId, amount, message: message || null, status: 'pending', counter_amount: null, counter_message: null },
        { onConflict: 'listing_id,buyer_id' }
      )
    if (!error) fetchOffers()
    return { error: error?.message || null }
  }

  async function sellerRespond(offerId: string, action: 'accepted' | 'declined' | 'countered', counterAmount?: number, counterMessage?: string) {
    const fields: any = { status: action }
    if (action === 'countered') { fields.counter_amount = counterAmount; fields.counter_message = counterMessage || null }
    const { error } = await supabase.from('listing_offers').update(fields).eq('id', offerId)
    if (!error) fetchOffers()
    return { error: error?.message || null }
  }

  async function buyerRespondToCounter(offerId: string, accept: boolean) {
    const offer = offers.find((o: any) => o.id === offerId)
    const fields: any = accept ? { status: 'accepted', amount: offer?.counter_amount } : { status: 'declined' }
    const { error } = await supabase.from('listing_offers').update(fields).eq('id', offerId)
    if (!error) fetchOffers()
    return { error: error?.message || null }
  }

  async function withdrawOffer(offerId: string) {
    const { error } = await supabase.from('listing_offers').update({ status: 'withdrawn' }).eq('id', offerId)
    if (!error) fetchOffers()
    return { error: error?.message || null }
  }

  return { offers, loading, makeOffer, sellerRespond, buyerRespondToCounter, withdrawOffer, refetch: fetchOffers }
}

export function useCheckins(shopId: string) {
  const [checkinCount, setCheckinCount] = useState(0)
  const [userCheckedIn, setUserCheckedIn] = useState(false)

  useEffect(() => {
    if (!shopId) return
    supabase
      .from('checkins')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .then(({ count }) => setCheckinCount(count || 0))
  }, [shopId])

  async function checkIn(userId: string, shopId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('checkins')
      .insert({ shop_id: shopId, user_id: userId })
    if (!error) {
      setCheckinCount(c => c + 1)
      setUserCheckedIn(true)
    }
    return { error: error?.message || null }
  }

  return { checkinCount, userCheckedIn, checkIn }
}

export function useNews() {
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('news_articles')
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(80)
      .then(({ data }) => {
        setArticles(data || [])
        setLoading(false)
      })
  }, [])

  return { articles, loading }
}

export function useEvents() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .gte('date', today)
      .order('date', { ascending: true })
      .then(({ data }) => {
        setEvents(data || [])
        setLoading(false)
      })
  }, [])

  return { events, loading }
}
export function useListings() {
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Fetches every listing regardless of status (active + sold) — the app
  // filters to active-only for the public browse grid, but a seller's own
  // "My Listings" view (and a sold item's own detail page/URL) needs to see
  // sold ones too.
  const fetchListings = () => {
    setLoading(true)
    supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setListings(data || []); setLoading(false) })
  }

  useEffect(() => { fetchListings() }, [])

  // Downscale + compress in the browser before upload. Phone photos are often
  // 5-15 MB (and sometimes HEIC); this turns them into ~200-400 KB JPEGs so
  // uploads are fast and universally viewable. Falls back to the original file
  // if the browser can't decode it (e.g. some HEIC).
  async function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<File> {
    if (!file.type.startsWith('image/')) return file
    // Hard guard: never let compression hang the upload. If anything stalls
    // (FileReader/Image never firing, HEIC decode, etc.), fall back to original.
    const compress = async (): Promise<File> => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = () => reject(new Error('read failed'))
        r.readAsDataURL(file)
      })
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error('decode failed'))
        i.src = dataUrl
      })
      let { width, height } = img
      if (!width || !height) return file
      if (Math.max(width, height) > maxEdge) {
        const scale = maxEdge / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      ctx.drawImage(img, 0, 0, width, height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob || blob.size >= file.size) return file
      return new File([blob], (file.name.replace(/\.[^.]+$/, '') || 'photo') + '.jpg', { type: 'image/jpeg' })
    }
    const timeout = new Promise<File>(resolve => setTimeout(() => resolve(file), 8000))
    try {
      return await Promise.race([compress(), timeout])
    } catch {
      return file
    }
  }

  async function uploadPhoto(file: File, userId: string): Promise<string | null> {
    const compressed = await compressImage(file)
    const ext = (compressed.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('listings').upload(path, compressed, { upsert: false, contentType: compressed.type })
    if (error) {
      console.error('upload:', error.message)
      alert('Photo upload failed: ' + error.message)
      return null
    }
    const { data } = supabase.storage.from('listings').getPublicUrl(path)
    return data.publicUrl
  }

  async function createListing(payload: any): Promise<boolean> {
    const { error } = await supabase.from('listings').insert(payload)
    if (error) { console.error('createListing:', error.message); return false }
    fetchListings()
    return true
  }

  async function deleteListing(id: string) {
    const { error } = await supabase.from('listings').delete().eq('id', id)
    if (!error) fetchListings()
  }

  async function updateListing(id: string, fields: any): Promise<boolean> {
    const { error } = await supabase.from('listings').update(fields).eq('id', id)
    if (error) { console.error('updateListing:', error.message); return false }
    fetchListings()
    return true
  }

  async function fetchComments(listingId: string) {
    const { data } = await supabase
      .from('listing_comments')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true })
    return data || []
  }

  async function addComment(payload: any) {
    const { error } = await supabase.from('listing_comments').insert(payload)
    return { error: error?.message || null }
  }

  async function deleteComment(id: string) {
    await supabase.from('listing_comments').delete().eq('id', id)
  }

  return { listings, loading, uploadPhoto, createListing, updateListing, deleteListing, refetch: fetchListings, fetchComments, addComment, deleteComment }
}

export function useFcbd(year: number) {
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchParticipants = () => {
    setLoading(true)
    supabase
      .from('fcbd_participation')
      .select('*, shops(id,name,address,lat,lng,image_url,category,rating)')
      .eq('year', year)
      .eq('participating', true)
      .then(({ data }) => { setParticipants(data || []); setLoading(false) })
  }

  useEffect(() => { fetchParticipants() }, [year])

  async function upsertParticipation(p: any) {
    const { error } = await supabase
      .from('fcbd_participation')
      .upsert({ ...p, updated_at: new Date().toISOString() }, { onConflict: 'shop_id,year' })
    if (!error) fetchParticipants()
    return { error: error?.message || null }
  }

  async function getMyParticipation(shopId: string) {
    const { data } = await supabase
      .from('fcbd_participation')
      .select('*')
      .eq('shop_id', shopId)
      .eq('year', year)
      .maybeSingle()
    return data
  }

  return { participants, loading, upsertParticipation, getMyParticipation, refetch: fetchParticipants }
}

export function useFcbdTitles(year: number) {
  const [titles, setTitles] = useState<any[]>([])

  const fetchTitles = () => {
    supabase
      .from('fcbd_titles')
      .select('*')
      .eq('year', year)
      .order('created_at', { ascending: true })
      .then(({ data }) => setTitles(data || []))
  }

  useEffect(() => { fetchTitles() }, [year])

  async function addTitle(t: any) {
    const { error } = await supabase.from('fcbd_titles').insert(t)
    if (!error) fetchTitles()
    return { error: error?.message || null }
  }

  async function deleteTitle(id: string) {
    const { error } = await supabase.from('fcbd_titles').delete().eq('id', id)
    if (!error) fetchTitles()
  }

  return { titles, addTitle, deleteTitle, refetch: fetchTitles }
}

export function useNotifications(userId: string | null) {
  const [items, setItems] = useState<any[]>([])

  const fetchNotifs = () => {
    if (!userId) { setItems([]); return }
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setItems(data || []))
  }

  useEffect(() => {
    fetchNotifs()
    if (!userId) return
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload: any) => setItems((prev: any[]) => [payload.new, ...prev]),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function markAllRead() {
    if (!userId) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    setItems(prev => prev.map((n: any) => ({ ...n, read: true })))
  }

  const unread = items.filter((n: any) => !n.read).length
  return { items, unread, refetch: fetchNotifs, markAllRead }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})

  const fetchSettings = () => {
    supabase.from('app_settings').select('*').then(({ data }) => {
      const m: Record<string, string> = {}
      ;(data || []).forEach((r: any) => { m[r.key] = r.value })
      setSettings(m)
    })
  }

  useEffect(() => { fetchSettings() }, [])

  async function saveSetting(key: string, value: string) {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
    if (!error) setSettings(prev => ({ ...prev, [key]: value }))
    return { error: error?.message || null }
  }

  return { settings, saveSetting, refetch: fetchSettings }
}

export function useFollows(userId: string | null) {
  const [following, setFollowing] = useState<string[]>([])
  const [followingProfiles, setFollowingProfiles] = useState<any[]>([])

  const fetchFollowing = () => {
    if (!userId) { setFollowing([]); return }
    supabase.from('user_follows').select('followed_id').eq('follower_id', userId).then(({ data }) => {
      setFollowing((data || []).map((r: any) => r.followed_id))
    })
  }

  useEffect(() => { fetchFollowing() }, [userId])

  // Keep the profile-card list (avatar/username, for the Profile tab's
  // "Following" section) in sync with the id list above.
  useEffect(() => {
    if (following.length === 0) { setFollowingProfiles([]); return }
    let active = true
    supabase.from('profiles').select('id, username, avatar_url').in('id', following).then(({ data }) => {
      if (active) setFollowingProfiles(data || [])
    })
    return () => { active = false }
  }, [following.join(',')])

  async function toggleFollow(targetUserId: string) {
    if (!userId || !targetUserId || targetUserId === userId) return
    const isFollowing = following.includes(targetUserId)
    setFollowing(prev => isFollowing ? prev.filter(id => id !== targetUserId) : [...prev, targetUserId])
    if (isFollowing) {
      const { error } = await supabase.from('user_follows').delete().eq('follower_id', userId).eq('followed_id', targetUserId)
      if (error) setFollowing(prev => [...prev, targetUserId])
    } else {
      const { error } = await supabase.from('user_follows').insert({ follower_id: userId, followed_id: targetUserId })
      if (error) setFollowing(prev => prev.filter(id => id !== targetUserId))
    }
  }

  return { following, followingProfiles, toggleFollow, refetch: fetchFollowing }
}

// Conversation list — derived client-side from the messages table, grouped
// by counterparty (same "fetch everything relevant, group in JS" approach
// already used for offers). Fine at this app's message volume.
export function useConversations(userId: string | null) {
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = async () => {
    if (!userId) { setConversations([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
    const rows = data || []
    const byCounterparty: Record<string, any> = {}
    for (const m of rows) {
      const counterpartyId = m.sender_id === userId ? m.recipient_id : m.sender_id
      if (!byCounterparty[counterpartyId]) {
        byCounterparty[counterpartyId] = { counterpartyId, lastMessage: m, unread: 0 }
      }
      if (m.recipient_id === userId && !m.read_at) byCounterparty[counterpartyId].unread++
    }
    const list = Object.values(byCounterparty)
    const ids = list.map((c: any) => c.counterpartyId)
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids)
      const profMap: Record<string, any> = {}
      ;(profs || []).forEach((p: any) => { profMap[p.id] = p })
      list.forEach((c: any) => { c.profile = profMap[c.counterpartyId] || null })
    }
    setConversations(list)
    setLoading(false)
  }

  useEffect(() => { fetchConversations() }, [userId])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`conversations:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${userId}` },
        () => fetchConversations())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const totalUnread = conversations.reduce((sum: number, c: any) => sum + c.unread, 0)
  return { conversations, loading, totalUnread, refetch: fetchConversations }
}

export function useMessages(userId: string | null, counterpartyId: string | null) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchThread = () => {
    if (!userId || !counterpartyId) { setMessages([]); setLoading(false); return }
    setLoading(true)
    supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${counterpartyId}),and(sender_id.eq.${counterpartyId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setMessages(data || []); setLoading(false) })
  }

  useEffect(() => { fetchThread() }, [userId, counterpartyId])

  useEffect(() => {
    if (!userId || !counterpartyId) return
    const channel = supabase
      .channel(`thread:${userId}:${counterpartyId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const m = payload.new
        if ((m.sender_id === userId && m.recipient_id === counterpartyId) || (m.sender_id === counterpartyId && m.recipient_id === userId)) {
          setMessages(prev => [...prev, m])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, counterpartyId])

  useEffect(() => {
    if (!userId || !counterpartyId) return
    supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('sender_id', counterpartyId).eq('recipient_id', userId).is('read_at', null).then(() => {})
  }, [userId, counterpartyId, messages.length])

  async function sendMessage(body: string) {
    if (!userId || !counterpartyId || !body.trim()) return { error: 'missing fields' }
    const { data, error } = await supabase.from('messages')
      .insert({ sender_id: userId, recipient_id: counterpartyId, body: body.trim() })
      .select().single()
    if (!error && data) setMessages(prev => (prev.some((m: any) => m.id === data.id) ? prev : [...prev, data]))
    return { error: error?.message || null }
  }

  return { messages, loading, sendMessage, refetch: fetchThread }
}

// Messages scoped to a single listing or trade — grouped by counterparty
// (a seller can have several buyers messaging about the same item; RLS
// already limits a non-owner's view to just their own thread). Powers the
// "Messages" section on a listing/trade detail page, replacing the old
// public Q&A comment thread.
export function useItemMessages(userId: string | null, itemId: string | null, itemType: 'listing' | 'trade') {
  const [threads, setThreads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const col = itemType === 'listing' ? 'listing_id' : 'trade_id'

  const fetchThreads = async () => {
    if (!userId || !itemId) { setThreads([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq(col, itemId)
      .order('created_at', { ascending: true })
    const rows = data || []
    const byCounterparty: Record<string, any> = {}
    for (const m of rows) {
      const counterpartyId = m.sender_id === userId ? m.recipient_id : m.sender_id
      if (!byCounterparty[counterpartyId]) byCounterparty[counterpartyId] = { counterpartyId, messages: [] }
      byCounterparty[counterpartyId].messages.push(m)
    }
    const list = Object.values(byCounterparty)
    const ids = list.map((t: any) => t.counterpartyId)
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids)
      const profMap: Record<string, any> = {}
      ;(profs || []).forEach((p: any) => { profMap[p.id] = p })
      list.forEach((t: any) => { t.profile = profMap[t.counterpartyId] || null })
    }
    setThreads(list)
    setLoading(false)
  }

  useEffect(() => { fetchThreads() }, [userId, itemId])

  useEffect(() => {
    if (!userId || !itemId) return
    const channel = supabase
      .channel(`item-msgs:${itemType}:${itemId}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const m = payload.new
        if (m[col] === itemId && (m.sender_id === userId || m.recipient_id === userId)) fetchThreads()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, itemId])

  async function sendItemMessage(recipientId: string, body: string) {
    if (!userId || !recipientId || !body.trim()) return { error: 'missing fields' }
    const payload: any = { sender_id: userId, recipient_id: recipientId, body: body.trim() }
    payload[col] = itemId
    const { error } = await supabase.from('messages').insert(payload)
    if (!error) fetchThreads()
    return { error: error?.message || null }
  }

  return { threads, loading, sendItemMessage, refetch: fetchThreads }
}
