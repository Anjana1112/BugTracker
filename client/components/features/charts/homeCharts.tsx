"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  groupByPriority,
  groupByProject,
  groupByStatus,
  isMine,
} from "@/lib/chartData"
import { TicketStatus, type Project, type Ticket } from "@/lib/api"
import { DonutChart, HorizontalBarChart } from "./chartPrimitives"

export function MyTicketCharts({
  tickets,
  projects,
  currentUserId,
}: {
  tickets: Ticket[]
  projects: Project[]
  currentUserId?: number
}) {
  if (tickets.length === 0) {
    return (
      <Card className="mb-8">
        <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No tickets yet — charts will appear once you have some.
        </CardContent>
      </Card>
    )
  }

  const myTickets =
    currentUserId != null ? tickets.filter((t) => isMine(t, currentUserId)) : []
  const myOpenTickets = myTickets.filter(
    (t) => t.status !== TicketStatus.CLOSED
  )

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <DonutChart
        title="My open tickets by priority"
        data={groupByPriority(myOpenTickets)}
      />
      <DonutChart
        title="My tickets by status"
        data={groupByStatus(myTickets)}
      />
      <HorizontalBarChart
        title="Tickets per project"
        data={groupByProject(tickets, projects)}
      />
    </div>
  )
}
