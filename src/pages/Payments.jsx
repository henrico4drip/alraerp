import React, { useMemo, useState } from 'react'
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

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  // Estado do pop-up de boletos
  const [showBoletoDialog, setShowBoletoDialog] = useState(false)
  const [boletoPagesHtml, setBoletoPagesHtml] = useState('')

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
          if (isOpen) {
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
    return result
  }, [sales, customerById])

  // Substitui "filtered" por duas listas: atrasados e a vencer neste mês
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const overdue = useMemo(
    () => openCarnes.filter((i) => i.due_date < today),
    [openCarnes, today]
  )
  const dueThisMonth = useMemo(
    () => openCarnes.filter((i) => i.due_date.getFullYear() === year && i.due_date.getMonth() === month && i.due_date >= today),
    [openCarnes, year, month, today]
  )

  const years = useMemo(() => {
    const ys = new Set([now.getFullYear()])
    for (const i of openCarnes) ys.add(i.due_date.getFullYear())
    return Array.from(ys).sort((a,b)=>a-b)
  }, [openCarnes])

  const renderPixQrSrc = (amount, txidRaw) => {
    if (!hasPixConfigured) return ''
    const txid = sanitizeTxid(txidRaw)
    const code = buildPixEmvPayload({
      key: String(settings?.pix_key || ''),
      amount: Number(amount || 0),
      name: settings?.erp_name || 'LOJA',
      city: (settings?.company_city || 'CIDADE'),
      txid,
    })
    const data = encodeURIComponent(code)
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${data}`
  }

  const sanitizePhone = (raw) => {
    const digits = (raw || '').replace(/\D/g, '')
    if (!digits) return ''
    return digits.startsWith('55') ? digits : `55${digits}`
  }

  const buildWhatsAppMessage = (installment) => {
    const firstName = (installment.customer_name || '').trim().split(/\s+/)[0] || ''
    const lines = [
      `Olá ${firstName}, segue boleto da parcela ${installment.installment_index}/${installment.installments_total}.`,
      `Vencimento: ${installment.due_date.toLocaleDateString('pt-BR')}`,
      `Valor da parcela: R$ ${Number(installment.installment_amount).toFixed(2)}`,
      `Total da venda: R$ ${Number(installment.total || 0).toFixed(2)}`,
    ]

    if (Array.isArray(installment.schedule) && installment.schedule.length > 0) {
      lines.push('\nParcelas:')
      for (const it of installment.schedule) {
        const d = new Date(it.due_date)
        lines.push(`- ${it.index}: ${d.toLocaleDateString('pt-BR')} • R$ ${Number(it.amount || 0).toFixed(2)}${it.index === installment.installment_index ? ' (esta)' : ''}`)
      }
    }

    // PIX: mantém chave e link do QR; remove copia-e-cola do WhatsApp
    if (hasPixConfigured) {
      const txid = `${installment.sale_id}-${String(installment.installment_index).padStart(2,'0')}`
      const qr = renderPixQrSrc(installment.installment_amount, txid)
      lines.push('')
      lines.push(`Chave PIX: ${String(settings?.pix_key || '')}`)
      lines.push(`QR Code (link): ${qr}`)
    }

    return lines.filter(Boolean).join('\n')
  }

  const handleOpenWhatsapp = (installment) => {
    const text = encodeURIComponent(buildWhatsAppMessage(installment))
    const phone = sanitizePhone(installment.customer_phone)
    const waUrl = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`
    window.open(waUrl, '_blank')
  }

  const handleGenerateBoletoPix = (installment) => {
    if (!hasPixConfigured) {
      alert('Configure sua chave PIX em Configurações para gerar o boleto/QR.')
      return
    }

    const schedule = Array.isArray(installment.schedule) ? installment.schedule : []
    if (schedule.length === 0) {
      alert('Não há parcelas para gerar boletos.')
      return
    }

    const buildReceipt = (it) => {
      const d = new Date(it.due_date)
      const txid = `${installment.sale_id}-${String(it.index).padStart(2,'0')}`
      const qrSrc = renderPixQrSrc(it.amount, txid)
      const amount = Number(it.amount || 0).toFixed(2)
      const dateStr = d.toLocaleDateString('pt-BR')

      const brandTitle = sanitizeEmvText(settings?.erp_name || 'LOJA', 25)
      const brandCnpj = settings?.company_cnpj || 'CNPJ não cadastrado'
      const brandAddr = [settings?.company_address, settings?.company_zip, settings?.company_city, settings?.company_state]
        .filter(Boolean).join(' - ')

      return `
      <div class="receipt">
        <div class="receipt__grid">
          <div class="receipt__left">
            <div class="hdr">${brandTitle}</div>
            <div class="sub">${brandCnpj}</div>
            <div class="sub">${brandAddr || 'Endereço não cadastrado'}</div>
            <div class="kv"><span class="k">Cliente</span><span class="v">${installment.customer_name || ''}</span></div>
            <div class="kv"><span class="k">Parcela</span><span class="v">${it.index}/${installment.installments_total}</span></div>
            <div class="kv"><span class="k">Vencimento</span><span class="v">${dateStr}</span></div>
            <div class="kv"><span class="k">Valor</span><span class="v">R$ ${amount}</span></div>
          </div>

          <div class="receipt__right">
            <img src="${qrSrc}" alt="QR PIX" class="qr"/>
            <div class="contact">${settings?.contact_email || 'email@loja.com'}</div>
          </div>
        </div>
      </div>`
    }

    const pages = schedule.map(buildReceipt).join('\n')

    const style = `
      <style>
        .receipts { max-height: 70vh; overflow-y: auto; overflow-x: hidden; padding-right: 6px; }
        .receipt { border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 10px; background: #fff; max-width: 100%; }
        .receipt__grid { display: grid; grid-template-columns: minmax(0,1fr) 180px; gap: 10px; padding: 10px; align-items: start; }
        .receipt__left { display: flex; flex-direction: column; gap: 6px; }
        .hdr { font-weight: 700; color: #111827; }
        .sub { font-size: 12px; color: #374151; }
        .kv { display: grid; grid-template-columns: 100px 1fr; gap: 6px; }
        .k { color: #374151; font-weight: 600; }
        .v { font-weight: 600; }
        .receipt__right { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .qr { width: 160px; height: 160px; border: 1px solid #e5e7eb; border-radius: 8px; object-fit: contain; }
        .contact { font-family: monospace; color: #111827; text-align: center; font-size: 12px; }
      </style>
    `

    setBoletoPagesHtml(style + `<div class="receipts">${pages}</div>`)
    setShowBoletoDialog(true)
  }

  const handleDownloadHtml = () => {
    const doc = `<!doctype html><html><head><meta charset="utf-8"/><title>Boletos PIX</title>${boletoPagesHtml.match(/<style>[\s\S]*<\/style>/)?.[0] || ''}</head><body>${boletoPagesHtml.replace(/<style>[\s\S]*<\/style>/,'')}</body></html>`
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
    const innerCss = styleTag.replace(/^<style>/,'').replace(/<\/style>$/,'')
    const extraCss = `
@page { size: A4; margin: 12mm; }
body { margin: 0; }
.receipts { max-height: none !important; overflow: visible !important; padding-right: 0 !important; }
.receipt { break-inside: avoid; page-break-inside: avoid; }
`
    const finalStyle = `<style>${innerCss}\n${extraCss}</style>`
    const content = boletoPagesHtml.replace(/<style>[\s\S]*<\/style>/,'')
    const doc = `<!doctype html><html><head><meta charset="utf-8"/><title>Boletos PIX</title>${finalStyle}</head><body>${content}</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(doc)
    win.document.close()
    win.focus()
    setTimeout(() => { try { win.print() } finally { win.close() } }, 200)
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Pagamentos (Carnê)</h1>

      {!hasPixConfigured && (
        <div className="mb-3 p-3 rounded-xl bg-yellow-50 text-yellow-800 border border-yellow-200">
          Configure sua chave PIX em Configurações para gerar boletos com QR.
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="rounded-xl border-gray-200 p-2">
          {years.map((y) => (<option key={y} value={y}>{y}</option>))}
        </select>
        <select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-xl border-gray-200 p-2">
          {monthNames.map((m, idx) => (<option key={idx} value={idx}>{m}</option>))}
        </select>
      </div>

      {/* Seções: Atrasados e A vencer no mês */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Carnês atrasados</h2>
          {overdue.length > 0 ? (
            <div className="space-y-2">
              {overdue.map((i) => (
                <div key={`${i.sale_id}-over-${i.installment_index}`} className="flex items-center justify-between border rounded-xl p-3">
                  <div>
                    <div className="font-medium">{i.customer_name || 'Cliente'}</div>
                    <div className="text-sm text-gray-600">Parcela {i.installment_index}/{i.installments_total} • Vencimento {i.due_date.toLocaleDateString('pt-BR')}</div>
                    <div className="text-sm">Valor R$ {i.installment_amount.toFixed(2)} • Total R$ {Number(i.total || 0).toFixed(2)}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="rounded-xl" onClick={() => handleGenerateBoletoPix(i)} disabled={!hasPixConfigured}>Gerar QR Code</Button>
                    <Button className="rounded-xl" onClick={() => handleOpenWhatsapp(i)}>WhatsApp</Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => openEdit(i)}>Editar</Button>
                    <Button variant="ghost" className="rounded-xl" onClick={() => deleteInstallment(i)}>Excluir</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-600">Nenhum carnê atrasado.</div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">A vencer em {monthNames[month]}/{year}</h2>
          <div className="space-y-2">
            {dueThisMonth.map((i) => (
              <div key={`${i.sale_id}-${i.installment_index}`} className="flex items-center justify-between border rounded-xl p-3">
                <div>
                  <div className="font-medium">{i.customer_name || 'Cliente'}</div>
                  <div className="text-sm text-gray-600">Parcela {i.installment_index}/{i.installments_total} • Vencimento {i.due_date.toLocaleDateString('pt-BR')}</div>
                  <div className="text-sm">Valor R$ {i.installment_amount.toFixed(2)} • Total R$ {Number(i.total || 0).toFixed(2)}</div>
                </div>
                <div className="flex gap-2">
                  <Button className="rounded-xl" onClick={() => handleGenerateBoletoPix(i)} disabled={!hasPixConfigured}>Gerar QR Code</Button>
                  <Button className="rounded-xl" onClick={() => handleOpenWhatsapp(i)}>WhatsApp</Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => openEdit(i)}>Editar</Button>
                  <Button variant="ghost" className="rounded-xl" onClick={() => deleteInstallment(i)}>Excluir</Button>
                </div>
              </div>
            ))}
            {dueThisMonth.length === 0 && (
              <div className="text-gray-600">Nenhum pagamento a vencer em {monthNames[month]}/{year}.</div>
            )}
          </div>
        </div>
      </div>

      {/* Diálogo de Boletos PIX */}
      <Dialog open={showBoletoDialog} onOpenChange={setShowBoletoDialog}>
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>Boletos PIX</DialogTitle>
          </DialogHeader>
          <div dangerouslySetInnerHTML={{ __html: boletoPagesHtml }} />
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={handlePrintPdf} className="rounded-xl">Baixar PDF (Imprimir)</Button>
            <Button onClick={handleDownloadHtml} className="rounded-xl" variant="secondary">Baixar HTML</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Editar Parcela */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar parcela</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Valor da parcela (R$)</p>
              <input type="number" step="0.01" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Vencimento</p>
              <input type="date" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="pt-2 flex gap-2 justify-end">
              <Button variant="outline" className="rounded-xl" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button className="rounded-xl" onClick={saveEdit} disabled={updateSaleMutation.isLoading}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
