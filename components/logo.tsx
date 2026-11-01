import { Repeat2 } from "lucide-react";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md font-semibold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Repeat2 aria-hidden className="size-5" />
      </span>
      LendLoop
    </Link>
  );
}
