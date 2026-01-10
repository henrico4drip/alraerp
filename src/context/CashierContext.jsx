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

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  };

  const discountAmount = () => {
    const total = calculateTotal();
    return Math.max(0, total * (Number(discountPercent) || 0) / 100);
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

  const remainingAmount = () => {
    const total = calculateTotal();
    const finalTotal = Math.max(0, total - discountAmount() - cashbackToUse);
    const remaining = Math.max(0, finalTotal - sumPayments());
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
    calculateTotal,
    // desconto
    discountPercent,
    setDiscountPercent,
    discountAmount,
    isFinalizing,
    setIsFinalizing,
  };

  return <CashierContext.Provider value={value}>{children}</CashierContext.Provider>;
}

export function useCashier() {
  const ctx = useContext(CashierContext);
  if (!ctx) throw new Error("useCashier must be used within CashierProvider");
  return ctx;
}