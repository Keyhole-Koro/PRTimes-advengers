import { useEffect, useMemo, useState } from "react";

import { buildRevisionDiffSummary } from "../utils/diff";
import { usePressReleaseRevisionsQuery } from "./usePressReleaseQueries";

export function useRevisionHistory() {
  const { data: revisions = [] } = usePressReleaseRevisionsQuery();
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null);

  useEffect(() => {
    if (revisions.length === 0) {
      return;
    }

    setSelectedRevisionId((current) =>
      current && revisions.some((revision) => revision.id === current) ? current : revisions[0].id,
    );
  }, [revisions]);

  const selectedRevision =
    revisions.find((revision) => revision.id === selectedRevisionId) ?? revisions[0] ?? null;
  const selectedRevisionIndex = selectedRevision
    ? revisions.findIndex((revision) => revision.id === selectedRevision.id)
    : -1;
  const previousRevision =
    selectedRevisionIndex >= 0 && selectedRevisionIndex < revisions.length - 1
      ? revisions[selectedRevisionIndex + 1]
      : null;

  const revisionSummaries = useMemo(
    () => Object.fromEntries(revisions.map((revision) => [revision.id, buildRevisionDiffSummary(revisions, revision.id)])),
    [revisions],
  );

  return {
    previousRevision,
    revisions,
    revisionSummaries,
    selectedRevision,
    selectedRevisionId,
    setSelectedRevisionId,
  };
}
