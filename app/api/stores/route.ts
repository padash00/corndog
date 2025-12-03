import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  const rows = await sql`
    SELECT id, name, district_id
    FROM stores
    ORDER BY name
  `

  const stores = (rows as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    districtId: row.district_id,
  }))

  return NextResponse.json(stores)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, districtId } = body

  if (!name || !districtId) {
    return NextResponse.json({ error: "Name and District ID are required" }, { status: 400 })
  }

  const [row] = await sql`
    INSERT INTO stores (name, district_id)
    VALUES (${name}, ${districtId})
    RETURNING id, name, district_id
  `

  return NextResponse.json({
    id: row.id,
    name: row.name,
    districtId: row.district_id
  }, { status: 201 })
}