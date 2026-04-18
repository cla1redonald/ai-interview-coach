import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Resend from 'next-auth/providers/resend';
import { db } from './db/index';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Resend({
      from: 'StoryBank <onboarding@resend.dev>',
    }),
  ],
  session: {
    // JWT strategy: session validated from cookie — no DB lookup per request.
    // Required for Edge middleware compatibility.
    strategy: 'jwt',
  },
  pages: {
    signIn:        '/login',
    verifyRequest: '/login/verify',
  },
  callbacks: {
    session({ session, token }) {
      // user.id is not forwarded by default — explicitly add it from the JWT sub claim.
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
