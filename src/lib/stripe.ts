export type PriceTier = 'elite' | 'store'

const PAYMENT_LINKS: Record<PriceTier, string> = {
  elite: 'https://buy.stripe.com/test_cNiaEZ8PZ84X1yidhx2go00',
  store: 'https://buy.stripe.com/test_bJebJ3eaj1Gz2Cm5P52go01',
}

export async function startCheckout(tier: PriceTier, customerEmail: string, userId: string): Promise<{ error: string | null }> {
  const link = PAYMENT_LINKS[tier]
  const url = new URL(link)
  url.searchParams.set('client_reference_id', userId)
  url.searchParams.set('prefilled_email', customerEmail)
  window.location.href = url.toString()
  return { error: null }
}
