"use client"
import { toast } from "sonner"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { getUsers, addProjectMembers } from "@/lib/api"
import Header from "@/components/features/general/titleHeader"
import {
  ProjectDetailsCard,
  ProjectDetailsCardSkeleton,
} from "@/components/features/projects/projectDetails"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/features/general/dataTable"
import {
  ApiError,
  deleteTicket,
  getProject,
  getProjectTickets,
  getProjectMembers,
  getProjectActivity,
  removeProjectMembers,
  User,
  type Activity,
  type Project,
  type Ticket,
} from "@/lib/api"
import { getTicketColumns } from "./ticketColumns"
import ModalNewTicket from "@/components/features/tickets/modalCreateTicket"
import { getProjectUserColumns } from "./projectUserColumns"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ModalEditProjectDetails from "@/components/features/projects/modalEditProjectDetails"
import { ProjectTicketCharts } from "@/components/features/charts/projectCharts"
import { ActivityFeed } from "@/components/features/general/activityFeed"
export default function ProjectPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const params = useParams<{ id?: string }>()
  const id = params?.id

  const projectId = useMemo(() => (id ? Number(id) : NaN), [id])
  const shouldSkip = !Number.isFinite(projectId)

  const [project, setProject] = useState<Project | null>(null)
  const [projectMembers, setProjectMembers] = useState<User[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])

  const [projectLoading, setProjectLoading] = useState(true)
  const [projectMembersLoading, setProjectMembersLoading] = useState(true)
  const [ticketsLoading, setTicketsLoading] = useState(true)

  const [projectError, setProjectError] = useState<string | null>(null)
  const [projectNotFound, setProjectNotFound] = useState(false)
  const [projectMembersError, setProjectMembersError] = useState<string | null>(
    null
  )
  const [ticketsError, setTicketsError] = useState<string | null>(null)
  const [isModalNewTicketOpen, setIsModalNewTicketOpen] = useState(false)

  const [isModalEditProjectDetailsOpen, setIsModalEditProjectDetailsOpen] =
    useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  const isCreator =
    project !== null &&
    project.createdByUserId !== null &&
    project.createdByUserId === session?.user?.userId
  const canManageMembers = isAdmin || isCreator

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

  const fetchActivity = useCallback(async () => {
    try {
      setActivityLoading(true)
      const data = await getProjectActivity(projectId)
      setActivity(data)
    } catch (err) {
      console.error("Failed to load project activity:", err)
    } finally {
      setActivityLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (shouldSkip) return
    fetchActivity()
  }, [shouldSkip, fetchActivity])

  const handleAddProjectMember = useCallback(
    async (userId: number) => {
      const projectId = project?.projectId
      if (!projectId) return
      try {
        await addProjectMembers(projectId, [userId])
        const user = allUsers.find((u) => u.userId === userId)
        if (user) setProjectMembers((prev) => [user, ...prev])
        toast("User has been added to project.")
        fetchActivity()
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Failed to add user to project"
        )
      }
    },
    [project?.projectId, allUsers, fetchActivity]
  )

  const handleRemoveProjectMember = useCallback(
    async (userId: number) => {
      const projectId = project?.projectId
      if (!projectId) return
      try {
        await removeProjectMembers(projectId, userId)
        setProjectMembers((prev) =>
          prev.filter((user) => user.userId !== userId)
        )
        toast("User has been removed from project.")
        fetchActivity()
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Failed to remove user from project"
        )
      }
    },
    [project?.projectId, fetchActivity]
  )

  const projectMemberColumns = useMemo(
    () =>
      getProjectUserColumns(
        handleRemoveProjectMember,
        project?.name,
        canManageMembers,
        projectMembers.length
      ),
    [
      handleRemoveProjectMember,
      project?.name,
      canManageMembers,
      projectMembers.length,
    ]
  )

  const handleDeleteProjectTicket = async (ticketId: number) => {
    await deleteTicket(ticketId)
    setTickets((prev) => prev.filter((ticket) => ticket.ticketId !== ticketId))
  }

  const fetchProject = useCallback(async () => {
    try {
      setProjectLoading(true)
      setProjectError(null)
      setProjectNotFound(false)
      const data = await getProject(projectId)
      setProject(data)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setProjectNotFound(true)
      } else {
        setProjectError(
          err instanceof Error ? err.message : "Failed to load project"
        )
      }
    } finally {
      setProjectLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (shouldSkip) return
    fetchProject()
  }, [shouldSkip, fetchProject])

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setProjectMembersLoading(true)
        setProjectMembersError(null)
        const data = await getProjectMembers(projectId)
        setProjectMembers(data.reverse())
      } catch (err) {
        setProjectMembersError(
          err instanceof Error ? err.message : "Failed to load users"
        )
      } finally {
        setProjectMembersLoading(false)
      }
    }
    fetchUsers()
  }, [projectId])

  const fetchTickets = useCallback(async () => {
    try {
      setTicketsLoading(true)
      setTicketsError(null)
      const data = await getProjectTickets(projectId)
      setTickets(data)
    } catch (err) {
      setTicketsError(
        err instanceof Error ? err.message : "Failed to load tickets"
      )
    } finally {
      setTicketsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (shouldSkip) return
    fetchTickets()
  }, [shouldSkip, fetchTickets])

  const ticketColumns = useMemo(
    () =>
      getTicketColumns(
        handleDeleteProjectTicket,
        fetchTickets,
        session?.user?.userId,
        isAdmin
      ),
    [fetchTickets, session?.user?.userId, isAdmin]
  )

  if (projectLoading) {
    return (
      <div className="px-4 pt-10 xl:px-6">
        <ProjectDetailsCardSkeleton />
      </div>
    )
  }

  if (projectNotFound) {
    return (
      <div className="px-4 pt-10 xl:px-6">
        <Alert>
          <AlertTitle>Project not found</AlertTitle>
          <AlertDescription>
            This project doesn&apos;t exist or you don&apos;t have access to it.{" "}
            <Link href="/">Back to projects</Link>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (projectError) {
    return (
      <div className="px-4 pt-10 xl:px-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{projectError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="px-4 pt-10 xl:px-6">
      <ModalNewTicket
        isOpen={isModalNewTicketOpen}
        onClose={() => setIsModalNewTicketOpen(false)}
        projectId={projectId}
        onSuccess={(newTicket) => setTickets((prev) => [newTicket, ...prev])}
      />
      {project && (
        <ModalEditProjectDetails //guard null on modal
          isOpen={isModalEditProjectDetailsOpen}
          onClose={() => setIsModalEditProjectDetailsOpen(false)}
          onSuccess={() => {
            fetchProject()
            fetchActivity()
          }}
          project={project}
        />
      )}
      {/* Project */}
      <div className="pt-6 pb-6 lg:pt-8 lg:pb-4">
        <div className="space-x-1">
          <Link href={"/"}>
            <ArrowLeftIcon />
          </Link>
          <Header name={project?.name ?? "Project"} />
        </div>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {/* LEFT → Project Card */}
          <div>
            <div className="flex items-center justify-between">
              <Header name="Overview" isSmallText />
              <Button
                className="bg-muted-foreground hover:cursor-pointer"
                onClick={() => setIsModalEditProjectDetailsOpen(true)}
              >
                Edit Project Details
              </Button>
            </div>
            {project && <ProjectDetailsCard project={project} />}
          </div>

          {/* RIGHT → Users */}
          <div>
            <div className="flex items-center justify-between">
              <Header name="Users" isSmallText />
              {canManageMembers && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">+ Add User</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-60 w-64 overflow-y-auto">
                    {allUsers.map((user) => {
                      const alreadyMember = projectMembers.some(
                        (m) => m.userId === user.userId
                      )
                      return (
                        <DropdownMenuItem
                          key={user.userId}
                          disabled={alreadyMember}
                          className={
                            alreadyMember
                              ? "cursor-not-allowed opacity-40"
                              : "cursor-pointer"
                          }
                          onSelect={() => {
                            if (!alreadyMember)
                              handleAddProjectMember(user.userId)
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{user.username}</span>
                            <span className="text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {projectMembersLoading ? (
              <div className="p-6">Loading project members...</div>
            ) : projectMembersError ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{projectMembersError}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="min-h-67.5 bg-white shadow-sm dark:bg-neutral-900">
                  <DataTable
                    columns={projectMemberColumns}
                    data={projectMembers}
                    pageSize={3}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <ActivityFeed
          activities={activity}
          users={allUsers}
          loading={activityLoading}
        />
      </div>

      <ProjectTicketCharts tickets={tickets} />

      {/* Tickets */}
      <div className="w-full pb-8">
        <div className="mb-4 flex items-center justify-between">
          <Header name="Tickets" isSmallText />
          <Button onClick={() => setIsModalNewTicketOpen(true)}>
            + New Ticket
          </Button>
        </div>

        {ticketsLoading ? (
          <div className="p-6">Loading tickets...</div>
        ) : ticketsError ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{ticketsError}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="min-h-67.5 bg-white shadow-sm dark:bg-neutral-900">
              <DataTable
                columns={ticketColumns}
                data={tickets}
                pageSize={5}
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
    </div>
  )
}
