// src/components/dashboard/district-summary.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { DistrictSummary } from "@/lib/types"

interface DistrictSummaryProps {
  summaries: DistrictSummary[]
  fallingDistrictIds?: string[]  // районы с падающей выручкой
}

export function DistrictSummary({ summaries, fallingDistrictIds = [] }: DistrictSummaryProps) {
  const fallingSet = new Set(fallingDistrictIds)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Сводка по районам
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead>Район</TableHead>
                <TableHead className="text-right">Выручка</TableHead>
                <TableHead className="text-right">Прибыль</TableHead>
                <TableHead className="text-right">Продано, шт</TableHead>
                <TableHead className="text-right">Возвраты</TableHead>
                <TableHead className="text-right">Обмены</TableHead>
                <TableHead className="text-right">Бонусы</TableHead>
                <TableHead className="text-right">Списания</TableHead>
                <TableHead className="text-right">Дней с продажами</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                    Нет данных по районам.
                  </TableCell>
                </TableRow>
              ) : (
                summaries.map((d) => {
                  const isFalling = fallingSet.has(d.districtId)
                  return (
                    <TableRow
                      key={d.districtId}
                      className={isFalling ? "bg-orange-50/60 dark:bg-orange-900/10" : ""}
                    >
                      <TableCell className="text-xs">
                        <div className="font-medium flex items-center gap-1">
                          {d.districtName}
                          {isFalling && (
                            <span className="text-[11px] text-orange-600">
                              ⚠ Падающий район
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {d.totalRevenue.toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {d.totalProfit.toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {d.salesQty}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {d.returnsQty}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {d.exchangesQty}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {d.bonusesQty}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {d.writeoffQty}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {d.uniqueSalesDays}
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
  )
}
