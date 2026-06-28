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
        .select('id, name, address, category, categories, hot_find, rating, tags, lat, lng, hours, description, phone, website, owner_id, image_url')
        .order('rating', { ascending: false })
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

  useEffect(() => {
    supabase
      .from('trade_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setTradePosts(data || []))
  }, [])

  async function addTradePost(userId: string, username: string, offer: string, lookFor: string, imageUrl?: string | null, lat?: number | null, lng?: number | null) {
    const { data, error } = await supabase
      .from('trade_posts')
      .insert({ user_id: userId, username, offer, look_for: lookFor, image_url: imageUrl || null, lat: lat ?? null, lng: lng ?? null })
      .select()
      .single()
    if (data) setTradePosts(prev => [data, ...prev])
    return { error: error?.message || null }
  }

  async function deleteTradePost(id: string) {
    await supabase.from('trade_posts').delete().eq('id', id)
    setTradePosts(prev => prev.filter((t: any) => t.id !== id))
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

  return { tradePosts, addTradePost, deleteTradePost, fetchTradeComments, addTradeComment, deleteTradeComment }
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

  const fetchListings = () => {
    setLoading(true)
    supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setListings(data || []); setLoading(false) })
  }

  useEffect(() => { fetchListings() }, [])

  async function uploadPhoto(file: File, userId: string): Promise<string | null> {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('listings').upload(path, file, { upsert: false, contentType: file.type })
    if (error) { console.error('upload:', error.message); return null }
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

  return { listings, loading, uploadPhoto, createListing, deleteListing, refetch: fetchListings, fetchComments, addComment, deleteComment }
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
