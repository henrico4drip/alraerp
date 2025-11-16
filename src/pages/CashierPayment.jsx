import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, Trash2, Check, FileText } from "lucide-react";
import { useCashier } from "@/context/CashierContext";
import { useNavigate } from "react-router-dom";
import CustomerDialog from "@/components/CustomerDialog";
import Receipt from "@/components/Receipt";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function CashierPayment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
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
    addPayment,
    removePayment,
    sumPayments,
    remainingAmount,
    calculateTotal,
    updateQuantity,
    removeFromCart,
    discountPercent,
    setDiscountPercent,
    discountAmount,
  } = useCashier();
  const [settings, setSettings] = useState(null);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [showCustomerCreateDialog, setShowCustomerCreateDialog] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: "", phone: "", email: "" });
  const [lastSale, setLastSale] = useState(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [showPaymentPopover, setShowPaymentPopover] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false);
  const [showFooterAnimation, setShowFooterAnimation] = useState(false);
  const [highlightRight, setHighlightRight] = useState(false);
  // Confirm dialogs states
  const [showConfirmRemoveCartItem, setShowConfirmRemoveCartItem] = useState(false);
  const [confirmRemoveCartItemId, setConfirmRemoveCartItemId] = useState(null);
  const [showConfirmRemovePayment, setShowConfirmRemovePayment] = useState(false);
  const [confirmRemovePaymentIdx, setConfirmRemovePaymentIdx] = useState(null);
  useEffect(() => {
    const animatePayment = sessionStorage.getItem('animateCashierPaymentEntry') === 'true';
    if (animatePayment) {
      setShowFooterAnimation(true);
      setTimeout(() => setHighlightRight(true), 50);
      setTimeout(() => {
        setShowFooterAnimation(false);
        sessionStorage.removeItem('animateCashierPaymentEntry');
      }, 900);
    }
  }, []);



  useEffect(() => {
    const fetchSettings = async () => {
      const settingsList = await base44.entities.Settings.list();
      if (settingsList.length > 0) {
        setSettings(settingsList[0]);
      }
    };
    fetchSettings();
  }, []);

  // Navega de volta para a tela inicial do caixa ao fechar o comprovante
  useEffect(() => {
    if (!showReceiptDialog && lastSale) {
      // Resetar sessão de caixa para nova venda
      setCart([]);
      setSelectedCustomer(null);
      setPayments([]);
      setPaymentDraft({ method: "", amount: 0, installments: 1 });
      setCashbackToUse(0);
      setObservations("");
      setDiscountPercent(0);
      // Voltar para a tela inicial de caixa (produtos)
      navigate('/cashier/products');
    }
  }, [showReceiptDialog]);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list(),
    initialData: [],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
    initialData: [],
  });

  const createSaleMutation = useMutation({
    mutationFn: (saleData) => base44.entities.Sale.create(saleData),
    onSuccess: () => {
      queryClient.invalidateQueries(["sales"]);
      queryClient.invalidateQueries(["customers"]);
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["customers"]);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["products"]);
    },
  });

  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      c.phone?.includes(customerSearchTerm)
  );

  const customer = selectedCustomer
    ? customers.find((c) => c.id === selectedCustomer.id)
    : null;
  const maxCashbackToUse = customer ? Math.min(customer.cashback_balance, calculateTotal()) : 0;

  // Destaca método selecionado e preenche valor automaticamente
  const handleSelectPaymentMethod = (method) => {
    const autoFillMethods = ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Carnê'];
    const shouldAutoFill = autoFillMethods.includes(method);
    const amt = shouldAutoFill ? remainingAmount().toFixed(2) : (paymentDraft.amount || '');
    const installments = (method === 'Cartão de Crédito' || method === 'Carnê') ? (paymentDraft.installments || 1) : 1;
    setPaymentDraft({ ...paymentDraft, method: method, amount: amt, installments });
  };

  const addCustomPaymentMethod = async () => {
    const m = (newPaymentMethod || '').trim();
    if (!m) return;
    try {
      setSavingPaymentMethod(true);
      let updated;
      if (settings) {
        const arr = Array.isArray(settings.payment_methods) ? settings.payment_methods : [];
        if (arr.includes(m)) {
          // já existe: apenas selecionar
          handleSelectPaymentMethod(m);
          setShowPaymentPopover(false);
          return;
        }
        updated = await base44.entities.Settings.update(settings.id, { payment_methods: [...arr, m] });
      } else {
        updated = await base44.entities.Settings.create({ erp_name: '', cashback_percentage: 0, payment_methods: [m] });
      }
      setSettings(updated);
      setNewPaymentMethod('');
      handleSelectPaymentMethod(m);
      setShowPaymentPopover(false);
    } catch (e) {
      alert('Falha ao salvar novo método: ' + (e?.message || 'erro'));
    } finally {
      setSavingPaymentMethod(false);
    }
  };

  const cashbackEarnedPreview = selectedCustomer
    ? calculateTotal() * ((settings?.cashback_percentage ?? 5) / 100)
    : 0;

  const printReceipt = (sale) => {
    if (!sale) return;
    const win = window.open("", "_blank");
    const itemsHtml = (sale.items || [])
      .map(
        (item) =>
          `<tr>
        <td style="padding:8px;border:1px solid #ddd;">${item.name || item.product_name || item.product_id}</td>
        <td style="padding:8px;border:1px solid #ddd;">${item.quantity}</td>
        <td style="padding:8px;border:1px solid #ddd;">R$ ${(item.unit_price || 0).toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #ddd;">R$ ${(item.total_price || 0).toFixed(2)}</td>
      </tr>`
      )
      .join("");
    const html = `
      <html>
        <head>
          <title>Nota ${sale.sale_number}</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; }
            .muted { color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .totals { margin-top: 12px; }
            .totals div { margin: 4px 0; }
          </style>
        </head>
        <body>
          <h1>Nota de Venda</h1>
          <div class="muted">${sale.sale_number} - ${new Date(sale.sale_date).toLocaleString()}</div>
          <div>Cliente: <strong>${sale.customer_name || 'Cliente Avulso'}</strong></div>
          ${ (sale.payments && sale.payments.length > 0)
            ? `<div class=\"muted\">Pagamentos:</div><div>${sale.payments.map(p => `${p.method}${(p.installments || 1) > 1 ? ` • ${p.installments}x` : ''}: R$ ${(p.amount || 0).toFixed(2)}`).join('<br/>')}</div>`
            : `<div class=\"muted\">Pagamento: ${sale.payment_method}</div>`
          }
          ${sale.observations ? `<div>Obs: ${sale.observations}</div>` : ''}
          <table>
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Produto</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Qtd</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Unitário</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div>Total: <strong>R$ ${(sale.total_amount || 0).toFixed(2)}</strong></div>
            ${sale.cashback_used > 0 ? `<div>Cashback usado: - R$ ${sale.cashback_used.toFixed(2)}</div>` : ''}
            ${sale.cashback_earned > 0 ? `<div>Cashback gerado: + R$ ${sale.cashback_earned.toFixed(2)}</div>` : ''}
          </div>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleFinalizeSale = async () => {
    const total = calculateTotal();
    const finalTotalLocal = Math.max(0, total - discountAmount() - cashbackToUse);

    if (payments.length === 0) {
      alert("Adicione pelo menos um pagamento.");
      return;
    }

    const sum = Number(sumPayments().toFixed(2));
    const finalDue = Number(finalTotalLocal.toFixed(2));
    if (sum < finalDue) {
      alert(`Pagamentos insuficientes. Faltam R$ ${(finalDue - sum).toFixed(2)}.`);
      return;
    }

    try {
      const saleDateIso = new Date().toISOString();
      const paymentsWithSchedule = payments.map((p) => {
        if (p.method === 'Carnê') {
          const installments = Number(p.installments || 1)
          const amount = Number(p.amount || 0)
          const firstDays = Number(p.first_due_days || 30)
          const perAmount = Number((amount / installments).toFixed(2))
          const schedule = Array.from({ length: installments }, (_, i) => ({
            index: i + 1,
            due_date: (() => { const d = new Date(saleDateIso); d.setDate(d.getDate() + firstDays + i * 30); return d.toISOString() })(),
            amount: perAmount,
            status: 'pending',
          }))
          return { ...p, schedule }
        }
        return p
      })

      const saleData = {
        sale_date: saleDateIso,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || null,
        items: cart.map((item) => ({
          product_id: item.product_id,
          name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity,
        })),
        total_amount: total,
        discount_amount: discountAmount(),
        discount_percent: Number(discountPercent) || 0,
        cashback_used: Number(cashbackToUse || 0),
        cashback_earned: (() => { const percent = settings?.cashback_percentage ?? 5; return Number((total * (percent / 100)).toFixed(2)); })(),
        payment_method: payments.map((p) => p.method).join(" + "),
        payments: paymentsWithSchedule.map((p) => ({ method: p.method, amount: p.amount, installments: p.installments, first_due_days: p.first_due_days, schedule: p.schedule })),
        observations,
      };

      const createdSale = await createSaleMutation.mutateAsync(saleData);

      if (selectedCustomer) {
        const currentBalance = Number(selectedCustomer.cashback_balance || 0);
        const used = Number(cashbackToUse || 0);
        const newCashbackBalance = Math.max(0, Number((currentBalance - used + saleData.cashback_earned).toFixed(2)));
        // Renova validade de todo o cashback a partir desta compra
        const expDays = settings?.cashback_expiration_days ?? 30;
        const newExpiresAt = new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString();
        await updateCustomerMutation.mutateAsync({
          id: selectedCustomer.id,
          data: {
            cashback_balance: newCashbackBalance,
            cashback_expires_at: newExpiresAt,
            total_spent: Number((selectedCustomer.total_spent || 0) + finalTotalLocal),
            total_purchases: (selectedCustomer.total_purchases || 0) + 1,
          },
        });
      }

      for (const item of cart) {
        const product = products.find((p) => p.id === item.product_id);
        if (product) {
          await updateProductMutation.mutateAsync({
            id: product.id,
            data: {
              stock: (product.stock || 0) - item.quantity,
            },
          });
        }
      }

      setLastSale(createdSale || saleData);
      setShowReceiptDialog(true);

      // Reset shared state for next sale
      setCart([]);
      setSelectedCustomer(null);
      setCustomerSearchTerm("");
      setCashbackToUse(0);
      setObservations("");
      setPayments([]);
      setPaymentDraft({ method: "", amount: "", installments: 1 });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao finalizar venda:", err);
      alert("Falha ao finalizar venda.");
    }
  };

  // Atalho: Enter finaliza pagamento quando habilitado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (!(cart.length === 0 || payments.length === 0 || remainingAmount() > 0)) {
          handleFinalizeSale();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, payments.length, remainingAmount]);

  const handleSendCashbackWhatsApp = () => {
    if (!lastSale) return;
    const customers = queryClient.getQueryData(["customers"]) || [];
    const customer = customers.find((c) => c.id === lastSale.customer_id);
    const rawPhone = customer?.phone || "";
    const digits = String(rawPhone).replace(/\D/g, "");
    const phoneWithCountry = digits.length >= 10 ? `55${digits}` : "";

    // Saldo total atual do cliente (após a venda)
    const balance = Number(customer?.cashback_balance || 0).toFixed(2);

    // Determinar data de vencimento: se houver no cliente, usa; senão calcula pelo settings
    const expDays = settings?.cashback_expiration_days ?? 30;
    const expiresAtIso = customer?.cashback_expires_at || new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString();
    const expiresDate = new Date(expiresAtIso);
    const expiresStr = expiresDate.toLocaleDateString('pt-BR');

    const earned = Number(lastSale.cashback_earned || 0).toFixed(2);
    const msg = `Olá${customer?.name ? ` ${customer.name}` : ""}! Você ganhou R$ ${earned} de cashback nesta compra. Seu saldo total de cashback é R$ ${balance} e vence em ${expDays} dias (até ${expiresStr}). Obrigado!`;

    if (!phoneWithCountry) {
      alert("Cliente sem telefone válido para WhatsApp.");
      try {
        navigator.clipboard.writeText(msg);
        alert("Mensagem de cashback copiada para a área de transferência.");
      } catch (e) {}
      return;
    }

    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 pb-32 lg:pb-0">
      <div className="max-w-5xl mx-auto">
        {showSuccess && (
          <Alert className="mb-4 bg-green-50 border-green-200 rounded-2xl">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 flex items-center gap-2">
              Venda finalizada com sucesso!
              {lastSale && (
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setShowReceiptDialog(true)}>
                  <FileText className="w-3 h-3 mr-1" /> Ver nota
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-4 h-[calc(100vh-112px-64px)]">
          {/* Cart Section */}
          <Card className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] border-0 rounded-2xl bg-white">
            <CardHeader className="bg-gray-100 border-b border-gray-200 rounded-t-2xl p-4">
              <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                Carrinho ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {cart.length === 0 ? (
                <div>
                  <p className="text-center text-gray-400 py-6 text-sm">Carrinho vazio</p>
                  <Button onClick={() => navigate('/cashier/products')} className="w-full rounded-xl">
                    Voltar para produtos
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                  {cart.map((item) => (
                    <div key={item.product_id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{item.product_name}</p>
                        <p className="text-xs text-gray-500">R$ {item.unit_price?.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => updateQuantity(item.product_id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => updateQuantity(item.product_id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => { setConfirmRemoveCartItemId(item.product_id); setShowConfirmRemoveCartItem(true); }}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between text-sm font-medium">
                <span>Total</span>
                <span>R$ {calculateTotal().toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Customer and Payment Section */}
          <div className="flex flex-col h-full min-h-0 space-y-4">
            <Card className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] border-0 rounded-2xl bg-white flex-1 min-h-0 flex flex-col">
            <CardHeader className="bg-gray-100 border-b border-gray-200 rounded-t-2xl p-4">
              <div className="flex flex-wrap gap-2 items-center">
                <Button variant="outline" className="rounded-xl" onClick={() => setShowNewCustomerDialog(true)}>
                  {selectedCustomer ? selectedCustomer.name : 'Cliente'}
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setShowDiscountDialog(true)}>
                  {Number(discountPercent) > 0
                    ? `Desconto (${Number(discountPercent)}%) • R$ ${Number(discountAmount() || 0).toFixed(2)}`
                    : 'Desconto'}
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => navigate('/cashier/products')}>
                  Itens
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4 flex-1 overflow-y-auto">

              {/* Barra de cashback após seleção de cliente */}
              {/* Removido slider superior de cashback para usar caixa numérica abaixo do Valor */}

              {/* Payment Method - inline controls (no floating) */}
              <div>
                <Label className="mb-2 block text-sm text-gray-700">Pagamento</Label>
                <div className="flex flex-nowrap gap-1 mb-2 overflow-x-auto">
                  <Button
                    size="sm"
                    variant={paymentDraft.method === 'PIX' ? undefined : 'outline'}
                    className={`h-8 px-2 text-xs rounded-lg ${paymentDraft.method === 'PIX' ? 'bg-gray-600 text-white hover:bg-gray-500' : ''}`}
                    onClick={() => handleSelectPaymentMethod('PIX')}
                  >
                    PIX
                  </Button>
                  <Button
                    size="sm"
                    variant={paymentDraft.method === 'Dinheiro' ? undefined : 'outline'}
                    className={`h-8 px-2 text-xs rounded-lg ${paymentDraft.method === 'Dinheiro' ? 'bg-gray-600 text-white hover:bg-gray-500' : ''}`}
                    onClick={() => handleSelectPaymentMethod('Dinheiro')}
                  >
                    Dinheiro
                  </Button>
                  <Button
                    size="sm"
                    variant={paymentDraft.method === 'Cartão de Débito' ? undefined : 'outline'}
                    className={`h-8 px-2 text-xs rounded-lg ${paymentDraft.method === 'Cartão de Débito' ? 'bg-gray-600 text-white hover:bg-gray-500' : ''}`}
                    onClick={() => handleSelectPaymentMethod('Cartão de Débito')}
                  >
                    Cartão débito
                  </Button>
                  <Button
                    size="sm"
                    variant={paymentDraft.method === 'Cartão de Crédito' ? undefined : 'outline'}
                    className={`h-8 px-2 text-xs rounded-lg ${paymentDraft.method === 'Cartão de Crédito' ? 'bg-gray-600 text-white hover:bg-gray-500' : ''}`}
                    onClick={() => handleSelectPaymentMethod('Cartão de Crédito')}
                  >
                    Cartão crédito
                  </Button>
                  <Button
                    size="sm"
                    variant={paymentDraft.method === 'Carnê' ? undefined : 'outline'}
                    className={`h-8 px-2 text-xs rounded-lg ${paymentDraft.method === 'Carnê' ? 'bg-gray-600 text-white hover:bg-gray-500' : ''}`}
                    onClick={() => handleSelectPaymentMethod('Carnê')}
                  >
                    Carnê
                  </Button>
                  <Button
                    size="sm"
                    variant={paymentDraft.method === 'Outros' ? undefined : 'outline'}
                    className={`h-8 px-2 text-xs rounded-lg ${paymentDraft.method === 'Outros' ? 'bg-gray-600 text-white hover:bg-gray-500' : ''}`}
                    onClick={() => { handleSelectPaymentMethod('Outros'); setShowPaymentPopover(v => !v); }}
                  >
                    Outros
                  </Button>
                </div>
                {showPaymentPopover && (
                  <div className="mb-2 flex items-center gap-1 flex-wrap">
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        placeholder="Digite a forma de pagamento"
                        value={newPaymentMethod}
                        onChange={(e) => setNewPaymentMethod(e.target.value)}
                        className="h-8 text-xs rounded-lg flex-1"
                      />
                      <Button
                        size="sm"
                        className="h-8 px-2 text-xs rounded-lg"
                        variant="outline"
                        onClick={() => { if ((newPaymentMethod || '').trim()) { handleSelectPaymentMethod((newPaymentMethod || '').trim()); setShowPaymentPopover(false); } }}
                      >
                        Usar agora
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 px-2 text-xs rounded-lg"
                        onClick={addCustomPaymentMethod}
                        disabled={savingPaymentMethod}
                      >
                        {savingPaymentMethod ? 'Salvando...' : 'Salvar novo método'}
                      </Button>
                    </div>
                    {(settings?.payment_methods || []).length > 0 ? (
                      (settings.payment_methods).map((m) => (
                        <Button
                          key={m}
                          size="sm"
                          variant={paymentDraft.method === m ? undefined : 'outline'}
                          className={`h-8 px-2 text-xs rounded-lg ${paymentDraft.method === m ? 'bg-gray-600 text-white hover:bg-gray-500' : ''}`}
                          onClick={() => handleSelectPaymentMethod(m)}
                        >
                          {m}
                        </Button>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500">
                        Nenhum método personalizado.
                      </div>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs rounded-lg" onClick={() => setShowPaymentPopover(false)}>Fechar</Button>
                  </div>
                )}

                {paymentDraft.method === 'Cartão de Crédito' || paymentDraft.method === 'Carnê' ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex gap-2">
                      <Input
                        placeholder="Valor (R$)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentDraft.amount}
                        onChange={(e) => setPaymentDraft({ ...paymentDraft, amount: e.target.value })}
                        className="rounded-xl border-gray-200 w-1/2"
                      />
                      <Input
                        placeholder="Parcelas"
                        type="number"
                        min="1"
                        step="1"
                        value={paymentDraft.installments}
                        onChange={(e) => setPaymentDraft({ ...paymentDraft, installments: e.target.value })}
                        className="rounded-xl border-gray-200 w-1/4"
                      />
                      {paymentDraft.method === 'Carnê' && (
                        <Input
                          placeholder="Dias até 1ª parcela"
                          type="number"
                          min="0"
                          step="1"
                          value={paymentDraft.firstDueDays || 30}
                          onChange={(e) => setPaymentDraft({ ...paymentDraft, firstDueDays: e.target.value })}
                          className="rounded-xl border-gray-200 w-1/4"
                        />
                      )}
                    </div>
                    <Button className="rounded-xl" onClick={() => addPayment()}>+</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Valor (R$)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentDraft.amount}
                      onChange={(e) => setPaymentDraft({ ...paymentDraft, amount: e.target.value })}
                      className="rounded-xl border-gray-200 flex-1"
                    />
                    <Button className="rounded-xl" onClick={() => addPayment()}>+</Button>
                  </div>
                )}


                {/* Cashback em caixa (exibição abaixo do valor) */}
                {selectedCustomer && (
                  <div className="mt-2">
                    <Label className="text-xs text-gray-700">Cashback (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      max={maxCashbackToUse}
                      step="0.01"
                      value={Number(cashbackToUse || 0)}
                      onChange={(e) => {
                        const val = Number(e.target.value || 0);
                        setCashbackToUse(Math.min(maxCashbackToUse, Math.max(0, val)));
                      }}
                      className="rounded-xl border-indigo-200"
                    />
                    <div className="flex justify-between text-[11px] text-indigo-700 mt-1">
                      <span>Selecionado: R$ {Number(cashbackToUse || 0).toFixed(2)}</span>
                      <span>Disponível: R$ {Number(maxCashbackToUse || 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {payments.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {payments.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded-xl">
                        <div className="text-sm">
                          <span className="font-medium">{p.method}</span>
                          {p.installments > 1 ? ` • ${p.installments}x` : ''}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">R$ {p.amount.toFixed(2)}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => { setConfirmRemovePaymentIdx(idx); setShowConfirmRemovePayment(true); }}>×</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>R$ {calculateTotal().toFixed(2)}</span></div>
                {discountAmount() > 0 && (
                  <div className="flex justify-between text-pink-600"><span>Desconto ({Number(discountPercent) || 0}%)</span><span>- R$ {discountAmount().toFixed(2)}</span></div>
                )}
                {cashbackToUse > 0 && (
                  <div className="flex justify-between text-pink-600"><span>Cashback</span><span>- R$ {cashbackToUse.toFixed(2)}</span></div>
                )}
                {selectedCustomer && (
                  <div className="flex justify-between text-green-600"><span>Cashback a ganhar</span><span>+ R$ {Number(cashbackEarnedPreview).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between"><span>Pagamentos</span><span>R$ {sumPayments().toFixed(2)}</span></div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div className="p-2 rounded-lg bg-gray-50">
                    <div className="text-[10px] text-gray-500">Troco (R$)</div>
                    <div className="text-sm font-semibold">{sumPayments() > Math.max(0, calculateTotal() - discountAmount() - cashbackToUse) ? (sumPayments() - Math.max(0, calculateTotal() - discountAmount() - cashbackToUse)).toFixed(2) : '-'}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50">
                    <div className="text-[10px] text-gray-500">Faltam (R$)</div>
                    <div className="text-sm font-semibold">{remainingAmount().toFixed(2)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50">
                    <div className="text-[10px] text-gray-500">Final (R$)</div>
                    <div className="text-sm font-semibold">{Math.max(0, calculateTotal() - discountAmount() - cashbackToUse).toFixed(2)}</div>
                  </div>
                </div>
              </div>
              <div>
                <Label className="mb-2 block text-sm text-gray-700">Observações</Label>
                <Input
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Observações da venda"
                  className="rounded-xl border-gray-200"
                />
              </div>


            </CardContent>
          </Card>

          <div className="hidden lg:flex gap-2 mt-auto">
            <Button variant="outline" onClick={() => navigate('/cashier/products')} className="rounded-xl">Voltar</Button>
            <Button
              onClick={handleFinalizeSale}
              disabled={cart.length === 0 || payments.length === 0 || remainingAmount() > 0}
              className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              Finalizar pagamentos
            </Button>
          </div>
        </div>
        </div>

        {/* Bottom action bar (mobile) */}
        <div className="fixed left-0 right-0 bottom-[72px] z-20 px-4 lg:hidden">
          <div className="max-w-5xl mx-auto flex gap-2">
            <Button variant="outline" onClick={() => navigate('/cashier/products')} className="flex-1 rounded-xl">Voltar</Button>
            <Button
              onClick={handleFinalizeSale}
              disabled={cart.length === 0 || payments.length === 0 || remainingAmount() > 0}
              className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              Finalizar pagamentos
            </Button>
          </div>
        </div>

        {/* Customer Dialog: select existing or create new */}
        <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
          <DialogContent className="w-[95vw] sm:w-[800px] lg:w-[1000px] max-w-none rounded-2xl">
            <DialogHeader>
              <DialogTitle>Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-gray-700">Buscar cliente</Label>
                <Input
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  placeholder="Nome ou telefone"
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-xl">
                {(filteredCustomers || []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-gray-600">{c.phone || ''} • Cashback: R$ {(c.cashback_balance || 0).toFixed(2)}</div>
                    </div>
                    <Button size="sm" className="rounded-lg" onClick={() => { setSelectedCustomer(c); setShowNewCustomerDialog(false); }}>Selecionar</Button>
                  </div>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">Nenhum cliente encontrado.</div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Ou criar novo cliente</span>
                <Button size="sm" className="rounded-lg bg-pink-600 hover:bg-pink-700" onClick={() => setShowCustomerCreateDialog(true)}>Novo Cliente</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reutiliza o mesmo pop da tela de Clientes para criar novo */}
        <CustomerDialog
          open={showCustomerCreateDialog}
          onOpenChange={setShowCustomerCreateDialog}
          customer={null}
          title="Novo Cliente"
          onSaved={(newCustomer) => {
            queryClient.invalidateQueries(['customers']);
            setSelectedCustomer(newCustomer);
            setCustomerSearchTerm(newCustomer.name || '');
          }}
        />

        {/* Discount Dialog - percent only */}
        <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
          <DialogContent className="w-[95vw] sm:w-[800px] lg:w-[1000px] max-w-none rounded-2xl">
            <DialogHeader>
              <DialogTitle>Aplicar Desconto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Desconto (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="rounded-xl"
                  placeholder="0"
                />
                <div className="text-xs text-gray-600 mt-1">Equivale a R$ {discountAmount().toFixed(2)} de desconto.</div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDiscountDialog(false)}>Fechar</Button>
                <Button className="flex-1 rounded-xl" onClick={() => setShowDiscountDialog(false)}>Aplicar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Sale Receipt Dialog */}
        <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Comprovante</DialogTitle>
            </DialogHeader>
            {lastSale && (
              <div className="space-y-3">
                <Receipt sale={lastSale} settings={settings} />
                <div className="flex gap-2 pt-2 flex-wrap">
                  <Button className="rounded-lg" onClick={() => printReceipt(lastSale)}>Imprimir/Salvar</Button>
                  <Button className="rounded-lg bg-green-600 hover:bg-green-700 text-white" onClick={handleSendCashbackWhatsApp}>Enviar cashback por WhatsApp</Button>
                  <Button variant="outline" className="rounded-lg" onClick={() => setShowReceiptDialog(false)}>Fechar</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={showConfirmRemoveCartItem}
          onOpenChange={setShowConfirmRemoveCartItem}
          title="Remover item do carrinho"
          description="Tem certeza que deseja remover este item do carrinho?"
          confirmText="Remover"
          cancelText="Cancelar"
          destructive
          onConfirm={() => {
            if (confirmRemoveCartItemId != null) removeFromCart(confirmRemoveCartItemId);
          }}
        />

        <ConfirmDialog
          open={showConfirmRemovePayment}
          onOpenChange={setShowConfirmRemovePayment}
          title="Remover pagamento"
          description="Tem certeza que deseja remover este pagamento?"
          confirmText="Remover"
          cancelText="Cancelar"
          destructive
          onConfirm={() => {
            if (confirmRemovePaymentIdx != null) removePayment(confirmRemovePaymentIdx);
          }}
        />

      </div>
    </div>
  );
}