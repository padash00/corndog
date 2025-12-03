import { format, getDay, startOfWeek, addWeeks, subWeeks, isSameWeek } from "date-fns"
import { ru } from "date-fns/locale"
import type { Movement, Product } from "./types"

type ForecastEntry = {
  productId: string
  productName: string
  average: number
  trend: number
  recommendedQty: number
}

// Данные для графика сезонности
export type SeasonalityPoint = {
  weekStart: string // метка для оси X
  sales: number
  isPeak: boolean
  isDrop: boolean
}

export function generateForecast(
  movements: Movement[],
  products: Product[],
  targetDate: Date
): ForecastEntry[] {
  const dayOfWeek = getDay(targetDate)
  const msInDay = 24 * 60 * 60 * 1000

  const cutoff7 = new Date(targetDate.getTime() - 7 * msInDay)
  const cutoff30 = new Date(targetDate.getTime() - 30 * msInDay)

  const filtered = movements.filter((m) => m.operationType === "sale")

  const byProduct = new Map<string, { name: string; sales7: number[]; sales30: number[] }>()

  filtered.forEach((m) => {
    const key = m.productId
    const date = new Date(m.date)
    const entry = byProduct.get(key) ?? {
      name: products.find((p) => p.id === key)?.name ?? "???",
      sales7: [],
      sales30: [],
    }

    if (date >= cutoff7) entry.sales7.push(m.quantity)
    if (date >= cutoff30) entry.sales30.push(m.quantity)

    byProduct.set(key, entry)
  })

  const result: ForecastEntry[] = []

  byProduct.forEach((entry, productId) => {
    const avg7 = average(entry.sales7)
    const avg30 = average(entry.sales30)
    const trend = avg7 && avg30 ? (avg7 - avg30) / avg30 : 0
    // Добавляем буфер в пятницу и субботу
    const recommended = Math.round((avg7 || avg30 || 0) * (1 + trend * 0.5)) + (dayOfWeek >= 5 ? 50 : 0)

    result.push({
      productId,
      productName: entry.name,
      average: Math.round(avg7 || avg30 || 0),
      trend: Math.round(trend * 100),
      recommendedQty: Math.max(recommended, 0),
    })
  })

  return result
}

function average(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((sum, n) => sum + n, 0) / arr.length
}

// НОВАЯ ФУНКЦИЯ: Анализ сезонности по неделям (за последние 12 недель)
export function analyzeSeasonality(movements: Movement[]): SeasonalityPoint[] {
  const weeksCount = 12
  const today = new Date()
  const weeks: SeasonalityPoint[] = []
  
  // Создаем бакеты для недель
  for (let i = weeksCount - 1; i >= 0; i--) {
    const d = subWeeks(today, i)
    weeks.push({
      weekStart: format(startOfWeek(d, { weekStartsOn: 1 }), "dd.MM", { locale: ru }),
      sales: 0,
      isPeak: false,
      isDrop: false
    })
  }

  // Заполняем данными
  const salesMovements = movements.filter(m => m.operationType === 'sale')
  
  salesMovements.forEach(m => {
    const date = new Date(m.date)
    // Ищем соответствующую неделю
    const weekIndex = weeks.findIndex((w, idx) => {
      const wDate = subWeeks(today, weeksCount - 1 - idx)
      return isSameWeek(date, wDate, { weekStartsOn: 1 })
    })
    
    if (weekIndex !== -1) {
      weeks[weekIndex].sales += m.quantity
    }
  })

  // Анализ пиков и спадов (простая эвристика)
  const values = weeks.map(w => w.sales)
  const mean = average(values)
  const threshold = mean * 0.2 // отклонение 20%

  return weeks.map(w => ({
    ...w,
    isPeak: w.sales > mean + threshold,
    isDrop: w.sales < mean - threshold && w.sales > 0 // > 0 чтобы не помечать будущие недели как спад
  }))
}