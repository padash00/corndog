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
  PackageCheck,
} from "lucide-react"
import { detectAnomalies } from "@/lib/anomalies"
import type { Product, Store, Movement } from "@/lib/types"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  format,
  subDays,
  isSameDay,
  startOfDay,
} from "date-fns"

// -------------------- HOOK ЗАГРУЗКИ ДАННЫХ --------------------

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

        if (!prodRes.ok || !storeRes.ok || !moveRes.ok) {
          throw new Error("Ошибка загрузки данных")
        }

        const [prod, store, move] = await Promise.all([
          prodRes.json(),
          storeRes.json(),
          moveRes.json(),
        ])

        setProducts(prod)
        setStores(store)

        // Даты сразу приводим к Date
        setMovements(
          (move as any[]).map((m) => ({
            ...m,
            date: new Date(m.date),
          }))
        )
      } catch (e: any) {
        console.error(e)
        setError(e.message || "Ошибка загрузки")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return { products, stores, movements, loading, error }
}

// -------------------- ЛОГИКА ПРОГНОЗА --------------------

type SmartForecastItem = {
  productId: string
  productName: string
  currentStock: number
  avgDailySales: number
  forecastDays: number
  forecastDemand: number
  safetyStock: number
  targetStock: number
  productionNeed: number
  recentSales: number[]
  coverageDays: number
  trendPercent: number // +20 / -15 и т.п.
}

type ForecastParams = {
  horizonDays: number     // за сколько дней смотреть продажи (7/14/30)
  planDays: number        // на сколько дней вперёд планируем выпуск (1/3/5)
  safetyDays: number      // страховой запас в днях
}

function calculateSmartForecast(
  movements: Movement[],
  products: Product[],
  targetStoreId: string,
  params: ForecastParams
): SmartForecastItem[] {
  const { horizonDays, planDays, safetyDays } = params
  if (!horizonDays || horizonDays <= 0) return []

  const today = startOfDay(new Date())

  // Массив дней для спарклайна: от самого старого к сегодняшнему
  const daysWindow = Array.from({ length: horizonDays }, (_, i) =>
    subDays(today, horizonDays - 1 - i)
  )

  // Базовая структура по продукту
  const stats = new Map<
    string,
    {
      stock: number
      salesHistory: number[]
    }
  >()

  products.forEach((p) =>
    stats.set(p.id, {
      stock: 0,
      salesHistory: new Array(horizonDays).fill(0),
    })
  )

  // Считаем остаток и продажи по дням
  movements.forEach((m) => {
    // Фильтр по магазину
    if (targetStoreId !== "all" && m.storeId !== targetStoreId) return

    const entry = stats.get(m.productId)
    if (!entry) return

    const op = m.operationType as string

    const isIn = ["load", "return", "transfer_in"].includes(op)
    const isOut = ["sale", "bonus", "exchange", "writeoff", "transfer_out"].includes(op)

    if (isIn) entry.stock += m.quantity
    if (isOut) entry.stock -= m.quantity

    if (op === "sale") {
      // попадаем ли в окно последних horizonDays
      const idx = daysWindow.findIndex((d) => isSameDay(d, m.date))
      if (idx !== -1) {
        entry.salesHistory[idx] += m.quantity
      }
    }
  })

  const result: SmartForecastItem[] = []

  products.forEach((p) => {
    const entry = stats.get(p.id)
    if (!entry) return

    const { stock, salesHistory } = entry
    const totalSales = salesHistory.reduce((a, b) => a + b, 0)
    const avgDailySales = horizonDays > 0 ? totalSales / horizonDays : 0

    // Тренд: сравниваем первые и последние 50% окна
    const half = Math.floor(horizonDays / 2) || 1
    const firstPart = salesHistory.slice(0, half)
    const lastPart = salesHistory.slice(-half)

    const firstAvg =
      firstPart.length > 0
        ? firstPart.reduce((a, b) => a + b, 0) / firstPart.length
        : 0
    const lastAvg =
      lastPart.length > 0
        ? lastPart.reduce((a, b) => a + b, 0) / lastPart.length
        : 0

    let trendFactor = 1
    if (firstAvg > 0) {
      trendFactor = lastAvg / firstAvg
    } else if (lastAvg > 0) {
      // Был ноль, сейчас что-то продаётся – считаем как рост
      trendFactor = 1.2
    }

    // Ограничиваем, чтобы не улететь в космос
    trendFactor = Math.min(Math.max(trendFactor, 0.7), 1.5)

    const effectiveDailyDemand = avgDailySales * trendFactor

    // Сколько нужно на период + запас
    const forecastDays = planDays
    const forecastDemand = Math.ceil(effectiveDailyDemand * forecastDays)
    const safetyStock = Math.ceil(effectiveDailyDemand * safetyDays)
    const targetStock = forecastDemand + safetyStock

    const productionNeed = Math.max(0, targetStock - stock)
    const coverageDays =
      avgDailySales > 0 ? stock / avgDailySales : stock > 0 ? Infinity : 0

    const trendPercent = Math.round((trendFactor - 1) * 100)

    // Чтобы не засорять список, показываем:
    // - либо реально надо производить
    // - либо товар активно продаётся, но запаса мало (<2 дней)
    const hasRecentSales = totalSales > 0
    const lowCoverage = coverageDays !== Infinity && coverageDays < 2

    if (productionNeed <= 0 && !(hasRecentSales && lowCoverage)) return

    result.push({
      productId: p.id,
      productName: p.name,
      currentStock: stock,
      avgDailySales,
      forecastDays,
      forecastDemand,
      safetyStock,
      targetStock,
      productionNeed,
      recentSales: salesHistory,
      coverageDays,
      trendPercent,
    })
  })

  // Сортировка: сначала то, что больше всего надо выпускать
  return result.sort((a, b) => b.productionNeed - a.productionNeed)
}

// -------------------- MAIN COMPONENT --------------------

export default function ForecastReportPage() {
  const { products, stores, movements, loading, error } = useForecastData()

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStore, setSelectedStore] = useState("all")
  const [horizonDays, setHorizonDays] = useState(7) // окно продаж
  const [planDays, setPlanDays] = useState(3)       // на сколько дней вперёд производим
  const [safetyDays, setSafetyDays] = useState(1)   // страховой запас в днях

  const alerts = useMemo(
    () => detectAnomalies(movements, stores),
    [movements, stores]
  )

  const forecastData = useMemo(
    () =>
      calculateSmartForecast(movements, products, selectedStore, {
        horizonDays,
        planDays,
        safetyDays,
      }),
    [movements, products, selectedStore, horizonDays, planDays, safetyDays]
  )

  const filteredData = useMemo(
    () =>
      forecastData.filter((f) =>
        f.productName.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [forecastData, searchTerm]
  )

  const totalProductionNeed = filteredData.reduce(
    (acc, item) => acc + item.productionNeed,
    0
  )

  const handleExport = () => {
    const headers = [
      "Товар",
      "Остаток",
      "Средн. продаж/день",
      `Прогноз на ${planDays} дн.`,
      `Страховой запас (${safetyDays} дн.)`,
      "Целевой остаток",
      "Нужно произвести",
      "Покрытие (дней)",
      "Тренд, %",
    ]

    const rows = filteredData.map((f) => [
      f.productName,
      f.currentStock,
      f.avgDailySales.toFixed(2),
      f.forecastDemand,
      f.safetyStock,
      f.targetStock,
      f.productionNeed,
      f.coverageDays === Infinity
        ? "∞"
        : f.coverageDays.toFixed(1),
      (f.trendPercent >= 0 ? "+" : "") + f.trendPercent,
    ])

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    )
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute(
      "download",
      `production_plan_${format(new Date(), "yyyy-MM-dd")}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-blue-600" /> Анализ
        данных...
      </div>
    )

  if (error)
    return (
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
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Планирование выпуска
            </h1>
            <p className="text-zinc-400 mt-1">
              Умный расчёт потребности с учётом остатков, трендов и горизонта
              планирования
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              asChild
              className="bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white"
            >
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Дашборд
              </Link>
            </Button>
            <Button
              variant="ghost"
              asChild
              className="text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <Link href="/reports">Отчёты</Link>
            </Button>
            <Button
              variant="ghost"
              asChild
              className="text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <Link href="/production">Производство</Link>
            </Button>
            <div className="w-px h-6 bg-zinc-800 mx-2 hidden sm:block" />
            <Button
              variant="outline"
              onClick={handleExport}
              className="bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white"
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
        </header>

        {/* GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* SIDEBAR */}
          <div className="lg:col-span-1 space-y-6">
            {/* KPI */}
            <Card className="bg-blue-900/10 border-blue-900/30">
              <CardContent className="pt-6 text-center">
                <div className="text-sm text-blue-400 uppercase font-medium mb-1">
                  Итого к выпуску
                </div>
                <div className="text-5xl font-bold text-blue-500">
                  {totalProductionNeed}
                </div>
                <div className="text-xs text-blue-400/70 mt-2">
                  единиц продукции по текущему фильтру
                </div>
              </CardContent>
            </Card>

            {/* Настройки расчёта */}
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardHeader className="pb-3 border-b border-zinc-800/50">
                <CardTitle className="text-sm text-zinc-100">
                  Настройки расчёта
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Магазин */}
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500 font-medium uppercase">
                    Магазин / точка
                  </span>
                  <Select
                    value={selectedStore}
                    onValueChange={setSelectedStore}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-200">
                      <SelectValue placeholder="Все магазины" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                      <SelectItem value="all">
                        Вся сеть (центральный цех)
                      </SelectItem>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Горизонт продаж */}
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500 font-medium uppercase">
                    Окно продаж
                  </span>
                  <Select
                    value={String(horizonDays)}
                    onValueChange={(v) => setHorizonDays(Number(v))}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                      <SelectItem value="7">7 дней</SelectItem>
                      <SelectItem value="14">14 дней</SelectItem>
                      <SelectItem value="30">30 дней</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* На сколько дней вперёд производим */}
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500 font-medium uppercase">
                    План на период
                  </span>
                  <Select
                    value={String(planDays)}
                    onValueChange={(v) => setPlanDays(Number(v))}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                      <SelectItem value="1">1 день</SelectItem>
                      <SelectItem value="3">3 дня</SelectItem>
                      <SelectItem value="5">5 дней</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Страховой запас */}
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500 font-medium uppercase">
                    Страховой запас
                  </span>
                  <Select
                    value={String(safetyDays)}
                    onValueChange={(v) => setSafetyDays(Number(v))}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                      <SelectItem value="0">без запаса</SelectItem>
                      <SelectItem value="1">1 день</SelectItem>
                      <SelectItem value="2">2 дня</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Поиск */}
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500 font-medium uppercase">
                    Поиск по товару
                  </span>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                      className="pl-8 bg-zinc-950 border-zinc-700 text-zinc-200 placeholder:text-zinc-600"
                      placeholder="Название товара..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ALERTS */}
            {alerts.length > 0 && (
              <Card className="border-orange-900/30 bg-orange-900/10">
                <CardHeader className="pb-2 border-b border-orange-900/20">
                  <CardTitle className="text-sm text-orange-400 flex gap-2">
                    <AlertTriangle className="w-4 h-4" /> Внимание (
                    {alerts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <ul className="space-y-2">
                    {alerts.slice(0, 3).map((a, i) => (
                      <li
                        key={i}
                        className="text-xs text-orange-300/80 flex justify-between items-center"
                      >
                        <span>{a.storeName}</span>
                        <span className="font-bold bg-orange-900/40 px-1.5 py-0.5 rounded text-orange-300">
                          {a.type === "returns" ? "Возврат" : "Бонус"}{" "}
                          {a.percent}%
                        </span>
                      </li>
                    ))}
                    {alerts.length > 3 && (
                      <li className="text-xs text-center text-orange-500 mt-1">
                        ...и ещё {alerts.length - 3}
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* MAIN TABLE */}
          <div className="lg:col-span-3">
            <Card className="h-full bg-zinc-900/30 border-zinc-800">
              <CardHeader className="pb-3 border-b border-zinc-800/50">
                <CardTitle className="flex items-center gap-2 text-zinc-100">
                  <Factory className="h-5 w-5 text-blue-500" />
                  План производства на {format(new Date(), "dd.MM")}
                </CardTitle>
                <CardDescription className="text-zinc-400 text-xs md:text-sm">
                  Окно продаж: {horizonDays} дн. • План выпуска: {planDays} дн.
                  • Страховой запас: {safetyDays} дн.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-900/50 text-zinc-400 font-medium">
                      <tr>
                        <th className="px-4 py-3 font-medium">Товар</th>
                        <th className="px-4 py-3 w-32 font-medium">
                          Динамика ({horizonDays}д)
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Продаж/день
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Остаток
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Покрытие
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Прогноз
                        </th>
                        <th className="px-4 py-3 text-right text-blue-400 font-bold">
                          Выпустить
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {filteredData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="p-8 text-center text-zinc-500"
                          >
                            Нет данных для расчёта
                          </td>
                        </tr>
                      ) : (
                        filteredData.map((item) => {
                          const max = Math.max(...item.recentSales, 1)
                          const coverageText =
                            item.coverageDays === Infinity
                              ? "∞"
                              : item.coverageDays.toFixed(1) + " дн."

                          const trendLabel =
                            item.trendPercent === 0
                              ? "0%"
                              : (item.trendPercent > 0 ? "+" : "") +
                                item.trendPercent +
                                "%"

                          return (
                            <tr
                              key={item.productId}
                              className="hover:bg-zinc-900/60 transition-colors"
                            >
                              <td className="px-4 py-3 font-medium text-zinc-200">
                                {item.productName}
                              </td>

                              {/* Sparkline */}
                              <td className="px-4 py-3">
                                <div className="flex items-end gap-[2px] h-6 w-24">
                                  {item.recentSales.map((val, idx) => {
                                    const height = Math.max(
                                      (val / max) * 100,
                                      val > 0 ? 10 : 0
                                    )
                                    return (
                                      <div
                                        key={idx}
                                        className="w-1/6 bg-blue-500/25 rounded-sm hover:bg-blue-500 transition-all"
                                        style={{ height: `${height}%` }}
                                        title={`День ${idx + 1}: ${val} шт`}
                                      />
                                    )
                                  })}
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-1">
                                  Тренд:{" "}
                                  <span
                                    className={
                                      item.trendPercent > 0
                                        ? "text-green-400"
                                        : item.trendPercent < 0
                                        ? "text-red-400"
                                        : "text-zinc-400"
                                    }
                                  >
                                    {trendLabel}
                                  </span>
                                </div>
                              </td>

                              {/* Продаж/день */}
                              <td className="px-4 py-3 text-right text-zinc-300">
                                {item.avgDailySales.toFixed(2)}
                              </td>

                              {/* Остаток */}
                              <td className="px-4 py-3 text-right text-zinc-300">
                                {item.currentStock}
                              </td>

                              {/* Покрытие */}
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={`text-xs px-2 py-1 rounded-md border ${
                                    item.coverageDays === Infinity
                                      ? "text-zinc-300 border-zinc-700 bg-zinc-800/40"
                                      : item.coverageDays < 1
                                      ? "text-red-400 border-red-900 bg-red-900/20"
                                      : item.coverageDays < 2
                                      ? "text-orange-400 border-orange-900 bg-orange-900/20"
                                      : "text-green-400 border-green-900 bg-green-900/20"
                                  }`}
                                >
                                  {coverageText}
                                </span>
                              </td>

                              {/* Прогноз спроса на период */}
                              <td className="px-4 py-3 text-right text-zinc-300">
                                {item.forecastDemand}{" "}
                                <span className="text-[10px] text-zinc-500">
                                  + запас {item.safetyStock}
                                </span>
                              </td>

                              {/* Выпустить */}
                              <td className="px-4 py-3 text-right">
                                {item.productionNeed > 0 ? (
                                  <span className="inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold shadow-sm shadow-blue-900/20">
                                    {item.productionNeed}
                                  </span>
                                ) : (
                                  <span className="text-green-500 flex items-center justify-end gap-1.5 text-xs font-medium bg-green-900/10 px-2 py-1 rounded-md border border-green-900/20">
                                    <PackageCheck className="w-3.5 h-3.5" />{" "}
                                    Хватает
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })
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
