import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '')

export type PriceTier = 'elite' | 'store'

const PRICE_IDS: Record<PriceTier, string> = {
  elite: import.meta.env.VITE_STRIPE_ELITE_PRICE_ID || '',
  store: import.meta.env.VITE_STRIPE_STORE_PRICE_ID || '',
}

export async function startCheckout(tier: PriceTier, customerEmail: string, userId: string): Promise<{ error: string | null }> {
  const stripe = await stripePromise
  if (!stripe) return { error: 'Stripe failed to load' }

  const priceId = PRICE_IDS[tier]
  if (!priceId) return { error: 'Price ID not configured' }

  const { error } = await stripe.redirectToCheckout({
    lineItems: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    customerEmail,
    successUrl: `${window.location.origin}/?checkout=success&tier=${tier}&uid=${userId}`,
    cancelUrl: `${window.location.origin}/?checkout=cancelled`,
    clientReferenceId: userId,
  })

  return { error: error?.message || null }
}
