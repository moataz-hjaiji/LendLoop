"use client";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto max-w-md flex-1 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">That did not work</h1>
      <p role="alert" className="mt-2 text-muted-foreground">
        {errorMessage(error)}
      </p>
      <Button className="mt-6" onClick={retry}>
        Try again
      </Button>
    </main>
  );
}
