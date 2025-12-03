"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns"
import { ru } from "date-fns/locale"
import { ArrowLeft, Calendar, Loader2, Factory, Plus, Search } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Types
import type { Product, Movement } from "@/lib/types"

// --- TYPES ---

export type ProductionBatch = {
  id: string
  date: string
  productId: string
  producedQty: number
  bonusPoolQty: number
  comment: string | null
  createdAt: string
}

type ProductionSummaryRow = {
  id: string
  date: string
  productId: string
  productName: string
  producedQty: number
  bonusPoolQty: number
  salesQty: number
  bonusQty: number
  returnsQty: number
  exchangesQty: number
  netOutflowQty: number
  theoreticalRestQty: number
}

// --- BUSINESS LOGIC ---

const calculateProductionSummary = (
  batches: ProductionBatch[],
  movements: Movement[],
  products: Product[],
  dateFrom?: string,
  dateTo?: string
): ProductionSummaryRow[] => {
  const from = dateFrom ? startOfDay(new Date(dateFrom)) : null
  const to = dateTo ? endOfDay(new Date(dateTo)) : null

  const filteredBatches = batches.filter((b) => {
    if (!from && !to) return true
    const d = startOfDay(new Date(b.date))
    if (from && to) return isWithinInterval(d, { start: from, end: to })
    if (from) return d >= from
    if (to) return d <= to
    return true
  })

  if (filteredBatches.length === 0) return []

  const map = new Map<string, ProductionSummaryRow>()

  filteredBatches.forEach((b) => {
    const key = `${b.date}-${b.productId}`
    if (!map.has(key)) {
      const product = products.find((p) => p.id === b.productId)
      map.set(key, {
        id: key,
        date: b.date,
        productId: b.productId,
        productName: product?.name ?? "Неизвестный продукт",
        producedQty: 0,
        bonusPoolQty: 0,
        salesQty: 0,
        bonusQty: 0,
        returnsQty: 0,
        exchangesQty: 0,
        netOutflowQty: 0,
        theoreticalRestQty: 0,
      })
    }
    const row = map.get(key)!
    row.producedQty += b.producedQty
    row.bonusPoolQty += b.bonusPoolQty
  })

  movements.forEach((m) => {
    const mDate = m.date instanceof Date ? m.date : new Date(m.date)
    const dateStr = format(mDate, "yyyy-MM-dd")
    const key = `${dateStr}-${m.productId}`

    const row = map.get(key)
    if (!row) return

    switch (m.operationType) {
      case "sale": row.salesQty += m.quantity; break
      case "bonus": row.bonusQty += m.quantity; break
      case "return": row.returnsQty += m.quantity; break
      case "exchange": row.exchangesQty += m.quantity; break
    }
  })

  return Array.from(map.values())
    .map((row) => {
      const totalOut = row.salesQty + row.bonusQty + row.exchangesQty
      const netOut = totalOut - row.returnsQty
      return {
        ...row,
        netOutflowQty: netOut,
        theoreticalRestQty: row.producedQty - netOut,
      }
    })
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return a.productName.localeCompare(b.productName, "ru")
    })
}

// --- CUSTOM HOOKS ---

function useProductionData() {
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [prodRes, batchRes, movRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/production-batches"),
        fetch("/api/movements"),
      ])

      if (!prodRes.ok || !batchRes.ok || !movRes.ok) throw new Error("Ошибка загрузки данных")

      const [pData, bData, mData] = await Promise.all([
        prodRes.json(), batchRes.json(), movRes.json()
      ])

      setProducts(pData)
      setBatches(bData)
      setMovements((mData as any[]).map(m => ({ ...m, date: new Date(m.date) })))

    } catch (e: any) {
      console.error(e)
      setError(e.message || "Неизвестная ошибка")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { products, batches, movements, loading, error, setBatches }
}

// --- STYLED COMPONENTS ---

const AddBatchForm = ({ products, onSave }: { products: Product[], onSave: (data: any) => Promise<void> }) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [productId, setProductId] = useState("")
  const [producedQty, setProducedQty] = useState("")
  const [bonusQty, setBonusQty] = useState("")
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!date || !productId || !producedQty) return
    setIsSubmitting(true)
    await onSave({
      date,
      productId,
      producedQty: Number(producedQty),
      bonusPoolQty: bonusQty ? Number(bonusQty) : 0,
      comment: comment || null
    })
    setIsSubmitting(false)
    setProducedQty("")
    setBonusQty("")
    setComment("")
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/30">
      <CardHeader className="border-b border-zinc-800/50 pb-4">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Factory className="h-5 w-5 text-blue-500" /> Добавить партию
        </CardTitle>
        <CardDescription className="text-zinc-400">Фиксация выпуска продукции за смену</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label className="text-zinc-400">Дата производства</Label>
            <Input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="bg-zinc-950 border-zinc-700 hover:border-zinc-600 focus-visible:ring-blue-600 text-zinc-200"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">Продукт</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="bg-zinc-950 border-zinc-700 hover:border-zinc-600 focus:ring-blue-600 text-zinc-200">
                <SelectValue placeholder="Выберите продукт" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="focus:bg-zinc-800 cursor-pointer">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">Произведено (шт)</Label>
            <Input 
              type="number" 
              placeholder="0" 
              value={producedQty} 
              onChange={(e) => setProducedQty(e.target.value)} 
              className="bg-zinc-950 border-zinc-700 hover:border-zinc-600 focus-visible:ring-blue-600 text-zinc-200 font-medium"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">Бонусный фонд (шт)</Label>
            <Input 
              type="number" 
              placeholder="0" 
              value={bonusQty} 
              onChange={(e) => setBonusQty(e.target.value)} 
              className="bg-zinc-950 border-zinc-700 hover:border-zinc-600 focus-visible:ring-blue-600 text-zinc-200"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-zinc-400">Комментарий</Label>
          <Textarea 
            placeholder="Смена, ответственный, нюансы..." 
            value={comment} 
            onChange={(e) => setComment(e.target.value)}
            className="bg-zinc-950 border-zinc-700 hover:border-zinc-600 focus-visible:ring-blue-600 text-zinc-200 h-20 resize-none"
          />
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={handleSubmit} disabled={isSubmitting || !date || !productId} className="bg-blue-600 hover:bg-blue-500 text-white min-w-[150px]">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить партию
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const SummaryTable = ({ rows }: { rows: ProductionSummaryRow[] }) => (
  <Card className="border-zinc-800 bg-zinc-900/30">
    <CardHeader className="border-b border-zinc-800/50 pb-4">
      <CardTitle className="text-zinc-100">Сводка производства</CardTitle>
      <CardDescription className="text-zinc-400">Сравнение выпуска с фактическими продажами день-в-день</CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-sm">
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400 min-w-[100px]">Дата</TableHead>
              <TableHead className="text-zinc-400 min-w-[200px]">Продукт</TableHead>
              <TableHead className="text-right text-zinc-300">Выпуск</TableHead>
              <TableHead className="text-right text-zinc-500 text-xs">Фонд</TableHead>
              <TableHead className="text-right text-blue-400 font-medium">Продажи</TableHead>
              <TableHead className="text-right text-yellow-500">Бонусы</TableHead>
              <TableHead className="text-right text-red-400">Возвраты</TableHead>
              <TableHead className="text-right text-zinc-400">Обмены</TableHead>
              <TableHead className="text-right text-zinc-200 font-semibold border-l border-zinc-800/50">Расход (чистый)</TableHead>
              <TableHead className="text-right font-bold border-l border-zinc-800/50">Остаток (теор.)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={10} className="text-center py-12 text-zinc-500">
                  Нет данных за выбранный период
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="border-zinc-800/50 hover:bg-zinc-900/60 transition-colors">
                  <TableCell className="font-medium text-zinc-300 whitespace-nowrap">
                    {format(new Date(row.date), "dd.MM.yyyy", { locale: ru })}
                  </TableCell>
                  <TableCell className="text-zinc-200">{row.productName}</TableCell>
                  <TableCell className="text-right font-medium text-zinc-100">{row.producedQty}</TableCell>
                  <TableCell className="text-right text-zinc-600 text-xs">{row.bonusPoolQty}</TableCell>
                  <TableCell className="text-right text-blue-300">{row.salesQty}</TableCell>
                  <TableCell className="text-right text-yellow-600">{row.bonusQty}</TableCell>
                  <TableCell className="text-right text-red-400">{row.returnsQty}</TableCell>
                  <TableCell className="text-right text-zinc-500">{row.exchangesQty}</TableCell>
                  
                  {/* Чистый расход (Продажи + Бонусы + Обмены - Возвраты) */}
                  <TableCell className="text-right font-semibold text-zinc-200 border-l border-zinc-800/50 bg-zinc-900/20">
                    {row.netOutflowQty}
                  </TableCell>
                  
                  {/* Остаток (Выпуск - Чистый расход) */}
                  <TableCell className={`text-right font-bold border-l border-zinc-800/50 bg-zinc-900/20 ${
                      row.theoreticalRestQty < 0 ? "text-red-500" : "text-green-500"
                  }`}>
                    {row.theoreticalRestQty}
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

export default function ProductionPage() {
  const { products, batches, movements, loading, error, setBatches } = useProductionData()

  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const summaryRows = useMemo(
    () => calculateProductionSummary(batches, movements, products, dateFrom, dateTo),
    [batches, movements, products, dateFrom, dateTo]
  )

  const handleSaveBatch = async (batchData: any) => {
    try {
      const res = await fetch("/api/production-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchData),
      })
      if (!res.ok) throw new Error(await res.text())
      const saved = await res.json()
      setBatches((prev) => [saved, ...prev])
    } catch (e) {
      console.error(e)
      alert("Не удалось сохранить партию")
    }
  }

  const handleResetFilter = () => {
    setDateFrom("")
    setDateTo("")
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-blue-600"/> Загрузка производства...
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-red-400 gap-4">
      <p>Ошибка: {error}</p>
      <Button variant="outline" onClick={() => window.location.reload()} className="border-zinc-700 text-zinc-200">Попробовать снова</Button>
    </div>
  )

  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8 bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Производство</h1>
            <p className="text-zinc-400 mt-1">Учёт партий и сверка с продажами</p>
          </div>
          <Button variant="outline" asChild className="bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Назад в дашборд
            </Link>
          </Button>
        </header>

        {/* FILTERS */}
        <div className="flex flex-wrap items-end gap-4 bg-zinc-900/30 p-4 rounded-lg border border-zinc-800">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-zinc-400"><Calendar className="h-4 w-4" /> С даты</Label>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)} 
                className="w-40 bg-zinc-950 border-zinc-700 text-zinc-200 hover:border-zinc-600 focus-visible:ring-blue-600" 
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-zinc-400"><Calendar className="h-4 w-4" /> По дату</Label>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)} 
                className="w-40 bg-zinc-950 border-zinc-700 text-zinc-200 hover:border-zinc-600 focus-visible:ring-blue-600" 
              />
            </div>
            <Button 
                variant="ghost" 
                onClick={handleResetFilter} 
                disabled={!dateFrom && !dateTo}
                className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              Сбросить
            </Button>
            
            <div className="ml-auto text-sm text-zinc-500 hidden md:block">
                Показываются только дни с производством
            </div>
        </div>

        {/* ADD FORM */}
        <AddBatchForm products={products} onSave={handleSaveBatch} />

        {/* TABLE */}
        <SummaryTable rows={summaryRows} />
      </div>
    </main>
  )
}