import { Badge } from "@/components/ui/badge";

type Availability = { state: "available" | "on_loan" | "overdue"; until?: string };

export const SOFT_GREEN = "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200";
export const SOFT_AMBER = "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200";

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  if (availability.state === "available") return <Badge className={SOFT_GREEN}>Available</Badge>;
  if (availability.state === "overdue") return <Badge variant="destructive">Overdue</Badge>;
  return <Badge className={SOFT_AMBER}>On loan until {availability.until}</Badge>;
}
