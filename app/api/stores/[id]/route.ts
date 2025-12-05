import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

type RouteContext = { params: { id?: string } }

// Универсально достаём id (из params или прямо из URL)
function getIdFromRequest(req: NextRequest, params: { id?: string }) {
  if (params?.id) return params.id

  const url = new URL(req.url)
  const parts = url.pathname.split("/").filter(Boolean)
  // .../api/stores/:id -> последний сегмент
  return parts[parts.length - 1]
}

// PATCH /api/stores/:id — редактирование магазина (название / район)
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const rawId = getIdFromRequest(req, context.params || {})
    const id = (rawId ?? "").trim()

    if (!id) {
      return NextResponse.json(
        { error: "ID магазина не передан в запросе" },
        { status: 400 }
      )
    }

    const body = await req.json()
    const name =
      typeof body?.name === "string" ? (body.name as string).trim() : undefined
    const districtId =
      body?.districtId === null || typeof body?.districtId === "string"
        ? (body.districtId as string | null)
        : undefined

    // Ничего не передали — нечего обновлять
    if (name === undefined && districtId === undefined) {
      return NextResponse.json(
        { error: "Нет данных для обновления (name или districtId)" },
        { status: 400 }
      )
    }

    const rows = await sql`
      UPDATE stores
      SET
        name = COALESCE(${name}, name),
        district_id = ${
          districtId !== undefined ? districtId : sql`district_id`
        }
      WHERE id = ${id}::uuid
      RETURNING
        id,
        name,
        district_id AS "districtId"
    `

    if (rows.length === 0) {
      return NextResponse.json(
        { error: `Магазин не найден в базе (id: ${id})` },
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

// (опционально) DELETE /api/stores/:id — если захочешь удалять магазины
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const rawId = getIdFromRequest(req, context.params || {})
    const id = (rawId ?? "").trim()

    if (!id) {
      return NextResponse.json(
        { error: "ID магазина не передан в запросе" },
        { status: 400 }
      )
    }

    const rows = await sql`
      DELETE FROM stores
      WHERE id = ${id}::uuid
      RETURNING id
    `

    if (rows.length === 0) {
      return NextResponse.json(
        { error: `Магазин не найден в базе (id: ${id})` },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Store DELETE error:", error)
    return NextResponse.json(
      { error: "Не удалось удалить магазин" },
      { status: 500 }
    )
  }
}
