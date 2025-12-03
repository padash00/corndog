import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  // Ограничиваем последние 500 записей
  const rows = await sql`
    SELECT id, date, product_id, produced_qty, bonus_pool_qty, comment, created_at
    FROM production_batches
    ORDER BY date DESC, created_at DESC
    LIMIT 500
  `

  const batches = (rows as any[]).map((row) => ({
    id: row.id,
    date: row.date, // YYYY-MM-DD
    productId: row.product_id,
    producedQty: Number(row.produced_qty),
    bonusPoolQty: Number(row.bonus_pool_qty),
    comment: row.comment,
    createdAt: row.created_at
  }))

  return NextResponse.json(batches)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { date, productId, producedQty, bonusPoolQty, comment } = body

  if (!date || !productId || producedQty === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const [row] = await sql`
    INSERT INTO production_batches (date, product_id, produced_qty, bonus_pool_qty, comment)
    VALUES (${date}, ${productId}, ${producedQty}, ${bonusPoolQty || 0}, ${comment || null})
    RETURNING *
  `

  return NextResponse.json({
    id: row.id,
    date: row.date,
    productId: row.product_id,
    producedQty: Number(row.produced_qty),
    bonusPoolQty: Number(row.bonus_pool_qty),
    comment: row.comment,
    createdAt: row.created_at
  }, { status: 201 })
}