"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SortableHeader } from "@/components/features/general/dataTable"
import ModalEditUser from "@/components/features/users/modalEditUser"
import { removeUser, type User } from "@/lib/api"

export type UserRow = User

const ActionsCell = ({
  user,
  onSuccess,
}: {
  user: UserRow
  onSuccess: () => void
}) => {
  const [editOpen, setEditOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete user "${user.username}"?`)) return
    try {
      setIsDeleting(true)
      await removeUser(user.userId)
      onSuccess()
    } catch (error) {
      console.error("Failed to delete user:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0" disabled={isDeleting}>
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

      <ModalEditUser
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={onSuccess}
        user={user}
      />
    </>
  )
}

export const getColumns = (
  isAdmin: boolean,
  onSuccess: () => void
): ColumnDef<UserRow>[] => {
  const baseColumns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "userId",
      header: ({ column }) => (
        <SortableHeader column={column} label="User Id" />
      ),
      cell: ({ row }) => row.original.userId,
    },
    {
      accessorKey: "username",
      header: ({ column }) => <SortableHeader column={column} label="Name" />,
      cell: ({ row }) => row.original.username,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email,
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => row.original.role,
    },
  ]

  if (!isAdmin) {
    return baseColumns
  }

  return [
    ...baseColumns,
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <ActionsCell user={row.original} onSuccess={onSuccess} />
      ),
    },
  ]
}
