// src/components/dashboard/operations-table.tsx
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Search } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import type {
  MovementWithCalculations,
  District,
  Store,
  Product,
  Movement,
  OperationType,
} from "@/lib/types"
import { AddOperationDialog } from "./add-operation-dialog"

interface OperationsTableProps {
  movements: MovementWithCalculations[]
  districts: District[]
  stores: Store[]
  products: Product[]
  onAddMovement: (movement: Omit<Movement, "id">) => void
}

const operationLabel: Record<OperationType, string> = {
  sale: "Продажа",
  return: "Возврат",
  exchange: "Обмен",
  bonus: "Бонус",
  writeoff: "Списание",
}

const paymentLabel: Record<string, string> = {
  cash: "Наличные",
  kaspi: "Kaspi",
  card: "Карта",
  transfer: "Перевод",
  credit: "В долг",
}

export function OperationsTable({
  movements,
  districts,
  stores,
  products,
  onAddMovement,
}: OperationsTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return movements.filter((m) => {
      if (!query) return true
      const district = districts.find((d) => d.id === m.districtId)
      const store = m.storeId ? stores.find((s) => s.id === m.storeId) : null
      const product = products.find((p) => p.id === m.productId)

      const haystack = [
        district?.name ?? "",
        store?.name ?? "",
        product?.name ?? "",
        m.comment ?? "",
        operationLabel[m.operationType],
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [movements, search, districts, stores, products])

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Операции</CardTitle>
            <p className="text-xs text-muted-foreground">
              Все продажи, возвраты, обмены, бонусы и списания по магазинам и районам.
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 w-[220px]"
                placeholder="Поиск по магазину, товару, комменту..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Добавить операцию
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Дата</TableHead>
                  <TableHead>Район / магазин</TableHead>
                  <TableHead>Товар</TableHead>
                  <TableHead>Тип операции</TableHead>
                  <TableHead>Оплата</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead className="text-right">Цена</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="text-right">Прибыль</TableHead>
                  <TableHead>Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">
                      Нет операций по текущим фильтрам.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((m) => {
                    const district = districts.find((d) => d.id === m.districtId)
                    const store = m.storeId ? stores.find((s) => s.id === m.storeId) : null
                    const product = products.find((p) => p.id === m.productId)

                    const dateObj = m.date instanceof Date ? m.date : new Date(m.date)
                    const formattedDate = format(dateObj, "dd.MM.yyyy", { locale: ru })

                    const op = m.operationType
                    const isNegativeRow =
                      op === "return" || op === "writeoff" || m.profit < 0

                    return (
                      <TableRow
                        key={m.id}
                        className={isNegativeRow ? "bg-red-50/40 dark:bg-red-900/10" : ""}
                      >
                        <TableCell className="whitespace-nowrap text-xs">
                          {formattedDate}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">
                            {store?.name ?? "По району"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {district?.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {product?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant={
                              op === "sale"
                                ? "default"
                                : op === "bonus"
                                  ? "secondary"
                                  : op === "writeoff" || op === "return"
                                    ? "destructive"
                                    : "outline"
                            }
                          >
                            {operationLabel[op]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline">
                            {paymentLabel[m.paymentType] ?? m.paymentType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {m.quantity}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {m.unitPrice.toLocaleString("ru-RU")}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {m.amount.toLocaleString("ru-RU")}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right text-xs font-medium",
                            m.profit < 0 ? "text-red-600" : "text-emerald-600",
                          )}
                        >
                          {m.profit.toLocaleString("ru-RU")}
                        </TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate">
                          {m.comment ?? "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddOperationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        districts={districts}
        stores={stores}
        products={products}
        onAdd={onAddMovement}
      />
    </>
  )
}

// маленький хелпер, чтобы не тянуть cn из utils сюда ещё раз, если сверху нет
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
