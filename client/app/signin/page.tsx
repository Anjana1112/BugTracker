"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demoAccounts"

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setIsLoading(false)

    if (result?.error) {
      toast.error("Invalid email or password.")
      return
    }

    router.push("/")
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
            {/* GitHub sign-in doesn't mint a backend JWT yet (see the
                signIn callback in options.ts) — a "successful" GitHub
                login would 401 on every API call. Hidden until that's
                built; the provider itself stays configured. */}
            {process.env.NEXT_PUBLIC_ENABLE_GITHUB_LOGIN === "true" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => signIn("github")}
              >
                Sign in with GitHub
              </Button>
            )}
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign up
            </Link>
          </p>
          <Separator className="my-5" />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Try a demo account</p>
            <p className="text-xs text-muted-foreground">
              Password for all demo accounts:{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                {DEMO_PASSWORD}
              </code>
            </p>
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="outline"
                className="h-auto justify-between py-2"
                onClick={() => {
                  setEmail(account.email)
                  setPassword(DEMO_PASSWORD)
                }}
              >
                <span className="flex flex-col items-start">
                  <span className="text-sm">{account.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {account.email}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {account.label}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
