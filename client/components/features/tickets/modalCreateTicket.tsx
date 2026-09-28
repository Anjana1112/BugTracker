"use client"

import Modal from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"
import React, { useEffect, useMemo, useState } from "react"
import { formatISO } from "date-fns"
import { Textarea } from "@/components/ui/textarea"
import {
  TicketStatus,
  TicketType,
  TicketPriority,
  createTicket,
  getProject,
  getProjectMembers,
  type Project,
  type User,
  Ticket,
} from "@/lib/api"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

type Props = {
  isOpen: boolean
  onClose: () => void
  projectId: number
  onSuccess?: (ticket: Ticket) => void
}

const ModalNewTicket = ({ isOpen, onClose, projectId, onSuccess }: Props) => {
  const projectIdNum = Number(projectId)

  const [members, setMembers] = useState<User[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<TicketStatus>(TicketStatus.OPEN)
  const [priority, setPriority] = useState<TicketPriority>(TicketPriority.LOW)
  const [type, setType] = useState<TicketType>(TicketType.BUG)

  const [startDate, setStartDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([])

  const inputStyle =
    "w-full rounded border border-gray-300 p-2 shadow-sm dark:border-dark-tertiary dark:bg-dark-tertiary dark:text-white dark:focus:outline-none"

  useEffect(() => {
    const fetchMembers = async () => {
      if (!isOpen || !projectId || Number.isNaN(projectIdNum)) {
        setMembers([])
        return
      }

      try {
        const data = await getProjectMembers(projectIdNum)
        setMembers(data)
      } catch (error) {
        console.error("Failed to fetch project members:", error)
        setMembers([])
      }
    }

    fetchMembers()
  }, [isOpen, projectId, projectIdNum])

  useEffect(() => {
    const fetchProject = async () => {
      if (!isOpen || !projectId || Number.isNaN(projectIdNum)) {
        setProject(null)
        return
      }

      try {
        const data = await getProject(projectIdNum)
        setProject(data)
      } catch (error) {
        console.error("Failed to fetch project:", error)
        setProject(null)
      }
    }

    fetchProject()
  }, [isOpen, projectId, projectIdNum])

  const isFormValid = () => {
    if (!title) return false

    const projectStart = project?.startDate ? new Date(project.startDate) : null
    const projectEnd = project?.endDate ? new Date(project.endDate) : null
    const ticketStart = startDate ? new Date(startDate) : null
    const ticketDue = dueDate ? new Date(dueDate) : null

    if (ticketStart && projectStart && ticketStart < projectStart) return false
    if (ticketDue && projectStart && ticketDue < projectStart) return false
    if (ticketDue && projectEnd && ticketDue > projectEnd) return false
    if (ticketStart && ticketDue && ticketDue < ticketStart) return false

    return true
  }

  const toggleAssignee = (id: number) => {
    setAssignedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectedAssigneeLabel = useMemo(() => {
    if (assignedUserIds.length === 0) return "Select assignees"
    return `Assignees (${assignedUserIds.length})`
  }, [assignedUserIds])

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setStatus(TicketStatus.OPEN)
    setPriority(TicketPriority.LOW)
    setType(TicketType.BUG)
    setStartDate("")
    setDueDate("")
    setAssignedUserIds([])
  }

  const handleSubmit = async () => {
    if (!title) return

    const formattedStartDate = startDate
      ? formatISO(new Date(startDate), { representation: "complete" })
      : undefined

    const formattedDueDate = dueDate
      ? formatISO(new Date(dueDate), { representation: "complete" })
      : undefined

    try {
      setIsLoading(true)

      const newTicket = await createTicket({
        title,
        description,
        status,
        priority,
        type,
        startDate: formattedStartDate,
        dueDate: formattedDueDate,
        projectId: projectIdNum,
        assignedUserIds,
      })
      onSuccess?.(newTicket)
      toast("Ticket created successfully.")
      resetForm()
      onClose()
    } catch (error) {
      console.error("Failed to create ticket:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} name="Create New Ticket">
      <form
        className="mt-4 space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
      >
        <Input
          type="text"
          className={inputStyle}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Textarea
          className={inputStyle}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-2">
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as TicketStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(TicketStatus).map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as TicketPriority)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(TicketPriority).map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={type}
            onValueChange={(value) => setType(value as TicketType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(TicketType).map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-2">
          <div className="relative">
            <Input
              type="date"
              className={`${inputStyle} pr-7`}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            {startDate && (
              <button
                type="button"
                onClick={() => setStartDate("")}
                aria-label="Clear start date"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="relative">
            <Input
              type="date"
              className={`${inputStyle} pr-7`}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {dueDate && (
              <button
                type="button"
                onClick={() => setDueDate("")}
                aria-label="Clear due date"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {(project?.startDate || project?.endDate) && (
          <p className="text-xs text-muted-foreground">
            Dates must fall within the project's timeline
            {project?.startDate &&
              ` (from ${new Date(project.startDate).toLocaleDateString()}`}
            {project?.endDate &&
              ` ${project?.startDate ? "to" : "until"} ${new Date(project.endDate).toLocaleDateString()}`}
            {project?.startDate && ")"}
          </p>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={inputStyle}>
              {selectedAssigneeLabel}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-160">
            {members.map((u: User) => (
              <DropdownMenuCheckboxItem
                key={u.userId}
                checked={assignedUserIds.includes(u.userId!)}
                onCheckedChange={() => toggleAssignee(u.userId!)}
              >
                {u.username}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="submit"
          disabled={!isFormValid() || isLoading}
          className={`mt-4 flex w-full justify-center rounded-md border border-transparent bg-black px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-gray-900 ${!isFormValid() || isLoading ? "cursor-not-allowed opacity-50" : ""}`}
        >
          {isLoading ? "Creating..." : "Create Ticket"}
        </Button>
      </form>
    </Modal>
  )
}

export default ModalNewTicket
