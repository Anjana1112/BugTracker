"use client"

import type { ReactNode } from "react"
import Link from "next/link"
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
import { ConfirmDeleteDialog } from "@/components/features/general/delete"
import ModalEditProject from "@/components/features/projects/modalEditProject"
import type { Project } from "@/lib/api"
import { SortableHeader } from "@/components/features/general/dataTable"

export type ProjectRow = {
  projectId: number
  name: string
  description?: string | null
}

const ProjectLink = ({ id, children }: { id: number; children: ReactNode }) => (
  <Link href={`/projects/${id}`} className="block w-full cursor-pointer py-2">
    {children}
  </Link>
)

const ActionsCell = ({
  project,
  onDeleteProject,
  onEditSuccess,
}: {
  project: Project
  onDeleteProject: (projectId: number) => Promise<void>
  onEditSuccess: () => void
}) => {
  const [editOpen, setEditOpen] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            Edit
          </DropdownMenuItem>
          <ConfirmDeleteDialog
            entityType="project"
            name={project.name}
            trigger={
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => e.preventDefault()}
              >
                Delete
              </DropdownMenuItem>
            }
            onConfirm={async () => await onDeleteProject(project.projectId)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <ModalEditProject
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={onEditSuccess}
        project={project}
      />
    </>
  )
}

export const getColumns = (
  onDeleteProject: (projectId: number) => Promise<void>,
  onEditSuccess: () => void,
  projects: Project[]
): ColumnDef<ProjectRow>[] => [
  {
    accessorKey: "projectId",
    header: ({ column }) => (
      <SortableHeader column={column} label="Project Id" />
    ),
    cell: ({ row }) => (
      <ProjectLink id={row.original.projectId}>
        {row.original.projectId}
      </ProjectLink>
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} label="Name" />,
    cell: ({ row }) => (
      <ProjectLink id={row.original.projectId}>{row.original.name}</ProjectLink>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <ProjectLink id={row.original.projectId}>
        {row.original.description ?? "—"}
      </ProjectLink>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const fullProject = projects.find(
        (p) => p.projectId === row.original.projectId
      )
      if (!fullProject) return null
      return (
        <ActionsCell
          project={fullProject}
          onDeleteProject={onDeleteProject}
          onEditSuccess={onEditSuccess}
        />
      )
    },
  },
]
