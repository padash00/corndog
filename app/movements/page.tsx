"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { ArrowLeft, Loader2, PackagePlus, History, Truck, RotateCcw, Trash2, type LucideIcon } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import type { Product, Movement, Store } from "@/lib/types"

// --- TYPES & CONFIG ---

type NewMovementPayload = {
  date: string
  storeId: string
  productId: string
  quantity: number
  operationType: OperationType
  comment: string
}

type OperationType = "load" | "return" | "writeoff"

// Тип для сгруппированной строки таблицы (Сводка за день)
type DailySummary = {
  id: string          // Уникальный ключ (дата_магазин_товар)
  date: Date
  storeName: string
  productName: string
  loaded: number      // Сумма отгрузок
  returned: number    // Сумма возвратов
  writeoff: number    // Сумма списаний
  comments: string[]  // Список уникальных комментариев
}

// Конфигурация для выпадающего списка в форме
const OPERATION_CONFIG: Record<OperationType, { label: string; icon: LucideIcon; color: string }> = {
  load: { 
    label: "Отгрузка (Приход)", 
    icon: Truck, 
    color: "text-green-400"
  },
  return: { 
    label: "Возврат", 
    icon: RotateCcw, 
    color: "text-red-400"
  },
  writeoff: { 
    label: "Списание", 
    icon: Trash2, 
    color: "text-zinc-400"
  },
}

// --- CUSTOM HOOKS ---

function useMovementsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [rawMovements, setRawMovements] = useState<Movement[]>([]) // Храним сырые данные
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

      if (!pRes.ok || !sRes.ok || !mRes.ok) throw new Error("Ошибка при загрузке данных")

      const [pData, sData, mData] = await Promise.all([
        pRes.json(), sRes.json(), mRes.json()
      ])

      setProducts(pData)
      setStores(sData)
      // Сортируем сырые данные сразу при получении (новые сверху)
      setRawMovements((mData as Movement[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : "Неизвестная ошибка")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- ЛОГИКА АГРЕГАЦИИ (ГРУППИРОВКИ) ---
  const groupedMovements = useMemo<DailySummary[]>(() => {
    const pMap = new Map(products.map(p => [p.id, p.name]))
    const sMap = new Map(stores.map(s => [s.id, s.name]))
    const groupedMap = new Map<string, DailySummary>()

    // Проходим по всем записям и складываем их в "копилки"
    rawMovements.forEach(m => {
      // Ключ группировки: Дата + Магазин + Товар
      // slice(0, 10) берет только дату "YYYY-MM-DD", игнорируя время
      const dateKey = new Date(m.date).toISOString().slice(0, 10)
      const key = `${dateKey}_${m.storeId}_${m.productId}`

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          id: key,
          date: new Date(m.date),
          storeName: m.storeId ? (sMap.get(m.storeId) || "Неизвестный магазин") : "—",
          productName: pMap.get(m.productId) || "Удаленный товар",
          loaded: 0,
          returned: 0,
          writeoff: 0,
          comments: []
        })
      }

      const summary = groupedMap.get(key)!

      // Суммируем количество в нужную категорию
      if (m.operationType === 'load') summary.loaded += m.quantity
      else if (m.operationType === 'return') summary.returned += m.quantity
      else if (m.operationType === 'writeoff') summary.writeoff += m.quantity

      // Собираем уникальные комментарии
      if (m.comment && m.comment.trim() !== "" && !summary.comments.includes(m.comment)) {
        summary.comments.push(m.comment)
      }
    })

    // Превращаем Map обратно в массив
    return Array.from(groupedMap.values())
  }, [rawMovements, products, stores])

  const addMovement = async (payload: NewMovementPayload) => {
    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || "Ошибка сохранения")
      }

      const saved = await res.json()
      
      // Добавляем новую запись в начало сырого массива. 
      // useMemo автоматически пересчитает группировку и обновит таблицу.
      setRawMovements(prev => [saved, ...prev])
      return true
    } catch (e) {
      console.error(e)
      alert(`Ошибка: ${e instanceof Error ? e.message : "Не удалось сохранить"}`)
      return false
    }
  }

  return { products, stores, movements: groupedMovements, loading, error, addMovement }
}

// --- SUB-COMPONENTS ---

const MovementForm = ({ 
  stores, 
  products, 
  onSave 
}: { 
  stores: Store[], 
  products: Product[], 
  onSave: (data: NewMovementPayload) => Promise<boolean> 
}) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [storeId, setStoreId] = useState("")
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [operationType, setOperationType] = useState<OperationType>("load")
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!storeId || !productId || !quantity) return

    setIsSubmitting(true)
    
    const success = await onSave({
      date,
      storeId,
      productId,
      quantity: Number(quantity),
      operationType,
      comment
    })

    setIsSubmitting(false)
    
    if (success) {
      setQuantity("")
      setComment("")
    }
  }

  const handleReset = () => {
    setDate(new Date().toISOString().slice(0, 10))
    setStoreId("")
    setProductId("")
    setQuantity("")
    setOperationType("load")
    setComment("")
  }

  const isValid = storeId && productId && quantity && Number(quantity) > 0

  return (
    <Card className="border-zinc-800 bg-zinc-900/30">
      <CardHeader className="border-b border-zinc-800/50 pb-4">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <PackagePlus className="h-5 w-5 text-blue-500" /> 
          Новая операция
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Внесите одиночную операцию вручную. Она автоматически добавится в сводку за день.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-zinc-400">Дата операции</Label>
            <Input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="bg-zinc-950 border-zinc-700 text-zinc-200"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">Магазин</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-200">
                <SelectValue placeholder="Выберите магазин" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 space-y-2">
            <Label className="text-zinc-400">Товар</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-200">
                <SelectValue placeholder="Выберите товар" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">Количество</Label>
            <Input 
              type="number" 
              placeholder="0" 
              value={quantity} 
              onChange={e => setQuantity(e.target.value)} 
              min={1}
              className="bg-zinc-950 border-zinc-700 text-zinc-200 font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-zinc-400">Тип операции</Label>
            <Select value={operationType} onValueChange={(v) => setOperationType(v as OperationType)}>
              <SelectTrigger className={`bg-zinc-950 border-zinc-700 ${OPERATION_CONFIG[operationType].color}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                {Object.entries(OPERATION_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key} className={`focus:bg-zinc-800 cursor-pointer ${config.color}`}>
                      <div className="flex items-center gap-2">
                         <config.icon className="h-4 w-4" /> {config.label}
                      </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label className="text-zinc-400">Комментарий</Label>
            <Input 
              placeholder="Например: возврат брака" 
              value={comment} 
              onChange={e => setComment(e.target.value)} 
              className="bg-zinc-950 border-zinc-700 text-zinc-200"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={handleReset} disabled={isSubmitting} className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800">
            Очистить
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !isValid} className="bg-blue-600 hover:bg-blue-500 text-white min-w-[120px]">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// --- НОВАЯ ТАБЛИЦА (СВОДНАЯ) ---

const MovementsTable = ({ movements }: { movements: DailySummary[] }) => (
  <Card className="border-zinc-800 bg-zinc-900/30">
    <CardHeader className="border-b border-zinc-800/50 pb-4">
      <CardTitle className="flex items-center gap-2 text-zinc-100">
        <History className="h-5 w-5 text-zinc-500" /> 
        Сводный отчет по дням
      </CardTitle>
      <CardDescription className="text-zinc-400">
        Суммарные показатели за день (группировка по дате, магазину и товару).
      </CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      <div className="overflow-x-auto max-h-[800px]">
        <Table>
          <TableHeader className="bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-sm">
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400 w-[110px]">Дата</TableHead>
              <TableHead className="text-zinc-400">Магазин</TableHead>
              <TableHead className="text-zinc-400">Товар</TableHead>
              {/* Колонки разбиты по типам */}
              <TableHead className="text-center text-green-500 font-medium w-[100px]">Отгрузка</TableHead>
              <TableHead className="text-center text-red-400 font-medium w-[100px]">Возврат</TableHead>
              <TableHead className="text-center text-zinc-500 font-medium w-[100px]">Списание</TableHead>
              <TableHead className="text-zinc-400">Комментарии</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={7} className="text-center py-12 text-zinc-500">
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              movements.map((m) => (
                <TableRow key={m.id} className="border-zinc-800/50 hover:bg-zinc-900/60 transition-colors">
                  <TableCell className="text-zinc-300 font-medium whitespace-nowrap">
                    {format(m.date, "dd.MM.yyyy", { locale: ru })}
                  </TableCell>
                  <TableCell className="text-zinc-300 font-medium">{m.storeName}</TableCell>
                  <TableCell className="text-zinc-400">{m.productName}</TableCell>
                  
                  {/* Отгрузка */}
                  <TableCell className="text-center">
                    {m.loaded > 0 ? (
                      <span className="font-bold text-green-400 bg-green-900/20 px-2 py-1 rounded-md text-sm border border-green-900/30 block">
                        +{m.loaded}
                      </span>
                    ) : <span className="text-zinc-800">—</span>}
                  </TableCell>

                  {/* Возврат */}
                  <TableCell className="text-center">
                    {m.returned > 0 ? (
                      <span className="font-bold text-red-400 bg-red-900/20 px-2 py-1 rounded-md text-sm border border-red-900/30 block">
                        -{m.returned}
                      </span>
                    ) : <span className="text-zinc-800">—</span>}
                  </TableCell>

                  {/* Списание */}
                  <TableCell className="text-center">
                     {m.writeoff > 0 ? (
                      <span className="font-bold text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-md text-sm border border-zinc-700 block">
                        -{m.writeoff}
                      </span>
                    ) : <span className="text-zinc-800">—</span>}
                  </TableCell>

                  <TableCell className="text-zinc-500 text-xs max-w-[200px]">
                    <div className="flex flex-col gap-1">
                      {m.comments.length > 0 ? m.comments.map((c, i) => (
                         <span key={i} className="truncate block" title={c}>• {c}</span>
                      )) : "—"}
                    </div>
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

// --- MAIN PAGE ---

export default function MovementsPage() {
  const { products, stores, movements, loading, error, addMovement } = useMovementsPage()

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-blue-600"/> Загрузка...
    </div>
  )
  
  if (error) return (
    <div className="flex flex-col h-screen items-center justify-center bg-zinc-950 text-red-400 gap-4">
        <p>Ошибка: {error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Повторить</Button>
    </div>
  )

  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8 bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Движения товара</h1>
            <p className="text-zinc-400 mt-1">Ручное управление и ежедневная сводка</p>
          </div>
          <Button variant="outline" asChild className="bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white">
            <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Назад в дашборд</Link>
          </Button>
        </header>

        <section>
            <MovementForm stores={stores} products={products} onSave={addMovement} />
        </section>

        <section>
            <MovementsTable movements={movements} />
        </section>
      </div>
    </main>
  )
}