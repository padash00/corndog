"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { ru } from "date-fns/locale"
import {
  LayoutDashboard,
  FileText,
  Factory,
  Package,
  CreditCard,
  ArrowRightLeft,
  CalendarDays,
  Plus,
  MapPin,
} from "lucide-react"

// UI
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Dashboard parts
import { FiltersPanel } from "@/components/dashboard/filters-panel"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { DailyCharts } from "@/components/dashboard/daily-charts"

// Types
import type {
  Movement,
  MovementWithCalculations,
  StoreSummary as StoreSummaryType,
  DistrictSummary as DistrictSummaryType,
  District,
  Store,
  Product,
  OperationCounts,
} from "@/lib/types"

// --- CONSTANTS ---

const OP_TYPES = {
  SALE: "sale",
  RETURN: "return",
  EXCHANGE: "exchange",
  BONUS: "bonus",
  WRITEOFF: "writeoff",
} as const

// --- HELPERS ---

// SALE      -> +выручка, +себестоимость
// RETURN    -> -выручка, -себестоимость (откат)
// EXCHANGE  -> 0 выручки, +себестоимость (замена за наш счёт)
// BONUS     -> 0 выручки, +себестоимость (маркетинг)
// WRITEOFF  -> 0 выручки, +себестоимость (списание)
const calculateMovementFinancials = (
  m: Movement,
  products: Product[]
): MovementWithCalculations => {
  const product = products.find((p) => p.id === m.productId)
  const costPrice = product?.costPrice ?? 0
  const unitPrice = m.unitPrice

  const baseAmount = m.quantity * unitPrice
  const baseCostAmount = m.quantity * costPrice

  let amount = 0
  let costAmount = 0

  switch (m.operationType) {
    case OP_TYPES.SALE:
      amount = baseAmount
      costAmount = baseCostAmount
      break
    case OP_TYPES.RETURN:
      amount = -baseAmount
      costAmount = -baseCostAmount
      break
    case OP_TYPES.EXCHANGE:
    case OP_TYPES.BONUS:
    case OP_TYPES.WRITEOFF:
      amount = 0
      costAmount = baseCostAmount
      break
    default:
      break
  }

  return {
    ...m,
    amount,
    costAmount,
    profit: amount - costAmount,
  }
}

// --- DATA HOOK ---

function useDashboardData() {
  const [districts, setDistricts] = useState<District[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [dRes, sRes, pRes, mRes] = await Promise.all([
        fetch("/api/districts"),
        fetch("/api/stores"),
        fetch("/api/products"),
        fetch("/api/movements"),
      ])

      if (!dRes.ok || !sRes.ok || !pRes.ok || !mRes.ok) {
        throw new Error("Ошибка загрузки данных")
      }

      const [dData, sData, pData, mData] = await Promise.all([
        dRes.json(),
        sRes.json(),
        pRes.json(),
        mRes.json(),
      ])

      setDistricts(dData)
      setStores(sData)
      setProducts(pData)
      setMovements(
        (mData as any[]).map((m) => ({ ...m, date: new Date(m.date) }))
      )
    } catch (err) {
      console.error(err)
      setError("Не удалось загрузить данные")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    districts,
    stores,
    products,
    movements,
    loading,
    error,
    setMovements,
    setProducts,
  }
}

// --- DIALOG: DAILY REPORT ---

const DailyReportDialog = ({
  isOpen,
  onClose,
  stores,
  products,
  onSave,
}: {
  isOpen: boolean
  onClose: () => void
  stores: Store[]
  products: Product[]
  onSave: (
    date: Date,
    storeId: string,
    data: Record<string, Record<string, number>>
  ) => Promise<void>
}) => {
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [storeId, setStoreId] = useState<string>("")
  const [values, setValues] = useState<
    Record<string, Record<string, number>>
  >({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStoreId("")
      const initial: Record<string, Record<string, number>> = {}
      products.forEach((p) => {
        initial[p.id] = {
          [OP_TYPES.SALE]: 0,
          [OP_TYPES.RETURN]: 0,
          [OP_TYPES.EXCHANGE]: 0,
          [OP_TYPES.BONUS]: 0,
          [OP_TYPES.WRITEOFF]: 0,
        }
      })
      setValues(initial)
    }
  }, [isOpen, products])

  const handleInputChange = (productId: string, type: string, val: string) => {
    if (val === "") {
      setValues((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], [type]: 0 },
      }))
      return
    }
    const num = parseInt(val)
    if (!isNaN(num)) {
      setValues((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], [type]: num },
      }))
    }
  }

  const handleSubmit = async () => {
    if (!storeId || !date) {
      alert("Выберите магазин и дату")
      return
    }
    setSaving(true)
    await onSave(new Date(date), storeId, values)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader className="p-6 pb-4 border-b border-zinc-800 bg-zinc-900/50">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2 text-zinc-100">
            <div className="p-1.5 bg-blue-500/10 rounded-md">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            Внести смену
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-400">
            Заполните данные по продажам и операциям за день.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 bg-zinc-900/30 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-zinc-800">
          <div className="space-y-2">
            <Label className="text-zinc-400 font-medium">Дата смены</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-zinc-950 border-zinc-700 hover:border-zinc-600 focus-visible:ring-blue-600 text-zinc-200"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400 font-medium">Магазин</Label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full rounded-md bg-zinc-950 border border-zinc-700 text-zinc-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <option value="">Выберите точку…</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="hover:bg-transparent border-zinc-800">
                  <TableHead className="w-[250px] text-zinc-300 font-medium pl-4">
                    Товар
                  </TableHead>
                  <TableHead className="text-center text-green-500 font-semibold w-[100px]">
                    Продажа
                  </TableHead>
                  <TableHead className="text-center text-red-500 font-medium w-[100px]">
                    Возврат
                  </TableHead>
                  <TableHead className="text-center text-blue-500 font-medium w-[100px]">
                    Обмен
                  </TableHead>
                  <TableHead className="text-center text-yellow-500 font-medium w-[100px]">
                    Бонус
                  </TableHead>
                  <TableHead className="text-center text-zinc-500 font-medium w-[100px]">
                    Спис.
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow
                    key={p.id}
                    className="hover:bg-zinc-900/40 border-zinc-800/50 transition-colors"
                  >
                    <TableCell className="font-medium text-zinc-200 pl-4 py-3">
                      {p.name}
                    </TableCell>

                    <TableCell className="p-1">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="text-center h-9 bg-zinc-900/50 border-transparent text-green-400 font-bold focus-visible:bg-zinc-950 focus-visible:border-green-500/50 focus-visible:ring-1 focus-visible:ring-green-500 placeholder:text-zinc-700 transition-all"
                        value={values[p.id]?.[OP_TYPES.SALE] || ""}
                        onChange={(e) =>
                          handleInputChange(
                            p.id,
                            OP_TYPES.SALE,
                            e.target.value
                          )
                        }
                      />
                    </TableCell>

                    <TableCell className="p-1">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="text-center h-9 bg-zinc-900/30 border-transparent text-zinc-400 focus:text-red-400 focus-visible:bg-zinc-950 focus-visible:border-red-500/50 focus-visible:ring-1 focus-visible:ring-red-500 placeholder:text-zinc-700 transition-all"
                        value={values[p.id]?.[OP_TYPES.RETURN] || ""}
                        onChange={(e) =>
                          handleInputChange(
                            p.id,
                            OP_TYPES.RETURN,
                            e.target.value
                          )
                        }
                      />
                    </TableCell>

                    <TableCell className="p-1">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="text-center h-9 bg-zinc-900/30 border-transparent text-zinc-400 focus:text-blue-400 focus-visible:bg-zinc-950 focus-visible:border-blue-500/50 focus-visible:ring-1 focus-visible:ring-blue-500 placeholder:text-zinc-700 transition-all"
                        value={values[p.id]?.[OP_TYPES.EXCHANGE] || ""}
                        onChange={(e) =>
                          handleInputChange(
                            p.id,
                            OP_TYPES.EXCHANGE,
                            e.target.value
                          )
                        }
                      />
                    </TableCell>

                    <TableCell className="p-1">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="text-center h-9 bg-zinc-900/30 border-transparent text-zinc-400 focus:text-yellow-400 focus-visible:bg-zinc-950 focus-visible:border-yellow-500/50 focus-visible:ring-1 focus-visible:ring-yellow-500 placeholder:text-zinc-700 transition-all"
                        value={values[p.id]?.[OP_TYPES.BONUS] || ""}
                        onChange={(e) =>
                          handleInputChange(
                            p.id,
                            OP_TYPES.BONUS,
                            e.target.value
                          )
                        }
                      />
                    </TableCell>

                    <TableCell className="p-1">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="text-center h-9 bg-zinc-900/30 border-transparent text-zinc-400 focus:text-gray-300 focus-visible:bg-zinc-950 focus-visible:border-zinc-500/50 focus-visible:ring-1 focus-visible:ring-zinc-500 placeholder:text-zinc-700 transition-all"
                        value={values[p.id]?.[OP_TYPES.WRITEOFF] || ""}
                        onChange={(e) =>
                          handleInputChange(
                            p.id,
                            OP_TYPES.WRITEOFF,
                            e.target.value
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="p-6 border-t border-zinc-800 bg-zinc-900/50">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent hover:border-zinc-700"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 text-white min-w-[150px] shadow-lg shadow-blue-900/20"
          >
            {saving ? "Сохранение..." : "Сохранить отчет"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Сводки ---

function DistrictAnalyticsTable({ data }: { data: DistrictSummaryType[] }) {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100 flex items-center gap-2">
          📊 Сводка по районам
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Район</TableHead>
              <TableHead className="text-right text-zinc-400">
                Продажи (шт)
              </TableHead>
              <TableHead className="text-right text-zinc-400">
                Выручка
              </TableHead>
              <TableHead className="text-right text-zinc-400">
                Прибыль
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow
                key={d.districtId}
                className="border-zinc-800 hover:bg-zinc-800/50"
              >
                <TableCell className="font-medium text-zinc-200">
                  {d.districtName}
                </TableCell>
                <TableCell className="text-right text-zinc-300">
                  {d.salesQty}
                </TableCell>
                <TableCell className="text-right text-zinc-300">
                  {d.totalRevenue.toLocaleString("ru-RU")} ₸
                </TableCell>
                <TableCell className="text-right font-bold text-green-400">
                  {d.totalProfit.toLocaleString("ru-RU")} ₸
                </TableCell>
              </TableRow>
            ))}
            {!data.length && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  Нет данных
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function StoreAnalyticsTable({ data }: { data: StoreSummaryType[] }) {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100 flex items-center gap-2">
          🏪 Сводка по магазинам
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Магазин</TableHead>
              <TableHead className="text-zinc-400">Район</TableHead>
              <TableHead className="text-right text-zinc-400">
                Продажи
              </TableHead>
              <TableHead className="text-right text-zinc-400">
                Возвраты
              </TableHead>
              <TableHead className="text-right text-зinc-400">
                Выручка
              </TableHead>
              <TableHead className="text-right text-зinc-400">
                Прибыль
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => (
              <TableRow
                key={s.storeId ?? "no-store"}
                className="border-zinc-800 hover:bg-зinc-800/50"
              >
                <TableCell className="font-medium text-zinc-200">
                  {s.storeName}
                </TableCell>
                <TableCell className="text-zinc-500 text-sm">
                  {s.districtName}
                </TableCell>
                <TableCell className="text-right text-zinc-300">
                  {s.salesQty}
                </TableCell>
                <TableCell className="text-right text-red-400">
                  {s.returnsQty > 0 ? s.returnsQty : "-"}
                </TableCell>
                <TableCell className="text-right text-zinc-300">
                  {s.totalRevenue.toLocaleString("ru-RU")} ₸
                </TableCell>
                <TableCell className="text-right font-bold text-green-400">
                  {s.totalProfit.toLocaleString("ru-RU")} ₸
                </TableCell>
              </TableRow>
            ))}
            {!data.length && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  Нет данных
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// --- Dialog только для товара ---

const DashboardDialogs = ({
  isAddProductOpen,
  setIsAddProductOpen,
  onSaveProduct,
}: {
  isAddProductOpen: boolean
  setIsAddProductOpen: (open: boolean) => void
  onSaveProduct: (name: string, cost: string, sale: string) => Promise<void>
}) => {
  const [newProductName, setNewProductName] = useState("")
  const [newProductCost, setNewProductCost] = useState("")
  const [newProductSale, setNewProductSale] = useState("")

  const handleSaveProduct = async () => {
    await onSaveProduct(newProductName, newProductCost, newProductSale)
    setNewProductName("")
    setNewProductCost("")
    setNewProductSale("")
  }

  return (
    <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Добавить товар</DialogTitle>
          <DialogDescription>
            Заполните параметры нового товара для учета.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Название</Label>
            <Input
              className="bg-zinc-900 border-zinc-700 text-zinc-200 focus-visible:ring-blue-600"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Себестоимость</Label>
              <Input
                className="bg-zinc-900 border-zinc-700 text-zinc-200 focus-visible:ring-blue-600"
                value={newProductCost}
                onChange={(e) => setNewProductCost(e.target.value)}
              />
            </div>
            <div>
              <Label>Цена</Label>
              <Input
                className="bg-zinc-900 border-зinc-700 text-зinc-200 focus-visible:ring-blue-600"
                value={newProductSale}
                onChange={(e) => setNewProductSale(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSaveProduct}
            className="bg-blue-600 hover:bg-blue-500"
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- HEADER ---

const Header = ({
  onOpenDailyReport,
  onOpenProduct,
}: {
  onOpenDailyReport: () => void
  onOpenProduct: () => void
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl px-4 md:px-8">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white hidden md:block">
            CornDog CRM
          </h1>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
          <Link
            href="/reports"
            className="hover:text-white transition-colors flex items-center gap-2"
          >
            <FileText className="h-4 w-4" /> Отчеты
          </Link>
          <Link
            href="/production"
            className="hover:text-white transition-colors flex items-center gap-2"
          >
            <Factory className="h-4 w-4" /> Производство
          </Link>
          <Link
            href="/stock"
            className="hover:text-white transition-colors flex items-center gap-2"
          >
            <Package className="h-4 w-4" /> Остатки
          </Link>
          <Link
            href="/debts"
            className="hover:text-white transition-colors flex items-center gap-2"
          >
            <CreditCard className="h-4 w-4" /> Долги
          </Link>
          <Link
            href="/movements"
            className="hover:text-white transition-colors flex items-center gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" /> Движения
          </Link>
          <Link
            href="/reports-forecast"
            className="hover:text-white transition-colors flex items-center gap-2"
          >
            <CalendarDays className="h-4 w-4" /> Планы
          </Link>
          <Link
            href="/districts"
            className="hover:text-white transition-colors flex items-center gap-2"
          >
            <MapPin className="h-4 w-4" /> Районы
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-white h-8 hover:bg-zinc-800"
        >
          <Link href="/districts">Районы и магазины</Link>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenProduct}
          className="text-zinc-400 hover:text-white h-8 hover:bg-zinc-800"
        >
          + Товар
        </Button>

        <Button
          onClick={onOpenDailyReport}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium h-9 px-4 shadow-lg shadow-blue-900/20"
        >
          <Plus className="mr-2 h-4 w-4" />
          Внести смену
        </Button>
      </div>
    </header>
  )
}

// --- MAIN PAGE ---

export default function DashboardPage() {
  const { districts, stores, products, movements, loading, error, setMovements, setProducts } =
    useDashboardData()

  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all")
  const [selectedStore, setSelectedStore] = useState<string>("all")
  const [selectedOperationType, setSelectedOperationType] =
    useState<string>("all")

  const [isAddProductOpen, setIsAddProductOpen] = useState(false)
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false)

  // движения с учётом себестоимости и прибыли
  const movementsWithCalculations = useMemo(
    () => movements.map((m) => calculateMovementFinancials(m, products)),
    [movements, products]
  )

  // --- ФИЛЬТРЫ ---
  const filteredMovements = useMemo(
    () =>
      movementsWithCalculations
        .filter((m) => {
          const mDate = new Date(m.date)

          if (dateFrom && dateTo) {
            if (
              !isWithinInterval(mDate, {
                start: startOfDay(dateFrom),
                end: endOfDay(dateTo),
              })
            )
              return false
          } else if (dateFrom && mDate < startOfDay(dateFrom)) {
            return false
          } else if (dateTo && mDate > endOfDay(dateTo)) {
            return false
          }

          if (selectedDistrict !== "all" && m.districtId !== selectedDistrict)
            return false

          if (selectedStore !== "all" && m.storeId !== selectedStore)
            return false

          if (
            selectedOperationType !== "all" &&
            m.operationType !== selectedOperationType
          )
            return false

          return true
        })
        .sort(
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
    [
      movementsWithCalculations,
      dateFrom,
      dateTo,
      selectedDistrict,
      selectedStore,
      selectedOperationType,
    ]
  )

  // --- KPI ---
  const kpis = useMemo<{
    revenue: number
    cost: number
    profit: number
    ops: OperationCounts
  }>(() => {
    return filteredMovements.reduce(
      (acc, m) => {
        acc.revenue += m.amount
        acc.cost += m.costAmount
        acc.profit += m.profit

        switch (m.operationType) {
          case OP_TYPES.SALE:
            acc.ops.sales++
            break
          case OP_TYPES.RETURN:
            acc.ops.returns++
            break
          case OP_TYPES.EXCHANGE:
            acc.ops.exchanges++
            break
          case OP_TYPES.BONUS:
            acc.ops.bonuses++
            break
        }

        return acc
      },
      {
        revenue: 0,
        cost: 0,
        profit: 0,
        ops: { sales: 0, returns: 0, exchanges: 0, bonuses: 0 },
      }
    )
  }, [filteredMovements])

  // --- Сводка по районам ---
  const districtSummaries = useMemo<DistrictSummaryType[]>(() => {
    const map = new Map<string, DistrictSummaryType>()
    const daySets = new Map<string, Set<string>>()

    filteredMovements.forEach((m) => {
      if (!map.has(m.districtId)) {
        const d = districts.find((d) => d.id === m.districtId)
        map.set(m.districtId, {
          districtId: m.districtId,
          districtName: d?.name || "Неизвестно",
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          salesQty: 0,
          returnsQty: 0,
          exchangesQty: 0,
          bonusesQty: 0,
          uniqueSalesDays: 0,
        })
        daySets.set(m.districtId, new Set())
      }

      const item = map.get(m.districtId)!
      const daySet = daySets.get(m.districtId)!

      item.totalRevenue += m.amount
      item.totalCost += m.costAmount
      item.totalProfit += m.profit

      const dateKey = format(new Date(m.date), "yyyy-MM-dd")
      if (m.operationType === OP_TYPES.SALE) {
        item.salesQty += m.quantity
        daySet.add(dateKey)
      } else if (m.operationType === OP_TYPES.RETURN) {
        item.returnsQty += m.quantity
      } else if (m.operationType === OP_TYPES.EXCHANGE) {
        item.exchangesQty += m.quantity
      } else if (m.operationType === OP_TYPES.BONUS) {
        item.bonusesQty += m.quantity
      }
    })

    map.forEach((item, districtId) => {
      item.uniqueSalesDays = daySets.get(districtId)?.size ?? 0
    })

    return Array.from(map.values()).sort(
      (a, b) => b.totalProfit - a.totalProfit
    )
  }, [filteredMovements, districts])

  // --- Сводка по магазинам ---
  const storeSummaries = useMemo<StoreSummaryType[]>(() => {
    const map = new Map<string | null, StoreSummaryType>()

    filteredMovements.forEach((m) => {
      const key = m.storeId
      if (!map.has(key)) {
        const d = districts.find((d) => d.id === m.districtId)
        const s = stores.find((s) => s.id === m.storeId)
        map.set(key, {
          districtId: m.districtId,
          districtName: d?.name || "N/A",
          storeId: m.storeId,
          storeName: s?.name || "По району (без магазина)",
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          salesQty: 0,
          returnsQty: 0,
          exchangesQty: 0,
          bonusesQty: 0,
          salesCount: 0,
          returnsCount: 0,
          exchangesCount: 0,
          bonusesCount: 0,
        })
      }

      const item = map.get(key)!
      item.totalRevenue += m.amount
      item.totalCost += m.costAmount
      item.totalProfit += m.profit

      switch (m.operationType) {
        case OP_TYPES.SALE:
          item.salesQty += m.quantity
          item.salesCount += 1
          break
        case OP_TYPES.RETURN:
          item.returnsQty += m.quantity
          item.returnsCount += 1
          break
        case OP_TYPES.EXCHANGE:
          item.exchangesQty += m.quantity
          item.exchangesCount += 1
          break
        case OP_TYPES.BONUS:
          item.bonusesQty += m.quantity
          item.bonusesCount += 1
          break
      }
    })

    return Array.from(map.values()).sort(
      (a, b) => b.totalProfit - a.totalProfit
    )
  }, [filteredMovements, districts, stores])

  // --- Данные для графика ---
  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; profit: number }>()

    filteredMovements.forEach((m) => {
      const dateKey = format(new Date(m.date), "dd.MM", { locale: ru })
      if (!map.has(dateKey)) {
        map.set(dateKey, { date: dateKey, revenue: 0, profit: 0 })
      }
      const item = map.get(dateKey)!
      item.revenue += m.amount
      item.profit += m.profit
    })

    return Array.from(map.values()).reverse()
  }, [filteredMovements])

  // --- HANDLERS ---

  const handleSaveDailyReport = async (
    date: Date,
    storeId: string,
    data: Record<string, Record<string, number>>
  ) => {
    const store = stores.find((s) => s.id === storeId)
    if (!store) return

    const promises: Promise<any>[] = []

    Object.entries(data).forEach(([productId, types]) => {
      const product = products.find((p) => p.id === productId)
      if (!product) return

      Object.entries(types).forEach(([type, qty]) => {
        if (qty > 0) {
          const payload = {
            date: date.toISOString().slice(0, 10),
            districtId: store.districtId,
            storeId: store.id,
            productId: product.id,
            operationType: type as any,
            quantity: qty,
            unitPrice: product.salePrice,
            comment: "Ежедневный отчет",
          }
          promises.push(
            fetch("/api/movements", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }).then((res) => res.json())
          )
        }
      })
    })

    if (!promises.length) return

    try {
      const results = await Promise.all(promises)
      const newMovements = results.map((m) => ({
        ...m,
        date: new Date(m.date),
      }))
      setMovements((prev) => [...newMovements, ...prev])
      alert(`Успешно сохранено операций: ${newMovements.length}`)
    } catch (e) {
      console.error(e)
      alert("Ошибка при сохранении отчета")
    }
  }

  const onSaveProduct = async (name: string, cost: string, sale: string) => {
    if (!name.trim()) return
    const res = await fetch("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name,
        costPrice: Number(cost),
        salePrice: Number(sale),
      }),
    })
    if (res.ok) {
      const newItem = await res.json()
      setProducts((prev) =>
        [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name))
      )
      setIsAddProductOpen(false)
    }
  }

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Загрузка системы...
      </div>
    )
  if (error)
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-red-400">
        Ошибка: {error}
      </div>
    )

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      <Header
        onOpenDailyReport={() => setIsDailyReportOpen(true)}
        onOpenProduct={() => setIsAddProductOpen(true)}
      />

      <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8">
        {/* Фильтры + KPI */}
        <FiltersPanel
          districts={districts}
          stores={stores}
          dateFrom={dateFrom}
          dateTo={dateTo}
          selectedDistrict={selectedDistrict}
          selectedStore={selectedStore}
          selectedOperationType={selectedOperationType}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onDistrictChange={setSelectedDistrict}
          onStoreChange={setSelectedStore}
          onOperationTypeChange={setSelectedOperationType}
          onReset={() => {
            setDateFrom(undefined)
            setDateTo(undefined)
            setSelectedDistrict("all")
            setSelectedStore("all")
            setSelectedOperationType("all")
          }}
        />

        <KpiCards
          revenue={kpis.revenue}
          cost={kpis.cost}
          profit={kpis.profit}
          operationCounts={kpis.ops}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />

        {/* Tabs */}
        <Tabs defaultValue="districts" className="space-y-4">
          <TabsList className="bg-zinc-900 border-zinc-800">
            <TabsTrigger
              value="districts"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              По Районам
            </TabsTrigger>
            <TabsTrigger
              value="stores"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              По Магазинам
            </TabsTrigger>
            <TabsTrigger
              value="charts"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              График динамики
            </TabsTrigger>
          </TabsList>
          <TabsContent value="districts" className="space-y-4">
            <DistrictAnalyticsTable data={districtSummaries} />
          </TabsContent>
          <TabsContent value="stores" className="space-y-4">
            <StoreAnalyticsTable data={storeSummaries} />
          </TabsContent>
          <TabsContent value="charts" className="space-y-4">
            <DailyCharts data={dailyData} />
          </TabsContent>
        </Tabs>

        <Card className="bg-zinc-900/30 border-zinc-800 border-dashed">
          <CardHeader>
            <CardTitle className="text-zinc-400 text-base">
              🔮 Прогноз производства (Справочно)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              Для детального планирования и алгоритмов перейдите в раздел{" "}
              <Link
                href="/reports-forecast"
                className="text-blue-400 hover:underline"
              >
                Планирование
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>

      <DashboardDialogs
        isAddProductOpen={isAddProductOpen}
        setIsAddProductOpen={setIsAddProductOpen}
        onSaveProduct={onSaveProduct}
      />

      <DailyReportDialog
        isOpen={isDailyReportOpen}
        onClose={() => setIsDailyReportOpen(false)}
        stores={stores}
        products={products}
        onSave={handleSaveDailyReport}
      />
    </main>
  )
}
