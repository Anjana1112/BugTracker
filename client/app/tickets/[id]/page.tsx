"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Header from "@/components/features/general/titleHeader"
import { TicketDetailsCardSkeleton } from "@/components/features/tickets/ticketDetails"
import { TicketDetailsCard } from "@/components/features/tickets/ticketDetails"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ApiError,
  TicketStatus,
  deleteTicket,
  getTicket,
  getTicketActivity,
  getUsers,
  updateTicketStatus,
  type Activity,
  type Ticket,
  type User,
} from "@/lib/api"
import { getTicketPermission } from "@/lib/ticketPermissions"
import { ArrowLeftIcon, FolderOpen } from "lucide-react"
import Link from "next/link"
import ModalEditTicket from "@/components/features/tickets/modalEditTicket"
import { toast } from "sonner"
import { TicketChat } from "@/components/features/tickets/ticketComments"
import { ActivityFeed } from "@/components/features/general/activityFeed"

export default function TicketPage() {
  const { data: session } = useSession()
  const params = useParams<{ id?: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params?.id

  const ticketId = useMemo(() => (id ? Number(id) : NaN), [id])
  const shouldSkip = !Number.isFinite(ticketId)

  const from = searchParams.get("from")

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [ticketLoading, setTicketLoading] = useState(true)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [ticketNotFound, setTicketNotFound] = useState(false)
  const [isModalEditTicketOpen, setIsModalEditTicketOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [activity, setActivity] = useState<Activity[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<User[]>([])

  const isAdmin = session?.user?.role === "ADMIN"
  const permission = ticket
    ? getTicketPermission(ticket, session?.user?.userId, isAdmin)
    : "read"

  const fetchTicket = async () => {
    try {
      setTicketLoading(true)
      setTicketError(null)
      setTicketNotFound(false)
      const data = await getTicket(ticketId)
      setTicket(data)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setTicketNotFound(true)
      } else {
        setTicketError(
          err instanceof Error ? err.message : "Failed to load ticket"
        )
      }
    } finally {
      setTicketLoading(false)
    }
  }

  const fetchActivity = async () => {
    try {
      setActivityLoading(true)
      const data = await getTicketActivity(ticketId)
      setActivity(data)
    } catch (err) {
      console.error("Failed to load ticket activity:", err)
    } finally {
      setActivityLoading(false)
    }
  }

  useEffect(() => {
    if (shouldSkip) return
    fetchTicket()
    fetchActivity()
  }, [ticketId, shouldSkip])

  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const data = await getUsers()
        setAllUsers(data)
      } catch (err) {
        console.error("Failed to load users", err)
      }
    }
    fetchAllUsers()
  }, [])

  const handleTicketChanged = () => {
    fetchTicket()
    fetchActivity()
  }

  const handleStatusChange = async (status: TicketStatus) => {
    if (!ticket) return
    try {
      setIsUpdatingStatus(true)
      await updateTicketStatus(ticket.ticketId, status)
      toast("Ticket status updated.")
      handleTicketChanged()
    } catch (err) {
      console.error("Failed to update ticket status:", err)
      toast.error("Failed to update ticket status.")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleDeleteTicket = async () => {
    if (!ticket) return
    if (!confirm(`Delete ticket "${ticket.title}"?`)) return
    try {
      setIsDeleting(true)
      await deleteTicket(ticketId)
      router.push(`/projects/${ticket.projectId}`)
      toast("Ticket deleted successfully.")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load tickets"
      setTicketError(msg)
      toast.error(msg)
    } finally {
      setIsDeleting(false)
    }
  }
  if (ticketLoading) {
    return (
      <div className="px-4 pt-10 xl:px-6">
        <TicketDetailsCardSkeleton />
      </div>
    )
  }

  if (ticketNotFound) {
    return (
      <div className="px-4 pt-10 xl:px-6">
        <Alert>
          <AlertTitle>Ticket not found</AlertTitle>
          <AlertDescription>
            This ticket doesn&apos;t exist or you don&apos;t have access to it.{" "}
            <Link href="/tickets">Back to tickets</Link>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (ticketError) {
    return (
      <div className="px-4 pt-10 xl:px-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{ticketError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="px-4 pt-10 xl:px-6">
      {ticket && permission === "full" && (
        <ModalEditTicket
          isOpen={isModalEditTicketOpen}
          onClose={() => setIsModalEditTicketOpen(false)}
          onSuccess={handleTicketChanged}
          ticket={ticket}
        />
      )}

      <div className="pt-6 pb-6 lg:pt-8 lg:pb-4">
        {ticket && (
          <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" />
            <Link
              href={`/projects/${ticket.projectId}`}
              className="hover:text-foreground hover:underline"
            >
              {ticket.project?.name ?? `Project #${ticket.projectId}`}
            </Link>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <Link
            href={
              from === "project" && ticket
                ? `/projects/${ticket.projectId}`
                : "/tickets"
            }
          >
            <ArrowLeftIcon />
          </Link>
          <Header name={ticket?.title ?? "Ticket"} />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <Header name="Overview" isSmallText />
            {permission === "full" && (
              <Button
                className="bg-muted-foreground hover:cursor-pointer"
                onClick={() => setIsModalEditTicketOpen(true)}
              >
                Edit Ticket
              </Button>
            )}
            {permission === "status" && ticket && (
              <Select
                value={ticket.status}
                onValueChange={(v) => handleStatusChange(v as TicketStatus)}
                disabled={isUpdatingStatus}
              >
                <SelectTrigger className="w-40">
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
            )}
          </div>
          {ticket && <TicketDetailsCard ticket={ticket} />}
          <ActivityFeed
            activities={activity}
            users={allUsers}
            loading={activityLoading}
          />
          {ticket && <TicketChat ticketId={ticket.ticketId} />}
        </div>

        {/* Delete at bottom */}
        {permission === "full" && (
          <div className="mt-10 border-t pt-6">
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteTicket}
            >
              {isDeleting ? "Deleting..." : "Delete Ticket"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
