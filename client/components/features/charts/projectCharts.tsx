"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  groupByAssignee,
  groupByDueBucket,
  groupByPriority,
  groupByStatus,
} from "@/lib/chartData"
import type { Ticket } from "@/lib/api"
import {
  DonutChart,
  HorizontalBarChart,
  VerticalBarChart,
} from "./chartPrimitives"

export function ProjectTicketCharts({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return (
      <Card className="mb-8">
        <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No tickets yet
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <DonutChart title="Tickets by status" data={groupByStatus(tickets)} />
      <DonutChart title="Tickets by priority" data={groupByPriority(tickets)} />
      <HorizontalBarChart
        title="Tickets by assignee"
        data={groupByAssignee(tickets)}
      />
      <VerticalBarChart title="Due date" data={groupByDueBucket(tickets)} />
    </div>
  )
}
