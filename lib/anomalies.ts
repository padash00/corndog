import type { Movement, Store, Product } from "./types"

export type AlertType = "returns" | "bonuses" | "exchanges"

export type StoreAlert = {
  storeId: string
  storeName: string
  type: AlertType
  percent: number
}

export type ProductReturnAlert = {
  id: string
  storeName: string
  productName: string
  sales: number
  returns: number
  rate: number
}

// Общий анализ по магазинам (существующая функция)
export function detectAnomalies(
  movements: Movement[],
  stores: Store[]
): StoreAlert[] {
  const alerts: StoreAlert[] = []
  const byStore = new Map<string, { sales: number; returns: number; bonuses: number; exchanges: number }>()

  for (const m of movements) {
    if (!m.storeId) continue
    const entry = byStore.get(m.storeId) ?? { sales: 0, returns: 0, bonuses: 0, exchanges: 0 }

    if (m.operationType === "sale") entry.sales += m.quantity
    if (m.operationType === "return") entry.returns += m.quantity
    if (m.operationType === "bonus") entry.bonuses += m.quantity
    if (m.operationType === "exchange") entry.exchanges += m.quantity

    byStore.set(m.storeId, entry)
  }

  for (const [storeId, stats] of byStore.entries()) {
    const store = stores.find((s) => s.id === storeId)
    if (!store || stats.sales === 0) continue

    const addAlert = (type: AlertType, count: number, threshold: number) => {
      const percent = (count / stats.sales) * 100
      if (percent > threshold) {
        alerts.push({
          storeId,
          storeName: store.name,
          type,
          percent: Math.round(percent),
        })
      }
    }

    addAlert("returns", stats.returns, 10)
    addAlert("bonuses", stats.bonuses, 5)
    addAlert("exchanges", stats.exchanges, 10)
  }

  return alerts
}

// НОВАЯ ФУНКЦИЯ: Детальный анализ возвратов по конкретным товарам
export function detectProductAnomalies(
  movements: Movement[],
  stores: Store[],
  products: Product[]
): ProductReturnAlert[] {
  const alerts: ProductReturnAlert[] = []
  // Ключ: "storeId:productId"
  const stats = new Map<string, { sales: number; returns: number }>()

  for (const m of movements) {
    if (!m.storeId) continue
    const key = `${m.storeId}:${m.productId}`
    const entry = stats.get(key) ?? { sales: 0, returns: 0 }

    if (m.operationType === "sale") entry.sales += m.quantity
    if (m.operationType === "return") entry.returns += m.quantity
    // Обмены тоже можно считать как сигнал проблемы с качеством
    if (m.operationType === "exchange") entry.returns += m.quantity 

    stats.set(key, entry)
  }

  for (const [key, data] of stats.entries()) {
    // Фильтр шума: анализируем, только если было хотя бы 5 продаж
    if (data.sales < 5) continue

    const rate = (data.returns / data.sales) * 100
    
    // Порог тревоги: > 15% возвратов по конкретному товару
    if (rate > 15) {
      const [storeId, productId] = key.split(":")
      const store = stores.find(s => s.id === storeId)
      const product = products.find(p => p.id === productId)

      if (store && product) {
        alerts.push({
          id: key,
          storeName: store.name,
          productName: product.name,
          sales: data.sales,
          returns: data.returns,
          rate: Math.round(rate)
        })
      }
    }
  }

  return alerts.sort((a, b) => b.rate - a.rate)
}