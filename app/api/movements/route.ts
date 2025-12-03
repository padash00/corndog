// src/app/api/movements/route.ts
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { OperationType, PaymentMethod } from "@/lib/types"

type MovementRow = {
  id: string
  date: string
  district_id: string
  store_id: string | null
  product_id: string
  operation_type: OperationType
  payment_type: PaymentMethod | null
  quantity: number
  unit_price: string
  comment: string | null
}

function mapRow(row: MovementRow) {
  return {
    id: row.id,
    date: row.date, // на фронте превратим в Date
    districtId: row.district_id,
    storeId: row.store_id,
    productId: row.product_id,
    operationType: row.operation_type,
    paymentType: (row.payment_type ?? "cash") as PaymentMethod,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    comment: row.comment,
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from") // YYYY-MM-DD
  const to = searchParams.get("to")

  let rows: MovementRow[]

  if (from && to) {
    rows = await sql<MovementRow>`
      SELECT *
      FROM movements
      WHERE date BETWEEN ${from}::date AND ${to}::date
      ORDER BY date DESC, created_at DESC
    `
  } else if (from) {
    rows = await sql<MovementRow>`
      SELECT *
      FROM movements
      WHERE date >= ${from}::date
      ORDER BY date DESC, created_at DESC
    `
  } else if (to) {
    rows = await sql<MovementRow>`
      SELECT *
      FROM movements
      WHERE date <= ${to}::date
      ORDER BY date DESC, created_at DESC
    `
  } else {
    rows = await sql<MovementRow>`
      SELECT *
      FROM movements
      ORDER BY date DESC, created_at DESC
    `
  }

  return NextResponse.json(rows.map(mapRow))
}

export async function POST(req: Request) {
  const body = await req.json()

  const {
    date,
    districtId,
    storeId,
    productId,
    operationType,
    paymentType,
    quantity,
    unitPrice,
    comment,
  } = body as {
    date: string
    districtId: string
    storeId: string | null
    productId: string
    operationType: OperationType
    paymentType?: PaymentMethod
    quantity: number
    unitPrice: number
    comment?: string
  }

  if (!date || !districtId || !productId || !operationType || !quantity || unitPrice == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const normalizedPayment: PaymentMethod = paymentType ?? "cash"

  const [row] = await sql<MovementRow>`
    INSERT INTO movements
      (date, district_id, store_id, product_id, operation_type, payment_type, quantity, unit_price, comment)
    VALUES
      (
        ${date}::date,
        ${districtId},
        ${storeId},
        ${productId},
        ${operationType},
        ${normalizedPayment},
        ${quantity},
        ${unitPrice},
        ${comment ?? null}
      )
    RETURNING *
  `

  return NextResponse.json(mapRow(row), { status: 201 })
}
