import { Badge } from "@/components/ui/badge";

type Availability = { state: "available" | "on_loan" | "overdue"; until?: string };

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  if (availability.state === "available") return <Badge>Available</Badge>;
  if (availability.state === "overdue") return <Badge variant="destructive">Overdue</Badge>;
  return <Badge variant="secondary">On loan until {availability.until}</Badge>;
}
