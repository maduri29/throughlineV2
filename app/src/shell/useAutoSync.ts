import { useEffect } from "react";
import { useGraphStore } from "../store";
import { checkTursoConfigured } from "../data/sync";
import { getWorkspaceAccount } from "../data/account";

export function useAutoSync() {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const sync = async () => {
      const state = useGraphStore.getState();
      if (
        stopped ||
        document.visibilityState !== "visible" ||
        state.syncStatus === "syncing" ||
        state.status === "booting"
      ) {
        return;
      }
      await state.forceSave();
      if (useGraphStore.getState().status !== "saved") return;
      await state.syncNow();
    };

    void (async () => {
      await useGraphStore.getState().boot();
      if (!getWorkspaceAccount() || stopped || !(await checkTursoConfigured())) return;
      await sync();
      if (!stopped) timer = setInterval(() => void sync(), 60_000);
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, []);
}
