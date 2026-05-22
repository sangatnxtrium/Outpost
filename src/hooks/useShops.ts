import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useShops() {
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchShops() }, [])

  async function fetchShops() {
    setLoading(true)
    const { data, error } = await supabase
      .from('shops')
      .select('*, events(*)')
      .order('rating', { ascending: false })
      .limit(10000)
      .limit(10000)
    if (error) setError(error.message)
    else setShops(data || [])
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

  return { shops, loading, error, refetch: fetchShops, updateHotFind }
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

  async function addTradePost(userId: string, username: string, offer: string, lookFor: string) {
    const { data, error } = await supabase
      .from('trade_posts')
      .insert({ user_id: userId, username, offer, look_for: lookFor })
      .select()
      .single()
    if (data) setTradePosts(prev => [data, ...prev])
    return { error: error?.message || null }
  }

  return { tradePosts, addTradePost }
}

export function useVault(userId: string | null) {
  const [vaultItems, setVaultItems] = useState<any[]>([])

  useEffect(() => {
    if (!userId) return
    supabase
      .from('vault_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setVaultItems(data || []))
  }, [userId])

  async function addVaultItem(userId: string, name: string, estValue: number) {
    const { data, error } = await supabase
      .from('vault_items')
      .insert({ user_id: userId, name, est_value: estValue })
      .select()
      .single()
    if (data) setVaultItems(prev => [...prev, data])
    return { error: error?.message || null }
  }

  return { vaultItems, addVaultItem }
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
    supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true })
      .then(({ data }) => {
        setEvents(data || [])
        setLoading(false)
      })
  }, [])

  return { events, loading }
}