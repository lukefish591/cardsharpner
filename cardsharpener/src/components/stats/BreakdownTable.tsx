import { formatStakesNl, money, pct, type BreakdownRow } from "../../lib/stats";

interface BreakdownTableProps {
  rows: BreakdownRow[];
  keyLabel: string;
  showBb?: boolean;
}

export function BreakdownTable({ rows, keyLabel, showBb = false }: BreakdownTableProps) {
  return (
    <div className="stats-table-wrap" data-region="stats-table">
      <table className="stats-table">
        <thead>
          <tr>
            <th>{keyLabel}</th>
            <th>Hands</th>
            <th>Total profit</th>
            {showBb ? <th>Profit (BB)</th> : null}
            <th>Avg / hand</th>
            <th>Showdown rate</th>
            <th>Flop win</th>
            <th>PFR</th>
            <th>C-bet flop</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{keyLabel === "Stakes" ? formatStakesNl(row.key) : row.key}</td>
              <td>{row.hands}</td>
              <td className={row.totalProfit >= 0 ? "is-pos" : "is-neg"}>
                {money(row.totalProfit)}
              </td>
              {showBb ? (
                <td>
                  {row.profitBb == null ? "—" : `${row.profitBb.toFixed(1)} BB`}
                </td>
              ) : null}
              <td>{money(row.avgProfit, 3)}</td>
              <td>{pct(row.showdownRate)}</td>
              <td>{pct(row.flopWinRate)}</td>
              <td>{pct(row.preflopRaiseRate)}</td>
              <td>{pct(row.cbetRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
