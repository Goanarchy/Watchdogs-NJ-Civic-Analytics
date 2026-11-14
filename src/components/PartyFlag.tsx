import { partyShortLabel } from "../lib/labels";
import { useI18n } from "../lib/i18n";

export function PartyFlag({
  party,
  showLabel = false,
  className = "",
}: {
  party: string;
  showLabel?: boolean;
  className?: string;
}) {
  const { lang } = useI18n();
  const label = partyShortLabel(party, lang);
  const letter = party === "D" ? "D" : party === "R" ? "R" : "I";

  return (
    <span className={`party-flag-wrap ${className}`.trim()}>
      <span
        className={`party-flag party-flag-${party.toLowerCase()}`}
        role="img"
        aria-label={label}
        title={label}
      >
        <span aria-hidden="true">{letter}</span>
      </span>
      {showLabel && <span className="party-flag-label">{label}</span>}
    </span>
  );
}
