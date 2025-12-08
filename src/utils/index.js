export function createPageUrl(name) {
  const map = {
    Dashboard: '/dashboard',
    Dashboard2: '/dashboard2',
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
