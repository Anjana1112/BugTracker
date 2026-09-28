import { TicketStatus, TicketPriority, type Ticket, type Project } from "./api"

export interface ChartDatum {
  name: string
  value: number
  fill: string
}

export const NEUTRAL_CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: "Open",
  [TicketStatus.IN_PROGRESS]: "In Progress",
  [TicketStatus.CLOSED]: "Closed",
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: "var(--chart-red)",
  [TicketStatus.IN_PROGRESS]: "var(--chart-amber)",
  [TicketStatus.CLOSED]: "var(--chart-green)",
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: "Low",
  [TicketPriority.MEDIUM]: "Medium",
  [TicketPriority.HIGH]: "High",
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: "var(--chart-green)",
  [TicketPriority.MEDIUM]: "var(--chart-amber)",
  [TicketPriority.HIGH]: "var(--chart-red)",
}

export function isMine(ticket: Ticket, userId: number): boolean {
  return (
    ticket.authorUserId === userId ||
    (ticket.ticketAssignments ?? []).some((a) => a.userId === userId)
  )
}

export function groupByStatus(tickets: Ticket[]): ChartDatum[] {
  return Object.values(TicketStatus).map((status) => ({
    name: STATUS_LABELS[status],
    value: tickets.filter((t) => t.status === status).length,
    fill: STATUS_COLORS[status],
  }))
}

export function groupByPriority(tickets: Ticket[]): ChartDatum[] {
  return Object.values(TicketPriority).map((priority) => ({
    name: PRIORITY_LABELS[priority],
    value: tickets.filter((t) => t.priority === priority).length,
    fill: PRIORITY_COLORS[priority],
  }))
}

// Each assignment on a ticket counts as one unit of workload for that
// person; tickets with no assignees count toward "Unassigned".
export function groupByAssignee(tickets: Ticket[]): ChartDatum[] {
  const counts = new Map<string, number>()

  for (const ticket of tickets) {
    const assignments = ticket.ticketAssignments ?? []
    if (assignments.length === 0) {
      counts.set("Unassigned", (counts.get("Unassigned") ?? 0) + 1)
      continue
    }
    for (const assignment of assignments) {
      const name = assignment.user?.username ?? "Unknown"
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name,
      value,
      fill: NEUTRAL_CHART_COLORS[i % NEUTRAL_CHART_COLORS.length],
    }))
}

// Urgency buckets over non-closed tickets only — due-date urgency isn't
// meaningful for work that's already done.
export function groupByDueBucket(tickets: Ticket[]): ChartDatum[] {
  const open = tickets.filter((t) => t.status !== TicketStatus.CLOSED)

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const weekFromNow = new Date(startOfToday)
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  let overdue = 0
  let thisWeek = 0
  let later = 0
  let noDueDate = 0

  for (const ticket of open) {
    const due = ticket.dueDate ? new Date(ticket.dueDate) : null
    if (!due || Number.isNaN(due.getTime())) {
      noDueDate++
    } else if (due < startOfToday) {
      overdue++
    } else if (due < weekFromNow) {
      thisWeek++
    } else {
      later++
    }
  }

  return [
    { name: "Overdue", value: overdue, fill: "var(--chart-red)" },
    { name: "This week", value: thisWeek, fill: "var(--chart-amber)" },
    { name: "Later", value: later, fill: "var(--chart-green)" },
    { name: "No due date", value: noDueDate, fill: "var(--chart-1)" },
  ]
}

export function groupByProject(
  tickets: Ticket[],
  projects: Project[]
): ChartDatum[] {
  const counts = new Map<number, number>()
  for (const ticket of tickets) {
    counts.set(ticket.projectId, (counts.get(ticket.projectId) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([projectId, value], i) => ({
      name:
        projects.find((p) => p.projectId === projectId)?.name ??
        `Project #${projectId}`,
      value,
      fill: NEUTRAL_CHART_COLORS[i % NEUTRAL_CHART_COLORS.length],
    }))
}
