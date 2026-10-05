import Link from 'next/link';
import type { CurrentReserve } from '@/lib/current-reserves';

export function CurrentReserves({rows,compact=false}:{rows:CurrentReserve[];compact?:boolean}) {
  if(!rows.length)return null;
  if(compact)return <details className="team-reserve-summary">
    <summary>Injury / reserve list <span>({rows.length} players)</span></summary>
    <p>Current roster status, separate from weekly injury reports. Pending moves are not confirmed.</p>
    <ul>{rows.map(row=><li key={row.player_key}>
      <Link href={`/players/${encodeURIComponent(row.player_key)}`}>{row.display_name}</Link>
      <span>{row.position || '—'} · {row.label}</span>
    </li>)}</ul>
  </details>;
  return <section aria-label="Current injured reserve"><h2>Current reserve / injury list</h2>
    <p>Current roster status, separate from weekly practice reports and past game-day availability. Reported moves awaiting an official transaction are labeled pending.</p>
    <details open={rows.length<=15}><summary>Show {rows.length} current reserve / pending entries</summary>
    <div className="table-wrap" style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Player</th><th>Team</th><th>Position</th><th>Current status</th></tr></thead>
      <tbody>{rows.map(row=><tr key={row.player_key}><td><Link href={`/players/${encodeURIComponent(row.player_key)}`}>{row.display_name}</Link></td>
        <td>{row.team_abbr}</td><td>{row.position || '-'}</td><td>{row.label}</td></tr>)}</tbody></table></div>
    </details></section>;
}
