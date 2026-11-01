import { clerkMiddleware } from "@clerk/nextjs/server";

// Only makes the Clerk session available to server components. It protects nothing:
// app/(app)/layout.tsx redirects signed-out visitors, and Convex is the security boundary.
export default clerkMiddleware();

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)", "/(api|trpc)(.*)"],
};
