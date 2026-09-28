import type { Ticket } from "@/lib/api"

export type TicketPermission = "full" | "status" | "read"

// Mirrors the server-side rule in ticketController.ts (editTicket/deleteTicket/
// updateTicketStatus): author and admins get full edit/delete, assignees who
// are neither get status-only, everyone else with project access is read-only.
export function getTicketPermission(
  ticket: Pick<Ticket, "authorUserId" | "ticketAssignments">,
  userId: number | undefined,
  isAdmin: boolean
): TicketPermission {
  if (isAdmin) return "full"
  if (userId == null) return "read"
  if (ticket.authorUserId === userId) return "full"

  const isAssignee = (ticket.ticketAssignments ?? []).some(
    (a) => a.userId === userId
  )
  if (isAssignee) return "status"

  return "read"
}
