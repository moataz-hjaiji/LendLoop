"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

export default function PublicPage() {
  const { isSignedIn } = useAuth();
  const tools = useQuery(api.tools.listPublic);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">LendLoop</h1>
      <p className="mt-3 text-xl text-muted-foreground">Borrow what you need. Lend what you don&apos;t.</p>
      <div className="mt-6">
        {isSignedIn ? (
          <Button size="lg" render={<Link href="/tools" />} nativeButton={false}>
            Go to your tools
          </Button>
        ) : (
          <SignInButton mode="modal" forceRedirectUrl="/tools">
            <Button size="lg">Sign in to lend or borrow</Button>
          </SignInButton>
        )}
      </div>

      <section className="mt-14" aria-labelledby="available-heading">
        <h2 id="available-heading" className="text-lg font-semibold">
          Available in the neighborhood
        </h2>
        {tools === undefined && <p className="mt-4 text-muted-foreground">Loading…</p>}
        {tools?.length === 0 && (
          <p className="mt-4 text-muted-foreground">Nothing is listed yet. Be the first to lend something.</p>
        )}
        <ul className="mt-4 divide-y border-y">
          {tools?.map((tool) => (
            <li key={tool._id} className="flex items-center justify-between gap-4 py-3">
              <span>{tool.name}</span>
              <Badge variant="secondary" className="capitalize">
                {tool.category}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
