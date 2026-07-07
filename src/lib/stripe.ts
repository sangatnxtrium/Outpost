import { supabase } from './supabase'

export type PriceTier = 'elite' | 'store'

const PAYMENT_LINKS: Record<PriceTier, string> = {
  elite: 'https://buy.stripe.com/bJecN77LVbh93Gq1yP2go02',
  store: 'https://buy.stripe.com/5kQ6oJ3vFcld7WGb9p2go03',
}

// Everyone gets Elite/Store free until this date, regardless of when they
// signed up (previously this was 6 months from each user's own signup date —
// changed 2026-07 to a fixed cutoff instead, to prioritize growing supply
// before introducing payment friction, matching the "free while building
// critical mass" approach other marketplaces have used). To extend the free
// period later, just move this date forward.
const FREE_UNTIL = new Date('2028-01-01T00:00:00Z')

export async function startCheckout(
  tier: PriceTier,
  customerEmail: string,
  userId: string
): Promise<{ error: string | null, upgraded?: boolean }> {

  const isFreeWindow = new Date() < FREE_UNTIL

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

  // After the free window — redirect to Stripe
  const link = PAYMENT_LINKS[tier]
  if (!link) return { error: 'Payment link not configured' }

  const url = new URL(link)
  url.searchParams.set('client_reference_id', userId)
  url.searchParams.set('prefilled_email', customerEmail)
  window.location.href = url.toString()

  return { error: null }
}
