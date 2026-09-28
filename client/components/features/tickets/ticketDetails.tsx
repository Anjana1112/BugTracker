import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { Ticket } from "@/lib/api"

function formatDateSafe(date: string | null | undefined) {
  if (!date) return "—"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString()
}

const priorityStyles: Record<string, string> = {
  HIGH: "bg-red text-foreground border-red-200",
  MEDIUM: "bg-yellow text-foreground border-yellow-200",
  LOW: "bg-green text-foreground border-green-200",
}

const statusStyles: Record<string, string> = {
  OPEN: "text-red-700",
  IN_PROGRESS: "text-yellow-700",
  CLOSED: "text-green-700",
}

export function TicketDetailsCard({ ticket }: { ticket: Ticket }) {
  return (
    <Card className="mt-4 w-full pt-5">
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="font-semibold text-muted-foreground">Description</div>
          <div className="text-sm">{ticket.description || "—"}</div>
        </div>

        <div className="flex justify-between">
          <div>
            <div className="font-semibold text-muted-foreground">Author</div>
            <div className="text-sm">{ticket.author?.username ?? "—"}</div>
          </div>
          <div>
            <div className="font-semibold text-muted-foreground">Assignees</div>
            <div className="text-sm">
              {ticket.ticketAssignments?.length
                ? ticket.ticketAssignments
                    .map((a) => a.user?.username)
                    .filter(Boolean)
                    .join(", ")
                : "—"}
            </div>
          </div>
          <div>
            <div className="font-semibold text-muted-foreground">
              Start Date
            </div>
            <div className="text-sm">{formatDateSafe(ticket.startDate)}</div>
          </div>
          <div>
            <div className="font-semibold text-muted-foreground">Due Date</div>
            <div className="text-sm">{formatDateSafe(ticket.dueDate)}</div>
          </div>
        </div>
        <div className="flex justify-between">
          <div>
            <div className="font-semibold text-muted-foreground">Status</div>
            <div
              className={`text-sm font-medium ${statusStyles[ticket.status] ?? ""}`}
            >
              {ticket.status}
            </div>
          </div>
          <div>
            <div className="font-semibold text-muted-foreground">Priority</div>
            <Badge
              variant="outline"
              className={`text-sm font-medium ${priorityStyles[ticket.priority] ?? ""}`}
            >
              {ticket.priority}
            </Badge>
          </div>
          <div>
            <div className="font-semibold text-muted-foreground">Type</div>
            <div className="text-sm">{ticket.type}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
export function TicketDetailsCardSkeleton() {
  return (
    <Card className="mt-4 w-full">
      <CardContent className="grid gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
