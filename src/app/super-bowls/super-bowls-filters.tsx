"use client";

type TeamOption = {
  abbr: string;
  name: string;
};

export default function SuperBowlFilters({
  selectedTeam,
  selectedSeason,
  teamOptions,
  seasons,
}: {
  selectedTeam: string;
  selectedSeason: string;
  teamOptions: TeamOption[];
  seasons: number[];
}) {
  return (
    <form className="super-bowls-pickers" method="get">
      <label className="super-bowls-picker" htmlFor="sb-team">
        <span>Pick a team</span>
        <select
          id="sb-team"
          name="team_abbr"
          value={selectedTeam}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          <option value="">Select team</option>
          {teamOptions.map((team) => (
            <option key={team.abbr} value={team.abbr}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <label className="super-bowls-picker" htmlFor="sb-year">
        <span>Pick a season</span>
        <select
          id="sb-year"
          name="season_year"
          value={selectedSeason}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          <option value="">Select season</option>
          {seasons.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
