import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  DollarSign,
  Check,
  UserPlus,
  FileText,
  Pencil
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Receipt from "@/components/Receipt";
import { supabase } from "@/api/supabaseClient";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function Cashier() {
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cashbackToUse, setCashbackToUse] = useState(0);
  const [observations, setObservations] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [settings, setSettings] = useState(null);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [lastSale, setLastSale] = useState(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const searchRef = useRef(null);
  const queryClient = useQueryClient();

  const [showNewProductDialog, setShowNewProductDialog] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: "",
    barcode: "",
    price: "",
    cost: "",
    stock: "",
    category: "",
  });
  const [payments, setPayments] = useState([]);
  const [paymentDraft, setPaymentDraft] = useState({ method: "", amount: "", installments: 1 });
  // Confirm dialogs states
  const [showConfirmRemoveCartItem, setShowConfirmRemoveCartItem] = useState(false);
  const [confirmRemoveCartItemId, setConfirmRemoveCartItemId] = useState(null);
  const [showConfirmRemovePayment, setShowConfirmRemovePayment] = useState(false);
  const [confirmRemovePaymentIdx, setConfirmRemovePaymentIdx] = useState(null);

  const [editingCartItem, setEditingCartItem] = useState(null);
  const [newPrice, setNewPrice] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      const settingsList = await base44.entities.Settings.list();
      if (settingsList.length > 0) {
        setSettings(settingsList[0]);
      }
    };
    fetchSettings();
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
    initialData: [],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    initialData: [],
  });

  const createSaleMutation = useMutation({
    mutationFn: (saleData) => base44.entities.Sale.create(saleData),
    onSuccess: () => {
      queryClient.invalidateQueries(['sales']);
      queryClient.invalidateQueries(['customers']);
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['customers']);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: (newCustomer) => {
      queryClient.invalidateQueries(['customers']);
      setSelectedCustomer(newCustomer);
      setCustomerSearchTerm(newCustomer.name);
      setShowNewCustomerDialog(false);
      setNewCustomerForm({ name: "", phone: "", email: "" });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      setShowNewProductDialog(false);
      setNewProductForm({ name: "", barcode: "", price: "", cost: "", stock: "", category: "" });
    },
  });

  const handleSearchProducts = (value) => {
    setSearchTerm(value);

    // Try to find by barcode first
    const productByBarcode = products.find(p => p.barcode === value);
    if (productByBarcode) {
      addToCart(productByBarcode);
      setSearchTerm("");
      searchRef.current?.focus();
    }
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    const price = Number(product.price || 0);
    const promo = Number(product.promo_price || 0);
    const effectivePrice = (product.promo_price && promo < price) ? promo : price;

    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        unit_price: effectivePrice,
        quantity: 1
      }]);
    }
  };

  const updateQuantity = (productId, change) => {
    setCart(cart.map(item =>
      item.product_id === productId
        ? { ...item, quantity: Math.max(1, item.quantity + change) }
        : item
    ).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  };

  const calculateCashbackEarned = () => {
    const total = calculateTotal();
    const used = parseFloat(cashbackToUse) || 0;
    const netTotal = Math.max(0, total - used);
    const percentage = settings?.cashback_percentage || 5;
    return netTotal * (percentage / 100);
  };

  const getFinalTotal = () => {
    const total = calculateTotal();
    const currentCashback = Number(selectedCustomer?.cashback_balance || 0);
    const cashbackRequested = parseFloat(cashbackToUse) || 0;
    const cashbackUsed = Math.min(cashbackRequested, currentCashback, total);
    return total - cashbackUsed;
  };

  const sumPayments = () => payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  const remainingAmount = () => Number((getFinalTotal() - sumPayments()).toFixed(2));

  const addPayment = () => {
    const amt = parseFloat(paymentDraft.amount);
    if (!paymentDraft.method || isNaN(amt) || amt <= 0) return;
    const newEntry = {
      method: paymentDraft.method,
      amount: amt,
      installments: (paymentDraft.method === 'Cartão de Crédito' || paymentDraft.method === 'Carnê') ? parseInt(paymentDraft.installments || 1, 10) : 1,
    };
    setPayments([...payments, newEntry]);
    setPaymentDraft({ method: "", amount: "", installments: 1 });
  };

  const removePayment = (index) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    await createCustomerMutation.mutateAsync(newCustomerForm);
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0 || payments.length === 0) return;

    const total = calculateTotal();
    const cashbackEarned = selectedCustomer ? calculateCashbackEarned() : 0;
    const currentCashback = Number(selectedCustomer?.cashback_balance || 0);
    const cashbackRequested = parseFloat(cashbackToUse) || 0;
    const cashbackUsed = Math.min(cashbackRequested, currentCashback, total);

    const finalTotal = total - cashbackUsed;

    // Validate payments cover finalTotal
    const sum = sumPayments();
    if (Number(sum.toFixed(2)) < Number(finalTotal.toFixed(2))) {
      alert(`Pagamentos insuficientes. Faltam R$ ${(finalTotal - sum).toFixed(2)}.`);
      return;
    }

    const getNextSaleNumber = async () => {
      try {
        const list = await base44.entities.Sale.list();
        const nums = (list || [])
          .map(s => {
            const raw = String(s.sale_number || '').trim();
            const onlyDigits = raw.replace(/\D+/g, '');
            const n = Number(onlyDigits);
            return Number.isFinite(n) ? n : null;
          })
          .filter(n => n !== null);
        const max = nums.length ? Math.max(...nums) : 99;
        return String(max + 1);
      } catch {
        return '100';
      }
    };

    const localSaleNumber = !supabase ? await getNextSaleNumber() : undefined;

    const saleData = {
      ...(localSaleNumber ? { sale_number: localSaleNumber } : {}),
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.name || "Cliente Avulso",
      total_amount: finalTotal,
      cashback_earned: cashbackEarned,
      cashback_used: cashbackUsed,
      payment_method: payments.map(p => p.method).join(' + '),
      payments,
      observations: observations,
      items: cart.map(item => ({
        ...item,
        total_price: item.unit_price * item.quantity
      })),
      sale_date: new Date().toISOString()
    };

    const createdSale = await createSaleMutation.mutateAsync(saleData);

    if (selectedCustomer) {
      const newCashbackBalance = Number((currentCashback - cashbackUsed + cashbackEarned).toFixed(2));
      await updateCustomerMutation.mutateAsync({
        id: selectedCustomer.id,
        data: {
          cashback_balance: Math.max(0, newCashbackBalance),
          total_spent: Number((selectedCustomer.total_spent || 0) + finalTotal),
          total_purchases: (selectedCustomer.total_purchases || 0) + 1
        }
      });
    }

    for (const item of cart) {
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        await updateProductMutation.mutateAsync({
          id: product.id,
          data: {
            stock: (product.stock || 0) - item.quantity
          }
        });
      }
    }

    setLastSale(createdSale || saleData);
    setShowReceiptDialog(true);

    setCart([]);
    setSelectedCustomer(null);
    setPaymentMethod("");
    setCashbackToUse(0);
    setObservations("");
    setCustomerSearchTerm("");
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const printReceipt = (sale) => {
    if (!sale) return;
    const win = window.open('', '_blank');
    const itemsHtml = (sale.items || []).map(item => (
      `<tr>
        <td style="padding:8px;border:1px solid #ddd;">${item.name || item.product_name || item.product_id}</td>
        <td style="padding:8px;border:1px solid #ddd;">${item.quantity}</td>
        <td style="padding:8px;border:1px solid #ddd;">R$ ${(item.unit_price || 0).toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #ddd;">R$ ${(item.total_price || 0).toFixed(2)}</td>
      </tr>`
    )).join('');
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
          ${(sale.payments && sale.payments.length > 0)
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

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    c.phone?.includes(customerSearchTerm)
  );

  const customer = selectedCustomer ? customers.find(c => c.id === selectedCustomer.id) : null;
  const maxCashbackToUse = customer ? Math.min(customer.cashback_balance, calculateTotal()) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {settings?.logo_url && (
          <div className="mb-4 flex justify-center">
            <img src={settings.logo_url} alt="Logo" className="h-14 object-contain" />
          </div>
        )}

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

        {/* Nota de Venda */}
        <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Comprovante</DialogTitle>
            </DialogHeader>
            {lastSale && (
              <div className="space-y-3">
                <Receipt sale={lastSale} settings={settings} />
                <div className="flex gap-2 pt-2">
                  <Button className="rounded-lg" onClick={() => printReceipt(lastSale)}>Imprimir/Salvar</Button>
                  <Button variant="outline" className="rounded-lg" onClick={() => setShowReceiptDialog(false)}>Fechar</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="grid lg:grid-cols-3 gap-4" data-tutorial="cashier-main">
          {/* Products Section */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] border-0 rounded-2xl bg-white">
              <CardHeader className="bg-gray-100 border-b border-gray-200 rounded-t-2xl p-4">
                <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                  <ShoppingCart className="w-5 h-5 text-slate-700" />
                  Produtos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {/* Unified Search/Barcode */}
                <div className="mb-4">
                  <Input
                    ref={searchRef}
                    value={searchTerm}
                    onChange={(e) => handleSearchProducts(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchProducts(searchTerm);
                      }
                    }}
                    placeholder="Buscar por nome ou código de barras..."
                    className="w-full rounded-xl border-gray-200"
                  />
                </div>

                <div className="mb-3">
                  <Button onClick={() => setShowNewProductDialog(true)} className="rounded-xl bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Novo Produto
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                  {filteredProducts.map((product, index) => (
                    <Card
                      key={product.id}
                      className={`cursor-pointer shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] hover:shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] transition-shadow border-0 bg-white rounded-xl ${index % 2 === 0 ? 'animate-enter-left' : 'animate-enter-right'}`}
                      onClick={() => addToCart(product)}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <CardContent className="p-3">
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-20 object-cover rounded-lg mb-2"
                          />
                        )}
                        <h3 className="font-medium text-sm line-clamp-2 text-gray-900">{product.name}</h3>
                        <p className="text-green-600 font-semibold mt-1 text-sm">R$ {product.price?.toFixed(2)}</p>
                        {product.stock !== undefined && (
                          <p className="text-xs text-gray-500">Estoque: {product.stock}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cart Section */}
          <div className="space-y-4">
            <Card className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] border-0 rounded-2xl bg-white">
              <CardHeader className="bg-gray-100 border-b border-gray-200 rounded-t-2xl p-4">
                <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                  <ShoppingCart className="w-5 h-5 text-green-600" />
                  Carrinho ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {cart.length === 0 ? (
                  <p className="text-center text-gray-400 py-6 text-sm">Carrinho vazio</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto mb-4">
                    {cart.map(item => (
                      <div key={item.product_id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{item.product_name}</p>
                          <p className="text-xs text-gray-500">R$ {item.unit_price?.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-lg"
                            onClick={() => updateQuantity(item.product_id, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-lg"
                            onClick={() => updateQuantity(item.product_id, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-lg"
                            onClick={() => { setConfirmRemoveCartItemId(item.product_id); setShowConfirmRemoveCartItem(true); }}
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Customer Search with Add Button */}
                <div className="mb-4">
                  <Label className="mb-2 block text-sm text-gray-700">Cliente</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        placeholder="Buscar cliente..."
                        className="rounded-xl border-gray-200"
                      />
                      {customerSearchTerm && filteredCustomers.length > 0 && (
                        <div className="mt-2 bg-white border border-gray-200 rounded-xl max-h-32 overflow-y-auto">
                          {filteredCustomers.map(customer => (
                            <div
                              key={customer.id}
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setCustomerSearchTerm(customer.name);
                                setCashbackToUse(0);
                              }}
                              className="p-2 hover:bg-gray-50 cursor-pointer text-sm border-b last:border-b-0"
                            >
                              <p className="font-medium text-gray-900">{customer.name}</p>
                              <p className="text-xs text-gray-500">Cashback: R$ {customer.cashback_balance?.toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => setShowNewCustomerDialog(true)}
                      className="rounded-xl bg-pink-600 hover:bg-pink-700 px-3"
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Cashback Info */}
                {customer && (
                  <div className="mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <p className="text-sm font-medium text-indigo-900 mb-2">
                      Cashback disponível: R$ {customer.cashback_balance?.toFixed(2)}
                    </p>
                    <Label className="text-xs text-indigo-700 mb-1 block">Usar cashback (R$)</Label>
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

                {/* Payment Method */}
                <div className="mb-4">
                  <Label className="mb-2 block text-sm text-gray-700">Formas de Pagamento</Label>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="w-40">
                      <Select value={paymentDraft.method} onValueChange={(v) => setPaymentDraft({ ...paymentDraft, method: v })}>
                        <SelectTrigger className="rounded-xl border-gray-200">
                          <SelectValue placeholder="Método" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                          <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                          <SelectItem value="PIX">PIX</SelectItem>
                          <SelectItem value="Carnê">Carnê</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-36">
                      <Label className="text-xs text-gray-500">Valor</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentDraft.amount}
                        onChange={(e) => setPaymentDraft({ ...paymentDraft, amount: e.target.value })}
                        className="rounded-xl border-gray-200"
                      />
                    </div>
                    {(paymentDraft.method === 'Cartão de Crédito' || paymentDraft.method === 'Carnê') && (
                      <div className="w-28">
                        <Label className="text-xs text-gray-500">Parcelas</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={paymentDraft.installments}
                          onChange={(e) => setPaymentDraft({ ...paymentDraft, installments: e.target.value })}
                          className="rounded-xl border-gray-200"
                        />
                      </div>
                    )}
                    <Button onClick={addPayment} className="rounded-xl bg-blue-600 hover:bg-blue-700">Adicionar</Button>
                  </div>
                  {payments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {payments.map((p, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-gray-700">
                          <span>{p.method}{p.installments > 1 ? ` • ${p.installments}x` : ''}</span>
                          <span>R$ {p.amount.toFixed(2)}</span>
                          <Button size="sm" variant="ghost" className="h-7 rounded-lg" onClick={() => { setConfirmRemovePaymentIdx(idx); setShowConfirmRemovePayment(true); }}>Remover</Button>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Restante</span>
                        <span>R$ {Math.max(0, remainingAmount()).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Observations */}
                <div className="mb-4">
                  <Label className="mb-2 block text-sm text-gray-700">Observações</Label>
                  <Textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Adicione uma observação..."
                    className="rounded-xl border-gray-200 resize-none"
                    rows={2}
                  />
                </div>

                {/* Totals */}
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal:</span>
                    <span>R$ {calculateTotal().toFixed(2)}</span>
                  </div>
                  {cashbackToUse > 0 && (
                    <div className="flex justify-between text-sm text-indigo-600">
                      <span>Cashback usado:</span>
                      <span>- R$ {cashbackToUse.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedCustomer && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Cashback a ganhar:</span>
                      <span>+ R$ {calculateCashbackEarned().toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold text-gray-900 pt-2 border-t border-gray-100">
                    <span>Total:</span>
                    <span className="text-green-600">
                      R$ {(calculateTotal() - cashbackToUse).toFixed(2)}
                    </span>
                  </div>
                  {payments.length > 0 && (
                    <div className="text-xs text-gray-600">
                      Pagamentos: {payments.map(p => `${p.method}${p.installments > 1 ? ` ${p.installments}x` : ''} R$ ${p.amount.toFixed(2)}`).join(' + ')}
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleFinalizeSale}
                  disabled={cart.length === 0 || payments.length === 0 || remainingAmount() > 0}
                  className="w-full mt-4 bg-green-600 hover:bg-green-700 rounded-xl h-11 text-base font-semibold"
                >
                  <DollarSign className="w-5 h-5 mr-2" />
                  Finalizar Venda
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* New Customer Dialog */}
        <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-3xl lg:max-w-4xl rounded-2xl">
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm text-gray-700">Nome *</Label>
                <Input
                  id="name"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  required
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm text-gray-700">Telefone</Label>
                <Input
                  id="phone"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm text-gray-700">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  placeholder="cliente@email.com"
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowNewCustomerDialog(false)} className="flex-1 rounded-xl">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-700 rounded-xl">
                  Criar Cliente
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Unified Product Dialog */}
        <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editingProductId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <Label htmlFor="prod-name" className="text-sm text-gray-700">Nome *</Label>
                <Input
                  id="prod-name"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div>
                <Label htmlFor="prod-barcode" className="text-sm text-gray-700">Código de Barras</Label>
                <Input
                  id="prod-barcode"
                  value={productForm.barcode}
                  onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                  placeholder="EAN / Código"
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prod-price" className="text-sm text-gray-700">Preço de Venda *</Label>
                  <Input
                    id="prod-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    required
                    className="rounded-xl border-gray-200"
                  />
                </div>
                <div>
                  <Label htmlFor="prod-promo" className="text-sm text-gray-700">Preço Promocional</Label>
                  <Input
                    id="prod-promo"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.promo_price}
                    onChange={(e) => setProductForm({ ...productForm, promo_price: e.target.value })}
                    placeholder="Opcional"
                    className="rounded-xl border-gray-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prod-stock" className="text-sm text-gray-700">Estoque</Label>
                  <Input
                    id="prod-stock"
                    type="number"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    className="rounded-xl border-gray-200"
                  />
                </div>
                <div>
                  <Label htmlFor="prod-category" className="text-sm text-gray-700">Categoria</Label>
                  <Input
                    id="prod-category"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="rounded-xl border-gray-200"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowProductDialog(false)} className="flex-1 rounded-xl">Cancelar</Button>
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl">Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={showConfirmRemoveCartItem}
          onOpenChange={setShowConfirmRemoveCartItem}
          title="Remover item do carrinho"
          description="Remover este item do carrinho?"
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
          description="Remover este pagamento?"
          confirmText="Remover"
          cancelText="Cancelar"
          destructive
          onConfirm={() => {
            if (confirmRemovePaymentIdx != null) removePayment(confirmRemovePaymentIdx);
          }}
        />
      </div>
    </div >
  );
}