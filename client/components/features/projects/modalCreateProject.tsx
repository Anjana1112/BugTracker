"use client"

import Modal from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { createProject, getUsers, User } from "@/lib/api"
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
}

const ModalCreateProject = ({ isOpen, onClose, onSuccess }: Props) => {
  const [isLoading, setIsLoading] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])

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
        console.error("Failed to fetch project members:", error)
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

      await createProject({
        name: projectName,
        description,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        teamMembers: selectedUserIds,
      })
      setProjectName("")
      setDescription("")
      setStartDate("")
      setEndDate("")
      setSelectedUserIds([])
      onSuccess()
      toast("Project created.")
      onClose()
    } catch (error) {
      console.error("Failed to create project:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid = () => {
    return Boolean(
      projectName &&
      startDate &&
      endDate &&
      new Date(endDate) >= new Date(startDate) &&
      selectedUserIds.length > 0
    )
  }

  const inputStyle =
    "w-full rounded border border-gray-300 p-2 shadow-sm bg-background"

  return (
    <Modal isOpen={isOpen} onClose={onClose} name="Create New Project">
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
                checked={selectedUserIds.includes(u.userId!)}
                onCheckedChange={() => toggleUser(u.userId!)}
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
          {isLoading ? "Creating..." : "Create Project"}
        </Button>
      </form>
    </Modal>
  )
}

export default ModalCreateProject
