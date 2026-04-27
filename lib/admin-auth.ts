// Legacy shim — preusmerava na novi lib/auth.ts.
// Ostavljeno zbog postojećih import-a po codebase-u.
export { ADMIN_COOKIE, isMasterAuthed as isAdminAuthed } from "./auth";
