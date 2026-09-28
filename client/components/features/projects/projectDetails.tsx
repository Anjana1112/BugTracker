import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Project = {
  name: string
  description?: string | null
  startDate?: string | Date | null
  endDate?: string | Date | null
}

function formatDateSafe(date: Project["startDate"]) {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString()
}

export function ProjectDetailsCard({ project }: { project: Project }) {
  return (
    <Card className="mt-4 w-full pt-5">
      <CardContent className="grid gap-4">
        <div>
          <div className="font-semibold text-muted-foreground">Description</div>
          <div className="text-sm">{project.description || "—"}</div>
        </div>

        <div>
          <div className="font-semibold text-muted-foreground">Start Date</div>
          <div className="text-sm">{formatDateSafe(project.startDate)}</div>
        </div>

        <div>
          <div className="font-semibold text-muted-foreground">End Date</div>
          <div className="text-sm">{formatDateSafe(project.endDate)}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ProjectDetailsCardSkeleton() {
  return (
    <Card className="mt-4 w-full">
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
      </CardContent>
    </Card>
  )
}
