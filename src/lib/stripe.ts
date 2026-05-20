export type PriceTier = 'elite' | 'store'

export async function startCheckout(_tier: PriceTier, _email: string, _userId: string): Promise<{ error: string | null }> {
  alert('Payments coming soon!')
  return { error: null }
}