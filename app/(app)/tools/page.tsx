"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { BadgeCheck, Plus } from "lucide-react";
import { useState } from "react";
import { AvailabilityBadge } from "@/components/availability-badge";
import { BorrowDialog } from "@/components/borrow-dialog";
import { CategoryTile } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ToolFormDialog } from "@/components/tool-form-dialog";
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
      <PageHeader
        title="All tools"
        description="Everything your neighbors are happy to lend."
        action={
          <Button onClick={() => setListing(true)}>
            <Plus aria-hidden /> List a tool
          </Button>
        }
      />

      <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" variant={category ? "outline" : "default"} aria-pressed={!category} onClick={() => setCategory(undefined)}>
          All
        </Button>
        {CATEGORIES.map((option) => (
          <Button
            key={option}
            size="sm"
            className="rounded-full capitalize"
            variant={category === option ? "default" : "outline"}
            aria-pressed={category === option}
            onClick={() => setCategory(option)}
          >
            {option}
          </Button>
        ))}
      </div>

      <div className="mt-6">
        {tools === undefined && <p className="text-muted-foreground">Loading…</p>}
        {tools?.length === 0 && <EmptyState message="No tools in this category yet." />}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools?.map((tool) => (
            <li key={tool._id}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <CategoryTile category={tool.category} />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold">{tool.name}</h2>
                      <p className="text-sm capitalize text-muted-foreground">
                        {tool.category} · {tool.condition}
                      </p>
                    </div>
                  </div>
                  <div>
                    <AvailabilityBadge availability={tool.availability} />
                  </div>
                  <p className="flex-1 text-sm">{tool.description}</p>
                  <div className="flex items-center justify-between gap-2 border-t pt-3">
                    <span className="min-w-0 text-sm text-muted-foreground">
                      <span className="block truncate">{tool.isMine ? "Your listing" : tool.ownerName}</span>
                      {tool.ownerTrusted && (
                        <span className="flex items-center gap-1 text-xs font-medium text-primary">
                          <BadgeCheck aria-hidden className="size-3.5" /> Trusted Lender
                        </span>
                      )}
                    </span>
                    {!tool.isMine && (
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => setBorrowing(tool)}>
                        Request to borrow
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      {borrowing && <BorrowDialog tool={borrowing} onClose={() => setBorrowing(undefined)} />}
      {/* Clear the filter so a new tool in another category is not hidden. */}
      <ToolFormDialog open={listing} onOpenChange={setListing} onCreated={() => setCategory(undefined)} />
    </>
  );
}
