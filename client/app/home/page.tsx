"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/features/general/dataTable"
import {
  deleteProject,
  getProjects,
  getTickets,
  type Project,
  type Ticket,
} from "@/lib/api"
import { getColumns } from "./columns"
import ModalNewProject from "@/components/features/projects/modalCreateProject"
import { MyTicketCharts } from "@/components/features/charts/homeCharts"
import { toast } from "sonner"

export default function HomePage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleDeleteProject = async (projectId: number) => {
    await deleteProject(projectId)
    setProjects((prev) =>
      prev.filter((project) => project.projectId !== projectId)
    )
    toast("Project deleted.")
  }

  const handleRefreshProjects = () => fetchProjects()

  const columns = useMemo(
    () => getColumns(handleDeleteProject, handleRefreshProjects, projects),
    [projects]
  )

  const fetchProjects = async () => {
    try {
      const data = await getProjects()
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const data = await getTickets()
        setTickets(data)
      } catch (err) {
        console.error("Failed to load tickets", err)
      }
    }
    fetchTickets()
  }, [])

  if (isLoading) {
    return <div className="p-6">Loading projects...</div>
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Failed to load projects
        <pre className="mt-3 text-xs whitespace-pre-wrap text-red-400">
          {error}
        </pre>
      </div>
    )
  }
  return (
    <div className="mt-20 flex justify-center">
      <ModalNewProject
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchProjects}
      />
      <div className="w-[95%]">
        <div className="mb-6 rounded-xl border bg-background p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">PROJECTS</h1>
            <Button onClick={() => setIsModalOpen(true)}>+ New Project</Button>
          </div>

          <div className="min-h-62.5">
            <DataTable columns={columns} data={projects} pageSize={5} />
          </div>
        </div>

        <MyTicketCharts
          tickets={tickets}
          projects={projects}
          currentUserId={session?.user?.userId}
        />
      </div>
    </div>
  )
}
