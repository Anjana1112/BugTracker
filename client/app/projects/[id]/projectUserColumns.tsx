"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmRemoveProjectUser } from "@/components/features/users/removeProjectUser"
import { SortableHeader } from "@/components/features/general/dataTable"

export type ProjectUserRow = {
  userId: number
  username: string
  email: string
  role: string
}

export const getProjectUserColumns = (
  onRemoveUser: (userId: number) => Promise<void>,
  projectName?: string,
  canManageMembers?: boolean,
  memberCount?: number
): ColumnDef<ProjectUserRow>[] => {
  const isLastMember = (memberCount ?? 0) <= 1
  const baseColumns: ColumnDef<ProjectUserRow>[] = [
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

  if (!canManageMembers) {
    return baseColumns
  }

  return [
    ...baseColumns,
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const user = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <ConfirmRemoveProjectUser
                name={user.username}
                projectName={projectName}
                trigger={
                  <DropdownMenuItem
                    disabled={isLastMember}
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault()
                    }}
                  >
                    Remove from project
                  </DropdownMenuItem>
                }
                onConfirm={async () => {
                  await onRemoveUser(user.userId)
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
