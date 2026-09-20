export const ENV = {
  appId: "local",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
  firebaseApiKey: process.env.FIREBASE_API_KEY ?? "",
  brevoApiKey: process.env.BREVO_API_KEY ?? "",
  publicAppUrl: (process.env.PUBLIC_APP_URL ?? "https://the-next-minds.vercel.app").replace(/\/+$/, ""),
};
