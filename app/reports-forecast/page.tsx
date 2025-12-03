"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { 
  ArrowLeft, 
  Loader2, 
  AlertTriangle, 
  Download, 
  Search, 
  Factory, 
  PackageCheck
} from "lucide-react"
import { detectAnomalies } from "@/lib/anomalies"
import type { Product, Store, Movement } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format, subDays, isSameDay } from "date-fns"

// --- Custom Hook для загрузки данных ---
function useForecastData() {
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [prodRes, storeRes, moveRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/stores"),
          fetch("/api/movements"),
        ])
        
        if (!prodRes.ok || !storeRes.ok || !moveRes.ok) throw new Error("Ошибка загрузки данных")

        const [prod, store, move] = await Promise.all([
          prodRes.json(), storeRes.json(), moveRes.json(),
        ])

        setProducts(prod)
        setStores(store)
        setMovements(move.map((m: any) => ({ ...m, date: new Date(m.date) })))
      } catch (e: any) {
        setError(e.message || "Ошибка загрузки")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { products, stores, movements, loading, error }
}

// --- Логика расчета "Умного прогноза" ---
type SmartForecastItem = {
  productId: string
  productName: string
  currentStock: number
  forecastDemand: number
  productionNeed: number
  recentSales: number[]
  trend: number
}

function calculateSmartForecast(
  movements: Movement[],
  products: Product[],
  targetStoreId: string
): SmartForecastItem[] {
  const today = new Date()
  const last7Days = Array.from({ length: 7 }).map((_, i) => subDays(today, 6 - i))

  const stats = new Map<string, { stock: number; salesHistory: number[] }>()

  products.forEach(p => stats.set(p.id, { stock: 0, salesHistory: new Array(7).fill(0) }))

  movements.forEach(m => {
    if (targetStoreId !== "all" && m.storeId !== targetStoreId) return
    
    const entry = stats.get(m.productId)
    if (!entry) return

    const isIn = ["load", "return", "transfer_in"].includes(m.operationType)
    const isOut = ["sale", "bonus", "exchange", "writeoff", "transfer_out"].includes(m.operationType)
    
    if (isIn) entry.stock += m.quantity
    if (isOut) entry.stock -= m.quantity

    if (m.operationType === "sale") {
      const dayIndex = last7Days.findIndex(d => isSameDay(d, m.date))
      if (dayIndex !== -1) {
        entry.salesHistory[dayIndex] += m.quantity
      }
    }
  })

  return products.map(p => {
    const s = stats.get(p.id)!
    
    const avgSales = s.salesHistory.reduce((a, b) => a + b, 0) / 7
    const recentSum = s.salesHistory.slice(4).reduce((a,b)=>a+b,0)
    const oldSum = s.salesHistory.slice(0,3).reduce((a,b)=>a+b,0)
    const trend = oldSum > 0 ? (recentSum / 3) / (oldSum / 3) : 1
    
    const forecastDemand = Math.ceil(avgSales * (trend > 1.1 ? 1.1 : 1))
    const productionNeed = Math.max(0, forecastDemand - s.stock)

    return {
      productId: p.id,
      productName: p.name,
      currentStock: s.stock,
      forecastDemand,
      productionNeed,
      recentSales: s.salesHistory,
      trend: Math.round((trend - 1) * 100)
    }
  }).sort((a, b) => b.productionNeed - a.productionNeed)
}

// --- MAIN COMPONENT ---

export default function ForecastReportPage() {
  const { products, stores, movements, loading, error } = useForecastData()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStore, setSelectedStore] = useState("all")

  const alerts = useMemo(() => detectAnomalies(movements, stores), [movements, stores])

  const forecastData = useMemo(() => 
    calculateSmartForecast(movements, products, selectedStore), 
    [movements, products, selectedStore]
  )

  const filteredData = useMemo(() => 
    forecastData.filter(f => f.productName.toLowerCase().includes(searchTerm.toLowerCase())),
    [forecastData, searchTerm]
  )

  const totalProductionNeed = filteredData.reduce((acc, item) => acc + item.productionNeed, 0)

  const handleExport = () => {
    const headers = ["Товар", "Остаток", "Прогноз спроса", "Нужно произвести"]
    const rows = filteredData.map(f => [f.productName, f.currentStock, f.forecastDemand, f.productionNeed])
    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `production_plan_${format(new Date(), "yyyy-MM-dd")}.csv`)
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-blue-600"/> Анализ данных...
    </div>
  )

  if (error) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-red-400">
        Ошибка: {error}
    </div>
  )

  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8 bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Планирование выпуска</h1>
            <p className="text-zinc-400 mt-1">Расчет потребности с учетом остатков и трендов</p>
          </div>
          <div className="flex flex-wrap gap-2">
             <Button variant="outline" asChild className="bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white">
               <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Дашборд</Link>
             </Button>
             <Button variant="ghost" asChild className="text-zinc-400 hover:text-white hover:bg-zinc-800">
               <Link href="/reports">Отчёты</Link>
             </Button>
             <Button variant="ghost" asChild className="text-zinc-400 hover:text-white hover:bg-zinc-800">
               <Link href="/production">Производство</Link>
             </Button>
             <div className="w-px h-6 bg-zinc-800 mx-2 hidden sm:block" />
             <Button variant="outline" onClick={handleExport} className="bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white">
               <Download className="mr-2 h-4 w-4" /> CSV
             </Button>
          </div>
        </header>

        {/* CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* SIDEBAR: FILTERS & KPI */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* KPI CARD */}
            <Card className="bg-blue-900/10 border-blue-900/30">
              <CardContent className="pt-6 text-center">
                <div className="text-sm text-blue-400 uppercase font-medium mb-1">Итого к выпуску</div>
                <div className="text-5xl font-bold text-blue-500">{totalProductionNeed}</div>
                <div className="text-xs text-blue-400/70 mt-2">единиц продукции</div>
              </CardContent>
            </Card>

            {/* SETTINGS CARD */}
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardHeader className="pb-3 border-b border-zinc-800/50">
                <CardTitle className="text-sm text-zinc-100">Настройки расчета</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500 font-medium uppercase">Магазин / Точка</span>
                  <Select value={selectedStore} onValueChange={setSelectedStore}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-200">
                        <SelectValue placeholder="Все магазины" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                      <SelectItem value="all">Вся сеть (Центральный цех)</SelectItem>
                      {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500 font-medium uppercase">Поиск</span>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input 
                        className="pl-8 bg-zinc-950 border-zinc-700 text-zinc-200 placeholder:text-zinc-600" 
                        placeholder="Название товара..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ALERTS CARD */}
            {alerts.length > 0 && (
              <Card className="border-orange-900/30 bg-orange-900/10">
                <CardHeader className="pb-2 border-b border-orange-900/20">
                    <CardTitle className="text-sm text-orange-400 flex gap-2">
                        <AlertTriangle className="w-4 h-4"/> Внимание ({alerts.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <ul className="space-y-2">
                    {alerts.slice(0, 3).map((a, i) => (
                      <li key={i} className="text-xs text-orange-300/80 flex justify-between items-center">
                        <span>{a.storeName}</span>
                        <span className="font-bold bg-orange-900/40 px-1.5 py-0.5 rounded text-orange-300">
                            {a.type === 'returns' ? 'Возврат' : 'Бонус'} {a.percent}%
                        </span>
                      </li>
                    ))}
                    {alerts.length > 3 && <li className="text-xs text-center text-orange-500 mt-1">...и еще {alerts.length - 3}</li>}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* MAIN: PLAN TABLE */}
          <div className="lg:col-span-3">
            <Card className="h-full bg-zinc-900/30 border-zinc-800">
              <CardHeader className="pb-3 border-b border-zinc-800/50">
                <CardTitle className="flex items-center gap-2 text-zinc-100">
                  <Factory className="h-5 w-5 text-blue-500" />
                  План производства на {format(new Date(), "dd.MM")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-900/50 text-zinc-400 font-medium">
                      <tr>
                        <th className="px-4 py-3 font-medium">Товар</th>
                        <th className="px-4 py-3 w-32 font-medium">Динамика (7д)</th>
                        <th className="px-4 py-3 text-right font-medium">Остаток</th>
                        <th className="px-4 py-3 text-right font-medium">Прогноз</th>
                        <th className="px-4 py-3 text-right text-blue-400 font-bold">Выпустить</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {filteredData.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-zinc-500">Нет данных для расчета</td></tr>
                      ) : (
                        filteredData.map((item) => (
                          <tr key={item.productId} className="hover:bg-zinc-900/60 transition-colors">
                            <td className="px-4 py-3 font-medium text-zinc-200">{item.productName}</td>
                            <td className="px-4 py-3">
                              {/* Sparkline Chart */}
                              <div className="flex items-end gap-[2px] h-6 w-24">
                                {item.recentSales.map((val, idx) => {
                                  const max = Math.max(...item.recentSales, 1)
                                  const height = Math.max((val / max) * 100, 10) 
                                  return (
                                    <div 
                                      key={idx} 
                                      className="w-1/6 bg-blue-500/20 rounded-sm hover:bg-blue-500 transition-all"
                                      style={{ height: `${height}%` }}
                                      title={`День ${idx+1}: ${val} шт`}
                                    />
                                  )
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-400">
                              {item.currentStock}
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-300">
                              {item.forecastDemand}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {item.productionNeed > 0 ? (
                                <span className="inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold shadow-sm shadow-blue-900/20">
                                  {item.productionNeed}
                                </span>
                              ) : (
                                <span className="text-green-500 flex items-center justify-end gap-1.5 text-xs font-medium bg-green-900/10 px-2 py-1 rounded-md border border-green-900/20">
                                  <PackageCheck className="w-3.5 h-3.5" /> Хватает
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}