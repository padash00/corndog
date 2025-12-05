import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

type RouteContext = { params: { id: string } }

// PUT /api/districts/:id — переименовать район
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = params
    const body = await req.json()
    const name = (body?.name ?? "").trim()

    if (!name) {
      return NextResponse.json(
        { error: "Название района обязательно" },
        { status: 400 }
      )
    }

    // КАСТ по text, чтобы не было проблем с uuid
    const rows = await sql`
      UPDATE districts
      SET name = ${name}
      WHERE id::text = ${id}
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
    console.error("District PUT error:", error)
    return NextResponse.json(
      { error: "Не удалось обновить район" },
      { status: 500 }
    )
  }
}

// DELETE /api/districts/:id — удалить район
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = params

    const rows = await sql`
      DELETE FROM districts
      WHERE id::text = ${id}
      RETURNING id
    `

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Район не найден" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("District DELETE error:", error)
    return NextResponse.json(
      { error: "Не удалось удалить район" },
      { status: 500 }
    )
  }
}
