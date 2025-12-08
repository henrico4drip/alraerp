import React, { useState, useEffect, useMemo } from "react"
import { base44 } from "@/api/base44Client"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { createPageUrl } from "@/utils"
import { ShoppingCart, Users, Package, FileText, Settings as SettingsIcon, Wallet, ArrowRight, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"

export default function Dashboard2() {
  const [settings, setSettings] = useState(null)
  const [greeting, setGreeting] = useState("Olá")

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: () => base44.entities.Sale.list("-created_date"),
    initialData: [],
  })

  useEffect(() => {
    const fetchSettings = async () => {
      const s = await base44.entities.Settings.list()
      if (s.length > 0) setSettings(s[0])
    }
    fetchSettings()

    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Bom dia")
    else if (hour < 18) setGreeting("Boa tarde")
    else setGreeting("Boa noite")
  }, [])

  const today = new Date()
  const revenueToday = useMemo(
    () =>
      sales
        .filter((s) => s.sale_date && isSameDay(new Date(s.sale_date), today))
        .reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0),
    [sales, today]
  )

  const actions = [
    { label: "Novo Pedido", desc: "Abrir o caixa", icon: ShoppingCart, link: "Cashier", color: "bg-blue-600", hover: "hover:bg-blue-700", lightColor: "bg-blue-50", textColor: "text-blue-600" },
    { label: "Estoque", desc: "Gerenciar produtos", icon: Package, link: "Inventory", color: "bg-emerald-600", hover: "hover:bg-emerald-700", lightColor: "bg-emerald-50", textColor: "text-emerald-600" },
    { label: "Clientes", desc: "Base e Fidelidade", icon: Users, link: "Customers", color: "bg-violet-600", hover: "hover:bg-violet-700", lightColor: "bg-violet-50", textColor: "text-violet-600" },
    { label: "Pagamentos", desc: "Carnês e Cobranças", icon: Wallet, link: "Payments", color: "bg-amber-500", hover: "hover:bg-amber-600", lightColor: "bg-amber-50", textColor: "text-amber-600" },
    { label: "Relatórios", desc: "Análise financeira", icon: FileText, link: "Reports", color: "bg-slate-600", hover: "hover:bg-slate-700", lightColor: "bg-slate-50", textColor: "text-slate-600" },
    { label: "Ajustes", desc: "Configurações", icon: SettingsIcon, link: "Settings", color: "bg-gray-500", hover: "hover:bg-gray-600", lightColor: "bg-gray-50", textColor: "text-gray-500" },
  ]

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 w-full flex flex-col items-center">
      <div className="max-w-5xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-6 border-b border-gray-100">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {greeting}, <span className="opacity-60">{settings?.erp_name?.split(" ")[0] || "Lojista"}</span>
            </h1>
            <p className="text-gray-400 mt-1 font-medium">{format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-end gap-2">
              Vendas Hoje <TrendingUp className="w-4 h-4 text-green-500" />
            </p>
            <div className="text-4xl font-extrabold text-gray-900 tracking-tight">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(revenueToday)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {actions.map((action) => (
            <Link key={action.label} to={createPageUrl(action.link)} className="group">
              <Card className="border-0 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full bg-white rounded-3xl overflow-hidden ring-1 ring-gray-100">
                <CardContent className="p-6 flex flex-col items-start h-full justify-between">
                  <div className={`p-3.5 rounded-2xl ${action.lightColor} ${action.textColor} mb-4 transition-transform group-hover:scale-110`}>
                    <action.icon className="w-7 h-7" />
                  </div>
                  <div className="w-full">
                    <h3 className="font-bold text-lg text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">{action.label}</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-400 font-medium">{action.desc}</p>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transform translate-x-0 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="flex justify-center pt-2">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline" className="rounded-full border-gray-300 text-gray-700 hover:bg-gray-50">Voltar ao Dashboard inicial</Button>
          </Link>
        </div>

        <div className="text-center pt-8">
          <p className="text-xs text-gray-300 font-medium">AlraERP+ • Sistema Inteligente</p>
        </div>
      </div>
    </div>
  )
}
