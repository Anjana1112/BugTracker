"use client"

import { ActivityAction, type Activity, type User } from "@/lib/api"
import { timeAgo } from "@/lib/utils"
import { Card } from "@/components/ui/card"

const FIELD_LABELS: Record<string, string> = {
  title: "title",
  description: "description",
  status: "status",
  priority: "priority",
  type: "type",
  startDate: "start date",
  dueDate: "due date",
  name: "name",
  endDate: "end date",
}

function truncate(value: string | null, max = 60) {
  if (!value) return "—"
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function describeActivity(activity: Activity, users: User[]): string {
  const userFor = (idStr: string | null) => {
    if (!idStr) return "someone"
    const id = Number(idStr)
    return users.find((u) => u.userId === id)?.username ?? `user #${idStr}`
  }

  switch (activity.action) {
    case ActivityAction.FIELD_CHANGED: {
      const label =
        FIELD_LABELS[activity.field ?? ""] ?? activity.field ?? "a field"
      return `changed ${label} from "${truncate(activity.oldValue)}" to "${truncate(activity.newValue)}"`
    }
    case ActivityAction.ASSIGNEE_ADDED:
      return `assigned ${userFor(activity.newValue)}`
    case ActivityAction.ASSIGNEE_REMOVED:
      return `unassigned ${userFor(activity.oldValue)}`
    case ActivityAction.MEMBER_ADDED:
      return `added ${userFor(activity.newValue)} to the project`
    case ActivityAction.MEMBER_REMOVED:
      return `removed ${userFor(activity.oldValue)} from the project`
    default:
      return "made a change"
  }
}

export function ActivityFeed({
  activities,
  users,
  loading,
}: {
  activities: Activity[]
  users: User[]
  loading?: boolean
}) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-base font-semibold">Activity Log</h2>
        <span className="text-sm text-muted-foreground">
          {activities.length} changes
        </span>
      </div>

      <Card className="w-full overflow-hidden pt-0">
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading activity...</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes yet.</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.activityId} className="text-sm">
                <span className="font-medium">{activity.actor.username}</span>{" "}
                <span className="text-muted-foreground">
                  {describeActivity(activity, users)}
                </span>{" "}
                <span className="text-xs text-muted-foreground">
                  · {timeAgo(activity.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
