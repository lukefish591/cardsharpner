interface CardProps {
  /** e.g. "As", "Td"; omit or "??" for face-down / unknown */
  code?: string | null;
  faceDown?: boolean;
}

export function Card({ code, faceDown }: CardProps) {
  if (faceDown || code === "??") {
    return <span className="card card--back" aria-label="Face-down card" />;
  }
  if (!code) {
    return <span className="card card--empty" aria-hidden="true" />;
  }
  return (
    <span className="card" aria-label={code}>
      {code}
    </span>
  );
}
