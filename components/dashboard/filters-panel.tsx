// src/components/dashboard/filters-panel.tsx
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, RotateCcw } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import type { District, Store } from "@/lib/types"
import { cn } from "@/lib/utils"

interface FiltersPanelProps {
  districts: District[]
  stores: Store[]
  dateFrom: Date | undefined
  dateTo: Date | undefined
  selectedDistrict: string
  selectedStore: string
  selectedOperationType: string
  onDateFromChange: (value: Date | undefined) => void
  onDateToChange: (value: Date | undefined) => void
  onDistrictChange: (value: string) => void
  onStoreChange: (value: string) => void
  onOperationTypeChange: (value: string) => void
  onReset: () => void
}

export function FiltersPanel({
  districts,
  stores,
  dateFrom,
  dateTo,
  selectedDistrict,
  selectedStore,
  selectedOperationType,
  onDateFromChange,
  onDateToChange,
  onDistrictChange,
  onStoreChange,
  onOperationTypeChange,
  onReset,
}: FiltersPanelProps) {
  const filteredStores = selectedDistrict === "all"
    ? stores
    : stores.filter((s) => s.districtId === selectedDistrict)

  const periodText =
    dateFrom && dateTo
      ? `${format(dateFrom, "dd.MM.yyyy", { locale: ru })} — ${format(dateTo, "dd.MM.yyyy", { locale: ru })}`
      : dateFrom
        ? `с ${format(dateFrom, "dd.MM.yyyy", { locale: ru })}`
        : dateTo
          ? `по ${format(dateTo, "dd.MM.yyyy", { locale: ru })}`
          : "за всё время"

  return (
    <Card>
      <CardContent className="flex flex-wrap gap-4 items-end pt-4">
        {/* Даты */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Период</span>
          <div className="flex gap-2">
            {/* От */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start w-[140px]",
                    !dateFrom && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "dd.MM.yyyy", { locale: ru }) : "Дата от"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={onDateFromChange}
                  locale={ru}
                />
              </PopoverContent>
            </Popover>

            {/* До */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start w-[140px]",
                    !dateTo && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "dd.MM.yyyy", { locale: ru }) : "Дата до"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={onDateToChange}
                  locale={ru}
                />
              </PopoverContent>
            </Popover>
          </div>
          <span className="text-[11px] text-muted-foreground">{periodText}</span>
        </div>

        {/* Район */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Район</span>
          <Select value={selectedDistrict} onValueChange={onDistrictChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Все районы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все районы</SelectItem>
              {districts.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Магазин */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Магазин</span>
          <Select value={selectedStore} onValueChange={onStoreChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Все магазины" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все магазины</SelectItem>
              {filteredStores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Тип операции */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Тип операции</span>
          <Select value={selectedOperationType} onValueChange={onOperationTypeChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Все операции" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все операции</SelectItem>
              <SelectItem value="sale">Продажа</SelectItem>
              <SelectItem value="return">Возврат</SelectItem>
              <SelectItem value="exchange">Обмен</SelectItem>
              <SelectItem value="bonus">Бонус</SelectItem>
              <SelectItem value="writeoff">Списание</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Сбросить фильтры
        </Button>
      </CardContent>
    </Card>
  )
}
