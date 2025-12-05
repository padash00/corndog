import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// GET: список товаров
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, name, cost_price, sale_price
      FROM products
      ORDER BY name
    `

    const products = (rows as any[]).map((row) => ({
      id: row.id,
      name: row.name,
      costPrice: Number(row.cost_price) || 0,
      salePrice: Number(row.sale_price) || 0,
    }))

    return NextResponse.json(products)
  } catch (error) {
    console.error("products GET error:", error)
    return NextResponse.json(
      { error: "Не удалось получить список товаров" },
      { status: 500 }
    )
  }
}

// POST: создать новый товар
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const name = (body?.name ?? "").trim()
    const costPrice = Number(body?.costPrice ?? 0)
    const salePrice = Number(body?.salePrice ?? 0)

    if (!name) {
      return NextResponse.json(
        { error: "Название товара обязательно" },
        { status: 400 }
      )
    }

    if (Number.isNaN(costPrice) || Number.isNaN(salePrice)) {
      return NextResponse.json(
        { error: "Некорректные значения цены/себестоимости" },
        { status: 400 }
      )
    }

    const [row] = await sql<any>`
      INSERT INTO products (name, cost_price, sale_price)
      VALUES (${name}, ${costPrice}, ${salePrice})
      RETURNING id, name, cost_price, sale_price
    `

    return NextResponse.json(
      {
        id: row.id,
        name: row.name,
        costPrice: Number(row.cost_price) || 0,
        salePrice: Number(row.sale_price) || 0,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("products POST error:", error)
    return NextResponse.json(
      { error: "Не удалось создать товар" },
      { status: 500 }
    )
  }
}
