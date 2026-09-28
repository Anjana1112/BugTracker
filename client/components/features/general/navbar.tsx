"use client"

import { useEffect, useReducer, useRef, useState, useCallback } from "react"
import {
  Menu,
  Moon,
  Sun,
  X,
  UserCog,
  LogOut,
  Settings,
  FileText,
  FolderOpen,
  User,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { Input } from "@/components/ui/input"
import { useTheme } from "next-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  globalSearch,
  SearchResults,
  TicketStatus,
  TicketPriority,
} from "@/lib/api"
import { useSyncExternalStore } from "react"

const emptySubscribe = () => () => {}
const useHydrated = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

interface NavbarProps {
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>
}

const STATUS_STYLES: Record<
  TicketStatus,
  { label: string; className: string }
> = {
  [TicketStatus.OPEN]: {
    label: "Open",
    className:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/20",
  },
  [TicketStatus.IN_PROGRESS]: {
    label: "In Progress",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20",
  },
  [TicketStatus.CLOSED]: {
    label: "Closed",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20",
  },
}

const PRIORITY_STYLES: Record<TicketPriority, { dot: string }> = {
  [TicketPriority.LOW]: { dot: "bg-slate-400" },
  [TicketPriority.MEDIUM]: { dot: "bg-amber-400" },
  [TicketPriority.HIGH]: { dot: "bg-red-500" },
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

type SearchState =
  | { status: "idle"; results: null }
  | { status: "loading"; results: null }
  | { status: "done"; results: SearchResults }
  | { status: "error"; results: null }

type SearchAction =
  | { type: "FETCH" }
  | { type: "SUCCESS"; payload: SearchResults }
  | { type: "ERROR" }
  | { type: "CLEAR" }

function searchReducer(_: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "FETCH":
      return { status: "loading", results: null }
    case "SUCCESS":
      return { status: "done", results: action.payload }
    case "ERROR":
      return { status: "error", results: null }
    case "CLEAR":
      return { status: "idle", results: null }
  }
}

const Navbar = ({ isSidebarCollapsed, setIsSidebarCollapsed }: NavbarProps) => {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useHydrated()

  const [query, setQuery] = useState("")
  const [searchState, dispatch] = useReducer(searchReducer, {
    status: "idle",
    results: null,
  })
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      dispatch({ type: "CLEAR" })
      return
    }
    dispatch({ type: "FETCH" })
    globalSearch(debouncedQuery)
      .then((data) => {
        dispatch({ type: "SUCCESS", payload: data })
        setOpen(true)
      })
      .catch(() => dispatch({ type: "ERROR" }))
  }, [debouncedQuery])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const results = searchState.status === "done" ? searchState.results : null
  const totalResults = results
    ? results.tickets.length + results.projects.length + results.users.length
    : 0

  const handleClear = () => {
    setQuery("")
    dispatch({ type: "CLEAR" })
    setOpen(false)
  }

  const handleSelect = useCallback(() => {
    setOpen(false)
    setQuery("")
    dispatch({ type: "CLEAR" })
  }, [])

  return (
    <div className="fixed top-0 left-0 z-50 flex h-14 w-full items-center justify-between border-b border-border/50 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          type="button"
        >
          {isSidebarCollapsed ? (
            <Menu className="h-[18px] w-[18px]" />
          ) : (
            <X className="h-[18px] w-[18px]" />
          )}
        </button>
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          BUG TRACKER
        </Link>
      </div>

      {/* Search */}
      <div ref={containerRef} className="relative max-w-180">
        <div className="relative flex items-center">
          <Input
            ref={inputRef}
            className="h-9 w-full rounded-lg border border-border/60 bg-muted/50 pr-16 pl-9 text-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
            type="search"
            placeholder="Search anything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results && totalResults > 0 && setOpen(true)}
          />
        </div>

        {/* Dropdown */}
        {open && (
          <div
            className="fixed top-16 left-1/2 z-[99] -translate-x-1/2 overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-2xl shadow-black/20 dark:shadow-black/40"
            style={{
              width: "min(360px, calc(100vw - 48px))",
            }}
          >
            {/* Loading skeleton */}
            {searchState.status === "loading" && (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-1.5">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-muted" />
                    <div
                      className="h-3 animate-pulse rounded bg-muted"
                      style={{ width: `${55 + i * 12}%` }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {searchState.status === "error" && (
              <div className="flex items-center gap-2.5 px-4 py-3.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Something went wrong. Try again.</span>
              </div>
            )}

            {/* Empty */}
            {searchState.status === "done" && totalResults === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No results for{" "}
                  <span className="font-medium text-foreground">
                    &ldquo;{query}&rdquo;
                  </span>
                </p>
              </div>
            )}

            {/* Results */}
            {searchState.status === "done" && totalResults > 0 && (
              <div className="max-h-[460px] divide-y divide-border/40 overflow-y-auto overscroll-contain">
                {/* Tickets */}
                {results!.tickets.length > 0 && (
                  <div className="py-1.5">
                    <div className="flex items-center gap-2 px-4 pt-1 pb-1">
                      <FileText className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                        Tickets
                      </span>
                    </div>
                    {results!.tickets.map((ticket) => (
                      <Link
                        key={ticket.ticketId}
                        href={`/tickets/${ticket.ticketId}`}
                        onClick={handleSelect}
                        className="group flex items-center justify-between gap-4 px-4 py-2.5 transition-colors hover:bg-accent/60"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground/50 transition-colors group-hover:text-muted-foreground">
                            #{ticket.ticketId}
                          </span>
                          <span className="truncate text-sm leading-snug text-foreground">
                            {ticket.title}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${PRIORITY_STYLES[ticket.priority].dot}`}
                          />
                          <span
                            className={`${STATUS_STYLES[ticket.status].className} bg-transparent px-0 py-0 text-sm font-medium ring-0`}
                          >
                            {STATUS_STYLES[ticket.status].label}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Projects */}
                {results!.projects.length > 0 && (
                  <div className="py-1.5">
                    <div className="flex items-center gap-2 px-4 pt-1 pb-1">
                      <FolderOpen className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                        Projects
                      </span>
                    </div>
                    {results!.projects.map((project) => (
                      <Link
                        key={project.projectId}
                        href={`/projects/${project.projectId}`}
                        onClick={handleSelect}
                        className="flex min-w-0 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/60"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                          {project.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span className="shrink-0 text-sm font-medium text-foreground">
                            {project.name}
                          </span>
                          {project.description && (
                            <span className="truncate text-xs text-muted-foreground">
                              {project.description}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Users */}
                {results!.users.length > 0 && (
                  <div className="py-1.5">
                    <div className="flex items-center gap-2 px-4 pt-1 pb-1">
                      <User className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                        Users
                      </span>
                    </div>
                    {results!.users.map((user) => (
                      <Link
                        key={user.userId}
                        href={`/users/${user.userId}`}
                        onClick={handleSelect}
                        className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-accent/60"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm leading-snug font-medium text-foreground">
                              {user.username}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                        </div>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-muted-foreground/60 uppercase">
                          {user.role}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer hint */}
            {searchState.status === "done" && totalResults > 0 && (
              <div className="flex items-center gap-3 border-t border-border/40 px-4 py-2">
                <span className="text-[11px] text-muted-foreground/50">
                  {totalResults} result{totalResults !== 1 ? "s" : ""}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground/40">
                  ↵ to navigate
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <button
          onClick={() =>
            mounted && setTheme(resolvedTheme === "dark" ? "light" : "dark")
          }
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          type="button"
          aria-label="Toggle theme"
        >
          {mounted ? (
            resolvedTheme === "dark" ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )
          ) : (
            <div className="h-[18px] w-[18px]" />
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              type="button"
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onSelect={() => signOut({ callbackUrl: "/signin" })}
              className="flex items-center gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default Navbar
