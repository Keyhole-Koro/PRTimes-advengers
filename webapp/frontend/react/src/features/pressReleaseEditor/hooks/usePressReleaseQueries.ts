import { useQuery } from "@tanstack/react-query";

import { BASE_URL, buildPressReleaseQueryKey, buildPressReleaseRevisionsQueryKey, PRESS_RELEASE_LIST_QUERY_KEY } from "../constants";
import type { PressReleaseResponse, PressReleaseRevisionResponse } from "../types";

export function usePressReleaseListQuery() {
  return useQuery<PressReleaseResponse[]>({
    queryKey: PRESS_RELEASE_LIST_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/press-releases`);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }
      return (await response.json()) as PressReleaseResponse[];
    },
  });
}

export function usePressReleaseQuery(pressReleaseId: number | null) {
  return useQuery<PressReleaseResponse>({
    enabled: pressReleaseId !== null,
    queryKey: pressReleaseId === null ? ["fetch-press-release", "disabled"] : buildPressReleaseQueryKey(pressReleaseId),
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/press-releases/${pressReleaseId}`);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }
      return (await response.json()) as PressReleaseResponse;
    },
  });
}

export function usePressReleaseRevisionsQuery(pressReleaseId: number | null) {
  return useQuery<PressReleaseRevisionResponse[]>({
    enabled: pressReleaseId !== null,
    queryKey: pressReleaseId === null ? ["fetch-press-release-revisions", "disabled"] : buildPressReleaseRevisionsQueryKey(pressReleaseId),
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/press-releases/${pressReleaseId}/revisions`);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }
      return (await response.json()) as PressReleaseRevisionResponse[];
    },
  });
}
