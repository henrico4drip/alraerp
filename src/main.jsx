import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import './index.css'

// Páginas (iremos usar as versões em src ou stubs)
import Dashboard from './pages/Dashboard'
import Dashboard2 from './pages/Dashboard2'
import Layout from './Layout'
import Cashier from './pages/Cashier'
import Sales from './pages/Sales'
import Customers from './pages/Customers'
import Inventory from './pages/Inventory'
import Reports from './pages/Reports'
import Marketing from './pages/stubs/Marketing'
import Settings from './pages/Settings'
import Billing from './pages/Billing'
import Login from './pages/Login'
import TrialOffer from './pages/TrialOffer'
import { AuthProvider, useAuth } from './auth/AuthContext'
import CashierProducts from './pages/CashierProducts'
import CashierPayment from './pages/CashierPayment'
import { CashierProvider } from './context/CashierContext'
import Payments from './pages/Payments'
import LandingPage from './pages/Landing'
import Support from './pages/Support'
import { base44 } from './api/base44Client'

const queryClient = new QueryClient()

// Persist TanStack Query cache to localStorage for instant first paint between reloads
const localStoragePersister = {
  persistClient: async (client) => {
    try { window.localStorage.setItem('tanstack-query', JSON.stringify(client)) } catch { }
  },
  restoreClient: async () => {
    try {
      const raw = window.localStorage.getItem('tanstack-query')
      return raw ? JSON.parse(raw) : undefined
    } catch {
      return undefined
    }
  },
  removeClient: async () => {
    try { window.localStorage.removeItem('tanstack-query') } catch { }
  },
}

persistQueryClient({ queryClient, persister: localStoragePersister, maxAge: 1000 * 60 * 60 * 24 })

// Prefetch Settings to hydrate cache early (logo loads fast on Dashboard)
base44.entities.Settings.list().then(r => {
  const arr = Array.isArray(r) ? r : []
  queryClient.setQueryData(['settings'], arr)
}).catch(() => {
  try {
    const raw = window.localStorage.getItem('settings')
    const arr = raw ? JSON.parse(raw) : []
    queryClient.setQueryData(['settings'], Array.isArray(arr) ? arr : [])
  } catch { }
})

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

import SubscriptionLockOverlay from './components/SubscriptionLockOverlay'

function RequireSubscription({ children }) {
  const { user } = useAuth()
  const [allowed, setAllowed] = useState(null)

  // Efeito original de verificação (mantido, mas sem o Navigate no corpo do componente)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      // (Lógica original de verificação permanece idêntica, apenas setando setAllowed)
      if (!user?.email) { setAllowed(false); return }
      const email = String(user.email || '').toLowerCase()
      // ... (código existente de verificação de admins, trial, stripe) ...
      // Para brevidade do diff, vou colar a lógica inteira abaixo no replacement, 
      // mas precisamos ter cuidado pra não perder nada. 
      // Como o replace tool pede TargetContent exato, vamos substituir a função inteira 
      // ou parte dela. 

      const builtinAdmins = ['admin@erp.local', 'henrico.pierdona@gmail.com']
      const envAdmins = String(import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      const adminEmails = Array.from(new Set([...builtinAdmins, ...envAdmins]))
      const testEmails = String(import.meta.env.VITE_TEST_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      if (adminEmails.includes(email) || testEmails.includes(email)) { setAllowed(true); return }
      try {
        const params = new URLSearchParams(window.location.search)
        const status = params.get('status')
        const localSub = window.localStorage.getItem('subscribed')
        const trialUntilRaw = window.localStorage.getItem('trial_until')
        const trialUntil = trialUntilRaw ? new Date(trialUntilRaw).getTime() : 0
        const now = Date.now()
        if (status === 'success') {
          try { window.localStorage.setItem('subscribed', 'true') } catch { }
          setAllowed(true); return
        }
        if (localSub === 'true') { setAllowed(true); return }
        if (trialUntil > now) { setAllowed(true); return }
      } catch { }
      try {
        const API = import.meta.env.VITE_API_URL || 'http://localhost:4242'
        let ok = false
        try {
          const res = await fetch(`${API}/subscription-status?email=${encodeURIComponent(email)}`)
          const json = await res.json()
          ok = Boolean(json?.active)
        } catch { }
        if (!ok) {
          try {
            const alt = `${window.location.origin}/subscription-status?email=${encodeURIComponent(email)}`
            const res2 = await fetch(alt)
            const json2 = await res2.json()
            ok = Boolean(json2?.active)
          } catch { }
        }
        if (!cancelled) setAllowed(ok)
      } catch {
        if (!cancelled) setAllowed(false)
      }
      if (allowed === null && window.localStorage.getItem('subscribed') !== 'true') {
        try {
          const settings = await base44.entities.Settings.list()
          const trialUntil = settings?.[0]?.trial_until ? new Date(settings[0].trial_until).getTime() : 0
          if (trialUntil && trialUntil > Date.now()) {
            if (!cancelled) setAllowed(true)
          }
        } catch { }
      }
    }
    run()
    return () => { cancelled = true }
  }, [user])

  if (allowed === null) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>

  if (!allowed) {
    // ESTADO DE BLOQUEIO: Blur no app + Overlay
    return (
      <div className="relative w-full min-h-screen bg-gray-100 overflow-hidden">
        {/* Camada do App (Borrada e Inacessível) */}
        <div className="absolute inset-0 filter blur-[8px] opacity-50 pointer-events-none select-none transform scale-105 z-0">
          {children}
        </div>

        {/* Overlay de Bloqueio */}
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <SubscriptionLockOverlay />
        </div>
      </div>
    )
  }

  return children
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={<LandingPage />}
            />
            <Route
              path="/support"
              element={<Support />}
            />
            <Route
              path="/dashboard"
              element={<RequireAuth><RequireSubscription><Layout currentPageName="Dashboard"><Dashboard /></Layout></RequireSubscription></RequireAuth>}
            />
            <Route
              path="/dashboard2"
              element={<RequireAuth><RequireSubscription><Dashboard2 /></RequireSubscription></RequireAuth>}
            />
            <Route
              path="/cashier"
              element={<RequireAuth><Navigate to="/cashier/products" replace /></RequireAuth>}
            />
            <Route
              path="/cashier/products"
              element={<RequireAuth><RequireSubscription><Layout currentPageName="Cashier"><CashierProvider><CashierProducts /></CashierProvider></Layout></RequireSubscription></RequireAuth>}
            />
            <Route
              path="/cashier/payment"
              element={<RequireAuth><RequireSubscription><Layout currentPageName="Cashier"><CashierProvider><CashierPayment /></CashierProvider></Layout></RequireSubscription></RequireAuth>}
            />
            <Route
              path="/sales"
              element={<RequireAuth><RequireSubscription><Layout currentPageName="Sales"><Sales /></Layout></RequireSubscription></RequireAuth>}
            />
            <Route
              path="/customers"
              element={<RequireAuth><RequireSubscription><Layout currentPageName="Customers"><Customers /></Layout></RequireSubscription></RequireAuth>}
            />
            <Route
              path="/inventory"
              element={<RequireAuth><RequireSubscription><Layout currentPageName="Inventory"><Inventory /></Layout></RequireSubscription></RequireAuth>}
            />
            <Route
              path="/reports"
              element={<RequireAuth><RequireSubscription><Layout currentPageName="Reports"><Reports /></Layout></RequireSubscription></RequireAuth>}
            />
            <Route
              path="/marketing"
              element={<RequireAuth><RequireSubscription><Layout currentPageName="Marketing"><Marketing /></Layout></RequireSubscription></RequireAuth>}
            />
            <Route
              path="/settings"
              element={<RequireAuth><RequireSubscription><Layout currentPageName="Settings"><Settings /></Layout></RequireSubscription></RequireAuth>}
            />
            <Route
              path="/billing"
              element={<Billing />}
            />
            <Route
              path="/trial"
              element={<RequireAuth><TrialOffer /></RequireAuth>}
            />
            <Route
              path="/payments"
              element={<RequireAuth><RequireSubscription><Layout currentPageName="Payments"><Payments /></Layout></RequireSubscription></RequireAuth>}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => { })
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => { })
}
