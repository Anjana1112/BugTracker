"use client"
import {
  Column,
  ColumnDef,
  Row,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Pagination from "@/components/features/general/pagination"
import type { User } from "@/lib/api"

export function SortableHeader<TData>({
  column,
  label,
}: {
  column: Column<TData, unknown>
  label: string
}) {
  const sorted = column.getIsSorted()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUp className="ml-2 h-3.5 w-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="ml-2 h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-40" />
      )}
    </Button>
  )
}

export function enumSortingFn<TData>(order: string[]) {
  return (rowA: Row<TData>, rowB: Row<TData>, columnId: string) =>
    order.indexOf(rowA.getValue(columnId) as string) -
    order.indexOf(rowB.getValue(columnId) as string)
}

export interface PersonFilterConfig<TData> {
  users: User[]
  currentUserId?: number
  matchesUser: (row: TData, userId: number) => boolean
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchPlaceholder?: string
  pageSize?: number
  personFilter?: PersonFilterConfig<TData>
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  pageSize = 10,
  personFilter,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [selectedPersonId, setSelectedPersonId] = React.useState<number | null>(
    null
  )

  const filteredData = React.useMemo(() => {
    if (!personFilter || selectedPersonId == null) return data
    return data.filter((row) => personFilter.matchesUser(row, selectedPersonId))
  }, [data, personFilter, selectedPersonId])

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    initialState: { pagination: { pageSize } },
  })

  React.useEffect(() => {
    table.setPageIndex(0)
  }, [selectedPersonId, table])

  const selectedPerson =
    personFilter && selectedPersonId != null
      ? selectedPersonId === personFilter.currentUserId
        ? "you"
        : (personFilter.users.find((u) => u.userId === selectedPersonId)
            ?.username ?? null)
      : null

  const otherUsers = React.useMemo(() => {
    if (!personFilter) return []
    return personFilter.users
      .filter((u) => u.userId !== personFilter.currentUserId)
      .sort((a, b) => a.username.localeCompare(b.username))
  }, [personFilter])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 py-4">
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />

        {personFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {selectedPerson
                  ? selectedPerson === "you"
                    ? "My tickets"
                    : selectedPerson
                  : "Filter by person"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {personFilter.currentUserId != null && (
                <DropdownMenuItem
                  onSelect={() =>
                    setSelectedPersonId(personFilter.currentUserId!)
                  }
                >
                  My tickets
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {otherUsers.map((u) => (
                <DropdownMenuItem
                  key={u.userId}
                  onSelect={() => setSelectedPersonId(u.userId)}
                >
                  {u.username}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSelectedPersonId(null)}>
                Clear filter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {personFilter && selectedPerson && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing tickets where{" "}
            <span className="font-medium text-foreground">
              {selectedPerson === "you" ? "you are" : `"${selectedPerson}" is`}
            </span>{" "}
            the author or an assignee
          </span>
          <button
            type="button"
            onClick={() => setSelectedPersonId(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear person filter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="w-full overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={table.getState().pagination.pageIndex + 1}
        totalPages={Math.max(1, table.getPageCount())}
        onPageChange={(p) => table.setPageIndex(p - 1)}
      />
    </div>
  )
}
