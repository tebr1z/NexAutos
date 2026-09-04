import { Suspense } from "react";
import { ContractsAdmin } from "./contracts-admin";

export default function ContractsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Müqavilələr…</p>}>
      <ContractsAdmin />
    </Suspense>
  );
}
