"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import type { ChartDatum } from "@/lib/chartData"

const chartConfig: ChartConfig = { value: { label: "Tickets" } }

function isEmpty(data: ChartDatum[]) {
  return data.length === 0 || data.every((d) => d.value === 0)
}

export function ChartCard({
  title,
  data,
  emptyLabel = "No tickets yet",
  children,
}: {
  title: string
  data: ChartDatum[]
  emptyLabel?: string
  children: React.ReactNode
}) {
  return (
    <Card className="gap-3 pt-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {isEmpty(data) ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

export function DonutChart({
  title,
  data,
}: {
  title: string
  data: ChartDatum[]
}) {
  return (
    <ChartCard title={title} data={data}>
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square h-40"
      >
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={35}
            outerRadius={60}
            strokeWidth={2}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: d.fill }}
            />
            {d.name} ({d.value})
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

export function HorizontalBarChart({
  title,
  data,
  emptyLabel,
}: {
  title: string
  data: ChartDatum[]
  emptyLabel?: string
}) {
  const height = Math.max(120, data.length * 28)
  return (
    <ChartCard title={title} data={data} emptyLabel={emptyLabel}>
      <ChartContainer
        config={chartConfig}
        style={{ height }}
        className="w-full"
      >
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="value" radius={4}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

export function VerticalBarChart({
  title,
  data,
}: {
  title: string
  data: ChartDatum[]
}) {
  return (
    <ChartCard title={title} data={data}>
      <ChartContainer config={chartConfig} className="h-40 w-full">
        <BarChart data={data} margin={{ top: 8 }}>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis hide />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="value" radius={4}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}
