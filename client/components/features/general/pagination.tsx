"use client"

import { Button } from "@/components/ui/button"

type PaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <Button
        variant="outline"
        onClick={() => onPageChange(page - 1)}
        disabled={!canPrev}
      >
        Prev
      </Button>

      <div className="min-w-27.5 text-center text-sm text-muted-foreground">
        Page <span className="font-medium text-foreground">{page}</span> /{" "}
        <span className="font-medium text-foreground">{totalPages}</span>
      </div>

      <Button
        variant="outline"
        onClick={() => onPageChange(page + 1)}
        disabled={!canNext}
      >
        Next
      </Button>
    </div>
  )
}
