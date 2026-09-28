"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alertDialog"

type DeleteEntityType = "project" | "ticket" | "user" | "item"

type ConfirmDeleteDialogProps = {
  entityType?: DeleteEntityType
  name: string
  trigger: React.ReactNode

  onConfirm: () => void | Promise<void>

  title?: string
  description?: string

  confirmDisabled?: boolean
}

export function ConfirmDeleteDialog({
  entityType = "item",
  name,
  trigger,
  onConfirm,
  title,
  description,
  confirmDisabled,
}: ConfirmDeleteDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const handleConfirm = async () => {
    try {
      setLoading(true)
      await onConfirm()
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const defaultTitle =
    title ??
    `Are you sure you'd like to delete ${entityType === "item" ? "" : `${entityType}`} ${name}?`
  const defaultDescription = description ?? `This action cannot be undone.`

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{defaultTitle}</AlertDialogTitle>
          <AlertDialogDescription>{defaultDescription}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e: { preventDefault: () => void }) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={loading || confirmDisabled}
            className="bg-red-600 text-foreground hover:bg-red-700"
          >
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
