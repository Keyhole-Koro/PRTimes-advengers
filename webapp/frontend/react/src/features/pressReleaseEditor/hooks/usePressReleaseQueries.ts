import { useQuery } from "@tanstack/react-query";

import { BASE_URL, PRESS_RELEASE_ID, QUERY_KEY, REVISIONS_QUERY_KEY } from "../constants";
import type { PressReleaseResponse, PressReleaseRevisionResponse } from "../types";

export function usePressReleaseQuery() {
  return useQuery<PressReleaseResponse>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/press-releases/${PRESS_RELEASE_ID}`);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }
      return (await response.json()) as PressReleaseResponse;
    },
  });
}

export function usePressReleaseRevisionsQuery() {
  return useQuery<PressReleaseRevisionResponse[]>({
    queryKey: REVISIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/press-releases/${PRESS_RELEASE_ID}/revisions`);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }
      return (await response.json()) as PressReleaseRevisionResponse[];
    },
  });
}

