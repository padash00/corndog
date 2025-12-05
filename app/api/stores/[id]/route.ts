import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

type RouteContext = { params: { id: string } }

// PATCH /api/stores/:id
// Можно менять name и / или districtId
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const id = params.id
    const body = await req.json().catch(() => ({} as any))

    const rawName =
      typeof body?.name === "string" ? body.name.trim() : undefined

    // districtId может не передаваться вообще, а может быть null/"none"
    const rawDistrictId =
      Object.prototype.hasOwnProperty.call(body, "districtId")
        ? body.districtId
        : undefined

    const districtId =
      rawDistrictId === undefined
        ? undefined
        : rawDistrictId === null || rawDistrictId === "none"
        ? null
        : String(rawDistrictId)

    if (rawName === undefined && districtId === undefined) {
      return NextResponse.json(
        { error: "Нет полей для обновления" },
        { status: 400 }
      )
    }

    // name: если не передан — оставляем как есть через COALESCE
    const nameForSql = rawName ?? null

    const rows = await sql`
      UPDATE stores
      SET
        name = COALESCE(${nameForSql}, name),
        district_id = ${
          districtId === undefined ? sql`district_id` : districtId
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
    console.error("PATCH /api/stores/[id] error:", error)
    return NextResponse.json(
      { error: "Не удалось обновить магазин" },
      { status: 500 }
    )
  }
}
