"use client"

import Modal from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { updateProject, getUsers, User, Project } from "@/lib/api"
import { useEffect, useMemo, useState } from "react"
import { formatISO } from "date-fns"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  project: Project
}

const ModalEditProject = ({ isOpen, onClose, onSuccess, project }: Props) => {
  const [isLoading, setIsLoading] = useState(false)
  const [projectName, setProjectName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? "")
  const [startDate, setStartDate] = useState(
    project.startDate?.slice(0, 10) ?? ""
  )
  const [endDate, setEndDate] = useState(project.endDate?.slice(0, 10) ?? "")
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(
    project.teamMembers?.map((m) => m.userId) ?? []
  )

  useEffect(() => {
    setProjectName(project.name)
    setDescription(project.description ?? "")
    setStartDate(project.startDate?.slice(0, 10) ?? "")
    setEndDate(project.endDate?.slice(0, 10) ?? "")
    setSelectedUserIds(project.teamMembers?.map((m) => m.userId) ?? [])
  }, [project])

  useEffect(() => {
    const fetchUsers = async () => {
      if (!isOpen) {
        setUsers([])
        return
      }
      try {
        const data = await getUsers()
        setUsers(data)
      } catch (error) {
        console.error("Failed to fetch users:", error)
        setUsers([])
      }
    }
    fetchUsers()
  }, [isOpen])

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((userId) => userId !== id) : [...prev, id]
    )
  }

  const selectedUsersLabel = useMemo(() => {
    if (selectedUserIds.length === 0) return "Select team members"
    return `Team Members (${selectedUserIds.length})`
  }, [selectedUserIds])

  const handleSubmit = async () => {
    if (!projectName || !startDate || !endDate) return

    const formattedStartDate = formatISO(new Date(startDate), {
      representation: "complete",
    })
    const formattedEndDate = formatISO(new Date(endDate), {
      representation: "complete",
    })

    try {
      setIsLoading(true)
      await updateProject(project.projectId, {
        name: projectName,
        description,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        teamMembers: selectedUserIds,
      })
      onSuccess()
      toast("Project updated successfully.")
      onClose()
    } catch (error) {
      console.error("Failed to update project:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid = () =>
    Boolean(
      projectName &&
      startDate &&
      endDate &&
      new Date(endDate) >= new Date(startDate) &&
      selectedUserIds.length > 0
    )

  const inputStyle =
    "w-full rounded border border-gray-300 p-2 shadow-sm bg-background"

  return (
    <Modal isOpen={isOpen} onClose={onClose} name="Edit Project">
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
          placeholder="Project Name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
        />

        <Textarea
          className={inputStyle}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-2">
          <Input
            type="date"
            className={inputStyle}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            type="date"
            className={inputStyle}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={inputStyle}>
              {selectedUsersLabel}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-160">
            {users.map((u: User) => (
              <DropdownMenuCheckboxItem
                key={u.userId}
                checked={selectedUserIds.includes(u.userId)}
                onCheckedChange={() => toggleUser(u.userId)}
              >
                {u.username}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="submit"
          disabled={!isFormValid() || isLoading}
          className={`mt-4 flex w-full ${!isFormValid() || isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          variant="default"
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Modal>
  )
}

export default ModalEditProject
