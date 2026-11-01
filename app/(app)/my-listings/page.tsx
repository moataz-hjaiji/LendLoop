"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { AvailabilityBadge } from "@/components/availability-badge";
import { ConfirmButton } from "@/components/confirm-button";
import { ToolFormDialog } from "@/components/tool-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

export default function MyListingsPage() {
  const tools = useQuery(api.tools.myListings);
  const removeTool = useMutation(api.tools.remove);
  const [editing, setEditing] = useState<Doc<"tools">>();
  const [listing, setListing] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My listings</h1>
        <Button onClick={() => setListing(true)}>List a tool</Button>
      </div>

      {tools === undefined && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {tools?.length === 0 && (
        <p className="mt-6 text-muted-foreground">You have not listed anything yet. What is sitting in your garage?</p>
      )}

      <ul className="mt-6 grid gap-3">
        {tools?.map(({ availability, ...tool }) => (
          <li key={tool._id}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{tool.name}</span>
                    <AvailabilityBadge availability={availability} />
                  </div>
                  <p className="text-sm capitalize text-muted-foreground">
                    {tool.category} · {tool.condition}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(tool)}>
                    Edit
                  </Button>
                  <ConfirmButton
                    label="Remove"
                    title={`Remove ${tool.name}?`}
                    description="It disappears from the board and any pending requests are declined."
                    confirmLabel="Remove listing"
                    success="Listing removed"
                    action={() => removeTool({ toolId: tool._id })}
                  />
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {/* The key resets the form when switching between tools. */}
      {editing && <ToolFormDialog key={editing._id} open tool={editing} onOpenChange={() => setEditing(undefined)} />}
      <ToolFormDialog open={listing} onOpenChange={setListing} />
    </>
  );
}
