import { loadStripe } from '@stripe/stripe-js'

export type PriceTier = 'elite' | 'store'

const PRICE_IDS: Record<PriceTier, string> = {
  elite: import.meta.env.VITE_STRIPE_ELITE_PRICE_ID || '',
  store: import.meta.env.VITE_STRIPE_STORE_PRICE_ID || '',
}

export async function startCheckout(tier: PriceTier, customerEmail: string, userId: string): Promise<{ error: string | null }> {
  try {
    const priceId = PRICE_IDS[tier]
    if (!priceId) return { error: 'Price ID not configured. Check environment variables.' }

    const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY
    if (!stripeKey) return { error: 'Stripe public key not configured.' }

    const stripe = await loadStripe(stripeKey)
    if (!stripe) return { error: 'Stripe failed to load.' }

    const result = await stripe.redirectToCheckout({
      lineItems: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      customerEmail,
      successUrl: `${window.location.origin}/?checkout=success&tier=${tier}&uid=${userId}`,
      cancelUrl: `${window.location.origin}/?checkout=cancelled`,
      clientReferenceId: userId,
    })

    if (result.error) return { error: result.error.message || 'Checkout failed' }
    return { error: null }
  } catch (err: any) {
    return { error: err.message || 'Unexpected error' }
  }
}
