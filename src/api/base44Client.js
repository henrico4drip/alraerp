import { supabase } from '@/api/supabaseClient'

function makeStore(key) {
  const load = () => JSON.parse(localStorage.getItem(key) || '[]')
  const save = (data) => localStorage.setItem(key, JSON.stringify(data))
  const genId = () => Math.random().toString(36).slice(2)

  return {
    list: async (order) => {
      const arr = load()
      if (order === '-created_date') return arr.slice().reverse()
      return arr
    },
    create: async (obj) => {
      const arr = load()
      const item = { id: obj.id || genId(), created_date: new Date().toISOString(), ...obj }
      arr.push(item)
      save(arr)
      return item
    },
    update: async (id, patch) => {
      const arr = load()
      const idx = arr.findIndex(x => x.id === id)
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...patch }
        save(arr)
        return arr[idx]
      }
      throw new Error('Item not found')
    },
    delete: async (id) => {
      const arr = load()
      const idx = arr.findIndex(x => x.id === id)
      if (idx >= 0) {
        const removed = arr.splice(idx, 1)
        save(arr)
        return removed[0]
      }
      throw new Error('Item not found')
    }
  }
}

async function getCurrentUserId() {
  try {
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id || null
      console.log('[base44] getCurrentUserId from Supabase:', userId)
      return userId
    }
  } catch (err) {
    console.error('[base44] Error getting Supabase session:', err)
  }
  try {
    const raw = localStorage.getItem('session')
    const sess = raw ? JSON.parse(raw) : null
    const userId = sess?.user?.id || null
    console.log('[base44] getCurrentUserId from localStorage:', userId)
    return userId
  } catch (err) {
    console.error('[base44] Error getting localStorage session:', err)
    return null
  }
}

function normalizeNumber(v, { defaultValue = 0 } = {}) {
  if (v === '' || v === null || v === undefined) return defaultValue
  const num = Number(v)
  return Number.isNaN(num) ? defaultValue : num
}

function normalizePayload(table, obj) {
  if (!obj) return obj
  const n = { ...obj }
  if (table === 'products') {
    if (n.price !== undefined) n.price = normalizeNumber(n.price)
    if (n.wholesale_price !== undefined) n.wholesale_price = normalizeNumber(n.wholesale_price)
    if (n.cost !== undefined) n.cost = normalizeNumber(n.cost)
    if (n.stock !== undefined) n.stock = normalizeNumber(n.stock)
  } else if (table === 'sales') {
    if (n.total_amount !== undefined) n.total_amount = normalizeNumber(n.total_amount)
  } else if (table === 'settings') {
    if (n.cashback_percentage !== undefined) n.cashback_percentage = normalizeNumber(n.cashback_percentage)
  }
  return n
}

function makeRepo(table) {
  if (!supabase) {
    return makeStore(table)
  }
  const genId = () => Math.random().toString(36).slice(2)
  return {
    list: async (order) => {
      const userId = await getCurrentUserId()
      if (!userId) return []
      const q = supabase.from(table).select('*').eq('user_id', userId)
      if (order === '-created_date') {
        q.order('created_date', { ascending: false })
      }
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
    create: async (obj) => {
      const userId = await getCurrentUserId()
      console.log('[base44] Creating in table:', table, 'with userId:', userId)
      if (!userId) throw new Error('No user session')
      const normalized = normalizePayload(table, obj)

      // For staff_profiles, let Supabase generate the UUID (don't provide id)
      // For other tables, use the simple genId
      let item
      if (table === 'staff_profiles') {
        item = { ...normalized, user_id: userId }
      } else {
        item = { id: obj.id || genId(), created_date: new Date().toISOString(), ...normalized, user_id: userId }
      }

      console.log('[base44] Item to insert:', item)
      const { data, error } = await supabase.from(table).insert(item).select().single()
      if (error) {
        console.error('[base44] Insert error:', error)
        throw error
      }
      console.log('[base44] Insert success:', data)
      return data
    },
    update: async (id, patch) => {
      const userId = await getCurrentUserId()
      if (!userId) throw new Error('No user session')
      const normalized = normalizePayload(table, patch)
      const { data, error } = await supabase.from(table).update(normalized).eq('id', id).eq('user_id', userId).select().single()
      if (error) throw error
      return data
    },
    delete: async (id) => {
      const userId = await getCurrentUserId()
      if (!userId) throw new Error('No user session')
      const { data, error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId).select().single()
      if (error) throw error
      return data
    }
  }
}

export const base44 = {
  entities: {
    Settings: makeRepo('settings'),
    Customer: makeRepo('customers'),
    Product: makeRepo('products'),
    Sale: makeRepo('sales'),
    Expense: makeRepo('expenses'),
    Staff: makeRepo('staff_profiles'),
    User: makeRepo('users'),
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        // Persist as base64 data URL to survive page reloads (works for PNG)
        const readAsDataURL = (file) => new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const url = await readAsDataURL(file)
        return { file_url: url }
      }
    }
  },
  auth: {
    ensureSeedUser: async () => {
      if (supabase) return // Supabase auth in use; no local seeding
      const users = await base44.entities.User.list()
      if (!users || users.length === 0) {
        await base44.entities.User.create({
          email: 'admin@erp.local',
          password: '123456',
          name: 'Admin',
          role: 'admin'
        })
      }
    },
    login: async (email, password) => {
      if (supabase) throw new Error('Use Supabase auth')
      const users = await base44.entities.User.list()
      const user = users.find(u => u.email === email)
      if (!user || user.password !== password) {
        throw new Error('Credenciais inválidas')
      }
      const session = { user, created_at: new Date().toISOString() }
      localStorage.setItem('session', JSON.stringify(session))
      return session
    },
    logout: () => {
      localStorage.removeItem('session')
    },
    getSession: () => {
      const raw = localStorage.getItem('session')
      try { return raw ? JSON.parse(raw) : null } catch { return null }
    }
  },
  migrate: {
    toSupabase: async () => {
      if (!supabase) return
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) return
      const flagKey = `migrated_${userId}`
      if (localStorage.getItem(flagKey) === 'true') return
      const tables = ['settings', 'customers', 'products', 'sales']
      for (const table of tables) {
        const local = JSON.parse(localStorage.getItem(table) || '[]')
        if (!local || local.length === 0) continue
        // attach user_id and preserve id/created_date
        const payload = local.map(r => normalizePayload(table, { ...r, user_id: userId }))
        const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' })
        if (error) console.warn(`Falha ao migrar ${table}:`, error.message)
      }
      localStorage.setItem(flagKey, 'true')
    }
  }
}