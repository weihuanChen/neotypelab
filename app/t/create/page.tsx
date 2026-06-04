import { Suspense } from "react";
import { CreateWorkbench } from "@/app/t/create/CreateWorkbench";

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateWorkbench />
    </Suspense>
  );
}
