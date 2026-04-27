import { isAdminAuthed } from "@/lib/admin-auth";
import AdminGate from "../AdminGate";
import EditHistoryClient from "./EditHistoryClient";

export const dynamic = "force-dynamic";

export default async function EditHistoryPage() {
  if (!(await isAdminAuthed())) return <AdminGate />;
  return <EditHistoryClient />;
}
