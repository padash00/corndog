"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { format, endOfDay, isBefore, isEqual } from "date-fns"
import { ru } from "date-fns/locale"
import { ArrowLeft, Box, Calendar, Loader2, Search, Package } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Types
import type { Product, Movement, Store } from "@/lib/types"

// --- TYPES ---

type StockRow = {
  id: string
  storeId: string
  storeName: string
  productId: string
  productName: string
  totalIn: number
  totalOut: number
  balance: number
}

// --- BUSINESS LOGIC ---

const getMovementSign = (operationType: Movement["operationType"]): number => {
  switch (operationType) {
    case "load":
    case "return":
    case "transfer_in":
      return 1
    case "sale":
    case "bonus":
    case "exchange":
    case "writeoff":
    case "transfer_out":
      return -1
    default:
      return 0
  }
}

const calculateStockData = (
  movements: Movement[],
  stores: Store[],
  products: Product[],
  reportDate: string,
  selectedStoreId: string
): StockRow[] => {
  if (!reportDate || movements.length === 0) return []

  const cutoffDate = endOfDay(new Date(reportDate))
  const map = new Map<string, StockRow>()

  movements.forEach((m) => {
    const mDate = m.date instanceof Date ? m.date : new Date(m.date)
    if (isBefore(cutoffDate, mDate) && !isEqual(cutoffDate, mDate)) return

    if (selectedStoreId !== "all" && m.storeId !== selectedStoreId) return
    if (!m.storeId) return

    const sign = getMovementSign(m.operationType)
    if (sign === 0) return

    const key = `${m.storeId}-${m.productId}`

    if (!map.has(key)) {
      const store = stores.find((s) => s.id === m.storeId)
      const product = products.find((p) => p.id === m.productId)
      if (!store || !product) return

      map.set(key, {
        id: key,
        storeId: m.storeId,
        storeName: store.name,
        productId: m.productId,
        productName: product.name,
        totalIn: 0,
        totalOut: 0,
        balance: 0,
      })
    }

    const row = map.get(key)!
    const qty = m.quantity

    if (sign > 0) {
      row.totalIn += qty
    } else {
      row.totalOut += qty
    }
    row.balance += sign * qty
  })

  return Array.from(map.values()).sort((a, b) => {
    if (a.storeName === b.storeName) {
      return a.productName.localeCompare(b.productName, "ru")
    }
    return a.storeName.localeCompare(b.storeName, "ru")
  })
}

// --- CUSTOM HOOKS ---

function useStockData() {
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [pRes, sRes, mRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/stores"),
        fetch("/api/movements"),
      ])

      if (!pRes.ok || !sRes.ok || !mRes.ok) throw new Error("Ошибка загрузки данных")

      const [pData, sData, mData] = await Promise.all([
        pRes.json(), sRes.json(), mRes.json()
      ])

      setProducts(pData)
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

  return { products, stores, movements, loading, error }
}

// --- STYLED COMPONENTS ---

const StockTable = ({ rows }: { rows: StockRow[] }) => (
  <Card className="border-zinc-800 bg-zinc-900/30">
    <CardHeader className="border-b border-zinc-800/50 pb-4">
      <CardTitle className="flex items-center gap-2 text-zinc-100">
        <Package className="h-5 w-5 text-blue-500" /> 
        Детализация по товарам
      </CardTitle>
      <CardDescription className="text-zinc-400">
        Текущие остатки в разрезе магазинов и позиций.
      </CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-sm">
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Магазин</TableHead>
              <TableHead className="text-zinc-400">Продукт</TableHead>
              <TableHead className="text-right text-green-500 font-medium">Приход</TableHead>
              <TableHead className="text-right text-red-500 font-medium">Расход</TableHead>
              <TableHead className="text-right text-zinc-200 font-bold">Остаток</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={5} className="py-12 text-center text-zinc-500">
                  Нет движений по выбранным критериям
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="border-zinc-800/50 hover:bg-zinc-900/60 transition-colors">
                  <TableCell className="font-medium text-zinc-300">{row.storeName}</TableCell>
                  <TableCell className="text-zinc-400">{row.productName}</TableCell>
                  <TableCell className="text-right text-zinc-500">{row.totalIn}</TableCell>
                  <TableCell className="text-right text-zinc-500">{row.totalOut}</TableCell>
                  <TableCell className={`text-right font-bold ${
                      row.balance < 0 ? "text-red-500" : 
                      row.balance < 10 ? "text-yellow-500" : "text-zinc-200"
                  }`}>
                    {row.balance} шт
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

export default function StoreStockPage() {
  const { products, stores, movements, loading, error } = useStockData()

  const [reportDate, setReportDate] = useState<string>(format(new Date(), "yyyy-MM-dd"))
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all")

  const stockRows = useMemo(
    () => calculateStockData(movements, stores, products, reportDate, selectedStoreId),
    [movements, stores, products, reportDate, selectedStoreId]
  )

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-blue-600"/> Сверка склада...
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
            <h1 className="text-3xl font-bold tracking-tight text-white">Складские остатки</h1>
            <p className="text-zinc-400 mt-1">Текущее наличие товаров в торговых точках</p>
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
          </div>
        </header>

        {/* FILTERS */}
        <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-zinc-400"><Calendar className="h-4 w-4"/> Дата остатков</Label>
              <Input 
                type="date" 
                value={reportDate} 
                onChange={(e) => setReportDate(e.target.value)} 
                className="w-[180px] bg-zinc-950 border-zinc-700 text-zinc-200 hover:border-zinc-600 focus-visible:ring-blue-600" 
              />
            </div>

            <div className="space-y-2 min-w-[220px]">
              <Label className="flex items-center gap-2 text-zinc-400"><Search className="h-4 w-4"/> Фильтр по магазину</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-200 hover:border-zinc-600">
                  <SelectValue placeholder="Все магазины" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                  <SelectItem value="all">Все магазины</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="focus:bg-zinc-800 cursor-pointer">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="ml-auto text-sm text-zinc-500 self-center pb-2 bg-zinc-900/50 px-3 py-1 rounded border border-zinc-800">
               Остатки на конец дня: <span className="text-zinc-300 font-medium">{format(new Date(reportDate), "dd.MM.yyyy", { locale: ru })}</span>
            </div>
        </div>

        {/* DATA TABLE */}
        <StockTable rows={stockRows} />
      </div>
    </main>
  )
}