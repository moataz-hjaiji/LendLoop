// Tells Convex to trust JWTs issued by our Clerk instance. `applicationID` must
// match the `aud` claim of Clerk's "convex" JWT template.
const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
