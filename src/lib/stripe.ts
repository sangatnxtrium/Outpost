import { supabase } from './supabase'

export type PriceTier = 'elite' | 'store'

const PAYMENT_LINKS: Record<PriceTier, string> = {
  elite: 'https://buy.stripe.com/bJecN77LVbh93Gq1yP2go02',
  store: 'https://buy.stripe.com/5kQ6oJ3vFcld7WGb9p2go03',
}

export async function startCheckout(
  tier: PriceTier,
  customerEmail: string,
  userId: string
): Promise<{ error: string | null, upgraded?: boolean }> {

  // Get the user's signup date
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single()

  let isFreeWindow = false

  if (profile?.created_at) {
    const signupDate = new Date(profile.created_at)
    const sixMonthsLater = new Date(signupDate)
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)
    isFreeWindow = new Date() < sixMonthsLater
  }

  if (isFreeWindow) {
    const { error } = await supabase
      .from('profiles')
      .update({
        tier: tier === 'store' ? 'store' : 'elite',
        role: tier === 'store' ? 'merchant' : 'hunter',
      })
      .eq('id', userId)

    if (error) return { error: error.message }
    return { error: null, upgraded: true }
  }

  // After 6 months — redirect to Stripe
  const link = PAYMENT_LINKS[tier]
  if (!link) return { error: 'Payment link not configured' }

  const url = new URL(link)
  url.searchParams.set('client_reference_id', userId)
  url.searchParams.set('prefilled_email', customerEmail)
  window.location.href = url.toString()

  return { error: null }
}