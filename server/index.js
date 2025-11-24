import express from 'express'
import cors from 'cors'
import Stripe from 'stripe'

const app = express()
app.use(cors())
app.use(express.json())

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const PUBLISHABLE_KEY = process.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null
const APP_URL = process.env.APP_URL || ''

function getFrontendOrigin(req) {
  if (APP_URL) return APP_URL
  const origin = req.headers.origin
  if (origin) return origin
  const referer = req.headers.referer || req.headers.referrer
  if (referer) {
    try {
      const u = new URL(referer)
      return `${u.protocol}//${u.host}`
    } catch (_) {}
  }
  return 'http://localhost:5174'
}

// Health
app.get('/health', (req, res) => {
  res.json({ ok: true })
})

// Publishable key for front if needed
app.get('/config', (req, res) => {
  res.json({ publishableKey: PUBLISHABLE_KEY })
})

// Create Checkout Session for subscription
app.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: { message: 'Stripe not configured' } })
    const { plan = 'monthly', user_id } = req.body || {}

    const isAnnual = plan === 'annual'
    const amount = isAnnual ? 45984 : 4790 // em centavos BRL
    const productName = isAnnual ? 'ERP Plano Anual (20% OFF)' : 'ERP Plano Mensal'
    const interval = isAnnual ? 'year' : 'month'

    // Métodos suportados para assinaturas: cartão (inclui Apple Pay/Google Pay quando elegível)
    const payment_method_types = ['card']

    const FRONTEND = getFrontendOrigin(req)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types,
      line_items: [
        {
          price_data: {
            currency: 'brl',
            unit_amount: amount,
            product_data: { name: productName },
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      metadata: user_id ? { user_id } : undefined,
      success_url: `${FRONTEND}/dashboard`,
      cancel_url: `${FRONTEND}/billing?status=cancel`,
    })

    res.json({ id: session.id, url: session.url })
  } catch (err) {
    console.error('Stripe error:', err)
    res.status(400).json({ error: { message: err.message } })
  }
})

// Customer Portal (requires customer id)
app.post('/create-portal-session', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: { message: 'Stripe not configured' } })
    const { customerId } = req.body || {}
    if (!customerId) return res.status(400).json({ error: { message: 'customerId required' } })

    const FRONTEND = getFrontendOrigin(req)
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND}/settings`,
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('Portal error:', err)
    res.status(400).json({ error: { message: err.message } })
  }
})

// Create one-time Payment Checkout (Pix/Boleto/Card) for non-recurring access
app.post('/create-payment-session', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: { message: 'Stripe not configured' } })
    const { plan = 'monthly', user_id } = req.body || {}
    const isAnnual = plan === 'annual'
    const amount = isAnnual ? 45984 : 4790 // centavos BRL
    const productName = isAnnual ? 'ERP Plano Anual (Pagamento Avulso)' : 'ERP Plano Mensal (Pagamento Avulso)'

    const FRONTEND = getFrontendOrigin(req)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'boleto', 'pix'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            unit_amount: amount,
            product_data: { name: productName },
          },
          quantity: 1,
        },
      ],
      metadata: user_id ? { user_id, plan } : { plan },
      success_url: `${FRONTEND}/dashboard`,
      cancel_url: `${FRONTEND}/billing?status=cancel`,
    })

    res.json({ id: session.id, url: session.url })
  } catch (err) {
    console.error('Stripe payment error:', err)
    res.status(400).json({ error: { message: err.message } })
  }
})

// Create Checkout Session for subscription with free trial
app.post('/create-trial-session', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: { message: 'Stripe not configured' } })
    const { plan = 'monthly', user_id } = req.body || {}
    const isAnnual = plan === 'annual'
    const amount = isAnnual ? 45984 : 4790
    const productName = isAnnual ? 'ERP Plano Anual (Trial 7 dias)' : 'ERP Plano Mensal (Trial 7 dias)'
    const interval = isAnnual ? 'year' : 'month'

    const FRONTEND = getFrontendOrigin(req)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            unit_amount: amount,
            product_data: { name: productName },
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      subscription_data: { trial_period_days: 7 },
      metadata: user_id ? { user_id, trial: '7d' } : { trial: '7d' },
      success_url: `${FRONTEND}/dashboard`,
      cancel_url: `${FRONTEND}/billing?status=cancel`,
    })

    res.json({ id: session.id, url: session.url })
  } catch (err) {
    console.error('Stripe trial error:', err)
    res.status(400).json({ error: { message: err.message } })
  }
})

// Check subscription status by email (active subscription exists)
app.get('/subscription-status', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: { message: 'Stripe not configured' } })
    const email = String(req.query.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ error: { message: 'email required' } })

    // Try search API first (more accurate); fallback to list
    let customer = null
    try {
      const search = await stripe.customers.search({ query: `email:'${email}'` })
      customer = search?.data?.[0] || null
    } catch (_) {
      const list = await stripe.customers.list({ limit: 50 })
      customer = (list?.data || []).find(c => (c.email || '').toLowerCase() === email) || null
    }

    if (!customer) return res.json({ active: false, customerFound: false })

    const subsAll = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 5 })
    const hasAllowed = Array.isArray(subsAll?.data) && subsAll.data.some(s => ['active', 'trialing'].includes(String(s.status)))
    res.json({ active: hasAllowed, customerFound: true })
  } catch (err) {
    console.error('Subscription status error:', err)
    res.status(400).json({ error: { message: err.message } })
  }
})

const PORT = process.env.PORT || 4242
app.listen(PORT, () => {
  console.log(`Stripe server listening on http://localhost:${PORT}`)
})
