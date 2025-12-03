"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import type { District, Store, Product, Movement, OperationType } from "@/lib/types"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"

type AddOperationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  districts: District[]
  stores: Store[]
  products: Product[]
  onAdd: (movement: Omit<Movement, "id">) => void
}

// чтобы TS не ругался, но значение было строго тем же, что и в типе
const WRITE_OFF_OPERATION: OperationType = "writeoff" as OperationType

export function AddOperationDialog({
  open,
  onOpenChange,
  districts,
  stores,
  products,
  onAdd,
}: AddOperationDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [districtId, setDistrictId] = useState<string>("")
  // "district" = движение только по району, без конкретного магазина
  const [storeValue, setStoreValue] = useState<string>("district")
  const [productId, setProductId] = useState<string>("")
  const [operationType, setOperationType] = useState<OperationType>("sale")
  const [quantity, setQuantity] = useState<string>("1")
  const [unitPrice, setUnitPrice] = useState<string>("")
  const [comment, setComment] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const filteredStores = useMemo(
    () => stores.filter((s) => s.districtId === districtId),
    [stores, districtId],
  )

  // Автоподстановка цены при выборе товара / типа операции
  useEffect(() => {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    if (operationType === "bonus" || operationType === WRITE_OFF_OPERATION) {
      setUnitPrice("0")
    } else {
      setUnitPrice(String(product.salePrice ?? 0))
    }
  }, [productId, operationType, products])

  const resetForm = () => {
    setDate(new Date())
    setDistrictId("")
    setStoreValue("district")
    setProductId("")
    setOperationType("sale")
    setQuantity("1")
    setUnitPrice("")
    setComment("")
    setError(null)
  }

  const handleSubmit = () => {
    if (!date) {
      setError("Выберите дату")
      return
    }
    if (!districtId) {
      setError("Выберите район")
      return
    }
    if (!productId) {
      setError("Выберите товар")
      return
    }

    const qty = Number(quantity)
    const price = Number(unitPrice || 0)

    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Количество должно быть больше 0")
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Цена не может быть отрицательной")
      return
    }

    if (operationType === WRITE_OFF_OPERATION && !comment.trim()) {
      setError("Для списания обязательно укажите причину в поле «Комментарий»")
      return
    }

    const payload: Omit<Movement, "id"> = {
      date,
      districtId,
      storeId: storeValue === "district" ? null : storeValue,
      productId,
      operationType,
      quantity: qty,
      unitPrice: price,
      comment: comment.trim() || undefined,
    }

    onAdd(payload)
    resetForm()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(openState) => {
        if (!openState) {
          resetForm()
        }
        onOpenChange(openState)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить операцию</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Дата */}
          <div className="space-y-2">
            <Label>Дата</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Район */}
          <div className="space-y-2">
            <Label>Район</Label>
            <Select
              value={districtId}
              onValueChange={(value) => {
                setDistrictId(value)
                // при смене района сбрасываем магазин
                setStoreValue("district")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите район" />
              </SelectTrigger>
              <SelectContent>
                {districts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Магазин */}
          <div className="space-y-2">
            <Label>Магазин</Label>
            <Select
              value={storeValue}
              onValueChange={setStoreValue}
              disabled={!districtId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    districtId
                      ? "Выберите магазин или «Без магазина»"
                      : "Сначала выберите район"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="district">Без магазина (только район)</SelectItem>
                {filteredStores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Товар */}
          <div className="space-y-2">
            <Label>Товар</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите товар" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Тип операции */}
          <div className="space-y-2">
            <Label>Тип операции</Label>
            <Select
              value={operationType}
              onValueChange={(value) => setOperationType(value as OperationType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">Продажа</SelectItem>
                <SelectItem value="return">Возврат</SelectItem>
                <SelectItem value="exchange">Обмен</SelectItem>
                <SelectItem value="bonus">Бонус</SelectItem>
                <SelectItem value={WRITE_OFF_OPERATION}>Списание / брак</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Количество и цена */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Количество, шт</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitPrice">
                Цена за штуку, тг{" "}
                {(operationType === "bonus" || operationType === WRITE_OFF_OPERATION) && (
                  <span className="text-xs text-muted-foreground">(обычно 0)</span>
                )}
              </Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
          </div>

          {/* Комментарий / причина */}
          <div className="space-y-2">
            <Label htmlFor="comment">
              {operationType === WRITE_OFF_OPERATION
                ? "Причина списания / комментарий"
                : "Комментарий (необязательно)"}
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                operationType === WRITE_OFF_OPERATION
                  ? "Например: подгорели при жарке, истёк срок, повредили упаковку…"
                  : "Любой дополнительный комментарий"
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              resetForm()
              onOpenChange(false)
            }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!districtId || !productId || !quantity || unitPrice === ""}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
