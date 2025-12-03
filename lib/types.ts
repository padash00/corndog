// --- Районы и магазины ---

export interface District {
  id: string
  name: string
}

export interface Store {
  id: string
  districtId: string
  name: string
  address?: string
}

// --- Товары ---

export interface Product {
  id: string
  name: string
  costPrice: number      // себестоимость
  salePrice: number      // базовая цена продажи
}

// --- Справочники типов ---

export type OperationType = "sale" | "return" | "exchange" | "bonus"

export type PaymentMethod = "cash" | "kaspi" | "card" | "transfer" | "credit"

// --- Движения (отгрузки / возвраты / обмены / бонусы) ---

export interface Movement {
  id: string
  date: Date | string           // с бэка приходит string, на фронте часто превращаем в Date
  districtId: string
  storeId: string | null        // null = отгрузка по району, без конкретного магазина
  productId: string
  operationType: OperationType  // продажа / возврат / обмен / бонус
  paymentType: PaymentMethod    // как рассчитались: нал, Kaspi, карта, перевод, кредит (долг)
  quantity: number              // количество штук
  unitPrice: number             // цена за штуку
  comment?: string              // любой комментарий
}

export interface MovementWithCalculations extends Movement {
  amount: number      // сумма по продаже/операции (с учётом знака)
  costAmount: number  // себестоимость по операции
  profit: number      // прибыль по операции
}

// --- Сводка по магазину ---

export interface StoreSummary {
  districtId: string
  districtName: string
  storeId: string | null
  storeName: string

  totalRevenue: number
  totalCost: number
  totalProfit: number

  salesQty: number
  returnsQty: number
  exchangesQty: number
  bonusesQty: number

  salesCount: number
  returnsCount: number
  exchangesCount: number
  bonusesCount: number
}

// --- Сводка по району ---

export interface DistrictSummary {
  districtId: string
  districtName: string

  totalRevenue: number
  totalCost: number
  totalProfit: number

  salesQty: number
  returnsQty: number
  exchangesQty: number
  bonusesQty: number

  uniqueSalesDays: number
}

// --- KPI по операциям ---

export interface OperationCounts {
  sales: number
  returns: number
  exchanges: number
  bonuses: number
}

// --- Данные для графиков по дням ---

export interface DailyData {
  date: string      // "dd.MM"
  revenue: number
  profit: number
}

// --- Оплаты от магазинов (для дебиторки) ---

export interface StorePayment {
  id: string
  date: Date | string
  districtId: string | null     // можно null, если не хочешь жёстко привязывать к району
  storeId: string               // конкретный магазин
  amount: number                // сумма оплаты
  method: PaymentMethod         // способ оплаты
  comment?: string
}
