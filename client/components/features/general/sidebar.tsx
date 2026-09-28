"use client"

import { Home, LucideIcon, Tickets, Settings, User } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface SidebarProps {
  isSidebarCollapsed: boolean
}
const Sidebar = ({ isSidebarCollapsed }: SidebarProps) => {
  const sidebarClassNames = `fixed flex h-full flex-col justify-between overflow-y-auto bg-background shadow-xl transition-all duration-300 ${
    isSidebarCollapsed ? "hidden w-0" : "w-64"
  }`
  return (
    <div className={sidebarClassNames}>
      <div className="flex h-full w-full flex-col justify-start">
        <div className="flex min-h-14 items-center justify-between bg-background"></div>

        <nav className="z-10 w-full">
          <SidebarLink icon={Home} label="Home" href="/" />
          <SidebarLink icon={Tickets} label="Tickets" href="/tickets" />
          <SidebarLink icon={User} label="Users" href="/users" />
          <SidebarLink icon={Settings} label="Settings" href="/settings" />
        </nav>
      </div>
    </div>
  )
}

interface SidebarLinkProps {
  href: string
  icon: LucideIcon
  label: string
}

const SidebarLink = ({ href, icon: Icon, label }: SidebarLinkProps) => {
  const pathname = usePathname()
  const isActive =
    pathname === href || (pathname === "/" && href === "/dashboard")

  return (
    <Link href={href} className="w-full">
      <div
        className={`relative flex cursor-pointer items-center justify-start gap-3 px-8 py-3 transition-colors hover:bg-muted ${
          isActive ? "bg-muted text-foreground" : "text-muted-foreground"
        }`}
      >
        {isActive && (
          <div className="absolute top-0 left-0 h-full w-1.25 bg-blue-200" />
        )}

        <Icon className="h-6 w-6" />
        <span className="font-medium">{label}</span>
      </div>
    </Link>
  )
}

export default Sidebar
