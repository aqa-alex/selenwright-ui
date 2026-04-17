import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { buildVideoFileApiPath } from "../artifacts/artifactsPage";
import { CONSOLE_SNAPSHOT_QUERY_KEY } from "./useConsoleSnapshotQuery";

export interface DeleteVideoVariables {
  filename: string;
}

export function useDeleteVideoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ filename }: DeleteVideoVariables) => {
      if (!filename) {
        throw new Error("Video filename is required");
      }

      const response = await fetch(buildVideoFileApiPath(filename), {
        credentials: "include",
        headers: { accept: "application/json, text/plain;q=0.9, */*;q=0.1" },
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.text()).trim();
        throw new Error(
          body || `Failed to delete video ${filename} (${response.status}).`,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONSOLE_SNAPSHOT_QUERY_KEY });
    },
  });
}
