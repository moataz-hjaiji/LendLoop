import { ChefHat, Drill, Hammer, Package, SprayCan, Sprout, Tent, type LucideIcon } from "lucide-react";
import type { Category } from "@/convex/lib/domain";

const ICONS: Record<Category, LucideIcon> = {
  "power tools": Drill,
  "hand tools": Hammer,
  garden: Sprout,
  kitchen: ChefHat,
  camping: Tent,
  cleaning: SprayCan,
  other: Package,
};

/** Decorative: the category name is always shown as text beside it. */
export function CategoryTile({ category }: { category: Category }) {
  const Icon = ICONS[category];
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
      <Icon aria-hidden className="size-5" />
    </span>
  );
}
