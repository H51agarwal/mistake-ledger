"use client";

import { useCallback, useEffect, useState } from "react";
import type { Attempt, TaxonomyTag } from "@shared/types";
import { getAllTags, getAttempts } from "@/lib/ledger";
import { emptyTagCounts } from "@/lib/taxonomy";

export function useLedger(problemSlug?: string) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [tags, setTags] = useState<Record<TaxonomyTag, number>>(emptyTagCounts);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    setAttempts(getAttempts(problemSlug));
    setTags(getAllTags());
    setLoaded(true);
  }, [problemSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { attempts, tags, loaded, refresh };
}
