import React, { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, Trash2, Check, FileText, QrCode, Banknote, CreditCard, CalendarRange, MoreHorizontal, ShoppingCart, Package } from "lucide-react";
import { useCashier } from "@/context/CashierContext";
import { useNavigate } from "react-router-dom";
import CustomerDialog from "@/components/CustomerDialog";
import Receipt from "@/components/Receipt";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfinitePayButton from "@/components/InfinitePayButton";
import QRCode from 'qrcode';
import { Pix } from "@/utils/pix";
import { supabase } from "@/api/supabaseClient";

const mapPaymentMethodToCode = (method) => {
  const norm = method?.toLowerCase() || '';
  if (norm.includes('pix')) return '17';
  if (norm.includes('dinheiro')) return '01';
  if (norm.includes('crédito')) return '03';
  if (norm.includes('débito')) return '04';
  if (norm.includes('boleto')) return '15';
  return '99'; // Outros
};



const generateCashbackMessage = (sale, customer, settings) => {
  if (!sale || !customer) return { msg: '', phone: '' };

  const rawPhone = customer?.phone || "";
  const digits = String(rawPhone).replace(/\D/g, "");
  const phoneWithCountry = digits.length >= 10 ? `55${digits}` : "";

  const balance = Number(customer?.cashback_balance || 0).toFixed(2);
  const expDays = settings?.cashback_expiration_days ?? 30;
  const expiresAtIso = customer?.cashback_expires_at || new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString();
  const expiresDate = new Date(expiresAtIso);
  const expiresStr = expiresDate.toLocaleDateString('pt-BR');

  const earned = Number(sale.cashback_earned || 0).toFixed(2);
  const firstName = customer?.name ? customer.name.split(' ')[0] : "";

  const storeSlug = settings?.slug;
  const portalLink = storeSlug ? `https://alraerp.com.br/${storeSlug}/cashback` : '';

  let msg = `Olá${firstName ? ` ${firstName}` : ""}! Você ganhou R$ ${earned} de cashback nesta compra. Seu saldo total de cashback é R$ ${balance} e vence em ${expDays} dias (até ${expiresStr}).`;

  if (portalLink) {
    msg += ` Confira seu extrato completo em: ${portalLink}`;
  }
  msg += ` Obrigado!`;

  return { msg, phone: phoneWithCountry };
};

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
  const [saleDateTime, setSaleDateTime] = useState(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  // Confirm dialogs states
  const [showConfirmRemoveCartItem, setShowConfirmRemoveCartItem] = useState(false);
  const [confirmRemoveCartItemId, setConfirmRemoveCartItemId] = useState(null);
  const [showConfirmRemovePayment, setShowConfirmRemovePayment] = useState(false);
  const [confirmRemovePaymentIdx, setConfirmRemovePaymentIdx] = useState(null);
  const [editingPaymentIdx, setEditingPaymentIdx] = useState(null);
  const [showPixDialog, setShowPixDialog] = useState(false);
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState('');
  const [pixPayload, setPixPayload] = useState('');
  const amountInputRef = useRef(null);
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
  const maxCashbackToUse = customer ? Math.min(
    Number(customer.cashback_balance || 0),
    Math.max(0, calculateTotal() - discountAmount())
  ) : 0;

  // Destaca método selecionado e preenche valor automaticamente
  const handleSelectPaymentMethod = (method) => {
    const autoFillMethods = ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Carnê'];
    const shouldAutoFill = autoFillMethods.includes(method);
    const amt = shouldAutoFill ? remainingAmount().toFixed(2) : (paymentDraft.amount || '');
    const installments = (method === 'Cartão de Crédito' || method === 'Carnê') ? (paymentDraft.installments || 1) : 1;
    setPaymentDraft({ ...paymentDraft, method: method, amount: amt, installments });
  };

  const startEditPayment = (idx) => {
    const p = payments[idx]
    if (!p) return
    setEditingPaymentIdx(idx)
    setPaymentDraft({
      method: p.method,
      amount: p.amount,
      installments: p.installments || 1,
      firstDueDays: p.first_due_days || p.firstDueDays || 30,
    })
  }

  const commitEditPayment = () => {
    if (editingPaymentIdx == null) return
    const updated = {
      method: paymentDraft.method,
      amount: Number(paymentDraft.amount || 0),
      installments: Number(paymentDraft.installments || 1),
      first_due_days: paymentDraft.firstDueDays ? Number(paymentDraft.firstDueDays) : undefined,
    }
    setPayments((prev) => prev.map((p, i) => (i === editingPaymentIdx ? { ...p, ...updated } : p)))
    setEditingPaymentIdx(null)
    setPaymentDraft({ method: "", amount: 0, installments: 1 })
  }

  const generatePixCode = async () => {
    if (!settings?.pix_key) return;

    const amount = Number(paymentDraft.amount || 0);
    if (amount <= 0) return;

    try {
      const pix = new Pix(
        settings.pix_key,
        settings.erp_name || 'AlraERP Store',
        settings.company_city || 'Cidade',
        amount,
        'TX' + Date.now().toString().slice(-10) // Unique TxId
      );

      const payload = pix.getPayload();
      setPixPayload(payload);

      const url = await QRCode.toDataURL(payload);
      setPixQrCodeUrl(url);
      setShowPixDialog(true);
    } catch (e) {
      console.error('Error generating PIX:', e);
      alert('Erro ao gerar QR Code PIX: ' + e.message);
      addPayment();
    }
  };

  const handleAddPaymentWithPixCheck = () => {
    if (editingPaymentIdx != null) {
      commitEditPayment();
      return;
    }

    const { method, amount } = paymentDraft;
    const nm = Number(amount);

    if (!method) {
      alert('Selecione um método de pagamento.');
      return;
    }
    if (nm <= 0) {
      alert('Valor inválido.');
      return;
    }

    // Intercept PIX
    if (method === 'PIX' && settings?.pix_key) {
      if (confirm('Deseja gerar um QR Code PIX para este pagamento?')) {
        generatePixCode();
        return;
      }
    }

    addPayment();
  };



  // ... custom payment
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
    ? Math.max(0, calculateTotal() - discountAmount() - (cashbackToUse || 0)) * ((settings?.cashback_percentage ?? 5) / 100)
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

  const handleFinalizeSale = async () => {
    const minCount = Number(settings?.wholesale_min_count || 0)
    const totalQty = cart.reduce((s, it) => s + (it.quantity || 0), 0)
    const effectiveItems = cart.map((item) => {
      const product = products.find((p) => p.id === item.product_id)
      const w = product?.wholesale_price
      const hasW = w !== undefined && w !== null
      let price = item.unit_price
      if (settings?.wholesale_enabled && hasW) {
        if (settings?.wholesale_type === 'global' && totalQty >= minCount) price = Number(w)
        if (settings?.wholesale_type === 'item' && item.quantity >= minCount) price = Number(w)
      }
      return { ...item, unit_price: Number(price), total_price: Number(price) * Number(item.quantity || 0) }
    })
    const total = effectiveItems.reduce((sum, it) => sum + (it.total_price || 0), 0)
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
      const saleDateIso = (() => {
        try { return new Date(saleDateTime).toISOString() } catch { return new Date().toISOString() }
      })();
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
        items: effectiveItems.map((item) => ({
          product_id: item.product_id,
          name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        })),
        total_amount: total,
        discount_amount: discountAmount(),
        discount_percent: Number(discountPercent) || 0,
        cashback_used: Number(cashbackToUse || 0),
        cashback_earned: (() => { const percent = settings?.cashback_percentage ?? 5; return Number((Math.max(0, total - discountAmount() - (cashbackToUse || 0)) * (percent / 100)).toFixed(2)); })(),
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

      const minCountUpd = Number(settings?.wholesale_min_count || 0)
      const totalQtyUpd = effectiveItems.reduce((s, it) => s + (it.quantity || 0), 0)
      for (const item of effectiveItems) {
        const product = products.find((p) => p.id === item.product_id);
        if (!product) continue;
        let useWholesale = false;
        if (settings?.wholesale_enabled && product?.wholesale_price != null) {
          if (settings?.wholesale_type === 'global' && totalQtyUpd >= minCountUpd) useWholesale = true;
          if (settings?.wholesale_type === 'item' && item.quantity >= minCountUpd) useWholesale = true;
        }
        if (useWholesale) {
          const newW = Math.max(0, Number(product.wholesale_stock || 0) - Number(item.quantity || 0));
          await updateProductMutation.mutateAsync({ id: product.id, data: { wholesale_stock: newW } });
        } else {
          const newStock = Math.max(0, Number(product.stock || 0) - Number(item.quantity || 0));
          await updateProductMutation.mutateAsync({ id: product.id, data: { stock: newStock } });
        }
      }

      setLastSale(createdSale || saleData);

      // --- FISCAL EMISSION (NFCe) ---
      if (settings?.focus_company_id && createdSale?.id) {
        try {
          console.log('Iniciando emissão fiscal (NFCe)...');
          // Prepare Payload for Focus NFe
          const nfe_payload = {
            natureza_operacao: 'Venda ao Consumidor',
            data_emissao: saleData.sale_date,
            tipo_documento: 1, // 1=Saída
            finalidade_emissao: 1, // 1=Normal
            presenca_comprador: 1, // 1=Presencial
            cnpj_emitente: settings.company_cnpj?.replace(/\D/g, ''),
            nome_destinatario: saleData.customer_name || undefined, // Optional for NFCe < 10k normally
            cpf_destinatario: selectedCustomer?.cpf ? selectedCustomer.cpf.replace(/\D/g, '') : undefined,
            items: saleData.items.map((item, idx) => {
              // Try to find full product details locally
              const product = products.find(p => p.id === item.product_id);
              return {
                numero_item: idx + 1,
                codigo_produto: item.product_id,
                descricao: item.name,
                base_calculo_icms: item.total_price, // Simplifying for Simples Nacional
                valor_icms: 0,
                valor_bruto: item.total_price,
                quantidade_comercial: item.quantity,
                quantidade_tributavel: item.quantity,
                valor_unitario_comercial: item.unit_price,
                valor_unitario_tributavel: item.unit_price,
                unidade_comercial: 'UN',
                unidade_tributavel: 'UN',
                codigo_ncm: product?.ncm || settings.fiscal_ncm_default || '00000000', // Default fallback
                cfop: settings.fiscal_cfop_default || '5102',
                icms_origem: '0',
                icms_situacao_tributaria: settings.fiscal_regime === '1' ? '102' : '00',
                // PIS/COFINS defaults for Simples
                pis_situacao_tributaria: '07',
                cofins_situacao_tributaria: '07'
              }
            }),
            formas_pagamento: payments.map(p => ({
              forma_pagamento: mapPaymentMethodToCode(p.method),
              valor_pagamento: p.amount,
              troco: 0
            }))
          };

          const { data: fiscalRes, error: fiscalErr } = await supabase.functions.invoke('focus-nfe-proxy', {
            body: {
              action: 'issue_nfce',
              payload: {
                environment: settings.focus_environment || 'homologacao',
                reference: createdSale.id, // Use Sale ID as Ref
                nfe_payload
              }
            }
          });

          if (!fiscalErr && fiscalRes?.data) {
            console.log('Resposta Fiscal:', fiscalRes);
            // Verify if authorized immediately or processing
            // Focus returns: { status: "processando_autorizacao", caminho_xml_nota_fiscal: "...", url_danfe: "..." } if success
            // Or { status: "erro", ... }

            // Update sale with whatever we got
            const updates = {};
            if (fiscalRes.data.caminho_danfe) updates.fiscal_doc_url = fiscalRes.data.caminho_danfe; // Check field name in docs, usually 'caminho_danfe' or url_danfe
            if (fiscalRes.data.url_danfe) updates.fiscal_doc_url = fiscalRes.data.url_danfe;
            if (fiscalRes.data.status) updates.fiscal_status = fiscalRes.data.status;

            if (Object.keys(updates).length > 0) {
              await base44.entities.Sale.update(createdSale.id, updates);
              setLastSale(prev => ({ ...prev, ...updates }));
            }
          }
        } catch (fiscalError) {
          console.error('Erro na emissão fiscal:', fiscalError);
          // Don't block the UI flow, just log
        }
      }

      // --- WHATSAPP AUTOMATION ---
      if (settings?.whatsapp_auto_send_cashback && selectedCustomer) {
        try {
          const { msg, phone } = generateCashbackMessage(
            createdSale || saleData,
            { ...selectedCustomer, cashback_balance: (selectedCustomer.cashback_balance || 0) - (cashbackToUse || 0) + saleData.cashback_earned },
            settings
          );

          if (phone) {
            console.log('Enviando mensagem automática de cashback...');
            await supabase.functions.invoke('whatsapp-proxy', {
              body: {
                action: 'send_message',
                payload: { phone, message: msg }
              }
            });
          }
        } catch (waError) {
          console.error('Erro no envio automático do WhatsApp:', waError);
        }
      }
      // -----------------------------
      // -----------------------------

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
      setTimeout(() => setShowSuccess(false), 5000);
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

    const { msg, phone } = generateCashbackMessage(lastSale, customer, settings);

    if (!phone) {
      alert("Cliente sem telefone válido para WhatsApp.");
      if (msg) {
        try {
          navigator.clipboard.writeText(msg);
          alert("Mensagem de cashback copiada para a área de transferência.");
        } catch (e) { }
      }
      return;
    }

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  useEffect(() => {
    const handleEvent = () => {
      // Check validation again just in case, though button disabled state handles UI
      const total = calculateTotal();
      const finalTotalLocal = Math.max(0, total - discountAmount() - (cashbackToUse || 0));
      const sum = Number(sumPayments().toFixed(2));
      const finalDue = Number(finalTotalLocal.toFixed(2));

      if (cart.length === 0) return;
      if (payments.length === 0) { alert("Adicione pelo menos um pagamento."); return; }
      if (sum < finalDue) { alert(`Pagamentos insuficientes. Faltam R$ ${(finalDue - sum).toFixed(2)}.`); return; }

      handleFinalizeSale();
    };
    window.addEventListener('cashier-finish-sale', handleEvent);
    return () => window.removeEventListener('cashier-finish-sale', handleEvent);
  }, [cart, payments, cashbackToUse, discountAmount, calculateTotal, sumPayments, handleFinalizeSale]);

  return (
    <div className="fixed inset-0 top-[60px] pb-[100px] bg-[#fdfdfd] lg:bg-slate-50/50 p-2 sm:p-4 overflow-hidden flex flex-col">
      {showSuccess && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <Alert className="bg-green-50 border-green-200 rounded-2xl shadow-lg">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 flex items-center gap-2 font-medium">
              Venda finalizada com sucesso!
              {lastSale && (
                <Button size="sm" variant="outline" className="rounded-lg h-7 bg-white text-green-700 border-green-200 hover:bg-green-50" onClick={() => setShowReceiptDialog(true)}>
                  <FileText className="w-3 h-3 mr-1" /> Recibo
                </Button>
              )}
              {lastSale?.fiscal_doc_url && (
                <Button size="sm" variant="outline" className="rounded-lg h-7 bg-white text-blue-700 border-blue-200 hover:bg-blue-50" onClick={() => window.open(lastSale.fiscal_doc_url, '_blank')}>
                  <QrCode className="w-3 h-3 mr-1" /> Nota Fiscal
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* PIX QR Code Dialog */}
      <Dialog open={showPixDialog} onOpenChange={setShowPixDialog}>
        <DialogContent className="max-w-md bg-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold flex flex-col items-center gap-2">
              <QrCode className="w-8 h-8 text-green-600" />
              Pagamento via PIX
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-4 space-y-4">
            <div className="p-4 bg-white border-2 border-dashed border-green-200 rounded-2xl shadow-sm">
              {pixQrCodeUrl && <img src={pixQrCodeUrl} alt="QR Code PIX" className="w-64 h-64 object-contain" />}
            </div>

            <div className="text-center space-y-1">
              <p className="font-bold text-gray-900 text-2xl">R$ {Number(paymentDraft.amount || 0).toFixed(2)}</p>
              <p className="text-sm text-gray-400">Escaneie o código acima para pagar</p>
            </div>

            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1 rounded-xl h-11 border-gray-200" onClick={() => {
                navigator.clipboard.writeText(pixPayload);
                alert('Código PIX Copia e Cola copiado!');
              }}>
                Copiar Código
              </Button>
              <Button className="flex-1 rounded-xl h-11 bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-200" onClick={() => {
                setShowPixDialog(false);
                addPayment();
              }}>
                <Check className="w-4 h-4 mr-1" />
                Já Recebi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row gap-3 sm:gap-4 overflow-hidden">

        {/* Left Column: Cart Summary (1/3) */}
        <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-3xl border border-gray-200/60 shadow-sm relative order-2 lg:order-1 mb-20">
          <div className="shrink-0 px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-500">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">Resumo</h2>
                <p className="text-xs text-gray-400 font-medium">{cart.length} itens</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50">
            {cart.map((item) => (
              <div key={item.product_id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 shrink-0 flex items-center justify-center">
                  <Package className="w-4 h-4 text-gray-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-gray-900 text-sm truncate pr-2">{item.product_name}</h4>
                    <p className="font-bold text-gray-900 text-sm">R$ {(item.unit_price * item.quantity).toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-gray-500">{item.quantity}x R$ {item.unit_price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="shrink-0 bg-white border-t border-gray-100 p-5 space-y-2 z-10">
            <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>R$ {calculateTotal().toFixed(2)}</span></div>
            {discountAmount() > 0 && <div className="flex justify-between text-sm text-pink-600"><span>Desconto</span><span>- R$ {discountAmount().toFixed(2)}</span></div>}
            {cashbackToUse > 0 && <div className="flex justify-between text-sm text-purple-600"><span>Cashback</span><span>- R$ {Number(cashbackToUse).toFixed(2)}</span></div>}
            <div className="pt-2 border-t border-gray-100 mt-2">
              <div className="flex justify-between items-end">
                <span className="text-xs font-semibold uppercase text-gray-400">Total Final</span>
                <span className="text-2xl font-bold text-gray-900">R$ {Math.max(0, calculateTotal() - discountAmount() - (cashbackToUse || 0)).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Payment & Customer (2/3) */}
        <div className="flex-[1.5] lg:flex-[2] overflow-hidden flex flex-col bg-white rounded-3xl border border-gray-200/60 shadow-sm relative order-1 lg:order-2 mb-20">
          {/* Header / Tools */}
          <div className="shrink-0 px-4 sm:px-6 py-2 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-white relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="h-8 rounded-xl border-gray-200 hover:bg-gray-50 hover:border-blue-200 transition-colors px-3 text-sm" onClick={() => setShowNewCustomerDialog(true)}>
                <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mr-1.5 -ml-1">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span className="text-gray-700 font-medium text-sm">{selectedCustomer ? selectedCustomer.name : 'Cliente'}</span>
              </Button>

              <Button variant="outline" className="h-8 rounded-xl border-gray-200 hover:bg-gray-50 hover:border-pink-200 transition-colors px-3 text-sm" onClick={() => setShowDiscountDialog(true)}>
                {Number(discountPercent) > 0 ? (
                  <span className="text-pink-600 font-semibold text-sm">-{Number(discountPercent)}%</span>
                ) : (
                  <span className="text-gray-600 text-sm">Desconto</span>
                )}
              </Button>
            </div>

            <div className="w-[200px] sm:w-[220px]">
              <Input
                type="datetime-local"
                value={saleDateTime}
                onChange={(e) => setSaleDateTime(e.target.value)}
                className="h-8 rounded-xl border-gray-200 bg-gray-50/50 text-xs font-medium"
              />
            </div>
          </div>

          {/* Main Payment Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">

            {/* Payment Methods Grid */}
            <div className="space-y-2">
              <Label className={`text-xs font-bold uppercase tracking-wider transition-all ${!paymentDraft.method ? 'text-red-600 animate-pulse' : 'text-gray-400'}`}>Forma de Pagamento {!paymentDraft.method && <span className="text-red-500">*</span>}</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { id: 'PIX', icon: QrCode },
                  { id: 'Dinheiro', icon: Banknote },
                  { id: 'Cartão de Débito', label: 'Débito', icon: CreditCard },
                  { id: 'Cartão de Crédito', label: 'Crédito', icon: CreditCard },
                  { id: 'Carnê', icon: CalendarRange },
                  { id: 'Outros', icon: MoreHorizontal }
                ].map((m) => {
                  const isActive = paymentDraft.method === m.id;

                  // Classes fixas para cada método
                  const getButtonClasses = () => {
                    if (!isActive) return 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700';

                    switch (m.id) {
                      case 'PIX': return 'bg-green-100 border-green-600 text-green-800 shadow-md';
                      case 'Dinheiro': return 'bg-orange-100 border-orange-600 text-orange-800 shadow-md';
                      case 'Cartão de Débito': return 'bg-blue-100 border-blue-600 text-blue-800 shadow-md';
                      case 'Cartão de Crédito': return 'bg-indigo-100 border-indigo-600 text-indigo-800 shadow-md';
                      case 'Carnê': return 'bg-yellow-100 border-yellow-600 text-yellow-800 shadow-md';
                      case 'Outros': return 'bg-slate-100 border-slate-600 text-slate-800 shadow-md';
                      default: return 'bg-gray-100 border-gray-600 text-gray-800 shadow-md';
                    }
                  };

                  const getIconClasses = () => {
                    if (!isActive) return 'bg-gray-100 group-hover:bg-gray-200 text-gray-500';

                    switch (m.id) {
                      case 'PIX': return 'bg-green-300 text-green-900';
                      case 'Dinheiro': return 'bg-orange-300 text-orange-900';
                      case 'Cartão de Débito': return 'bg-blue-300 text-blue-900';
                      case 'Cartão de Crédito': return 'bg-indigo-300 text-indigo-900';
                      case 'Carnê': return 'bg-yellow-300 text-yellow-900';
                      case 'Outros': return 'bg-slate-300 text-slate-900';
                      default: return 'bg-gray-300 text-gray-900';
                    }
                  };

                  const getDotClasses = () => {
                    switch (m.id) {
                      case 'PIX': return 'bg-green-600';
                      case 'Dinheiro': return 'bg-orange-600';
                      case 'Cartão de Débito': return 'bg-blue-600';
                      case 'Cartão de Crédito': return 'bg-indigo-600';
                      case 'Carnê': return 'bg-yellow-600';
                      case 'Outros': return 'bg-slate-600';
                      default: return 'bg-gray-600';
                    }
                  };

                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (m.id === 'Outros') {
                          handleSelectPaymentMethod('Outros');
                          setShowPaymentPopover(v => !v);
                        } else {
                          handleSelectPaymentMethod(m.id);
                          // Focar no input de valor após selecionar método
                          setTimeout(() => amountInputRef.current?.focus(), 100);
                        }
                      }}
                      className={`relative h-14 sm:h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-200 group ${getButtonClasses()} ${isActive ? 'scale-[1.02]' : 'hover:scale-[1.02] hover:shadow-md'}`}
                    >
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-colors ${getIconClasses()}`}>
                        <m.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold text-center leading-tight px-1">{m.label || m.id}</span>

                      {isActive && (
                        <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full shadow-sm ${getDotClasses()}`} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom Payment Popover (Inline) */}
              {showPaymentPopover && (
                <div className="mt-2 p-3 bg-slate-50 rounded-xl border-2 border-slate-200 animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-slate-700">Métodos Personalizados</p>
                    <Button
                      size="sm"
                      onClick={() => navigate('/settings')}
                      className="h-8 px-3 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Adicionar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {settings?.payment_methods?.map(m => (
                      <Button
                        key={m}
                        size="sm"
                        onClick={() => { handleSelectPaymentMethod(m); setShowPaymentPopover(false); }}
                        className="h-8 text-xs rounded-lg bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold shadow-sm"
                      >
                        {m}
                      </Button>
                    ))}
                    {(!settings?.payment_methods || settings.payment_methods.length === 0) && (
                      <p className="text-xs text-slate-500 italic">Nenhum método personalizado. Clique em "+ Adicionar" para criar.</p>
                    )}
                  </div>
                </div>
              )}

              </div>

          <div className="bg-gray-50/50 rounded-2xl p-3 border border-gray-100">
              <div className="flex flex-col sm:flex-row gap-2 items-end">
                <div className="flex-1 w-full space-y-1">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Valor a Pagar (R$)</Label>
                  <Input
                    ref={amountInputRef}
                    type="number" step="0.01"
                    value={paymentDraft.amount}
                    onChange={e => setPaymentDraft({ ...paymentDraft, amount: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (editingPaymentIdx != null) commitEditPayment();
                        else handleAddPaymentWithPixCheck();
                      }
                    }}
                    className="h-9 rounded-xl border-gray-200 text-base font-bold bg-white shadow-sm"
                  />
                </div>
                {(paymentDraft.method === 'Cartão de Crédito' || paymentDraft.method === 'Carnê') && (
                  <div className="w-full sm:w-24 space-y-1">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Parcelas</Label>
                    <Input
                      type="number" min="1"
                      value={paymentDraft.installments}
                      onChange={e => setPaymentDraft({ ...paymentDraft, installments: e.target.value })}
                      className="h-9 rounded-xl border-gray-200 text-center text-sm font-bold bg-white shadow-sm"
                    />
                  </div>
                )}
                {paymentDraft.method === 'Carnê' && (
                  <div className="w-full sm:w-24 space-y-1">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">1ª Parc. (dias)</Label>
                    <Input
                      type="number" min="0"
                      value={paymentDraft.firstDueDays || 30}
                      onChange={e => setPaymentDraft({ ...paymentDraft, firstDueDays: e.target.value })}
                      className="h-9 rounded-xl border-gray-200 text-center text-sm font-bold bg-white shadow-sm"
                    />
                  </div>
                )}
                <Button
                  onClick={() => (editingPaymentIdx != null ? commitEditPayment() : handleAddPaymentWithPixCheck())}
                  className="h-9 px-4 rounded-xl bg-gray-900 text-white text-sm font-bold shadow-lg hover:bg-black hover:scale-105 transition-all w-full sm:w-auto flex items-center gap-2"
                >
                  {editingPaymentIdx != null ? 'Atualizar' : 'Adicionar'}
                  <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-white/20 rounded border border-white/30">↵</kbd>
                </Button>
              </div>
            </div>

            {/* Added Payments List */}
            {payments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pagamentos Lançados</Label>
                <div className="grid gap-2">
                  {payments.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-[10px] border-2 border-green-200">
                          R$
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-xs">R$ {Number(p.amount).toFixed(2)}</p>
                          <p className="text-xs text-gray-500 font-medium">
                            {p.method}
                            {p.installments > 1 && <span className="text-blue-600 ml-1">• {p.installments}x</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => startEditPayment(idx)}>
                          <FileText className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-red-50" onClick={() => { setConfirmRemovePaymentIdx(idx); setShowConfirmRemovePayment(true); }}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Fixed Bottom Section - Observations + Status Bar + Cashback */}
          <div className="shrink-0 bg-white border-t border-gray-100 p-3 space-y-2">
            {/* Observations */}
            <div>
              <Input
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder="Observações..."
                className="h-7 rounded-lg border-gray-200 focus:border-blue-300 transition-colors text-xs"
              />
            </div>

            {selectedCustomer && Number(selectedCustomer.cashback_balance || 0) > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-gray-600 font-semibold">Cashback</span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-purple-700">R$</span>
                  <Input
                    type="number" step="0.01" min="0" max={maxCashbackToUse}
                    value={cashbackToUse}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(Number(e.target.value || 0), maxCashbackToUse));
                      setCashbackToUse(v);
                    }}
                    className="h-7 w-24 pl-6 pr-2 rounded-full border-gray-200 text-xs font-bold bg-white"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] rounded-full text-purple-800 hover:bg-purple-50"
                  onClick={() => setCashbackToUse(maxCashbackToUse)}
                >
                  Tudo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] rounded-full text-purple-800 hover:bg-purple-50"
                  onClick={() => setCashbackToUse(0)}
                >
                  Limpar
                </Button>
                <span className="text-[10px] text-gray-500">Disp.: R$ {Number(selectedCustomer.cashback_balance || 0).toFixed(2)}</span>
              </div>
            )}

            {/* Status Bar + Cashback */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-2 rounded-xl bg-slate-100 border-2 border-slate-200">
                <p className="text-[9px] text-slate-600 font-bold uppercase">Total</p>
                <p className="text-xs font-bold text-slate-900">R$ {Math.max(0, calculateTotal() - discountAmount() - (cashbackToUse || 0)).toFixed(2)}</p>
              </div>
              <div className="p-2 rounded-xl bg-green-100 border-2 border-green-200">
                <p className="text-[9px] text-green-700 font-bold uppercase">Pago</p>
                <p className="text-xs font-bold text-green-800">R$ {sumPayments().toFixed(2)}</p>
              </div>
              <div className={`p-2 rounded-xl border-2 ${remainingAmount() > 0 ? 'bg-red-100 border-red-200' : 'bg-gray-100 border-gray-200 opacity-50'}`}>
                <p className={`text-[9px] font-bold uppercase ${remainingAmount() > 0 ? 'text-red-700' : 'text-gray-500'}`}>Falta</p>
                <p className={`text-xs font-bold ${remainingAmount() > 0 ? 'text-red-800' : 'text-gray-600'}`}>R$ {remainingAmount().toFixed(2)}</p>
              </div>
              <div className="p-2 rounded-xl bg-blue-100 border-2 border-blue-200">
                <p className="text-[9px] text-blue-700 font-bold uppercase">Troco</p>
                <p className="text-xs font-bold text-blue-900">R$ {sumPayments() > Math.max(0, calculateTotal() - discountAmount() - cashbackToUse) ? (sumPayments() - Math.max(0, calculateTotal() - discountAmount() - cashbackToUse)).toFixed(2) : '0.00'}</p>
              </div>
              {selectedCustomer && (
                <div className="p-2 rounded-xl bg-purple-100 border-2 border-purple-200">
                  <p className="text-[9px] text-purple-700 font-bold uppercase">Cashback</p>
                  <p className="text-xs font-bold text-purple-900">R$ {Number(selectedCustomer.cashback_balance || 0).toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Dialogs */}
      <div className="absolute">
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
