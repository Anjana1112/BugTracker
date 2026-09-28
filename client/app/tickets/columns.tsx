"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { TicketStatus, TicketPriority, type Ticket } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import { useState } from "react"
import ModalEditTicket from "@/components/features/tickets/modalEditTicket"
import { deleteTicket, updateTicketStatus } from "@/lib/api"
import { getTicketPermission } from "@/lib/ticketPermissions"
import { toast } from "sonner"
import {
  SortableHeader,
  enumSortingFn,
} from "@/components/features/general/dataTable"

const TicketLink = ({
  id,
  children,
}: {
  id: number
  children: React.ReactNode
}) => (
  <Link
    href={`/tickets/${id}?from=tickets`}
    className="block w-full cursor-pointer py-2"
  >
    {children}
  </Link>
)

const ActionsCell = ({
  ticket,
  onSuccess,
  currentUserId,
  isAdmin,
}: {
  ticket: Ticket
  onSuccess: () => void
  currentUserId?: number
  isAdmin: boolean
}) => {
  const [editOpen, setEditOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const permission = getTicketPermission(ticket, currentUserId, isAdmin)

  const handleDelete = async () => {
    if (!confirm(`Delete ticket "${ticket.title}"?`)) return
    try {
      setIsDeleting(true)
      await deleteTicket(ticket.ticketId)
      onSuccess()
    } catch (error) {
      console.error("Failed to delete ticket:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleStatusChange = async (status: TicketStatus) => {
    try {
      setIsUpdatingStatus(true)
      await updateTicketStatus(ticket.ticketId, status)
      toast("Ticket status updated.")
      onSuccess()
    } catch (error) {
      console.error("Failed to update ticket status:", error)
      toast.error("Failed to update ticket status.")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  if (permission === "read") {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={ticket.status}
        onValueChange={(v) => handleStatusChange(v as TicketStatus)}
        disabled={isUpdatingStatus}
      >
        <SelectTrigger className="h-8 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.values(TicketStatus).map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {permission === "full" && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="p0 h-8 w-8"
                disabled={isDeleting}
              >
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ModalEditTicket
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
            onSuccess={onSuccess}
            ticket={ticket}
          />
        </>
      )}
    </div>
  )
}

export const getColumns = (
  onSuccess: () => void,
  currentUserId: number | undefined,
  isAdmin: boolean
): ColumnDef<Ticket>[] => [
  {
    accessorKey: "projectId",
    header: ({ column }) => (
      <SortableHeader column={column} label="Project ID" />
    ),
    cell: ({ row }) => (
      <TicketLink id={row.original.projectId!}>
        {row.original.projectId}
      </TicketLink>
    ),
  },
  {
    accessorKey: "ticketId",
    header: ({ column }) => <SortableHeader column={column} label="ID" />,
    cell: ({ row }) => (
      <TicketLink id={row.original.ticketId}>
        {row.original.ticketId}
      </TicketLink>
    ),
  },
  {
    accessorKey: "title",
    header: ({ column }) => <SortableHeader column={column} label="Title" />,
    cell: ({ row }) => (
      <TicketLink id={row.original.ticketId}>{row.original.title}</TicketLink>
    ),
  },
  {
    accessorKey: "description",
    header: "Desc",
    cell: ({ row }) => (
      <TicketLink id={row.original.ticketId}>
        {row.original.description ?? "—"}
      </TicketLink>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    sortingFn: enumSortingFn(Object.values(TicketStatus)),
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const styles: Record<string, string> = {
        OPEN: "text-red-700",
        IN_PROGRESS: "text-yellow-700",
        CLOSED: "text-green-700",
      }
      return (
        <div
          className={`font-medium ${styles[status] ?? "bg-gray-100 text-gray-700"}`}
        >
          <TicketLink id={row.original.ticketId}>{status}</TicketLink>
        </div>
      )
    },
  },
  {
    accessorKey: "priority",
    header: ({ column }) => <SortableHeader column={column} label="Priority" />,
    sortingFn: enumSortingFn(Object.values(TicketPriority)),
    cell: ({ row }) => {
      const priority = row.getValue("priority") as string
      const styles: Record<string, string> = {
        HIGH: "bg-red-100 text-red-700 border-red-200",
        MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
        LOW: "bg-green-100 text-green-700 border-green-200",
      }
      return (
        <Badge
          variant="outline"
          className={`font-medium ${styles[priority] ?? "bg-gray-100 text-gray-700"}`}
        >
          <TicketLink id={row.original.ticketId}>{priority}</TicketLink>
        </Badge>
      )
    },
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => <SortableHeader column={column} label="Due" />,
    sortingFn: "datetime",
    cell: ({ row }) => {
      const d = row.original.dueDate
      if (!d) return "—"
      const date = new Date(d)
      return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString()
    },
  },
  {
    id: "author",
    accessorFn: (row) => row.author?.username ?? "",
    header: ({ column }) => <SortableHeader column={column} label="Author" />,
    cell: ({ row }) => row.original.author?.username ?? "—",
  },
  {
    id: "assignee",
    accessorFn: (row) => row.ticketAssignments?.[0]?.user?.username ?? "",
    header: ({ column }) => <SortableHeader column={column} label="Assignee" />,
    cell: ({ row }) => {
      const assignments = row.original.ticketAssignments ?? []
      if (!assignments.length) return "—"
      return assignments
        .map((a) => a.user?.username)
        .filter(Boolean)
        .join(", ")
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <ActionsCell
        ticket={row.original}
        onSuccess={onSuccess}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    ),
  },
]
