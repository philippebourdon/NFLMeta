"use client";

import { startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function TeamSeasonSelect({
  seasonYears,
  selectedSeason,
}: {
  seasonYears: number[];
  selectedSeason: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      id="team-season-select"
      name="season"
      aria-label="Select season"
      className="team-season-select-control"
      value={String(selectedSeason)}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("season", event.currentTarget.value);
        startTransition(() => {
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        });
      }}
    >
      {seasonYears.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  );
}
