interface PotProps {
  amountLabel: string;
}

export function Pot({ amountLabel }: PotProps) {
  return (
    <div className="poker-table__pot" data-region="pot">
      Pot {amountLabel}
    </div>
  );
}
