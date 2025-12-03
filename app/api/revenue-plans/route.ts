import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  const rows = await sql`
    SELECT id, district_id, period_start, period_end, plan_revenue
    FROM revenue_plans
    ORDER BY period_start DESC
  `

  const plans = (rows as any[]).map((row) => ({
    id: row.id as string,
    districtId: row.district_id as string,
    periodStart: (row.period_start as Date).toISOString().slice(0, 10),
    periodEnd: (row.period_end as Date).toISOString().slice(0, 10),
    planRevenue: Number(row.plan_revenue),
  }))

  return NextResponse.json(plans)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const districtId = (body?.districtId ?? "").trim()
  const periodStart = (body?.periodStart ?? "").trim()
  const periodEnd = (body?.periodEnd ?? "").trim()
  const planRevenue = Number(body?.planRevenue)

  if (!districtId || !periodStart || !periodEnd || Number.isNaN(planRevenue)) {
    return NextResponse.json(
      { error: "districtId, periodStart, periodEnd и planRevenue обязательны" },
      { status: 400 },
    )
  }

  const rows = await sql`
    INSERT INTO revenue_plans (district_id, period_start, period_end, plan_revenue)
    VALUES (${districtId}, ${periodStart}, ${periodEnd}, ${planRevenue})
    RETURNING id, district_id, period_start, period_end, plan_revenue
  `

  const row = (rows as any[])[0]

  const plan = {
    id: row.id as string,
    districtId: row.district_id as string,
    periodStart: (row.period_start as Date).toISOString().slice(0, 10),
    periodEnd: (row.period_end as Date).toISOString().slice(0, 10),
    planRevenue: Number(row.plan_revenue),
  }

  return NextResponse.json(plan, { status: 201 })
}
