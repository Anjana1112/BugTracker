import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    user: {
      id: string
      userId?: number
      role?: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    userId?: number
    role?: string
    accessToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    userId?: number
    role?: string
    accessToken?: string
  }
}
