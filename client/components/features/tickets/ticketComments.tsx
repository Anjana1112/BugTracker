"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import {
  getTicketComments,
  createTicketComment,
  editTicketComment,
  deleteTicketComment,
  getAttachmentUploadUrl,
  type Comment,
} from "@/lib/api"
import { toast } from "sonner"
import {
  Paperclip,
  SendHorizontal,
  X,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { timeAgo } from "@/lib/utils"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
]

type PendingAttachment = {
  id: string
  file: File
  status: "pending" | "uploading" | "uploaded" | "error"
  url?: string
  error?: string
}

function Avatar({ name, isSelf }: { name: string; isSelf: boolean }) {
  return (
    <div
      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase ${isSelf ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}
    >
      {name[0]}
    </div>
  )
}

export function TicketChat({ ticketId }: { ticketId: number }) {
  const { data: session } = useSession()
  const currentUserId = session?.user?.userId
  const currentUsername = session?.user?.name ?? "You"
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([])
  const [fileError, setFileError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getTicketComments(ticketId)
        setComments(data.reverse())
      } catch {
        toast.error("Failed to load messages.")
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [ticketId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const files = Array.from(e.target.files ?? [])

    const oversized = files.find((f) => f.size > MAX_FILE_SIZE)
    if (oversized) {
      setFileError(`${oversized.name} exceeds the 5 MB limit`)
      e.target.value = ""
      return
    }

    const unsupported = files.find(
      (f) => !ALLOWED_ATTACHMENT_TYPES.includes(f.type)
    )
    if (unsupported) {
      setFileError(`${unsupported.name} is not a supported file type`)
      e.target.value = ""
      return
    }

    setPendingAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "pending" as const,
      })),
    ])
    e.target.value = ""
  }

  const removeAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const uploadAttachment = async (
    attachment: PendingAttachment
  ): Promise<string> => {
    const { uploadUrl, publicUrl } = await getAttachmentUploadUrl(ticketId, {
      contentType: attachment.file.type,
      contentLength: attachment.file.size,
    })

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: attachment.file,
      headers: { "Content-Type": attachment.file.type },
    })
    if (!putRes.ok) {
      throw new Error("Upload failed")
    }

    return publicUrl
  }

  const handleSubmit = async () => {
    if (!newText.trim() && pendingAttachments.length === 0) return
    setSubmitting(true)
    try {
      // Attachments already uploaded (e.g. surviving a previously failed
      // comment post) are reused as-is; only new/errored ones get (re)tried.
      const alreadyUploaded = pendingAttachments.filter(
        (a) => a.status === "uploaded"
      )
      const toUpload = pendingAttachments.filter((a) => a.status !== "uploaded")

      let uploadResults: { id: string; url?: string }[] = []

      if (toUpload.length > 0) {
        setPendingAttachments((prev) =>
          prev.map((a) =>
            toUpload.some((u) => u.id === a.id)
              ? { ...a, status: "uploading" }
              : a
          )
        )

        uploadResults = await Promise.all(
          toUpload.map(async (attachment) => {
            try {
              const url = await uploadAttachment(attachment)
              return { id: attachment.id, url }
            } catch {
              return { id: attachment.id, url: undefined }
            }
          })
        )

        setPendingAttachments((prev) =>
          prev.map((a) => {
            const result = uploadResults.find((r) => r.id === a.id)
            if (!result) return a
            return result.url
              ? { ...a, status: "uploaded", url: result.url }
              : { ...a, status: "error", error: "Upload failed" }
          })
        )

        if (uploadResults.some((r) => !r.url)) {
          toast.error("One or more attachments failed to upload.")
          return
        }
      }

      const attachments = [
        ...alreadyUploaded.map((a) => ({
          url: a.url!,
          originalFilename: a.file.name,
        })),
        ...toUpload.map((a) => {
          const result = uploadResults.find((r) => r.id === a.id)
          return { url: result!.url!, originalFilename: a.file.name }
        }),
      ]

      const comment = await createTicketComment(ticketId, {
        text: newText.trim() || "(attachment)",
        attachments: attachments.length > 0 ? attachments : undefined,
      })
      setComments((prev) => [...prev, comment])
      setNewText("")
      setPendingAttachments([])
      setFileError(null)
      toast.success("Message sent.")
    } catch {
      toast.error("Failed to send message.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (commentId: number) => {
    if (!editText.trim()) return
    try {
      const updated = await editTicketComment(commentId, editText.trim())
      setComments((prev) =>
        prev.map((c) => (c.commentId === commentId ? updated : c))
      )
      setEditingId(null)
      toast.success("Message updated.")
    } catch {
      toast.error("Failed to update message.")
    }
  }

  const handleDelete = async (commentId: number) => {
    if (!confirm("Delete this message?")) return
    try {
      await deleteTicketComment(commentId)
      setComments((prev) => prev.filter((c) => c.commentId !== commentId))
      toast.success("Message deleted.")
    } catch {
      toast.error("Failed to delete message.")
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-base font-semibold">Activity</h2>
        <span className="text-sm text-muted-foreground">
          {comments.length} messages
        </span>
      </div>

      <Card className="w-full overflow-hidden pt-0">
        {/* Scrollable message area */}
        <div className="flex h-80 flex-col gap-5 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No messages yet. Start the conversation!
            </p>
          ) : (
            comments.map((comment) => {
              const isSelf = comment.userId === currentUserId
              const isEditing = editingId === comment.commentId
              const displayName = isSelf
                ? currentUsername
                : (comment.author?.username ?? "Unknown")

              return (
                <div
                  key={comment.commentId}
                  className={`flex items-end gap-2.5 ${isSelf ? "flex-row-reverse" : ""}`}
                >
                  <Avatar name={displayName} isSelf={isSelf} />

                  <div
                    className={`flex max-w-[70%] flex-col gap-1 ${isSelf ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`flex items-center gap-1.5 px-1 ${isSelf ? "flex-row-reverse" : ""}`}
                    >
                      <span className="text-xs font-medium">{displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(comment.createdAt)}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="flex w-full flex-col gap-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="resize-none text-sm"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(comment.commentId)}
                          >
                            <Check className="mr-1 h-3 w-3" /> Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="mr-1 h-3 w-3" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`flex items-end gap-1 ${isSelf ? "flex-row-reverse" : ""}`}
                      >
                        <div
                          className={`min-w-[2rem] px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                            isSelf
                              ? "rounded-3xl rounded-br-sm bg-blue-500 text-white"
                              : "rounded-3xl rounded-bl-sm border border-border bg-muted text-foreground"
                          }`}
                        >
                          {comment.text}
                        </div>

                        {/* ... menu — own messages only */}
                        {isSelf && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="mb-1 flex-shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingId(comment.commentId)
                                  setEditText(comment.text)
                                }}
                              >
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(comment.commentId)}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )}

                    {/* Attachments */}
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {comment.attachments.map((attachment) => (
                          <a
                            key={attachment.attachmentId}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 hover:bg-muted/80"
                          >
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                            <span className="max-w-[140px] truncate text-xs text-muted-foreground">
                              {attachment.originalFilename}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <CardContent className="flex flex-col gap-2 border-t border-border px-3 py-2">
          {/* Pending attachments */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((a) => (
                <div
                  key={a.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                    a.status === "error"
                      ? "border-destructive/50 bg-destructive/10"
                      : "border-border bg-muted"
                  }`}
                >
                  <Paperclip className="ml-3 h-3 w-3 text-muted-foreground" />
                  <span className="max-w-35 truncate text-xs text-muted-foreground">
                    {a.file.name}
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    {(a.file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  {a.status === "uploading" && (
                    <span className="text-xs text-muted-foreground">
                      Uploading...
                    </span>
                  )}
                  {a.status === "error" && (
                    <span className="text-xs text-destructive">Failed</span>
                  )}
                  <button
                    onClick={() => removeAttachment(a.id)}
                    disabled={a.status === "uploading"}
                    className="ml-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="flex-shrink-0 cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Paperclip className="h-4 w-4" />
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            <input
              type="text"
              placeholder="Type your message here..."
              value={newText}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />

            <button
              disabled={
                submitting ||
                (!newText.trim() && pendingAttachments.length === 0)
              }
              onClick={handleSubmit}
              className="flex-shrink-0 rounded-full bg-blue-500 p-1.5 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>

          {fileError && <p className="text-xs text-destructive">{fileError}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
