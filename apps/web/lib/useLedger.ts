"use client";

import { useCallback, useEffect, useState } from "react";
import type { Attempt, TaxonomyTag } from "@shared/types";
import { getAllTags, getAttempts, saveAttempt } from "@/lib/ledger";
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
    let cancelled = false;

    async function pullExtensionAttempts() {
      try {
        const response = await fetch("/api/ledger");
        if (!response.ok) return;
        const body = (await response.json()) as { attempts?: unknown };
        if (!Array.isArray(body.attempts)) return;
        for (const row of body.attempts) {
          if (row && typeof row === "object" && "id" in row) {
            saveAttempt(row as Attempt);
          }
        }
      } catch {
        // Dashboard still works from localStorage if the bridge is down.
      } finally {
        if (!cancelled) refresh();
      }
    }

    void pullExtensionAttempts();
    const timer = window.setInterval(() => {
      void pullExtensionAttempts();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { attempts, tags, loaded, refresh };
}
