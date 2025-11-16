export function createPageUrl(name) {
  const map = {
    Dashboard: '/dashboard',
    Cashier: '/cashier/products',
    Sales: '/sales',
    Customers: '/customers',
    Inventory: '/inventory',
    Reports: '/reports',
    Marketing: '/marketing',
    Settings: '/settings',
    Billing: '/billing',
    Payments: '/payments',
  }
  return map[name] || '/'
}