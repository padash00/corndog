import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  // Получаем магазины (можно добавить JOIN с районами, если нужно название района сразу)
  const rows = await sql`
    SELECT id, name, district_id
    FROM stores
    ORDER BY name
  `

  const stores = (rows as any[]).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    districtId: row.district_id as string,
  }))

  return NextResponse.json(stores)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const name = (body?.name ?? "").trim()
  const districtId = body?.districtId

  if (!name || !districtId) {
    return NextResponse.json({ error: "Name and District ID are required" }, { status: 400 })
  }

  const rows = await sql`
    INSERT INTO stores (name, district_id)
    VALUES (${name}, ${districtId})
    RETURNING id, name, district_id
  `

  const row = (rows as any[])[0]

  return NextResponse.json({
    id: row.id,
    name: row.name,
    districtId: row.district_id
  }, { status: 201 })
}