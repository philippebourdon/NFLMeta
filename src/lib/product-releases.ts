export type ProductRelease = {
  version: string;
  date: string;
  title: string;
  previousVersions?: string[];
  developerNotes?: string;
  otherImprovements?: string[];
  changes: { type: 'feature' | 'improvement' | 'fix'; text: string; href?: string; label?: string }[];
};

// Newest first. Product release versions are independent of /api/v1 and SDK versions.
export const productReleases: ProductRelease[] = [
  {
    version:'2026.09.13.4',date:'2026-09-13',title:'Live possession indicators',
    changes:[{type:'feature',text:'A football beside the team name shows reported possession on live score cards. It updates with the score feed and disappears when possession is unavailable or updates become stale.',href:'/scores',label:'Live scores'}],
  },
  {
    version:'2026.09.13.3',date:'2026-09-13',title:'Clearer live game clocks',
    changes:[{type:'fix',text:'Live score cards show the remaining time once with a full quarter label. Eastern-time timestamps display consistently when the page loads.',href:'/scores',label:'Live scores'}],
  },
  {
    version:'2026.09.13.2',date:'2026-09-13',title:'Injured reserve visibility',
    changes:[{type:'fix',text:'See current injured-reserve players alongside weekly injury reports, on team and player profiles. Pending reported moves are distinguished from confirmed roster status.',href:'/injuries',label:'View injuries'}],
    developerNotes:'Injury API responses include a separate current_reserves collection. Historical weekly injury designations are preserved.',
  },
  {
    version: '2026.09.13.1', date: '2026-09-13', title: 'Confirmed game-day inactives',
    changes: [{type:'feature',text:'See confirmed inactive players for both teams on game pages, through the API, and in connected AI assistants.',href:'/schedule',label:'View games'},
      {type:'fix',text:'Confirmed game-day availability now takes precedence over earlier injury designations on the injury list.'}],
    developerNotes: 'GET /api/v1/games/{id}/inactives and MCP get_game_inactives. Injury responses add game_status while preserving report_status.',
  },
  {
    version: '2026.09.12.2',
    date: '2026-09-12',
    previousVersions: ['2026.09.12.1'],
    title: 'Daily team salary-cap space',
    changes: [
      { type: 'feature', text: 'See available salary-cap space for all 32 teams on their profiles, through the API, or in connected AI assistants. Updated daily.', href: '/teams', label: 'Explore teams' },
      { type: 'fix', text: 'Division standings now correctly include teams that have not played and rank 0–0 teams ahead of 0–1 teams.', href: '/standings', label: 'View standings' },
    ],
    developerNotes: 'API: GET /api/v1/teams/cap-space. MCP: get_team_cap_space. Request one team or all 32. See the documentation for filters, freshness, and usage limits.',
  },
];
