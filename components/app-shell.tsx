"use client";

import { UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/tools", label: "All tools" },
  { href: "/my-listings", label: "My listings" },
  { href: "/my-requests", label: "My requests" },
  { href: "/incoming", label: "Incoming requests" },
];

function Message({ children }: { children: ReactNode }) {
  return <p className="mx-auto max-w-md px-6 py-16 text-center text-muted-foreground">{children}</p>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const storeUser = useMutation(api.users.store);
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const [storeError, setStoreError] = useState<string>();

  // Queries need the user's row, so pages render only once it exists.
  useEffect(() => {
    if (isAuthenticated) storeUser({}).catch((error) => setStoreError(errorMessage(error)));
  }, [isAuthenticated, storeUser]);

  const links = me?.role === "admin" ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;

  let content = children;
  if (storeError) content = <Message>{storeError}</Message>;
  else if (!isLoading && !isAuthenticated) {
    content = (
      <Message>
        Convex could not verify your session. Check that Clerk has a JWT template named
        &ldquo;convex&rdquo; and that CLERK_JWT_ISSUER_DOMAIN matches its issuer.
      </Message>
    );
  } else if (!me) content = <Message>Loading…</Message>;

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Logo />
          <nav aria-label="Main" className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  pathname === href && "bg-accent font-medium text-accent-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{content}</main>
    </>
  );
}
