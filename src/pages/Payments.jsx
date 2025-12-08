import React, { useMemo, useState } from 'react'
import { startOfDay, endOfDay, isWithinInterval, isSameDay, isAfter, isBefore, addMonths, subMonths, format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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

export default function Payments() {
  const queryClient = useQueryClient()
  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.Sale.list('-created_date'), initialData: [] })
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list('-created_date'), initialData: [] })
  const { data: settings = null } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => { const list = await base44.entities.Settings.list(); return list.length > 0 ? list[0] : null },
    initialData: null,
  })

  const hasPixConfigured = Boolean(settings?.pix_key)

  const customerById = useMemo(() => {
    const m = new Map()
    for (const c of customers) m.set(c.id, c)
    return m
  }, [customers])

  // --- STATE ---
  const [currentMonth, setCurrentMonth] = useState(new Date()) // Mês exibido no calendário
  const [dateRange, setDateRange] = useState({ from: null, to: null }) // Seleção de data

  // State for Edit Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [targetInstallment, setTargetInstallment] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')

  // Estado do pop-up de boletos
  const [showBoletoDialog, setShowBoletoDialog] = useState(false)
  const [boletoPagesHtml, setBoletoPagesHtml] = useState('')

  // --- DATA PROCESSING ---
  const openCarnes = useMemo(() => {
    const result = []
    for (const s of sales) {
      const carnePayments = (s.payments || []).filter((p) => p.method === 'Carnê' && Array.isArray(p.schedule))
      for (const p of carnePayments) {
        const schedule = Array.isArray(p.schedule) ? p.schedule : []
        const cust = s.customer_id ? customerById.get(s.customer_id) : null
        for (const inst of schedule) {
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
    if (!dateRange.from) {
      // Se não tem range, mostra os próximos 30 dias ou todos? Vamos mostrar todos os vencidos e próximos.
      // O usuário pediu "os que estão pendentes nessa linha de racioncínio".
      // Se nada selecionado, vamos listar atrasados primeiro, depois próximos.
      return openCarnes
    }
    const from = startOfDay(dateRange.from)
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)

    return openCarnes.filter(i => isWithinInterval(i.due_date, { start: from, end: to }))
  }, [openCarnes, dateRange])

  const totalSelected = useMemo(() =>
    filteredList.reduce((sum, i) => sum + i.installment_amount, 0),
    [filteredList])


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
      setEditDialogOpen(false)
    }
  })

  const openEdit = (inst) => {
    setTargetInstallment(inst)
    setEditAmount(inst.installment_amount)
    setEditDate(new Date(inst.due_date).toISOString().split('T')[0])
    setEditDialogOpen(true)
  }

  const saveEdit = () => {
    if (!targetInstallment) return
    const sale = sales.find(s => s.id === targetInstallment.sale_id)
    if (!sale) return

    const newPayments = (sale.payments || []).map(p => {
      if (p.method === 'Carnê' && Array.isArray(p.schedule)) {
        const newSchedule = p.schedule.map(item => {
          if (item.index === targetInstallment.installment_index) {
            return {
              ...item,
              amount: parseFloat(editAmount),
              due_date: new Date(editDate).toISOString()
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

  const deleteInstallment = (inst) => {
    if (!confirm('Tem certeza que deseja excluir esta parcela?')) return
    const sale = sales.find(s => s.id === inst.sale_id)
    if (!sale) return

    const newPayments = (sale.payments || []).map(p => {
      if (p.method === 'Carnê' && Array.isArray(p.schedule)) {
        const newSchedule = p.schedule.filter(item => item.index !== inst.installment_index)
        return { ...p, schedule: newSchedule }
      }
      return p
    })

    updateSaleMutation.mutate({ id: sale.id, updates: { payments: newPayments } })
  }

  // Reuse existing PIX helper functions logic
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
      const brandTitle = sanitizeEmvText(settings?.erp_name || 'LOJA', 25)
      const brandCnpj = settings?.company_cnpj || 'CNPJ não cadastrado'
      const brandAddr = [settings?.company_address, settings?.company_zip, settings?.company_city, settings?.company_state].filter(Boolean).join(' - ')

      return `<div class="receipt"><div class="receipt__grid"><div class="receipt__left"><div class="hdr">${brandTitle}</div><div class="sub">${brandCnpj}</div><div class="sub">${brandAddr || 'Endereço não cadastrado'}</div><div class="kv"><span class="k">Cliente</span><span class="v">${installment.customer_name || ''}</span></div><div class="kv"><span class="k">Parcela</span><span class="v">${it.index}/${installment.installments_total}</span></div><div class="kv"><span class="k">Vencimento</span><span class="v">${dateStr}</span></div><div class="kv"><span class="k">Valor</span><span class="v">R$ ${amount}</span></div></div><div class="receipt__right"><img src="${qrSrc}" alt="QR PIX" class="qr"/><div class="contact">${settings?.contact_email || 'email@loja.com'}</div></div></div></div>`
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

  const handlePrintPdf = () => {
    const styleTag = boletoPagesHtml.match(/<style>[\s\S]*<\/style>/)?.[0] || '<style></style>'
    const innerCss = styleTag.replace(/^<style>/, '').replace(/<\/style>$/, '')
    const extraCss = `@page { size: A4; margin: 12mm; } body { margin: 0; } .receipts { max-height: none !important; overflow: visible !important; padding-right: 0 !important; } .receipt { break-inside: avoid; page-break-inside: avoid; }`
    const finalStyle = `<style>${innerCss}\n${extraCss}</style>`
    const content = boletoPagesHtml.replace(/<style>[\s\S]*<\/style>/, '')
    const doc = `<!doctype html><html><head><meta charset="utf-8"/><title>Boletos PIX</title>${finalStyle}</head><body>${content}</body></html>`
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(doc)
      win.document.close()
      win.focus()
      setTimeout(() => { try { win.print() } finally { win.close() } }, 200)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <h1>Pagamentos Debug Mode</h1>
      <p>Se você vê isso, o problema está na renderização do calendário ou lista.</p>
    </div>
  )
}
