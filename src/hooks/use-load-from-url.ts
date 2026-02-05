import { useEffect, useRef } from "react";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { extractPlanFromHash } from "@/lib/share";
import { toast } from "sonner";

export function useLoadFromUrl() {
  const hasLoaded = useRef(false);
  const loadFromFile = useFloorPlanStore((s) => s.loadFromFile);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    const data = extractPlanFromHash();
    if (!data) return;

    window.history.replaceState(null, "", window.location.pathname);
    loadFromFile(data);
    toast.success("Floor plan loaded from shared link");
  }, [loadFromFile]);
}
