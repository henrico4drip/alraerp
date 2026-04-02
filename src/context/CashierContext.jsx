import React, { createContext, useContext, useState } from "react";

const CashierContext = createContext(null);

export function CashierProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [cashbackToUse, setCashbackToUse] = useState(0);
  const [observations, setObservations] = useState("");
  const [payments, setPayments] = useState([]);
  const [paymentDraft, setPaymentDraft] = useState({ method: '', amount: '', installments: 1, firstDueDays: 30 });
  // Desconto em % (0–100)
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isPixMode, setIsPixMode] = useState(true); // Default to Pix mode if base is pix
  const [suspendedSales, setSuspendedSales] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('alraerp_suspended_sales') || '[]');
    } catch { return []; }
  });

  const saveSuspendedSales = (list) => {
    setSuspendedSales(list);
    localStorage.setItem('alraerp_suspended_sales', JSON.stringify(list));
  };

  const suspendSale = () => {
    if (cart.length === 0) return false;
    const newSuspension = {
      id: Date.now(),
      date: new Date().toISOString(),
      cart: [...cart],
      selectedCustomer: selectedCustomer ? { ...selectedCustomer } : null,
      observations: observations,
      discountPercent: discountPercent,
    };
    saveSuspendedSales([newSuspension, ...suspendedSales]);
    setCart([]);
    setSelectedCustomer(null);
    setObservations("");
    setDiscountPercent(0);
    return true;
  };

  const resumeSale = (id) => {
    const sale = suspendedSales.find(s => s.id === id);
    if (!sale) return;
    setCart(sale.cart || []);
    setSelectedCustomer(sale.selectedCustomer || null);
    setObservations(sale.observations || "");
    setDiscountPercent(sale.discountPercent || 0);
    saveSuspendedSales(suspendedSales.filter(s => s.id !== id));
  };

  const deleteSuspendedSale = (id) => {
    saveSuspendedSales(suspendedSales.filter(s => s.id !== id));
  };

  const addToCart = (product) => {
    const existingItem = cart.find((item) => item.product_id === product.id);
    // Determine effective price (promo vs regular)
    const price = Number(product.price || 0);
    const promo = Number(product.promo_price || 0);
    const effectivePrice = (product.promo_price && promo < price) ? promo : price;

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          unit_price: effectivePrice,
          quantity: 1,
        },
      ]);
    }
  };

  const updateQuantity = (productId, change) => {
    setCart(
      cart
        .map((item) =>
          item.product_id === productId
            ? { ...item, quantity: Math.max(1, item.quantity + change) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  // Simple raw subtotal (no pricing rules)
  const rawSubtotal = () => cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const discountAmount = (settings) => {
    const sub = rawSubtotal();
    const pricingBase = settings?.pricing_base || 'pix';
    const cardSurcharge = Number(settings?.card_surcharge_percentage || 0);
    const pixDiscount = Number(settings?.pix_discount_percentage || 0);

    let adjusted = sub;
    if (isPixMode && pricingBase === 'card') adjusted = sub * (1 - pixDiscount / 100);
    else if (!isPixMode && pricingBase === 'pix') adjusted = sub * (1 + cardSurcharge / 100);

    return Math.max(0, adjusted * (Number(discountPercent) || 0) / 100);
  };

  const addPayment = () => {
    if (!paymentDraft.amount || Number(paymentDraft.amount) <= 0) return;

    const payment = {
      method: paymentDraft.method,
      amount: Number(paymentDraft.amount),
      installments: Number(paymentDraft.installments || 1),
      ...(paymentDraft.method === 'Carnê' ? { first_due_days: Number(paymentDraft.firstDueDays || 30) } : {}),
    };

    setPayments((prev) => [...prev, payment]);
    setPaymentDraft({ method: '', amount: '', installments: 1, firstDueDays: 30 });
  };

  const removePayment = (idx) => {
    setPayments(payments.filter((_, i) => i !== idx));
  };

  const sumPayments = () => payments.reduce((s, p) => s + (p.amount || 0), 0);

  const remainingAmount = (settings) => {
    const total = calculateTotal(settings);
    const remaining = Math.max(0, total - sumPayments());
    return remaining;
  };

  const value = {
    cart,
    setCart,
    selectedCustomer,
    setSelectedCustomer,
    customerSearchTerm,
    setCustomerSearchTerm,
    cashbackToUse,
    setCashbackToUse,
    observations,
    setObservations,
    payments,
    setPayments,
    paymentDraft,
    setPaymentDraft,
    addToCart,
    updateQuantity,
    removeFromCart,
    addPayment,
    removePayment,
    sumPayments,
    remainingAmount,
    discountPercent,
    setDiscountPercent,
    discountAmount,
    isFinalizing,
    setIsFinalizing,
    isPixMode,
    setIsPixMode,
    calculateSubtotal: (settings) => {
      const baseTotal = cart.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);
      const pricingBase = settings?.pricing_base || 'pix';
      const cardSurcharge = Number(settings?.card_surcharge_percentage || 0);
      const pixDiscount = Number(settings?.pix_discount_percentage || 0);

      if (isPixMode && pricingBase === 'card') return baseTotal * (1 - pixDiscount / 100);
      if (!isPixMode && pricingBase === 'pix') return baseTotal * (1 + cardSurcharge / 100);
      return baseTotal;
    },
    calculateTotal: (settings) => {
      const sub = cart.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);
      const pricingBase = settings?.pricing_base || 'pix';
      const cardSurcharge = Number(settings?.card_surcharge_percentage || 0);
      const pixDiscount = Number(settings?.pix_discount_percentage || 0);

      let adjusted = sub;
      if (isPixMode && pricingBase === 'card') {
        adjusted = sub * (1 - pixDiscount / 100);
      } else if (!isPixMode && pricingBase === 'pix') {
        adjusted = sub * (1 + cardSurcharge / 100);
      }

      const discVal = (adjusted * (discountPercent || 0)) / 100;
      return Math.max(0, adjusted - discVal - (cashbackToUse || 0));
    },
    suspendedSales,
    suspendSale,
    resumeSale,
    deleteSuspendedSale,
  };

  return <CashierContext.Provider value={value}>{children}</CashierContext.Provider>;
}

export function useCashier() {
  const ctx = useContext(CashierContext);
  if (!ctx) throw new Error("useCashier must be used within CashierProvider");
  return ctx;
}