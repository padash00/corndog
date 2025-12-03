"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { ru } from "date-fns/locale"
import { ArrowLeft, Calendar, CreditCard, Filter, Loader2, Wallet } from "lucide-react"

import type {
  District,
  Store,
  Movement,
  StorePayment,
  PaymentMethod,
} from "@/lib/types"

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// --- TYPES ---

type StoreDebtSummary = {
  id: string // composite: districtId-storeId
  districtId: string
  storeId: string
  districtName: string
  storeName: string
  creditAmount: number
  paymentsAmount: number
  balance: number
}

// --- BUSINESS LOGIC (Pure Functions) ---

const calculateDebts = (
  movements: Movement[],
  payments: StorePayment[],
  stores: Store[],
  districts: District[],
  dateFrom?: string,
  dateTo?: string,
  selectedDistrict: string = "all",
  selectedStore: string = "all"
): StoreDebtSummary[] => {
  const map = new Map<string, StoreDebtSummary>()
  const from = dateFrom ? startOfDay(new Date(dateFrom)) : null
  const to = dateTo ? endOfDay(new Date(dateTo)) : null

  const checkDate = (d: Date) => {
    if (from && to) return isWithinInterval(d, { start: from, end: to })
    if (from) return d >= from
    if (to) return d <= to
    return true
  }

  // 1. Обработка движений (только кредит)
  movements.forEach((m) => {
    if (m.paymentType !== "credit" || !m.storeId) return
    if (selectedDistrict !== "all" && m.districtId !== selectedDistrict) return
    if (selectedStore !== "all" && m.storeId !== selectedStore) return
    
    const mDate = new Date(m.date)
    if (!checkDate(mDate)) return

    const key = `${m.districtId}-${m.storeId}`
    if (!map.has(key)) {
      const store = stores.find((s) => s.id === m.storeId)
      const district = districts.find((d) => d.id === m.districtId)
      map.set(key, {
        id: key,
        districtId: m.districtId,
        storeId: m.storeId,
        districtName: district?.name || "Неизвестный район",
        storeName: store?.name || "Неизвестный магазин",
        creditAmount: 0,
        paymentsAmount: 0,
        balance: 0,
      })
    }

    const item = map.get(key)!
    // return уменьшает долг (магазин вернул товар), sale увеличивает
    const sign = m.operationType === "return" ? -1 : 1
    const amount = sign * m.quantity * m.unitPrice
    
    item.creditAmount += amount
    item.balance += amount
  })

  // 2. Обработка оплат
  payments.forEach((p) => {
    const store = stores.find((s) => s.id === p.storeId)
    // Если districtId нет в оплате, берем из магазина
    const pDistrictId = p.districtId ?? store?.districtId
    if (!pDistrictId) return

    if (selectedDistrict !== "all" && pDistrictId !== selectedDistrict) return
    if (selectedStore !== "all" && p.storeId !== selectedStore) return

    const pDate = new Date(p.date)
    if (!checkDate(pDate)) return

    const key = `${pDistrictId}-${p.storeId}`
    
    // Если оплаты есть, а движений не было (редкий кейс, но возможный)
    if (!map.has(key)) {
      const district = districts.find((d) => d.id === pDistrictId)
      map.set(key, {
        id: key,
        districtId: pDistrictId,
        storeId: p.storeId,
        districtName: district?.name || "Неизвестный район",
        storeName: store?.name || "Неизвестный магазин",
        creditAmount: 0,
        paymentsAmount: 0,
        balance: 0,
      })
    }

    const item = map.get(key)!
    item.paymentsAmount += p.amount
    item.balance -= p.amount // оплата уменьшает долг
  })

  return Array.from(map.values()).sort((a, b) => b.balance - a.balance)
}

// --- CUSTOM HOOKS ---

function useDebtsData() {
  const [districts, setDistricts] = useState<District[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [payments, setPayments] = useState<StorePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [dRes, sRes, mRes, pRes] = await Promise.all([
        fetch("/api/districts"),
        fetch("/api/stores"),
        fetch("/api/movements"),
        fetch("/api/store-payments"),
      ])

      if (!dRes.ok || !sRes.ok || !mRes.ok || !pRes.ok) throw new Error("Ошибка API")

      const [dData, sData, mData, pData] = await Promise.all([
        dRes.json(), sRes.json(), mRes.json(), pRes.json()
      ])

      setDistricts(dData)
      setStores(sData)
      setMovements(mData) // Предполагаем, что даты уже строки или Date, обработаем при расчете
      setPayments(pData)
    } catch (e: any) {
      console.error(e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { districts, stores, movements, payments, loading, error, refresh: fetchData }
}

// --- SUB-COMPONENTS ---

// Диалог добавления оплаты
const AddPaymentDialog = ({ 
  isOpen, onClose, onSave, districts, stores 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (data: any) => Promise<void>,
  districts: District[],
  stores: Store[]
}) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [districtId, setDistrictId] = useState("")
  const [storeId, setStoreId] = useState("")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const availableStores = useMemo(() => {
    return districtId ? stores.filter(s => s.districtId === districtId) : []
  }, [stores, districtId])

  const handleSave = async () => {
    if (!amount || !storeId) return
    setIsSubmitting(true)
    await onSave({
      date, districtId: districtId || null, storeId, amount: Number(amount), method, comment
    })
    setIsSubmitting(false)
    // Сброс ключевых полей
    setAmount("")
    setComment("")
    setMethod("cash")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Внести оплату</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Дата</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Район</Label>
            <Select value={districtId} onValueChange={(v) => { setDistrictId(v); setStoreId("") }}>
              <SelectTrigger><SelectValue placeholder="Выберите район" /></SelectTrigger>
              <SelectContent>
                {districts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Магазин</Label>
            <Select value={storeId} onValueChange={setStoreId} disabled={!districtId}>
              <SelectTrigger><SelectValue placeholder={districtId ? "Выберите магазин" : "Сначала район"} /></SelectTrigger>
              <SelectContent>
                {availableStores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Сумма (тг)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Способ</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Наличные</SelectItem>
                <SelectItem value="kaspi">Kaspi</SelectItem>
                <SelectItem value="card">Карта</SelectItem>
                <SelectItem value="transfer">Перевод</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Причина, детали..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={isSubmitting || !storeId || !amount}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- MAIN COMPONENT ---

export default function DebtsPage() {
  // 1. Data Layer
  const { districts, stores, movements, payments, loading, error, refresh } = useDebtsData()

  // 2. UI State
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedDistrict, setSelectedDistrict] = useState("all")
  const [selectedStore, setSelectedStore] = useState("all")
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false)

  // 3. Derived State
  const debtData = useMemo(() => 
    calculateDebts(movements, payments, stores, districts, dateFrom, dateTo, selectedDistrict, selectedStore), 
    [movements, payments, stores, districts, dateFrom, dateTo, selectedDistrict, selectedStore]
  )

  const totals = useMemo(() => debtData.reduce((acc, curr) => ({
    credit: acc.credit + curr.creditAmount,
    paid: acc.paid + curr.paymentsAmount,
    balance: acc.balance + curr.balance
  }), { credit: 0, paid: 0, balance: 0 }), [debtData])

  const filteredStoresForSelect = useMemo(() => 
    selectedDistrict === "all" ? stores : stores.filter(s => s.districtId === selectedDistrict),
  [stores, selectedDistrict])

  // 4. Actions
  const handleSavePayment = async (payload: any) => {
    try {
      const res = await fetch("/api/store-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error("Error saving payment")
      refresh() // Refresh data to show updates
    } catch (e) {
      console.error(e)
      alert("Не удалось сохранить оплату")
    }
  }

  // 5. Render
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground"><Loader2 className="mr-2 animate-spin" /> Загрузка долгов...</div>
  if (error) return <div className="flex h-screen items-center justify-center text-destructive">Ошибка: {error}</div>

  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Долговая книга</h1>
            <p className="text-muted-foreground">Баланс взаиморасчетов с магазинами</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Назад</Link>
            </Button>
            <Button onClick={() => setIsAddPaymentOpen(true)}>
              <Wallet className="mr-2 h-4 w-4" /> Внести оплату
            </Button>
          </div>
        </header>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Отгружено в долг</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.credit.toLocaleString("ru-RU")} ₸</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Получено оплат</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totals.paid.toLocaleString("ru-RU")} ₸</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Текущий баланс</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totals.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                {totals.balance.toLocaleString("ru-RU")} ₸
              </div>
              <p className="text-xs text-muted-foreground">
                {totals.balance > 0 ? "Магазины должны нам" : "Мы должны (переплата)"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FILTERS */}
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>С даты</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-2">
              <Label>По дату</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-2 min-w-[180px]">
              <Label>Район</Label>
              <Select value={selectedDistrict} onValueChange={(v) => { setSelectedDistrict(v); setSelectedStore("all") }}>
                <SelectTrigger><SelectValue placeholder="Все районы" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все районы</SelectItem>
                  {districts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[180px]">
              <Label>Магазин</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore} disabled={selectedDistrict === "all"}>
                <SelectTrigger><SelectValue placeholder="Все магазины" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все магазины</SelectItem>
                  {filteredStoresForSelect.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" onClick={() => { setDateFrom(""); setDateTo(""); setSelectedDistrict("all"); setSelectedStore("all") }}>
              Сбросить
            </Button>
          </CardContent>
        </Card>

        {/* TABLE */}
        <Card>
          <CardHeader>
            <CardTitle>Детализация по точкам</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Район</TableHead>
                    <TableHead>Магазин</TableHead>
                    <TableHead className="text-right text-red-600">Взято в долг</TableHead>
                    <TableHead className="text-right text-green-600">Оплачено</TableHead>
                    <TableHead className="text-right font-bold">Баланс (Долг)</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Нет данных за выбранный период</TableCell>
                    </TableRow>
                  ) : (
                    debtData.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="text-muted-foreground">{row.districtName}</TableCell>
                        <TableCell className="font-medium">{row.storeName}</TableCell>
                        <TableCell className="text-right">{row.creditAmount.toLocaleString("ru-RU")}</TableCell>
                        <TableCell className="text-right">{row.paymentsAmount.toLocaleString("ru-RU")}</TableCell>
                        <TableCell className={`text-right font-bold ${row.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                          {row.balance.toLocaleString("ru-RU")}
                        </TableCell>
                        <TableCell>
                          {row.balance > 0 && <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Долг</span>}
                          {row.balance < 0 && <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Переплата</span>}
                          {row.balance === 0 && <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">Закрыт</span>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AddPaymentDialog 
        isOpen={isAddPaymentOpen} 
        onClose={() => setIsAddPaymentOpen(false)}
        onSave={handleSavePayment}
        districts={districts}
        stores={stores}
      />
    </main>
  )
}