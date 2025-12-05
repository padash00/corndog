import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

type RouteContext = { params: { id: string } }

// PATCH /api/stores/:id — изменить название и/или район
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = params
    const body = await req.json()

    const name = (body?.name ?? "").trim()
    const districtId = body?.districtId ?? null

    if (!name) {
      return NextResponse.json(
        { error: "Название магазина обязательно" },
        { status: 400 }
      )
    }

    const rows = await sql`
      UPDATE stores
      SET
        name = ${name},
        district_id = ${districtId}
      WHERE id = ${id}::uuid
      RETURNING id, name, district_id
    `

    if (rows.length === 0) {
      return NextResponse.json(
        { error: `Магазин не найден (id: ${id})` },
        { status: 404 }
      )
    }

    return NextResponse.json(rows[0])
  } catch (error) {
    console.error("Store PATCH error:", error)
    return NextResponse.json(
      { error: "Не удалось обновить магазин" },
      { status: 500 }
    )
  }
}
