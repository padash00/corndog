import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// GET: Получить все районы
export async function GET() {
  try {
    const rows = await sql`
      SELECT * FROM districts 
      ORDER BY name ASC
    `
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Database Error:", error)
    return NextResponse.json({ error: "Ошибка получения данных" }, { status: 500 })
  }
}

// POST: Создать новый район
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = (body?.name ?? "").trim()

    // Валидация: Для района нужно только имя
    if (!name) {
      return NextResponse.json({ error: "Название района обязательно" }, { status: 400 })
    }

    // Вставка в базу данных
    const result = await sql`
      INSERT INTO districts (name) 
      VALUES (${name}) 
      RETURNING id, name
    `
    
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error("API Error:", error)
    return NextResponse.json({ error: "Не удалось создать район" }, { status: 500 })
  }
}
