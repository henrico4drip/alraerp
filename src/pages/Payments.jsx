import React, { useMemo, useState, useRef } from 'react'
import { startOfDay, endOfDay, isWithinInterval, isSameDay, isAfter, isBefore, addMonths, subMonths, format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Banknote } from 'lucide-react'
import { useEffectiveSettings } from '@/hooks/useEffectiveSettings'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import RequirePermission from '@/components/RequirePermission'

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Helpers EMV Pix (payload copia-e-cola e QR)
const pad = (n, size = 2) => String(n).padStart(size, '0')
const emvField = (id, value) => {
  const v = String(value)
  return `${pad(id)}${pad(v.length)}${v}`
}
// CRC16-CCITT (0xFFFF)
const crc16 = (payload) => {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc = crc << 1
      }
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Sanitização conforme práticas comuns do EMV/PIX (remover acentos e caracteres inválidos)
const removeDiacritics = (s) => s.normalize('NFD').replace(/\p{Diacritic}+/gu, '')
const sanitizeEmvText = (s, maxLen) => {
  const noAccents = removeDiacritics(String(s || ''))
  const cleaned = noAccents.replace(/[^A-Za-z0-9 .\-]/g, '')
  return cleaned.toUpperCase().slice(0, maxLen || cleaned.length)
}
const sanitizeTxid = (s) => {
  const cleaned = String(s || '').replace(/[^A-Za-z0-9]/g, '')
  return cleaned.slice(0, 25) || 'TX'
}

const buildPixEmvPayload = ({ key, amount, name, city, txid, description }) => {
  const gui = emvField(0, 'br.gov.bcb.pix')
  const chave = emvField(1, key)
  const desc = description ? emvField(2, String(description).slice(0, 99)) : ''
  const mai = emvField(26, `${gui}${chave}${desc}`) // Merchant Account Information

  const mcc = emvField(52, '0000') // Merchant Category Code
  const curr = emvField(53, '986') // BRL
  const v = Number(amount || 0).toFixed(2)
  const amountField = emvField(54, v)
  const country = emvField(58, 'BR')
  const merchantName = emvField(59, sanitizeEmvText(name || 'LOJA', 25))
  const merchantCity = emvField(60, sanitizeEmvText(city || 'CIDADE', 15))
  const tx = emvField(5, sanitizeTxid(txid))
  const addData = emvField(62, `${tx}`)

  // Ponto de iniciação (estático)
  const poi = emvField(1, '11')

  // Sem CRC
  const partial = `${emvField(0, '01')}${poi}${mai}${mcc}${curr}${amountField}${country}${merchantName}${merchantCity}${addData}`
  const crcHeader = '63' + '04'
  const full = partial + crcHeader
  const crc = crc16(full)
  return partial + crcHeader + crc
}

const asPaymentsArray = (p) => Array.isArray(p) ? p : (p ? [p] : [])

import AccountsPayable from '@/components/AccountsPayable'

export default function Payments() {
  const queryClient = useQueryClient()
  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.Sale.list('-created_date'), initialData: [] })
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list('-created_date'), initialData: [] })
  const effectiveSettings = useEffectiveSettings()
  const hasPixConfigured = Boolean(effectiveSettings?.pix_key)

  const customerById = useMemo(() => {
    const m = new Map()
    for (const c of customers) m.set(c.id, c)
    return m
  }, [customers])

  // --- STATE ---
  const [activeTab, setActiveTab] = useState('receivables') // 'receivables' | 'payables'
  const [currentMonth, setCurrentMonth] = useState(new Date()) // Mês exibido no calendário
  const [dateRange, setDateRange] = useState({ from: null, to: null }) // Seleção de data

  // State for Abate Dialog
  const [abateDialogOpen, setAbateDialogOpen] = useState(false)
  const [targetAbateInstallment, setTargetAbateInstallment] = useState(null)
  const [abateAmount, setAbateAmount] = useState('')
  const [abateDueDate, setAbateDueDate] = useState('')
  const [abateType, setAbateType] = useState('full') // 'full' | 'partial'

  // State for Installments List Dialog
  const [selectedSaleId, setSelectedSaleId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Estado do pop-up de boletos
  const [showBoletoDialog, setShowBoletoDialog] = useState(false)
  const [boletoPagesHtml, setBoletoPagesHtml] = useState('')
  const boletoRef = useRef(null)


  // --- DATA PROCESSING ---
  const openCarnes = useMemo(() => {
    const result = []
    if (!Array.isArray(sales)) return []
    for (const s of sales) {
      if (!s) continue
      const carnePayments = asPaymentsArray(s.payments).filter((p) => p.method === 'Carnê' && Array.isArray(p.schedule))
      for (const p of carnePayments) {
        const schedule = Array.isArray(p.schedule) ? p.schedule : []
        const cust = s.customer_id ? customerById.get(s.customer_id) : null
        for (const inst of schedule) {
          if (!inst) continue
          const due = new Date(inst.due_date)
          const isOpen = inst.status !== 'paid'
          // Validate date to avoid crashes
          if (isOpen && isValid(due)) {
            result.push({
              sale_id: s.id,
              customer_id: s.customer_id,
              customer_name: s.customer_name,
              customer_phone: cust?.phone || '',
              total: Number(s.total_amount || 0),
              schedule,
              installments_total: schedule.length,
              installment_index: inst.index,
              installment_amount: Number(inst.amount || 0),
              due_date: due,
            })
          }
        }
      }
    }
    return result.sort((a, b) => a.due_date - b.due_date)
  }, [sales, customerById])

  const today = startOfDay(new Date())

  // Financial Summaries
  const totalOverdue = useMemo(() =>
    openCarnes.filter(i => isBefore(i.due_date, today)).reduce((sum, i) => sum + i.installment_amount, 0),
    [openCarnes, today])

  const totalOpenGeneral = useMemo(() =>
    openCarnes.reduce((sum, i) => sum + i.installment_amount, 0),
    [openCarnes])

  // Filtered List based on Range
  const filteredList = useMemo(() => {
    const base = !dateRange.from
      ? openCarnes
      : openCarnes.filter(i => isWithinInterval(i.due_date, { start: startOfDay(dateRange.from), end: dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from) }))

    if (!searchTerm) return base

    const lowerTerm = searchTerm.toLowerCase()
    return base.filter(i =>
      i.customer_name?.toLowerCase().includes(lowerTerm) ||
      String(i.installment_amount).includes(lowerTerm)
    )
  }, [openCarnes, dateRange, searchTerm])

  const totalSelected = useMemo(() =>
    filteredList.reduce((sum, i) => sum + i.installment_amount, 0),
    [filteredList])

  // Logic for Installment List Dialog
  const selectedSaleForList = useMemo(() =>
    sales.find(s => s.id === selectedSaleId),
    [sales, selectedSaleId]
  )

  const openInstallmentsList = useMemo(() => {
    if (!selectedSaleForList) return []
    const result = []
    const s = selectedSaleForList
    const carnePayments = asPaymentsArray(s.payments).filter((p) => p.method === 'Carnê' && Array.isArray(p.schedule))

    for (const p of carnePayments) {
      const schedule = Array.isArray(p.schedule) ? p.schedule : []
      for (const inst of schedule) {
        if (inst.status !== 'paid') {
          result.push({
            ...inst,
            sale_id: s.id,
            customer_id: s.customer_id,
            customer_name: s.customer_name,
            installments_total: schedule.length,
            installment_index: inst.index,
            installment_amount: Number(inst.amount || 0),
          })
        }
      }
    }
    return result.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
  }, [selectedSaleForList])

  // --- CALENDAR LOGIC ---
  const handleDayClick = (day) => {
    if (!dateRange.from || (dateRange.from && dateRange.to)) {
      // Start new selection
      setDateRange({ from: day, to: null })
      return
    }
    // Have 'from', selecting 'to'
    if (isBefore(day, dateRange.from)) {
      // Clicked before start -> reset start
      setDateRange({ from: day, to: null })
    } else {
      // Complete range
      setDateRange({ ...dateRange, to: day })
    }
  }

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const date = new Date(year, month, 1)
    const days = []
    while (date.getMonth() === month) {
      days.push(new Date(date))
      date.setDate(date.getDate() + 1)
    }
    return days
  }, [currentMonth])

  const firstDayOfWeek = daysInMonth[0].getDay() // 0 = Sunday
  const emptyDays = Array(firstDayOfWeek).fill(null)

  const isDaySelected = (day) => {
    if (!dateRange.from) return false
    if (isSameDay(day, dateRange.from)) return true
    if (dateRange.to && isSameDay(day, dateRange.to)) return true
    if (dateRange.to && isWithinInterval(day, { start: dateRange.from, end: dateRange.to })) return true
    return false
  }

  const getDayStyle = (day) => {
    if (!dateRange.from) return 'hover:bg-gray-100 rounded-lg'

    const isStart = isSameDay(day, dateRange.from)
    const isEnd = dateRange.to && isSameDay(day, dateRange.to)
    const isIn = dateRange.to && isWithinInterval(day, { start: dateRange.from, end: dateRange.to })

    if (isStart && isEnd) return 'bg-[#3490c7] text-white rounded-lg shadow-md z-10'
    if (isStart) return 'bg-[#3490c7] text-white rounded-l-lg shadow-md z-10'
    if (isEnd) return 'bg-[#3490c7] text-white rounded-r-lg shadow-md z-10'
    if (isIn) return 'bg-[#3490c7]/20 text-[#3490c7]' // Middle range
    return 'hover:bg-gray-100 rounded-lg'
  }

  // --- ACTIONS ---
  const updateSaleMutation = useMutation({
    mutationFn: ({ id, updates }) => base44.entities.Sale.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['sales'])
      setAbateDialogOpen(false)
    }
  })

  // Open Abate Dialog
  const handleOpenAbate = (inst) => {
    setTargetAbateInstallment(inst)
    setAbateAmount(inst.installment_amount)
    setAbateDueDate(inst.due_date ? new Date(inst.due_date).toISOString().split('T')[0] : '')
    setAbateType('full')
    setAbateDialogOpen(true)
  }

  // Update Date Only
  const handleUpdateDateOnly = () => {
    if (!targetAbateInstallment) return
    const sale = sales.find(s => s.id === targetAbateInstallment.sale_id)
    if (!sale) return

    const newPayments = asPaymentsArray(sale.payments).map(p => {
      if (p.method === 'Carnê' && Array.isArray(p.schedule)) {
        const newSchedule = p.schedule.map(item => {
          if (item.index === targetAbateInstallment.installment_index) {
            return {
              ...item,
              due_date: new Date(abateDueDate).toISOString()
            }
          }
          return item
        })
        return { ...p, schedule: newSchedule }
      }
      return p
    })

    updateSaleMutation.mutate({ id: sale.id, updates: { payments: newPayments } })
  }

  // Save Abate (Full or Partial)
  const handleSaveAbate = () => {
    if (!targetAbateInstallment) return
    const sale = sales.find(s => s.id === targetAbateInstallment.sale_id)
    if (!sale) return

    const amountToPay = parseFloat(abateAmount)
    if (!amountToPay || amountToPay <= 0) {
      alert('Valor inválido')
      return
    }

    const currentAmount = targetAbateInstallment.installment_amount

    // Se valor for maior que o restante, avisa (ou ajusta pra full)
    if (amountToPay > currentAmount + 0.01) { // margem de erro
      alert('Valor a pagar não pode ser maior que o valor da parcela.')
      return
    }

    const isFullPayment = Math.abs(amountToPay - currentAmount) < 0.01 || abateType === 'full'
    const finalPayValue = isFullPayment ? currentAmount : amountToPay

    const newPayments = asPaymentsArray(sale.payments).map(p => {
      if (p.method === 'Carnê' && Array.isArray(p.schedule)) {
        let newSchedule = [...p.schedule]

        // Find component index to modify
        const idx = newSchedule.findIndex(item => item.index === targetAbateInstallment.installment_index)
        if (idx === -1) return p

        if (isFullPayment) {
          // Marca como pago
          newSchedule[idx] = {
            ...newSchedule[idx],
            status: 'paid',
            value_paid: finalPayValue,
            payment_date: new Date().toISOString()
            // Mantém due_date original ou atualiza também? Geralmente mantém o histórico de quando venceu.
          }
        } else {
          // Pagamento Parcial:
          // 1. Atualiza parcela atual com o valor restante e NOVA DATA (se alterada)
          const remaining = currentAmount - finalPayValue
          newSchedule[idx] = {
            ...newSchedule[idx],
            amount: remaining,
            due_date: new Date(abateDueDate).toISOString() // Aplica nova data ao restante
          }

          // 2. Cria nova parcela "filha" já paga
          // Para evitar colisão de index, podemos usar decimal ou string composta, 
          // mas index numérico é comum. Vamos tentar manter numérico se possível ou converter pra string.
          // Se o sistema espera index numérico, pode ser tricky. Vamos assumir que index é só identificador.
          const paidInstallment = {
            ...newSchedule[idx], // copia dados base
            index: `${targetAbateInstallment.installment_index}.P`, // P de Partial
            amount: finalPayValue,
            status: 'paid',
            value_paid: finalPayValue,
            payment_date: new Date().toISOString(),
            due_date: new Date().toISOString(), // Pago hoje
            original_index: targetAbateInstallment.installment_index
          }
          // Adiciona ao schedule
          newSchedule.push(paidInstallment)
        }

        return { ...p, schedule: newSchedule }
      }
      return p
    })

    updateSaleMutation.mutate({ id: sale.id, updates: { payments: newPayments } })
  }

  const deleteInstallment = (inst) => {
    if (!confirm('Tem certeza que deseja excluir esta parcela?')) return
    const sale = sales.find(s => s.id === inst.sale_id)
    if (!sale) return

    const newPayments = asPaymentsArray(sale.payments).map(p => {
      if (p.method === 'Carnê' && Array.isArray(p.schedule)) {
        const newSchedule = p.schedule.filter(item => item.index !== inst.installment_index)
        return { ...p, schedule: newSchedule }
      }
      return p
    })

    updateSaleMutation.mutate({ id: sale.id, updates: { payments: newPayments } })
  }

  // Reuse existing PIX helper functions logic
  const renderPixQrSrc = (amount, txid) => {
    const payload = buildPixEmvPayload({
      key: effectiveSettings?.pix_key || '',
      amount,
      name: effectiveSettings?.erp_name || effectiveSettings?.company_name || 'LOJA',
      city: effectiveSettings?.company_city || 'CIDADE',
      txid,
      description: `Parcela ${txid}`,
    })
    const data = encodeURIComponent(payload)
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${data}`
  }

  const handleOpenWhatsapp = (installment) => {
    const phoneRaw = installment?.customer_phone || ''
    const digits = String(phoneRaw).replace(/\D/g, '')
    const phoneWithCountry = digits ? `55${digits}` : ''
    const dueStr = isValid(new Date(installment.due_date)) ? new Date(installment.due_date).toLocaleDateString('pt-BR') : ''
    const txid = `${installment.sale_id}-${String(installment.installment_index).padStart(2, '0')}`
    const payload = buildPixEmvPayload({
      key: effectiveSettings?.pix_key || '',
      amount: installment.installment_amount,
      name: effectiveSettings?.erp_name || effectiveSettings?.company_name || 'LOJA',
      city: effectiveSettings?.company_city || 'CIDADE',
      txid,
      description: `Parcela ${installment.installment_index}/${installment.installments_total}`,
    })
    const msg = `Olá${installment.customer_name ? ` ${installment.customer_name.split(' ')[0]}` : ''}!\nSegue boleto PIX da parcela ${installment.installment_index}/${installment.installments_total}.\nValor: R$ ${Number(installment.installment_amount).toFixed(2)}\nVencimento: ${dueStr}\nChave PIX: ${effectiveSettings?.pix_key || ''}\nCódigo copia-e-cola:\n${payload}`
    if (!phoneWithCountry) {
      try { navigator.clipboard.writeText(msg) } catch { }
      alert('Cliente sem telefone válido. Mensagem copiada para a área de transferência.')
      return
    }
    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const handleGenerateBoletoPix = (installment) => {
    if (!hasPixConfigured) {
      alert('Configure sua chave PIX em Configurações para gerar o boleto/QR.')
      return
    }
    const schedule = Array.isArray(installment.schedule) ? installment.schedule : []
    const buildReceipt = (it) => {
      const d = new Date(it.due_date)
      const txid = `${installment.sale_id}-${String(it.index).padStart(2, '0')}`
      const qrSrc = renderPixQrSrc(it.amount, txid)
      const amount = Number(it.amount || 0).toFixed(2)
      const dateStr = d.toLocaleDateString('pt-BR')
      const brandTitle = sanitizeEmvText(effectiveSettings?.erp_name || 'LOJA', 25)
      const brandCnpj = effectiveSettings?.company_cnpj || 'CNPJ não cadastrado'
      const brandAddr = [effectiveSettings?.company_address, effectiveSettings?.company_zip, effectiveSettings?.company_city, effectiveSettings?.company_state].filter(Boolean).join(' - ')

      return `<div class="receipt"><div class="receipt__grid"><div class="receipt__left"><div class="hdr">${brandTitle}</div><div class="sub">${brandCnpj}</div><div class="sub">${brandAddr || 'Endereço não cadastrado'}</div><div class="kv"><span class="k">Cliente</span><span class="v">${installment.customer_name || ''}</span></div><div class="kv"><span class="k">Parcela</span><span class="v">${it.index}/${installment.installments_total}</span></div><div class="kv"><span class="k">Vencimento</span><span class="v">${dateStr}</span></div><div class="kv"><span class="k">Valor</span><span class="v">R$ ${amount}</span></div></div><div class="receipt__right"><img src="${qrSrc}" alt="QR PIX" class="qr" crossorigin="anonymous"/><div class="contact">${effectiveSettings?.contact_email || 'email@loja.com'}</div></div></div></div>`
    }
    const pages = schedule.map(buildReceipt).join('\n')
    const style = `<style>.receipts { max-height: 70vh; overflow-y: auto; overflow-x: hidden; padding-right: 6px; } .receipt { border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 10px; background: #fff; max-width: 100%; } .receipt__grid { display: grid; grid-template-columns: minmax(0,1fr) 180px; gap: 10px; padding: 10px; align-items: start; } .receipt__left { display: flex; flex-direction: column; gap: 6px; } .hdr { font-weight: 700; color: #111827; } .sub { font-size: 12px; color: #374151; } .kv { display: grid; grid-template-columns: 100px 1fr; gap: 6px; } .k { color: #374151; font-weight: 600; } .v { font-weight: 600; } .receipt__right { display: flex; flex-direction: column; align-items: center; gap: 6px; } .qr { width: 160px; height: 160px; border: 1px solid #e5e7eb; border-radius: 8px; object-fit: contain; } .contact { font-family: monospace; color: #111827; text-align: center; font-size: 12px; } </style>`
    setBoletoPagesHtml(style + `<div class="receipts">${pages}</div>`)
    setShowBoletoDialog(true)
  }

  const handleDownloadHtml = () => {
    const doc = `<!doctype html><html><head><meta charset="utf-8"/><title>Boletos PIX</title>${boletoPagesHtml.match(/<style>[\s\S]*<\/style>/)?.[0] || ''}</head><body>${boletoPagesHtml.replace(/<style>[\s\S]*<\/style>/, '')}</body></html>`
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'boletos_pix.html'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const handleDownloadPdf = async () => {
    const node = boletoRef.current
    if (!node) return
    try {
      const canvas = await html2canvas(node, { scale: 2, useCORS: true, allowTaint: false })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = 210 - 24
      const pageHeight = 297 - 24
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 12
      pdf.addImage(imgData, 'PNG', 12, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        pdf.addPage()
        position = 12 - (imgHeight - heightLeft)
        pdf.addImage(imgData, 'PNG', 12, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      pdf.save('boletos_pix.pdf')
    } catch (e) {
      alert('Falha ao gerar PDF. Tente usar "Baixar HTML" e imprimir em PDF.')
    }
  }

  return (
    <RequirePermission permission="financial">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <div className="bg-gray-100 p-1 rounded-xl flex">
            <button
              onClick={() => setActiveTab('receivables')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'receivables' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              A Receber
            </button>
            <button
              onClick={() => setActiveTab('payables')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'payables' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              A Pagar
            </button>
          </div>
        </div>

        {activeTab === 'payables' ? (
          <AccountsPayable />
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex flex-col justify-between h-24">
                <div className="text-red-900 font-medium text-sm uppercase tracking-wide">Vencido</div>
                <div className="text-2xl font-bold text-red-700">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col justify-between h-24">
                <div className="text-blue-900 font-medium text-sm uppercase tracking-wide">A Receber Total</div>
                <div className="text-2xl font-bold text-blue-700">R$ {totalOpenGeneral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className={`p-4 rounded-2xl border flex flex-col justify-between h-24 transition-colors ${dateRange.from ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                <div className="text-indigo-900 font-medium text-sm uppercase tracking-wide">
                  {dateRange.from ? 'Selecionado' : 'Selecione um período'}
                </div>
                <div className="text-2xl font-bold text-indigo-700">
                  {dateRange.from ? `R$ ${totalSelected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-tutorial="payments-main">

              {/* Calendar Section (Left Side) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold capitalize text-gray-900">
                      {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-full">‹</Button>
                      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-full">›</Button>
                    </div>
                  </div>

                  {/* Weekdays */}
                  <div className="grid grid-cols-7 mb-2">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                      <div key={`weekday-${i}`} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d}</div>
                    ))}
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-y-1 gap-x-0 relative">
                    {emptyDays.map((_, i) => <div key={`empty-${i}`} />)}
                    {daysInMonth.map(day => {
                      const isOverdue = openCarnes.some(c => isSameDay(new Date(c.due_date), day) && isBefore(day, today))
                      const hasPayment = openCarnes.some(c => isSameDay(new Date(c.due_date), day))

                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => handleDayClick(day)}
                          className={`
                      relative w-full aspect-square flex items-center justify-center text-sm font-medium transition-all group
                      ${getDayStyle(day)}
                      ${isSameDay(day, new Date()) && !isDaySelected(day) ? 'text-blue-600 font-bold' : ''}
                    `}
                        >
                          <span className="relative z-20">{day.getDate()}</span>

                          {/* Dots indicators */}
                          <div className="absolute bottom-1.5 flex gap-0.5 z-20">
                            {isOverdue && <div className="w-1 h-1 rounded-full bg-red-500" />}
                            {!isOverdue && hasPayment && <div className="w-1 h-1 rounded-full bg-green-500" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-center text-gray-500">
                    Clique numa data inicial e outra final para filtrar.<br />
                    Boletinha <span className="text-red-500">vermelha</span> indica atraso.
                  </div>
                  {dateRange.from && (
                    <div className="mt-2 text-center">
                      <Button variant="outline" size="sm" onClick={() => setDateRange({ from: null, to: null })} className="rounded-xl text-xs h-7">
                        Limpar Filtro
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* List Section (Right Side) */}
              <div className="lg:col-span-8">
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                  <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/50">
                    <div className="flex-1 w-full">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-900">
                          {dateRange.from ? 'Extrato do Período' : 'Todos os Lançamentos'}
                        </h2>
                        <div className="text-right">
                          <div className="text-[10px] text-gray-400 uppercase font-semibold">Total Listado</div>
                          <div className="text-lg font-bold text-gray-900 leading-none">R$ {totalSelected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </div>
                      </div>

                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        </div>
                        <input
                          type="text"
                          placeholder="Buscar cliente ou valor..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                        />
                      </div>

                      <p className="text-[10px] text-gray-400 mt-2">
                        {dateRange.from
                          ? `${dateRange.from.toLocaleDateString('pt-BR')} ${dateRange.to ? 'até ' + dateRange.to.toLocaleDateString('pt-BR') : ''}`
                          : 'Exibindo lista completa de pendências e atrasos'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {filteredList.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                        <div className="text-4xl mb-2">💸</div>
                        <p>Sem parcelas neste filtro.</p>
                      </div>
                    ) : (
                      filteredList.map((item, idx) => {
                        const itemDate = new Date(item.due_date)
                        const isLate = isValid(itemDate) && isBefore(itemDate, today)
                        return (
                          <div key={`${item.sale_id}-${item.installment_index}-${idx}`}
                            className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors hover:shadow-sm
                            ${isLate ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                             ${isLate ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}
                           `}>
                                {item.installment_index}
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">{item.customer_name}</h4>
                                <div className="text-xs flex gap-2 text-gray-500">
                                  <span>Vence: {isValid(itemDate) ? itemDate.toLocaleDateString('pt-BR') : 'Data Inválida'}</span>
                                  {isLate && <span className="text-red-600 font-bold">• ATRASADO</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                              <div className="text-right mr-2">
                                <div className="font-bold text-gray-900">R$ {item.installment_amount.toFixed(2)}</div>
                                <div className="text-[10px] text-gray-400">Total Venda: R$ {item.total.toFixed(2)}</div>
                              </div>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 hover:bg-gray-200" onClick={() => handleGenerateBoletoPix(item)} title="QR Code">
                                  <span className="text-xs">QR</span>
                                </Button>
                                <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 hover:bg-green-100 text-green-600" onClick={() => handleOpenWhatsapp(item)} title="WhatsApp">
                                  <span className="text-xs">WA</span>
                                </Button>
                                <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 hover:bg-blue-100 text-blue-600" onClick={() => setSelectedSaleId(item.sale_id)} title="Ver parcelas">
                                  <Banknote className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Footer Total if needed */}
                  <div className="p-4 border-t border-gray-100 bg-gray-50 text-center text-xs text-gray-400">
                    Mostrando {filteredList.length} parcelas
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Helper Dialogs */}
        <Dialog open={showBoletoDialog} onOpenChange={setShowBoletoDialog}>
          <DialogContent className="max-w-4xl w-[90vw]">
            <DialogHeader><DialogTitle>Boletos PIX</DialogTitle></DialogHeader>
            <div ref={boletoRef} dangerouslySetInnerHTML={{ __html: boletoPagesHtml }} />
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={handleDownloadPdf} className="rounded-xl">Baixar PDF</Button>
              <Button onClick={handleDownloadHtml} className="rounded-xl" variant="secondary">Baixar HTML</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={abateDialogOpen} onOpenChange={setAbateDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader><DialogTitle>Abater Parcela</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-medium">Valor Atual</p>
                  <p className="text-xl font-bold text-gray-900">R$ {targetAbateInstallment?.installment_amount?.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase font-medium block">Vencimento</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold h-[52px]"
                    value={abateDueDate}
                    onChange={(e) => setAbateDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Tipo de Pagamento</label>
                <div className="flex gap-2">
                  <Button
                    variant={abateType === 'full' ? 'default' : 'outline'}
                    onClick={() => { setAbateType('full'); setAbateAmount(targetAbateInstallment?.installment_amount); }}
                    className="flex-1 rounded-xl"
                  >
                    Total
                  </Button>
                  <Button
                    variant={abateType === 'partial' ? 'default' : 'outline'}
                    onClick={() => { setAbateType('partial'); setAbateAmount(''); }}
                    className="flex-1 rounded-xl"
                  >
                    Parcial
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Valor a Pagar (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-lg font-semibold"
                  value={abateAmount}
                  onChange={(e) => setAbateAmount(e.target.value)}
                  disabled={abateType === 'full'}
                />
                {abateType === 'partial' && targetAbateInstallment && (Number(abateAmount) > 0) && (
                  <p className="text-xs text-gray-500 text-right">
                    Restante: R$ {(targetAbateInstallment.installment_amount - Number(abateAmount)).toFixed(2)}
                  </p>
                )}
              </div>

              <div className="pt-2 flex gap-2 justify-end">
                <Button variant="ghost" className="rounded-xl mr-auto text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={handleUpdateDateOnly} title="Salvar apenas a nova data">
                  Salvar Data
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setAbateDialogOpen(false)}>Cancelar</Button>
                <Button className="rounded-xl bg-green-600 hover:bg-green-700" onClick={handleSaveAbate} disabled={updateSaleMutation.isLoading}>
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={!!selectedSaleId} onOpenChange={(open) => !open && setSelectedSaleId(null)}>
          <DialogContent className="max-w-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle>Parcelas em Aberto</DialogTitle>
              <p className="text-sm text-gray-500">{selectedSaleForList?.customer_name || ''}</p>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto p-1">
              {openInstallmentsList.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma parcela em aberto.</p>
              ) : (
                openInstallmentsList.map((inst) => (
                  <div
                    key={`${inst.sale_id}-${inst.index}`}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer shadow-sm transition-all"
                    onClick={() => {
                      handleOpenAbate(inst)
                      setSelectedSaleId(null)
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-700">
                        {inst.installment_index}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-xs text-gray-500">
                          Vencimento
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900">
                        R$ {Number(inst.installment_amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-green-600 font-medium">ABERTO</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setSelectedSaleId(null)}>Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RequirePermission>
  )
}
