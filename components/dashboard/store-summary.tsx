// src/components/dashboard/store-summary.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { StoreSummary } from "@/lib/types"

interface StoreSummaryProps {
  summaries: StoreSummary[]
}

export function StoreSummary({ summaries }: StoreSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Сводка по магазинам
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead>Район</TableHead>
                <TableHead>Магазин</TableHead>
                <TableHead className="text-right">Выручка</TableHead>
                <TableHead className="text-right">Прибыль</TableHead>
                <TableHead className="text-right">Продано, шт</TableHead>
                <TableHead className="text-right">Возврат+обмен</TableHead>
                <TableHead className="text-right">Бонусы</TableHead>
                <TableHead className="text-right">Списания</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                    Нет данных по магазинам.
                  </TableCell>
                </TableRow>
              ) : (
                summaries.map((s) => {
                  const issueQty = s.returnsQty + s.exchangesQty
                  const baseQtyForIssues = s.salesQty || issueQty || 1
                  const issueRate = issueQty / baseQtyForIssues

                  const baseQtyForBonus = s.salesQty + s.bonusesQty || 1
                  const bonusRate = s.bonusesQty / baseQtyForBonus

                  const isProblemStore = issueRate >= 0.1 // >10% проблемных
                  const isHighBonus = bonusRate >= 0.05   // >5% бонусов

                  const rowClass =
                    isProblemStore
                      ? "bg-red-50/60 dark:bg-red-900/10"
                      : isHighBonus
                        ? "bg-amber-50/60 dark:bg-amber-900/10"
                        : ""

                  return (
                    <TableRow key={`${s.districtId}-${s.storeId ?? "district"}`} className={rowClass}>
                      <TableCell className="text-xs">{s.districtName}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{s.storeName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {isProblemStore && "⚠ Проблемная точка (возвраты/обмены > 10%)"}
                          {!isProblemStore && isHighBonus && "⚠ Много бонусов (>5%)"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {s.totalRevenue.toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {s.totalProfit.toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {s.salesQty}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {issueQty} шт{" "}
                        {baseQtyForIssues > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            ({(issueRate * 100).toFixed(1)}%)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {s.bonusesQty} шт{" "}
                        {baseQtyForBonus > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            ({(bonusRate * 100).toFixed(1)}%)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {s.writeoffQty}
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
