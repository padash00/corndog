import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

type Params = { params: { id: string } }

// PATCH /api/stores/:id
// body может содержать name и/или districtId
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const id = params.id
    const body = await req.json()

    const name: string | null =
      typeof body?.name === "string" ? body.name.trim() : null
    const districtId: string | null =
      body?.districtId === null || body?.districtId === "none"
        ? null
        : body?.districtId ?? null

    if (!name && districtId === null && !("districtId" in body)) {
      return NextResponse.json(
        { error: "Нет полей для обновления" },
        { status: 400 }
      )
    }

    const rows = await sql`
      UPDATE stores
      SET
        name = COALESCE(${name}, name),
        district_id = ${
          // если ключ есть в body — ставим districtId (может быть null),
          // если нет — оставляем как есть
          "districtId" in body ? districtId : sql`district_id`
        }
      WHERE id = ${id}
      RETURNING id, name, district_id AS "districtId"
    `

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Магазин не найден" },
        { status: 404 }
      )
    }

    return NextResponse.json(rows[0])
  } catch (error) {
    console.error("PATCH /stores/:id error:", error)
    return NextResponse.json(
      { error: "Не удалось обновить магазин" },
      { status: 500 }
    )
  }
}
