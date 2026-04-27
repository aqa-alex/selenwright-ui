import { useMutation } from "@tanstack/vue-query";
import { listRegistry } from "../api";
import type { RegistryListing } from "../api";

export function useListRegistryMutation() {
  return useMutation<RegistryListing, Error, string>({
    mutationFn: (host: string) => listRegistry(host),
  });
}
