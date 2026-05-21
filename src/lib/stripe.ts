import { supabase } from './supabase'

export type PriceTier = 'elite' | 'store'

const PAYMENT_LINKS: Record<PriceTier, string> = {
  elite: 'https://buy.stripe.com/test_cNiaEZ8PZ84X1yidhx2go00',
  store: 'https://buy.stripe.com/test_bJebJ3eaj1Gz2Cm5P52go01',
}

export async function startCheckout(
  tier: PriceTier,
  customerEmail: string,
  userId: string
): Promise<{ error: string | null }> {

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
    // Upgrade directly — no payment needed for first 6 months
    await supabase
      .from('profiles')
      .update({
        tier: tier === 'store' ? 'store' : 'elite',
        role: tier === 'store' ? 'merchant' : 'hunter',
      })
      .eq('id', userId)

    return { error: null }
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