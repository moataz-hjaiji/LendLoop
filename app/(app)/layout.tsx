import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A convenience for signed-out visitors, not the security boundary:
  // Convex checks identity and permissions again in every function.
  const { isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated) return redirectToSignIn();
  return <AppShell>{children}</AppShell>;
}
