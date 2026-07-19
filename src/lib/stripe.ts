import Stripe from 'stripe'

// Fixa à versão que o webhook de produção tem configurada na Stripe (não pode ser mudada
// por endpoint nesta conta) — mantém o SDK e os payloads recebidos na mesma versão da API,
// evitando divergência de forma dos campos entre o que o código espera e o que chega.
export function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' })
}
