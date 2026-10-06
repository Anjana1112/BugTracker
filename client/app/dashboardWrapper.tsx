"use client"

import React, { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import Navbar from "@/components/features/general/navbar"
import Sidebar from "@/components/features/general/sidebar"

const DashboardWrapper = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const isAuthRoute = pathname === "/signin" || pathname === "/signup"

  useEffect(() => {
    if (!isAuthRoute && status === "unauthenticated") {
      router.push("/signin")
    }
  }, [isAuthRoute, status, router])

  if (isAuthRoute) {
    return <>{children}</>
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar isSidebarCollapsed={isSidebarCollapsed} />
      <main
        className={`flex w-full flex-col bg-background ${
          isSidebarCollapsed ? "" : "md:pl-64"
        }`}
      >
        <Navbar
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
        />
        {children}
      </main>
    </div>
  )
}

export default DashboardWrapper
