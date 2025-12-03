import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { PaymentMethod } from "@/lib/types"

type StorePaymentRow = {
  id: string
  date: string
  district_id: string | null
  store_id: string
  amount: string
  method: PaymentMethod | null
  comment: string | null
}

function mapRow(row: StorePaymentRow) {
  return {
    id: row.id,
    date: row.date,
    districtId: row.district_id,
    storeId: row.store_id,
    amount: Number(row.amount),
    method: (row.method ?? "cash") as PaymentMethod,
    comment: row.comment ?? undefined,
  }
}

// GET /api/store-payments?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  let rows: StorePaymentRow[]

  if (from && to) {
    rows = await sql<StorePaymentRow>`
      SELECT *
      FROM store_payments
      WHERE date BETWEEN ${from}::date AND ${to}::date
      ORDER BY date DESC, created_at DESC
    `
  } else if (from) {
    rows = await sql<StorePaymentRow>`
      SELECT *
      FROM store_payments
      WHERE date >= ${from}::date
      ORDER BY date DESC, created_at DESC
    `
  } else if (to) {
    rows = await sql<StorePaymentRow>`
      SELECT *
      FROM store_payments
      WHERE date <= ${to}::date
      ORDER BY date DESC, created_at DESC
    `
  } else {
    rows = await sql<StorePaymentRow>`
      SELECT *
      FROM store_payments
      ORDER BY date DESC, created_at DESC
    `
  }

  return NextResponse.json(rows.map(mapRow))
}

// POST /api/store-payments
export async function POST(req: Request) {
  const body = await req.json()

  const {
    date,
    districtId,
    storeId,
    amount,
    method,
    comment,
  } = body as {
    date: string
    districtId: string | null
    storeId: string
    amount: number
    method?: PaymentMethod
    comment?: string
  }

  // базовая валидация
  if (!date || !storeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
  }

  const normalizedMethod: PaymentMethod = method ?? "cash"

  const [row] = await sql<StorePaymentRow>`
    INSERT INTO store_payments
      (date, district_id, store_id, amount, method, comment)
    VALUES
      (
        ${date}::date,
        ${districtId},
        ${storeId},
        ${numericAmount},
        ${normalizedMethod},
        ${comment ?? null}
      )
    RETURNING *
  `

  return NextResponse.json(mapRow(row), { status: 201 })
}
