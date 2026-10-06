import { getSession } from "next-auth/react"

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export interface Project {
  projectId: number
  name: string
  description: string | null
  startDate: string | null
  endDate: string | null
  createdByUserId: number | null
  teamMembers: User[]
  createdAt?: string
  updatedAt?: string
}

export enum TicketStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  CLOSED = "CLOSED",
}

export enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum TicketType {
  BUG = "BUG",
  FEATURE = "FEATURE",
  TASK = "TASK",
}

export enum Role {
  ADMIN = "ADMIN",
  DEVELOPER = "DEVELOPER",
}

export interface User {
  userId: number
  username: string
  email: string
  profilePictureUrl?: string | null
  role: Role
}

export interface CommentAttachment {
  attachmentId: number
  url: string
  originalFilename: string
  mimeType: string
  size: number | null
  createdAt: string
}

export interface Comment {
  commentId: number
  text: string
  createdAt: string
  ticketId: number
  userId: number
  author: User
  attachments?: CommentAttachment[]
}

export enum ActivityAction {
  FIELD_CHANGED = "FIELD_CHANGED",
  ASSIGNEE_ADDED = "ASSIGNEE_ADDED",
  ASSIGNEE_REMOVED = "ASSIGNEE_REMOVED",
  MEMBER_ADDED = "MEMBER_ADDED",
  MEMBER_REMOVED = "MEMBER_REMOVED",
}

export interface Activity {
  activityId: number
  action: ActivityAction
  field: string | null
  oldValue: string | null
  newValue: string | null
  actorUserId: number
  ticketId: number | null
  projectId: number | null
  createdAt: string
  actor: User
}

export interface TicketAssignment {
  id: number
  userId: number
  ticketId: number
  assignedAt: string
  user: User
}

export interface Ticket {
  ticketId: number
  title: string
  description: string | null
  status: TicketStatus
  priority: TicketPriority
  type: TicketType
  startDate: string | null
  dueDate: string | null
  projectId: number
  authorUserId: number
  author?: User
  project?: { projectId: number; name: string }
  createdAt?: string
  updatedAt?: string
  ticketAssignments?: TicketAssignment[]
  comments?: Comment[]
  attachmentURLs?: string[]
}

export interface CreateProjectPayload {
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  teamMembers?: number[]
}

export interface UpdateProjectPayload {
  name?: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  teamMembers?: number[]
}

export interface CreateTicketPayload {
  title: string
  description?: string | null
  status: TicketStatus
  priority: TicketPriority
  type: TicketType
  startDate?: string | null
  dueDate?: string | null
  projectId: number
  assignedUserIds?: number[]
}

export interface UpdateTicketPayload {
  title?: string
  description?: string | null
  status?: TicketStatus
  priority?: TicketPriority
  type?: TicketType
  startDate?: string | null
  dueDate?: string | null
  assignedUserIds?: number[]
}
export interface CreateCommentPayload {
  text: string
  attachments?: { url: string; originalFilename: string }[]
}

export interface AttachmentUploadTarget {
  uploadUrl: string
  publicUrl: string
}
export interface SearchResults {
  tickets: Pick<
    Ticket,
    "ticketId" | "title" | "status" | "priority" | "projectId"
  >[]
  projects: Pick<Project, "projectId" | "name" | "description">[]
  users: Pick<User, "userId" | "username" | "email" | "role">[]
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const session = await getSession()

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session?.accessToken
        ? { Authorization: `Bearer ${session.accessToken}` }
        : {}),
      ...(options?.headers || {}),
    },
    ...options,
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const errorData = await res.json()
      message = errorData.message || message
    } catch {}
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json()
}

// Projects
export interface RegisterPayload {
  username: string
  email: string
  password: string
}

export const register = (data: RegisterPayload) =>
  request<{ token: string; user: User }>("/api/register", {
    method: "POST",
    body: JSON.stringify(data),
  })

export const getProjects = () => request<Project[]>("/projects")

export const getProject = (projectId: number) =>
  request<Project>(`/projects/${projectId}`)

export const createProject = (data: CreateProjectPayload) =>
  request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  })

export const updateProject = (projectId: number, data: UpdateProjectPayload) =>
  request<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })

export const deleteProject = (projectId: number) =>
  request<{ message: string }>(`/projects/${projectId}`, {
    method: "DELETE",
  })
export const getProjectMembers = (projectId: number) =>
  request<User[]>(`/projects/${projectId}/members`)

export const addProjectMembers = (projectId: number, teamMembers: number[]) =>
  request<Project>(`/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ teamMembers }),
  })

export const removeProjectMembers = (projectId: number, userId: number) =>
  request<Project>(`/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  })

// Tickets
export const getTickets = () => request<Ticket[]>("/tickets")

export const getTicket = (ticketId: number) =>
  request<Ticket>(`/tickets/${ticketId}`)

export const getProjectTickets = (projectId: number) =>
  request<Ticket[]>(`/projects/${projectId}/tickets`)

export const createTicket = (data: CreateTicketPayload) =>
  request<Ticket>("/tickets", {
    method: "POST",
    body: JSON.stringify(data),
  })

export const updateTicket = (ticketId: number, data: UpdateTicketPayload) =>
  request<Ticket>(`/tickets/${ticketId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })

export const updateTicketStatus = (ticketId: number, status: TicketStatus) =>
  request<{ ticketId: number; status: TicketStatus }>(
    `/tickets/${ticketId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  )

export const editTicketAssignedUsers = (
  ticketId: number,
  assignedUserIds: number[]
) =>
  request<Ticket>(`/tickets/${ticketId}/assignees`, {
    method: "PATCH",
    body: JSON.stringify({ assignedUserIds }),
  })

export const deleteTicket = (ticketId: number) =>
  request<{ message: string }>(`/tickets/${ticketId}`, {
    method: "DELETE",
  })

// Users
export const getUsers = () => request<User[]>("/users")

export const getUser = (userId: number) => request<User>(`/users/${userId}`)

export const editUser = (userId: number, data: Partial<User>) =>
  request<User>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })

export const changePassword = (
  userId: number,
  data: { currentPassword: string; newPassword: string }
) =>
  request<{ message: string }>(`/users/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })

export const removeUser = (userId: number) =>
  request<{ message: string }>(`/users/${userId}`, {
    method: "DELETE",
  })

export const deleteMyAccount = (data: { password?: string }) =>
  request<{ message: string }>(`/users/me`, {
    method: "DELETE",
    body: JSON.stringify(data),
  })
//comments
export const getTicketComments = (ticketId: number) =>
  request<Comment[]>(`/tickets/${ticketId}/comments`)

export const createTicketComment = (
  ticketId: number,
  data: CreateCommentPayload
) =>
  request<Comment>(`/tickets/${ticketId}/comments`, {
    method: "POST",
    body: JSON.stringify(data),
  })

export const editTicketComment = (commentId: number, text: string) =>
  request<Comment>(`/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  })

export const deleteTicketComment = (commentId: number) =>
  request<void>(`/comments/${commentId}`, { method: "DELETE" })

export const getAttachmentUploadUrl = (
  ticketId: number,
  data: { contentType: string; contentLength: number }
) =>
  request<AttachmentUploadTarget>(
    `/tickets/${ticketId}/comments/attachments/upload-url`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  )

export const globalSearch = (q: string) =>
  request<SearchResults>(`/search?q=${encodeURIComponent(q)}`)

// Activity
export const getTicketActivity = (ticketId: number) =>
  request<Activity[]>(`/tickets/${ticketId}/activity`)

export const getProjectActivity = (projectId: number) =>
  request<Activity[]>(`/projects/${projectId}/activity`)
