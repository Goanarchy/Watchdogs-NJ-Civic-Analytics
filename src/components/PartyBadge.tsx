import { partyClass, partyLabel } from "../lib/labels";
import { useI18n } from "../lib/i18n";

export function PartyBadge({ party }: { party: string }) {
  const { lang } = useI18n();
  return (
    <span className={`party ${partyClass(party)}`}>
      {partyLabel(party, lang)}
    </span>
  );
}
