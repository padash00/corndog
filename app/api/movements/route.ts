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

// Типы операций, которые "съедают" суточное производство
const CONSUME_TYPES: OperationType[] = ["sale", "exchange", "bonus", "writeoff"]

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

// ---------- GET (как было) ----------

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from") // YYYY-MM-DD
  const to = searchParams.get("to")

  let rows: MovementRow[]

  if (from && to) {
    rows = await sql<MovementRow[]>`
      SELECT *
      FROM movements
      WHERE date BETWEEN ${from}::date AND ${to}::date
      ORDER BY date DESC, created_at DESC
    `
  } else if (from) {
    rows = await sql<MovementRow[]>`
      SELECT *
      FROM movements
      WHERE date >= ${from}::date
      ORDER BY date DESC, created_at DESC
    `
  } else if (to) {
    rows = await sql<MovementRow[]>`
      SELECT *
      FROM movements
      WHERE date <= ${to}::date
      ORDER BY date DESC, created_at DESC
    `
  } else {
    rows = await sql<MovementRow[]>`
      SELECT *
      FROM movements
      ORDER BY date DESC, created_at DESC
    `
  }

  return NextResponse.json(rows.map(mapRow))
}

// ---------- POST: с проверкой суточного производства ----------

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

  if (
    !date ||
    !districtId ||
    !productId ||
    !operationType ||
    !quantity ||
    unitPrice == null
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    )
  }

  if (quantity <= 0) {
    return NextResponse.json(
      { error: "Количество должно быть больше нуля" },
      { status: 400 }
    )
  }

  const normalizedPayment: PaymentMethod = paymentType ?? "cash"

  // --- Проверка дневного лимита по производству ---
  const isConsume = CONSUME_TYPES.includes(operationType)

  if (isConsume) {
    // 1) Сколько произведено по этому товару за эту дату
    const prodRows = await sql<{ total_produced: string | number }[]>`
      SELECT COALESCE(SUM(produced_qty), 0) AS total_produced
      FROM production_batches
      WHERE date = ${date}::date
        AND product_id = ${productId}
    `

    const totalProduced = Number(prodRows[0]?.total_produced ?? 0)

    if (totalProduced <= 0) {
      return NextResponse.json(
        {
          error:
            "На эту дату нет производства по этому товару. Сначала добавьте производство на странице «Производство».",
        },
        { status: 400 }
      )
    }

    // 2) Сколько уже съели за день по этому товару всеми магазинами
    const usedRows = await sql<{ used: string | number }[]>`
      SELECT COALESCE(SUM(quantity), 0) AS used
      FROM movements
      WHERE date = ${date}::date
        AND product_id = ${productId}
        AND operation_type IN ('sale', 'exchange', 'bonus', 'writeoff')
    `

    const usedBefore = Number(usedRows[0]?.used ?? 0)
    const willBeUsed = usedBefore + quantity

    if (willBeUsed > totalProduced) {
      return NextResponse.json(
        {
          error:
            "Недостаточно произведено на эту дату для этого товара. Проверьте количество.",
          details: {
            produced: totalProduced,
            usedBefore,
            tryingToAdd: quantity,
          },
        },
        { status: 400 }
      )
    }
  }

  // --- Если всё ок — пишем движение ---
  const [row] = await sql<MovementRow[]>`
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
