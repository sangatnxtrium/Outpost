import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type UserRole = 'hunter' | 'merchant'

export interface DbProfile {
  id: string
  username: string
  role: UserRole
  tier: 'free' | 'elite' | 'store'
  stripe_customer_id: string | null
  display_name?: string | null
  avatar_url?: string | null
  banner_url?: string | null
  created_at: string
}

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<DbProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data)
  }

  async function sendOtp(email: string, role: UserRole): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { role },
        shouldCreateUser: true,
      },
    })
    return { error: error?.message || null }
  }

  async function verifyOtp(email: string, code: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    if (error) return { error: error.message }
    if (data.user) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()
      if (!existing) {
        const role = (data.user.user_metadata?.role as UserRole) || 'hunter'
        await supabase.from('profiles').insert({
          id: data.user.id,
          username: email.split('@')[0],
          role,
          tier: 'free',
        })
      }
    }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function updateProfile(fields: Partial<DbProfile>) {
    if (!user) return { error: 'Not signed in' }
    const { error } = await supabase.from('profiles').update(fields).eq('id', user.id)
    if (!error) setProfile(prev => (prev ? { ...prev, ...fields } : prev))
    return { error: error?.message || null }
  }

  return { user, profile, loading, sendOtp, verifyOtp, signOut, updateProfile }
}
