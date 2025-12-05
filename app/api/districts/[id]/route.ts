import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

type RouteContext = { params: { id: string } }

// PUT /api/districts/:id — переименование района
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const id = params.id
    const body = await req.json()
    const name = (body?.name ?? "").trim()

    if (!name) {
      return NextResponse.json(
        { error: "Название района обязательно" },
        { status: 400 }
      )
    }

    const rows = await sql`
      UPDATE districts
      SET name = ${name}
      WHERE id = ${id}
      RETURNING id, name
    `

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Район не найден" },
        { status: 404 }
      )
    }

    return NextResponse.json(rows[0])
  } catch (error) {
    console.error("PUT /api/districts/[id] error:", error)
    return NextResponse.json(
      { error: "Не удалось обновить район" },
      { status: 500 }
    )
  }
}

// DELETE /api/districts/:id — удалить район
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const id = params.id

    await sql`
      DELETE FROM districts
      WHERE id = ${id}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/districts/[id] error:", error)
    return NextResponse.json(
      { error: "Не удалось удалить район" },
      { status: 500 }
    )
  }
}
