"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TaxonomyTag } from "@shared/types";
import { TAG_LABELS } from "@/lib/taxonomy";

export function ErrorMixChart({ tags }: { tags: Record<TaxonomyTag, number> }) {
  const data = Object.entries(tags).map(([tag, count]) => ({
    tag,
    label: TAG_LABELS[tag as TaxonomyTag],
    count,
  }));

  if (data.every((row) => row.count === 0)) {
    return <p className="text-sm text-muted-foreground">No tagged attempts yet.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
          <XAxis dataKey="tag" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={48} />
          <YAxis allowDecimals={false} width={28} />
          <Tooltip
            formatter={(value, _name, item) => [value ?? 0, String(item?.payload?.label ?? "")]}
          />
          <Bar dataKey="count" fill="var(--color-foreground)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
