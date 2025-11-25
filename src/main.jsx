import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import './index.css'

// Páginas (iremos usar as versões em src ou stubs)
import Dashboard from './pages/Dashboard'
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
import { base44 } from './api/base44Client'
import LandingPage from './pages/Landing'

const queryClient = new QueryClient()

// Persist TanStack Query cache to localStorage for instant first paint between reloads
const localStoragePersister = {
  persistClient: async (client) => {
    try { window.localStorage.setItem('tanstack-query', JSON.stringify(client)) } catch {}
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
    try { window.localStorage.removeItem('tanstack-query') } catch {}
  },
}

persistQueryClient({ queryClient, persister: localStoragePersister, maxAge: 1000 * 60 * 60 * 24 })

// Prefetch Settings to hydrate cache early (logo loads fast on Dashboard)
base44.entities.Settings.list().then(r => {
  const first = r?.[0] || null
  queryClient.setQueryData(['settings'], first)
})

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireSubscription({ children }) {
  const { user } = useAuth()
  const [allowed, setAllowed] = useState(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!user?.email) { setAllowed(false); return }
      const email = String(user.email || '').toLowerCase()
      const builtinAdmins = ['admin@erp.local', 'henrico.pierdona@gmail.com']
      const envAdmins = String(import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      const adminEmails = Array.from(new Set([...builtinAdmins, ...envAdmins]))
      const testEmails = String(import.meta.env.VITE_TEST_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      if (adminEmails.includes(email) || testEmails.includes(email)) { setAllowed(true); return }
      try {
        const params = new URLSearchParams(window.location.search)
        const status = params.get('status')
        const localSub = window.localStorage.getItem('subscribed')
        if (status === 'success' || localSub === 'true') { setAllowed(true); return }
      } catch {}
      try {
        const API = import.meta.env.VITE_API_URL || 'http://localhost:4242'
        const res = await fetch(`${API}/subscription-status?email=${encodeURIComponent(email)}`)
        const json = await res.json()
        if (!cancelled) setAllowed(Boolean(json?.active))
      } catch {
        if (!cancelled) setAllowed(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [user])

  if (allowed === null) return null
  if (!allowed) return <Navigate to="/trial" replace />
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
              path="/dashboard"
              element={<RequireAuth><RequireSubscription><Layout currentPageName="Dashboard"><Dashboard /></Layout></RequireSubscription></RequireAuth>}
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
              element={<RequireAuth><Billing /></RequireAuth>}
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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
