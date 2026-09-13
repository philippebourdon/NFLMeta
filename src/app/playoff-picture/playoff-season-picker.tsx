"use client";

import { startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function PlayoffSeasonPicker({
  selectedSeason,
  seasons,
}: {
  selectedSeason: number;
  seasons: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="playoff-filter" htmlFor="postseason-select">
      <span className="sr-only">Season</span>
      <div className="playoff-select-wrap">
        <select
          id="postseason-select"
          name="season"
          value={String(selectedSeason)}
          onChange={(event) => {
            const next = new URLSearchParams(searchParams.toString());
            next.set("season", event.target.value);
            const query = next.toString();
            startTransition(() => {
              router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
            });
          }}
        >
          {seasons.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
