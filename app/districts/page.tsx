"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Building2,
  Pencil,
  Trash2,
  Plus,
  Save,
  X,
  Search,
  AlertTriangle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { District, Store } from "@/lib/types"

// --- TYPES ---

type DistrictWithStats = District & {
  storeCount: number
}

type StoreWithDistrict = Store & {
  districtName?: string | null
}

// --- HOOK: LOAD DATA ---

function useGeoDirectory() {
  const [districts, setDistricts] = useState<District[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [dRes, sRes] = await Promise.all([
        fetch("/api/districts"),
        fetch("/api/stores"),
      ])

      if (!dRes.ok || !sRes.ok) throw new Error("Ошибка загрузки данных")

      const [dData, sData] = await Promise.all([dRes.json(), sRes.json()])

      setDistricts(dData)
      setStores(sData)
    } catch (e: any) {
      console.error(e)
      setError(e.message || "Не удалось загрузить справочник")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- API actions ---

  const createDistrict = async (name: string) => {
    const payload = { name: name.trim() }
    if (!payload.name) return

    const res = await fetch("/api/districts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    const created: District = await res.json()
    setDistricts((prev) => [...prev, created])
  }

  const updateDistrict = async (id: string, name: string) => {
    const payload = { name: name.trim() }
    if (!payload.name) return

    const res = await fetch(`/api/districts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    setDistricts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: payload.name } : d))
    )
  }

  const deleteDistrict = async (id: string) => {
    const res = await fetch(`/api/districts/${id}`, {
      method: "DELETE",
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    setDistricts((prev) => prev.filter((d) => d.id !== id))
    // открепляем магазины от удалённого района
    setStores((prev) =>
      prev.map((s) => (s.districtId === id ? { ...s, districtId: null } : s))
    )
  }

  const updateStoreDistrict = async (
    storeId: string,
    districtId: string | null
  ) => {
    // оптимистично обновляем
    setStores((prev) =>
      prev.map((s) =>
        s.id === storeId ? { ...s, districtId: districtId || null } : s
      )
    )

    const res = await fetch(`/api/stores/${storeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ districtId }),
    })

    if (!res.ok) {
      // откатываем, если ошибка
      await fetchData()
      throw new Error(await res.text())
    }
  }

  const updateStoreName = async (storeId: string, name: string) => {
    const payload = { name: name.trim() }
    if (!payload.name) return

    // оптимистично меняем имя
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, name: payload.name } : s))
    )

    const res = await fetch(`/api/stores/${storeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      // откат, если ошибка
      await fetchData()
      throw new Error(await res.text())
    }
  }

  return {
    districts,
    stores,
    loading,
    error,
    createDistrict,
    updateDistrict,
    deleteDistrict,
    updateStoreDistrict,
    updateStoreName,
  }
}

// --- SUB COMPONENT: DISTRICTS ---

const DistrictsCard = ({
  districts,
  stores,
  onCreate,
  onUpdate,
  onDelete,
}: {
  districts: District[]
  stores: Store[]
  onCreate: (name: string) => Promise<void> | void
  onUpdate: (id: string, name: string) => Promise<void> | void
  onDelete: (id: string) => Promise<void> | void
}) => {
  const [newName, setNewName] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [busyId, setBusyId] = useState<string | "new" | null>(null)

  const districtsWithStats: DistrictWithStats[] = useMemo(() => {
    const counts = new Map<string, number>()
    stores.forEach((s) => {
      if (s.districtId) {
        counts.set(s.districtId, (counts.get(s.districtId) || 0) + 1)
      }
    })
    return districts
      .map((d) => ({
        ...d,
        storeCount: counts.get(d.id) || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [districts, stores])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      setBusyId("new")
      await onCreate(name)
      setNewName("")
    } catch (e: any) {
      alert(e.message || "Не удалось создать район")
    } finally {
      setBusyId(null)
    }
  }

  const startEdit = (d: District) => {
    setEditId(d.id)
    setEditName(d.name)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditName("")
  }

  const handleSaveEdit = async () => {
    if (!editId) return
    const name = editName.trim()
    if (!name) return
    try {
      setBusyId(editId)
      await onUpdate(editId, name)
      cancelEdit()
    } catch (e: any) {
      alert(e.message || "Не удалось сохранить изменения")
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (d: DistrictWithStats) => {
    if (d.storeCount > 0) {
      const ok = confirm(
        `К району «${d.name}» привязано магазинов: ${d.storeCount}.\n` +
          "Удалить район и открепить магазины?"
      )
      if (!ok) return
    } else {
      const ok = confirm(`Удалить район «${d.name}»?`)
      if (!ok) return
    }

    try {
      setBusyId(d.id)
      await onDelete(d.id)
    } catch (e: any) {
      alert(e.message || "Не удалось удалить район")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="border-b border-zinc-800/60 pb-4">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <MapPin className="h-5 w-5 text-blue-500" />
          Районы
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Добавление района */}
        <div className="flex gap-2">
          <Input
            placeholder="Название нового района"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="bg-zinc-950 border-zinc-700 text-zinc-100"
          />
          <Button
            onClick={handleCreate}
            disabled={!newName.trim() || busyId === "new"}
            className="min-w-[110px] bg-blue-600 hover:bg-blue-500"
          >
            {busyId === "new" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" /> Добавить
              </>
            )}
          </Button>
        </div>

        {/* Список районов */}
        <div className="border border-zinc-800 rounded-lg max-h-[420px] overflow-y-auto">
          <Table>
            <TableHeader className="bg-zinc-900/70 sticky top-0 z-10">
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-400">Район</TableHead>
                <TableHead className="text-zinc-400 w-[110px] text-center">
                  Магазинов
                </TableHead>
                <TableHead className="w-[130px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {districtsWithStats.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-6 text-center text-zinc-500"
                  >
                    Районов пока нет
                  </TableCell>
                </TableRow>
              ) : (
                districtsWithStats.map((d) => (
                  <TableRow
                    key={d.id}
                    className="border-zinc-800/70 hover:bg-zinc-900/60"
                  >
                    <TableCell className="align-middle">
                      {editId === d.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 bg-zinc-950 border-zinc-700 text-zinc-100"
                          autoFocus
                        />
                      ) : (
                        <span className="text-zinc-100 font-medium">
                          {d.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-zinc-400 text-sm">
                      {d.storeCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {editId === d.id ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-400 hover:text-green-300"
                            onClick={handleSaveEdit}
                            disabled={busyId === d.id || !editName.trim()}
                          >
                            {busyId === d.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
                            onClick={cancelEdit}
                            disabled={busyId === d.id}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
                            onClick={() => startEdit(d)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-500 hover:text-red-400"
                            onClick={() => handleDelete(d)}
                            disabled={busyId === d.id}
                          >
                            {busyId === d.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// --- SUB COMPONENT: STORES ---

const StoresCard = ({
  stores,
  districts,
  onChangeDistrict,
  onUpdateStoreName,
}: {
  stores: Store[]
  districts: District[]
  onChangeDistrict: (
    storeId: string,
    districtId: string | null
  ) => Promise<void> | void
  onUpdateStoreName: (storeId: string, name: string) => Promise<void> | void
}) => {
  const [search, setSearch] = useState("")
  const [busyStoreId, setBusyStoreId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const districtMap = useMemo(
    () => new Map(districts.map((d) => [d.id, d.name])),
    [districts]
  )

  const data: StoreWithDistrict[] = useMemo(() => {
    const filtered = stores.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase())
    )
    return filtered
      .map((s) => ({
        ...s,
        districtName: s.districtId ? districtMap.get(s.districtId) || null : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [stores, search, districtMap])

  const handleChange = async (storeId: string, value: string) => {
    const districtId = value === "none" ? null : value
    try {
      setBusyStoreId(storeId)
      await onChangeDistrict(storeId, districtId)
    } catch (e: any) {
      alert(e.message || "Не удалось обновить магазин")
    } finally {
      setBusyStoreId(null)
    }
  }

  const startEdit = (store: StoreWithDistrict) => {
    setEditId(store.id)
    setEditName(store.name)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditName("")
  }

  const handleSaveEdit = async () => {
    if (!editId) return
    const name = editName.trim()
    if (!name) return
    try {
      setBusyStoreId(editId)
      await onUpdateStoreName(editId, name)
      cancelEdit()
    } catch (e: any) {
      alert(e.message || "Не удалось сохранить магазин")
    } finally {
      setBusyStoreId(null)
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="border-b border-zinc-800/60 pb-4">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Building2 className="h-5 w-5 text-blue-500" />
          Магазины и привязка к районам
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Поиск магазина..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-zinc-950 border-zinc-700 text-zinc-100"
          />
        </div>

        <div className="border border-zinc-800 rounded-lg max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader className="bg-zinc-900/70 sticky top-0 z-10">
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-400">Магазин</TableHead>
                <TableHead className="text-zinc-400 w-[260px]">
                  Район
                </TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-6 text-center text-zinc-500"
                  >
                    Магазинов нет или не найдено
                  </TableCell>
                </TableRow>
              ) : (
                data.map((s) => (
                  <TableRow
                    key={s.id}
                    className="border-zinc-800/70 hover:bg-zinc-900/60"
                  >
                    <TableCell className="text-zinc-100 font-medium align-middle">
                      {editId === s.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 bg-zinc-950 border-zinc-700 text-zinc-100"
                          autoFocus
                        />
                      ) : (
                        s.name
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={s.districtId ?? "none"}
                        onValueChange={(v) => handleChange(s.id, v)}
                        disabled={busyStoreId === s.id || districts.length === 0}
                      >
                        <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-100">
                          <SelectValue placeholder="Выберите район" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                          <SelectItem value="none">Без района</SelectItem>
                          {districts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      {editId === s.id ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-400 hover:text-green-300"
                            onClick={handleSaveEdit}
                            disabled={busyStoreId === s.id || !editName.trim()}
                          >
                            {busyStoreId === s.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
                            onClick={cancelEdit}
                            disabled={busyStoreId === s.id}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
                          onClick={() => startEdit(s)}
                          disabled={busyStoreId === s.id}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {districts.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/10 border border-amber-900/40 px-3 py-2 rounded-md">
            <AlertTriangle className="h-3.5 w-3.5" />
            Сначала добавьте хотя бы один район, чтобы привязывать магазины.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- MAIN PAGE ---

export default function DistrictsPage() {
  const {
    districts,
    stores,
    loading,
    error,
    createDistrict,
    updateDistrict,
    deleteDistrict,
    updateStoreDistrict,
    updateStoreName,
  } = useGeoDirectory()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="h-6 w-6 mr-2 animate-spin text-blue-500" />
        Загрузка справочника...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-zinc-950 text-red-400 gap-3">
        <p>Ошибка: {error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Повторить
        </Button>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Районы и магазины
            </h1>
            <p className="text-zinc-400 mt-1">
              Управление районами и привязка магазинов к нужному району
            </p>
          </div>
          <Button
            variant="outline"
            asChild
            className="bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white"
          >
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Назад в дашборд
            </Link>
          </Button>
        </header>

        {/* CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DistrictsCard
            districts={districts}
            stores={stores}
            onCreate={createDistrict}
            onUpdate={updateDistrict}
            onDelete={deleteDistrict}
          />
          <StoresCard
            stores={stores}
            districts={districts}
            onChangeDistrict={updateStoreDistrict}
            onUpdateStoreName={updateStoreName}
          />
        </div>
      </div>
    </main>
  )
}
