"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { BellRing, CalendarCheck, HandHelping, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { CategoryTile } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: HandHelping, title: "List what you own", text: "Share the tools sitting idle in your garage or shed." },
  { icon: CalendarCheck, title: "Request the dates", text: "Pick the days you need something. The lender decides." },
  { icon: BellRing, title: "Stay in the loop", text: "Updates and return reminders are sent automatically." },
];

export default function PublicPage() {
  const { isSignedIn } = useAuth();
  const tools = useQuery(api.tools.listPublic);

  const cta = isSignedIn ? (
    <Button size="lg" render={<Link href="/tools" />} nativeButton={false}>
      Go to your tools
    </Button>
  ) : (
    <SignInButton mode="modal" forceRedirectUrl="/tools">
      <Button size="lg">Sign in to lend or borrow</Button>
    </SignInButton>
  );

  return (
    <div className="hero-glow flex-1">
      <header className="mx-auto flex max-w-5xl items-center px-4 py-5">
        <Logo />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20">
        <section className="py-14 text-center sm:py-20">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Borrow what you need. <span className="text-primary">Lend what you don&apos;t.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground text-balance">
            LendLoop is a tool-lending board for your neighborhood, so one good drill can do the work of ten.
          </p>
          <div className="mt-8 flex justify-center [&_button]:h-11 [&_button]:px-6 [&_a]:h-11 [&_a]:px-6">{cta}</div>
        </section>

        <section aria-label="How it works" className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border bg-card/70 p-5">
              <Icon aria-hidden className="size-5 text-primary" />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        <section className="mt-16" aria-labelledby="available-heading">
          <h2 id="available-heading" className="text-2xl font-bold tracking-tight">
            Available in the neighborhood
          </h2>
          <div className="mt-5" aria-live="polite">
            {tools === undefined && <p className="text-muted-foreground">Loading…</p>}
            {tools?.length === 0 && <EmptyState message="Nothing is listed yet. Be the first to lend something." />}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools?.map((tool) => (
                <li key={tool._id}>
                  <Card>
                    <CardContent className="flex items-center gap-3">
                      <CategoryTile category={tool.category} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{tool.name}</p>
                        <p className="text-sm capitalize text-muted-foreground">{tool.category}</p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
