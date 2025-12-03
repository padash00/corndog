"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { format, startOfDay, endOfDay, isWithinInterval, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { ru } from "date-fns/locale"
import { ArrowLeft, Calendar, FileBarChart, Loader2, FilterX, TrendingUp, AlertTriangle } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Types
import type { District, Store, Movement } from "@/lib/types"

// --- TYPES ---

type ReportRow = {
  id: string
  name: string
  revenue: number
  profit: number
  salesQty: number
  returnsQty: number
  exchangesQty: number
  bonusesQty: number
  issueQty: number
  returnRate: number
  bonusShare: number
  subLabel?: string
}

// --- BUSINESS LOGIC ---

const calculateReportData = (
  movements: Movement[],
  districts: District[],
  stores: Store[],
  dateFrom?: string,
  dateTo?: string
) => {
  const from = dateFrom ? startOfDay(new Date(dateFrom)) : null
  const to = dateTo ? endOfDay(new Date(dateTo)) : null

  const filtered = movements.filter((m) => {
    const d = m.date instanceof Date ? m.date : new Date(m.date)
    if (from && to) return isWithinInterval(d, { start: from, end: to })
    if (from) return d >= from
    if (to) return d <= to
    return true
  })

  const updateRow = (row: ReportRow, m: Movement) => {
    const revenuePart = m.operationType === "return" ? -m.quantity * m.unitPrice : m.quantity * m.unitPrice
    const costPart = 0 

    row.revenue += revenuePart
    row.profit += (revenuePart - costPart)

    if (m.operationType === "sale") row.salesQty += m.quantity
    else if (m.operationType === "return") row.returnsQty += m.quantity
    else if (m.operationType === "exchange") row.exchangesQty += m.quantity
    else if (m.operationType === "bonus") row.bonusesQty += m.quantity

    if (m.operationType === "return" || m.operationType === "exchange") {
      row.issueQty += m.quantity
    }
  }

  const finalizeRow = (row: ReportRow) => {
    if (row.salesQty > 0) {
      row.returnRate = (row.issueQty / row.salesQty) * 100
      row.bonusShare = (row.bonusesQty / row.salesQty) * 100
    }
    return row
  }

  const districtMap = new Map<string, ReportRow>()
  const storeMap = new Map<string, ReportRow>()

  filtered.forEach(m => {
    if (!districtMap.has(m.districtId)) {
      const d = districts.find(x => x.id === m.districtId)
      districtMap.set(m.districtId, {
        id: m.districtId,
        name: d?.name || "Неизвестный район",
        revenue: 0, profit: 0, salesQty: 0, returnsQty: 0, exchangesQty: 0, 
        bonusesQty: 0, issueQty: 0, returnRate: 0, bonusShare: 0
      })
    }
    updateRow(districtMap.get(m.districtId)!, m)

    const storeIdKey = m.storeId || "unknown"
    const compositeKey = `${m.districtId}-${storeIdKey}`
    
    if (!storeMap.has(compositeKey)) {
      const d = districts.find(x => x.id === m.districtId)
      const s = stores.find(x => x.id === m.storeId)
      storeMap.set(compositeKey, {
        id: compositeKey,
        name: s?.name || "По району (без магазина)",
        subLabel: d?.name || "N/A",
        revenue: 0, profit: 0, salesQty: 0, returnsQty: 0, exchangesQty: 0, 
        bonusesQty: 0, issueQty: 0, returnRate: 0, bonusShare: 0
      })
    }
    updateRow(storeMap.get(compositeKey)!, m)
  })

  const districtRows = Array.from(districtMap.values()).map(finalizeRow).sort((a, b) => b.profit - a.profit)
  const storeRows = Array.from(storeMap.values()).map(finalizeRow).sort((a, b) => b.profit - a.profit)

  return { districtRows, storeRows }
}

// --- CUSTOM HOOKS ---

function useReportsData() {
  const [districts, setDistricts] = useState<District[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [dRes, sRes, mRes] = await Promise.all([
        fetch("/api/districts"),
        fetch("/api/stores"),
        fetch("/api/movements"),
      ])

      if (!dRes.ok || !sRes.ok || !mRes.ok) throw new Error("Ошибка загрузки данных")

      const [dData, sData, mData] = await Promise.all([
        dRes.json(), sRes.json(), mRes.json()
      ])

      setDistricts(dData)
      setStores(sData)
      setMovements((mData as any[]).map(m => ({ ...m, date: new Date(m.date) })))

    } catch (e: any) {
      console.error(e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { districts, stores, movements, loading, error }
}

// --- STYLED COMPONENTS ---

const ReportTable = ({ title, rows, showSubLabel = false }: { title: string, rows: ReportRow[], showSubLabel?: boolean }) => (
  <Card className="border-zinc-800 bg-zinc-900/30">
    <CardHeader className="border-b border-zinc-800/50 pb-4">
      <CardTitle className="text-zinc-100 flex items-center gap-2">
        <FileBarChart className="h-5 w-5 text-blue-500" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-sm">
            <TableRow className="border-zinc-800 hover:bg-transparent">
              {showSubLabel && <TableHead className="text-zinc-400">Район</TableHead>}
              <TableHead className="text-zinc-400 min-w-[200px]">{showSubLabel ? "Магазин" : "Название"}</TableHead>
              <TableHead className="text-right text-zinc-300">Выручка</TableHead>
              <TableHead className="text-right text-green-400 font-bold">Прибыль</TableHead>
              <TableHead className="text-right text-blue-300">Продажи</TableHead>
              <TableHead className="text-right text-red-400">Возвраты</TableHead>
              <TableHead className="text-right text-zinc-400">Обмены</TableHead>
              <TableHead className="text-right text-yellow-500">Бонусы</TableHead>
              <TableHead className="text-right text-zinc-500 text-xs w-24">Доля проблем</TableHead>
              <TableHead className="text-right text-zinc-500 text-xs w-24">Доля бонусов</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={showSubLabel ? 10 : 9} className="text-center py-12 text-zinc-500">
                  Нет данных за период
                </TableCell>
              </TableRow>
            ) : (
              rows.map(row => (
                <TableRow key={row.id} className="border-zinc-800/50 hover:bg-zinc-900/60 transition-colors">
                  {showSubLabel && <TableCell className="text-zinc-500 text-sm">{row.subLabel}</TableCell>}
                  <TableCell className="font-medium text-zinc-200">{row.name}</TableCell>
                  <TableCell className="text-right text-zinc-300 whitespace-nowrap">{row.revenue.toLocaleString("ru-RU")} ₸</TableCell>
                  <TableCell className="text-right text-green-400 font-bold whitespace-nowrap">{row.profit.toLocaleString("ru-RU")} ₸</TableCell>
                  <TableCell className="text-right text-blue-200">{row.salesQty}</TableCell>
                  <TableCell className="text-right text-red-400">{row.returnsQty}</TableCell>
                  <TableCell className="text-right text-zinc-400">{row.exchangesQty}</TableCell>
                  <TableCell className="text-right text-yellow-600">{row.bonusesQty}</TableCell>
                  
                  {/* Доля проблем (возвраты + обмены / продажи) */}
                  <TableCell className={`text-right font-medium ${row.returnRate > 10 ? "text-red-500" : row.returnRate > 5 ? "text-orange-400" : "text-zinc-500"}`}>
                    {row.returnRate > 0 ? `${row.returnRate.toFixed(1)}%` : "—"}
                  </TableCell>
                  
                  {/* Доля бонусов */}
                  <TableCell className={`text-right font-medium ${row.bonusShare > 10 ? "text-yellow-500" : "text-zinc-500"}`}>
                    {row.bonusShare > 0 ? `${row.bonusShare.toFixed(1)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
)

// --- MAIN COMPONENT ---

export default function ReportsPage() {
  const { districts, stores, movements, loading, error } = useReportsData()

  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const { districtRows, storeRows } = useMemo(
    () => calculateReportData(movements, districts, stores, dateFrom, dateTo),
    [movements, districts, stores, dateFrom, dateTo]
  )

  const setMonth = (offset: number) => {
    const now = new Date()
    const targetDate = subMonths(now, offset)
    setDateFrom(format(startOfMonth(targetDate), "yyyy-MM-dd"))
    setDateTo(format(endOfMonth(targetDate), "yyyy-MM-dd"))
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-blue-600"/> Загрузка отчетов...
    </div>
  )

  if (error) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-red-400">
        Ошибка: {error}
    </div>
  )

  const periodLabel = dateFrom && dateTo 
    ? `${format(new Date(dateFrom), "dd.MM.yyyy")} — ${format(new Date(dateTo), "dd.MM.yyyy")}`
    : "Весь период"

  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8 bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Аналитические отчёты</h1>
            <p className="text-zinc-400 mt-1">Детальная статистика по продажам и эффективности</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild className="bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Дашборд</Link>
            </Button>
            <Button variant="ghost" asChild className="text-zinc-400 hover:text-white hover:bg-zinc-800">
              <Link href="/production">Производство</Link>
            </Button>
            <Button variant="ghost" asChild className="text-zinc-400 hover:text-white hover:bg-zinc-800">
              <Link href="/debts">Долги</Link>
            </Button>
          </div>
        </header>

        {/* FILTERS */}
        <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-zinc-400"><Calendar className="h-4 w-4"/> С даты</Label>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)} 
                className="w-40 bg-zinc-950 border-zinc-700 text-zinc-200 hover:border-zinc-600 focus-visible:ring-blue-600" 
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-zinc-400"><Calendar className="h-4 w-4"/> По дату</Label>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)} 
                className="w-40 bg-zinc-950 border-zinc-700 text-zinc-200 hover:border-zinc-600 focus-visible:ring-blue-600" 
              />
            </div>
            
            <div className="flex gap-2 ml-auto sm:ml-0">
              <Button 
                variant="ghost" 
                onClick={() => { setDateFrom(""); setDateTo("") }}
                className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800"
              >
                <FilterX className="mr-2 h-4 w-4" /> Весь период
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setMonth(0)}
                className="bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                Текущий месяц
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setMonth(1)}
                className="bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                Прошлый месяц
              </Button>
            </div>
        </div>

        {/* TABLES */}
        <div className="space-y-8">
          <ReportTable title={`📍 Сводка по районам (${periodLabel})`} rows={districtRows} />
          <ReportTable title={`🏪 Сводка по магазинам (${periodLabel})`} rows={storeRows} showSubLabel />
        </div>
        
        <div className="text-center text-zinc-500 text-sm py-4 border-t border-zinc-900">
          <p className="flex items-center justify-center gap-2">
            <TrendingUp className="h-4 w-4" /> 
            Прибыль рассчитывается как "Выручка - Возвраты". Себестоимость в этом отчете не учитывается.
          </p>
        </div>
      </div>
    </main>
  )
}