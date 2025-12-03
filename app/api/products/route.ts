import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  const rows = await sql`
    SELECT id, name, cost_price, sale_price
    FROM products
    ORDER BY name
  `

  const products = (rows as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    costPrice: Number(row.cost_price),
    salePrice: Number(row.sale_price),
  }))

  return NextResponse.json(products)
}

export async function POST(req: Request) {
  const body = await req.json()
  const name = (body?.name ?? "").trim()
  const costPrice = Number(body?.costPrice || 0)
  const salePrice = Number(body?.salePrice || 0)

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const [row] = await sql`
    INSERT INTO products (name, cost_price, sale_price)
    VALUES (${name}, ${costPrice}, ${salePrice})
    RETURNING id, name, cost_price, sale_price
  `

  return NextResponse.json({
    id: row.id,
    name: row.name,
    costPrice: Number(row.cost_price),
    salePrice: Number(row.sale_price)
  }, { status: 201 })
}