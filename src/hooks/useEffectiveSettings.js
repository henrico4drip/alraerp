import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'

function getLocalSettingsArray() {
  try {
    const raw = window.localStorage.getItem('settings')
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

const DEFAULT_SETTINGS = {
  erp_name: '',
  logo_url: '',
  cashback_percentage: 5,
  cashback_expiration_days: 30,
  payment_methods: [],
  pix_key: '',
}

export function useEffectiveSettings() {
  const initial = getLocalSettingsArray()
  const { data = initial } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
    initialData: initial,
    retry: 0,
    staleTime: 1000,
  })
  const arr = Array.isArray(data) ? data : []
  const first = arr.length > 0 ? arr[0] : null
  return first || (initial.length > 0 ? initial[0] : DEFAULT_SETTINGS)
}
