"use client"

import Modal from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import React, { useEffect, useState } from "react"
import { ApiError, Role, editUser, type User } from "@/lib/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

type Props = {
  isOpen: boolean
  onClose: () => void
  user: User
  onSuccess?: () => void
}

const ModalEditUser = ({ isOpen, onClose, user, onSuccess }: Props) => {
  const [username, setUsername] = useState(user.username)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState<Role>(user.role)
  const [isLoading, setIsLoading] = useState(false)

  const inputStyle =
    "w-full rounded border border-gray-300 p-2 shadow-sm bg-background"

  useEffect(() => {
    setUsername(user.username)
    setEmail(user.email)
    setRole(user.role)
  }, [user])

  const isFormValid = () => Boolean(username) && Boolean(email)

  const handleSubmit = async () => {
    if (!isFormValid()) return

    try {
      setIsLoading(true)
      await editUser(user.userId, { username, email, role })
      onClose()
      toast("User updated successfully.")
      onSuccess?.()
    } catch (error) {
      console.error("Failed to update user:", error)
      toast.error(
        error instanceof ApiError ? error.message : "Failed to update user."
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} name="Edit User">
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
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <Input
          type="email"
          className={inputStyle}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(Role).map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

export default ModalEditUser
