import { cardAssetUrl } from "../../lib/assets";

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
  const src = cardAssetUrl(code);
  if (src) {
    return (
      <img
        className="card card--face"
        src={src}
        alt={code}
        draggable={false}
      />
    );
  }
  return (
    <span className="card" aria-label={code}>
      {code}
    </span>
  );
}
