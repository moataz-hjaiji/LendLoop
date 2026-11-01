"use client";

import { formatDistanceToNow } from "date-fns";
import { useMutation, useQuery } from "convex/react";
import { ActionButton } from "@/components/action-button";
import { ConfirmButton } from "@/components/confirm-button";
import { LoanList } from "@/components/loan-list";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";

function Automation() {
  const events = useQuery(api.automation.recent);
  if (!events) return <p className="text-muted-foreground">Loading…</p>;
  if (events.length === 0) return <p className="text-muted-foreground">No automation activity yet.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead>Key and detail</TableHead>
          <TableHead>When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event._id}>
            <TableCell>
              <Badge variant={event.status === "failed" ? "destructive" : "secondary"}>{event.status}</Badge>
            </TableCell>
            <TableCell>{event.kind.replace("_", " ")}</TableCell>
            <TableCell className="max-w-md whitespace-normal break-words">
              <code className="text-xs">{event.idempotencyKey}</code>
              {event.detail && <p className="text-sm text-muted-foreground">{event.detail}</p>}
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {formatDistanceToNow(event.updatedAt, { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Listings() {
  const tools = useQuery(api.tools.list, {});
  const removeTool = useMutation(api.tools.remove);
  if (!tools) return <p className="text-muted-foreground">Loading…</p>;
  if (tools.length === 0) return <p className="text-muted-foreground">No listings.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tool</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Moderation</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tools.map((tool) => (
          <TableRow key={tool._id}>
            <TableCell>{tool.name}</TableCell>
            <TableCell>{tool.ownerName}</TableCell>
            <TableCell className="text-right">
              <ConfirmButton
                label="Remove"
                title={`Remove ${tool.name}?`}
                description={`This removes ${tool.ownerName}'s listing and declines its pending requests.`}
                confirmLabel="Remove listing"
                success="Listing removed"
                action={() => removeTool({ toolId: tool._id })}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Users() {
  const users = useQuery(api.users.listAll);
  const setTrusted = useMutation(api.users.setTrustedLender);
  if (!users) return <p className="text-muted-foreground">Loading…</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Trusted Lender</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user._id}>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell className="capitalize">{user.role}</TableCell>
            <TableCell className="text-right">
              <ActionButton
                size="sm"
                variant={user.trustedLender ? "default" : "outline"}
                aria-pressed={user.trustedLender}
                aria-label={`Trusted Lender: ${user.name}`}
                action={() => setTrusted({ userId: user._id, trusted: !user.trustedLender })}
              >
                {user.trustedLender ? "Trusted" : "Mark trusted"}
              </ActionButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AllLoans() {
  const loans = useQuery(api.loans.listAll);
  return <LoanList loans={loans} show="both" empty="No loans yet." />;
}

export default function AdminPage() {
  const me = useQuery(api.users.me);
  if (me && me.role !== "admin") return <p className="text-muted-foreground">This page is for admins.</p>;

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Admin</h1>
      <Tabs defaultValue="automation">
        <TabsList>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="loans">All loans</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="automation" className="pt-4"><Automation /></TabsContent>
        <TabsContent value="loans" className="pt-4"><AllLoans /></TabsContent>
        <TabsContent value="listings" className="pt-4"><Listings /></TabsContent>
        <TabsContent value="users" className="pt-4"><Users /></TabsContent>
      </Tabs>
    </>
  );
}
