"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"

import { DataTable } from "@/components/features/general/dataTable"
import Header from "@/components/features/general/titleHeader"

import { getTickets, getUsers, type Ticket, type User } from "@/lib/api"
import { getColumns } from "./columns"

export default function TicketsPage() {
  const { data: session } = useSession()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [ticketsError, setTicketsError] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])

  const fetchTickets = useCallback(async () => {
    try {
      setTicketsLoading(true)
      setTicketsError(null)
      const data = await getTickets()
      setTickets(data)
    } catch (err) {
      setTicketsError(
        err instanceof Error ? err.message : "Failed to load tickets"
      )
    } finally {
      setTicketsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
    window.addEventListener("focus", fetchTickets)
    return () => window.removeEventListener("focus", fetchTickets)
  }, [fetchTickets])

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getUsers()
        setAllUsers(data)
      } catch (err) {
        console.error("Failed to load users", err)
      }
    }
    fetchUsers()
  }, [])

  const isAdmin = session?.user?.role === "ADMIN"
  const columns = useMemo(
    () => getColumns(fetchTickets, session?.user?.userId, isAdmin),
    [fetchTickets, session?.user?.userId, isAdmin]
  )
  return (
    <div className="mx-auto min-h-62.5 w-[98%] gap-4 pt-15">
      <Header name="Tickets" />

      {ticketsLoading ? (
        <div className="p-6">Loading tickets...</div>
      ) : ticketsError ? (
        <div className="p-6 text-red-500">{ticketsError}</div>
      ) : (
        <>
          <div className="min-h-67.5 bg-background shadow-sm">
            <DataTable
              columns={columns}
              data={tickets}
              pageSize={15}
              personFilter={{
                users: allUsers,
                currentUserId: session?.user?.userId,
                matchesUser: (ticket, userId) =>
                  ticket.authorUserId === userId ||
                  (ticket.ticketAssignments ?? []).some(
                    (a) => a.userId === userId
                  ),
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
