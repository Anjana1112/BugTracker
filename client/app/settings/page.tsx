"use client"

import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ApiError, changePassword, deleteMyAccount, editUser } from "@/lib/api"

export default function SettingsPage() {
  const { data: session, update } = useSession()

  const [basicInfo, setBasicInfo] = useState({
    username: "",
    email: "",
  })
  const [isSavingInfo, setIsSavingInfo] = useState(false)

  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  })
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [deletePassword, setDeletePassword] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  useEffect(() => {
    setBasicInfo({
      username: session?.user?.name ?? "",
      email: session?.user?.email ?? "",
    })
  }, [session?.user?.name, session?.user?.email])

  const handleSaveInfo = async () => {
    if (!session?.user?.userId) return
    if (!basicInfo.username || !basicInfo.email) {
      toast.error("Username and email are required.")
      return
    }

    setIsSavingInfo(true)
    try {
      await editUser(session.user.userId, {
        username: basicInfo.username,
        email: basicInfo.email,
      })
      await update({ name: basicInfo.username, email: basicInfo.email })
      toast.success("Account details updated.")
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to update account details"
      )
    } finally {
      setIsSavingInfo(false)
    }
  }

  const handleChangePassword = async () => {
    if (!session?.user?.userId) return

    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error("Fill in all three password fields.")
      return
    }
    if (passwords.new !== passwords.confirm) {
      toast.error("New password and confirmation don't match.")
      return
    }
    if (passwords.new.length < 8) {
      toast.error("New password must be at least 8 characters.")
      return
    }

    setIsSavingPassword(true)
    try {
      await changePassword(session.user.userId, {
        currentPassword: passwords.current,
        newPassword: passwords.new,
      })
      setPasswords({ current: "", new: "", confirm: "" })
      toast.success("Password updated.")
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update password"
      )
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error("Enter your password to delete your account.")
      return
    }
    if (!confirm("Permanently delete your account? This cannot be undone."))
      return

    setIsDeletingAccount(true)
    try {
      await deleteMyAccount({ password: deletePassword })
      toast.success("Account deleted.")
      await signOut({ callbackUrl: "/signin" })
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete account"
      )
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <div className="w-full max-w-3xl px-6 pt-15 pb-8 md:px-8 lg:px-10">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account details and security settings.
        </p>
      </div>

      <div className="space-y-8">
        <section className="grid grid-cols-1 items-start gap-6 md:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-base font-semibold">Account details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update your username and email address.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                className="max-w-sm"
                value={basicInfo.username}
                onChange={(e) =>
                  setBasicInfo((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                className="max-w-sm"
                value={basicInfo.email}
                onChange={(e) =>
                  setBasicInfo((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>

            <Button onClick={handleSaveInfo} disabled={isSavingInfo}>
              {isSavingInfo ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </section>

        <Separator />

        <section className="grid grid-cols-1 items-start gap-6 md:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-base font-semibold">Change password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep your account secure by updating your password.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                className="max-w-sm"
                value={passwords.current}
                onChange={(e) =>
                  setPasswords((prev) => ({ ...prev, current: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                className="max-w-sm"
                value={passwords.new}
                onChange={(e) =>
                  setPasswords((prev) => ({ ...prev, new: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                className="max-w-sm"
                value={passwords.confirm}
                onChange={(e) =>
                  setPasswords((prev) => ({ ...prev, confirm: e.target.value }))
                }
              />
            </div>

            <Button onClick={handleChangePassword} disabled={isSavingPassword}>
              {isSavingPassword ? "Updating..." : "Update password"}
            </Button>
          </div>
        </section>

        <Separator />

        <section className="grid grid-cols-1 items-start gap-6 md:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-base font-semibold text-destructive">
              Danger zone
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanent and irreversible account actions.
            </p>
          </div>

          <div className="max-w-sm rounded-xl border border-destructive/30 p-5">
            <p className="text-sm font-medium">Delete account</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete your account. This cannot be undone.
            </p>

            <div className="mt-4 space-y-2">
              <Label htmlFor="delete-password">Confirm your password</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>

            <Button
              variant="destructive"
              className="mt-4"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? "Deleting..." : "Delete account"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
