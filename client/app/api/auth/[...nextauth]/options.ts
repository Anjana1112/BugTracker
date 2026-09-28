import type { NextAuthOptions } from "next-auth"
import GithubProvider from "next-auth/providers/github"
import CredentialsProvider from "next-auth/providers/credentials"

export const options: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "Email" },
        password: {
          label: "Password",
          type: "password",
          placeholder: "Password",
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const res = await fetch(`${process.env.EXPRESS_API_URL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        })

        if (!res.ok) {
          return null
        }

        const { token, user } = await res.json()

        if (!token || !user) {
          return null
        }

        return {
          id: String(user.userId),
          userId: user.userId,
          role: user.role,
          accessToken: token,
          name: user.username,
          email: user.email,
          image: user.profilePictureUrl ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.userId = user.userId
        token.role = user.role
        token.accessToken = user.accessToken
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name
        if (session.email) token.email = session.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.userId = token.userId
        session.user.role = token.role
      }
      session.accessToken = token.accessToken
      return session
    },
  },
}
