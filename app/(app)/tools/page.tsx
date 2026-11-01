"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { AvailabilityBadge } from "@/components/availability-badge";
import { BorrowDialog } from "@/components/borrow-dialog";
import { ToolFormDialog } from "@/components/tool-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { CATEGORIES, type Category } from "@/convex/lib/domain";

type ToolRow = FunctionReturnType<typeof api.tools.list>[number];

export default function ToolsPage() {
  const [category, setCategory] = useState<Category>();
  const [borrowing, setBorrowing] = useState<ToolRow>();
  const [listing, setListing] = useState(false);
  const tools = useQuery(api.tools.list, { category });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">All tools</h1>
        <Button onClick={() => setListing(true)}>List a tool</Button>
      </div>

      <div role="group" aria-label="Filter by category" className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" variant={category ? "outline" : "default"} aria-pressed={!category} onClick={() => setCategory(undefined)}>
          All
        </Button>
        {CATEGORIES.map((option) => (
          <Button
            key={option}
            size="sm"
            className="capitalize"
            variant={category === option ? "default" : "outline"}
            aria-pressed={category === option}
            onClick={() => setCategory(option)}
          >
            {option}
          </Button>
        ))}
      </div>

      {tools === undefined && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {tools?.length === 0 && <p className="mt-6 text-muted-foreground">No tools in this category yet.</p>}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools?.map((tool) => (
          <li key={tool._id}>
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium">{tool.name}</h2>
                  <AvailabilityBadge availability={tool.availability} />
                </div>
                <p className="text-sm capitalize text-muted-foreground">
                  {tool.category} · {tool.condition}
                </p>
                <p className="flex-1 text-sm">{tool.description}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {tool.isMine ? "Your listing" : tool.ownerName}
                    {tool.ownerTrusted && <Badge variant="outline">Trusted Lender</Badge>}
                  </span>
                  {!tool.isMine && (
                    <Button size="sm" variant="outline" onClick={() => setBorrowing(tool)}>
                      Request to borrow
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {borrowing && <BorrowDialog tool={borrowing} onClose={() => setBorrowing(undefined)} />}
      {/* Clear the filter so a new tool in another category is not hidden. */}
      <ToolFormDialog open={listing} onOpenChange={setListing} onCreated={() => setCategory(undefined)} />
    </>
  );
}
