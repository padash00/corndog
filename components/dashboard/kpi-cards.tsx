// src/components/dashboard/kpi-cards.tsx
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Wallet, BarChart3, Minus, Activity } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import type { OperationCounts } from "@/lib/types"

interface KpiCardsProps {
  revenue: number
  cost: number
  profit: number
  operationCounts: OperationCounts
  dateFrom: Date | undefined
  dateTo: Date | undefined
}

const formatMoney = (value: number) =>
  value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })

export function KpiCards({ revenue, cost, profit, operationCounts, dateFrom, dateTo }: KpiCardsProps) {
  const margin = revenue !== 0 ? (profit / revenue) * 100 : 0

  const periodText =
    dateFrom && dateTo
      ? `${format(dateFrom, "dd.MM.yyyy", { locale: ru })} — ${format(dateTo, "dd.MM.yyyy", { locale: ru })}`
      : dateFrom
        ? `с ${format(dateFrom, "dd.MM.yyyy", { locale: ru })}`
        : dateTo
          ? `по ${format(dateTo, "dd.MM.yyyy", { locale: ru })}`
          : "за всё время"

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Выручка */}
      <Card>
        <CardContent className="flex items-center justify-between pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Выручка</p>
            <p className="text-2xl font-semibold">{formatMoney(revenue)} ₸</p>
            <p className="text-[11px] text-muted-foreground mt-1">{periodText}</p>
          </div>
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Прибыль / маржа */}
      <Card>
        <CardContent className="flex items-center justify-between pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Прибыль</p>
            <p className="text-2xl font-semibold">{formatMoney(profit)} ₸</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center text-[11px] rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30">
                <BarChart3 className="mr-1 h-3 w-3" />
                Маржа {margin.toFixed(1)}%
              </span>
              <span className="text-[11px] text-muted-foreground">
                Себестоимость: {formatMoney(cost)} ₸
              </span>
            </div>
          </div>
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
            {profit >= 0 ? (
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            ) : (
              <TrendingDown className="h-6 w-6 text-red-500" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Кол-во операций */}
      <Card>
        <CardContent className="flex items-center justify-between pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Операции</p>
            <div className="flex flex-col gap-1 mt-1 text-xs">
              <span>
                <span className="font-medium">{operationCounts.sales}</span> прод.
              </span>
              <span className="text-red-600">
                {operationCounts.returns} возвр. / {operationCounts.exchanges} обменов
              </span>
              <span className="text-sky-700">
                {operationCounts.bonuses} бонусов
              </span>
              <span className="text-amber-700">
                {operationCounts.writeoffs} списаний
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">{periodText}</p>
          </div>
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
            <Activity className="h-6 w-6 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
