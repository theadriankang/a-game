import type { AuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Credentials provider requires JWT sessions (NextAuth can't attach a
// credentials-based sign-in to a database session row), so this uses "jwt"
// rather than "database". The Prisma adapter is still wired in so OAuth
// providers can be added later without a schema or strategy change.
export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
};
