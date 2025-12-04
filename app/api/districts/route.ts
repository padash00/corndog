import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  const rows = await sql`SELECT * FROM districts ORDER BY name`
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const name = (body?.name ?? "").trim()
  // Если у вас есть привязка к городу, раскомментируйте строки ниже:
  // const cityId = body?.cityId 

  if (!name) { // Если нужен город, добавьте: || !cityId
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  // Вставка в таблицу DISTRICTS, а не stores
  const rows = await sql`
    INSERT INTO districts (name) 
    VALUES (${name})
    RETURNING id, name
  `
  // Если нужен city_id: INSERT INTO districts (name, city_id) VALUES (${name}, ${cityId})

  const row = (rows as any[])[0]
  return NextResponse.json(row, { status: 201 })
}
