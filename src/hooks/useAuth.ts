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
  referral_code?: string | null
  referred_by?: string | null
  is_founding_member?: boolean
  founding_member_number?: number | null
  op_multiplier?: number
}

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<DbProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) ensureProfile(session.user)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) ensureProfile(session.user)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Runs for EVERY valid session, not just the in-app "enter the 6-digit
  // code" flow. This matters because Supabase can also confirm a brand-new
  // signup via a clickable email link (depending on how the "Confirm signup"
  // template is configured in the Supabase dashboard) -- that path never goes
  // through verifyOtp() below, so without this fallback, a user who clicks
  // the link instead of entering a code would end up with a valid session
  // but no row in public.profiles: invisible in Admin, no username, forever.
  async function ensureProfile(authUser: any) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle()
    if (existing) {
      setProfile(existing)
      return
    }
    const role = (authUser.user_metadata?.role as UserRole) || 'hunter'
    const { data: created } = await supabase
      .from('profiles')
      .insert({
        id: authUser.id,
        username: (authUser.email || '').split('@')[0],
        role,
        tier: 'free',
      })
      .select('*')
      .maybeSingle()
    if (created) setProfile(created)
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
    if (data.user) await ensureProfile(data.user)
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
