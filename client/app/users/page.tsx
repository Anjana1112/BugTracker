"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"

import { DataTable } from "@/components/features/general/dataTable"
import Header from "@/components/features/general/titleHeader"

import { getUsers, type User } from "@/lib/api"
import { getColumns } from "./columns"

export default function UsersPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true)
      setUsersError(null)
      const data = await getUsers()
      setUsers(data)
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "Failed to load users")
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    window.addEventListener("focus", fetchUsers)
    return () => window.removeEventListener("focus", fetchUsers)
  }, [fetchUsers])

  const columns = useMemo(
    () => getColumns(isAdmin, fetchUsers),
    [isAdmin, fetchUsers]
  )

  return (
    <div className="mx-auto min-h-62.5 w-[98%] gap-4 pt-15">
      <Header name="Users" />

      {usersLoading ? (
        <div className="p-6">Loading users...</div>
      ) : usersError ? (
        <div className="p-6 text-red-500">{usersError}</div>
      ) : (
        <>
          <div className="min-h-67.5 bg-background shadow-sm">
            <DataTable columns={columns} data={users} pageSize={15} />
          </div>
        </>
      )}
    </div>
  )
}
