import { Link } from "react-router-dom";
import type { Legislator } from "../types";
import { useI18n } from "../lib/i18n";
import {
  chamberLabel,
  padDistrict,
  roleLabel,
  translateCommittee,
  translateLeadership,
} from "../lib/labels";
import { PartyBadge } from "./PartyBadge";
import { Portrait } from "./Portrait";

export function LegislatorCard({ legislator }: { legislator: Legislator }) {
  const { lang, t } = useI18n();
  const primaryCount = legislator.bills.filter(
    ([, type]) => type === "P",
  ).length;
  const primaryPct =
    legislator.bills.length > 0
      ? Math.round((primaryCount / legislator.bills.length) * 100)
      : 0;
  const role = legislator.leadership
    ? translateLeadership(legislator.leadership, lang)
    : roleLabel(legislator.chamber, lang);

  return (
    <Link
      to={`/legislador/${legislator.id}`}
      className="legislator-card"
      aria-label={t("home.cardAria", { name: legislator.fullName })}
    >
      <div className="card-top">
        <PartyBadge party={legislator.party} />
        <span className="district-tag">
          {t("home.cardDistrict", {
            district: padDistrict(legislator.district),
          })}
        </span>
      </div>

      <div className="card-body">
        <Portrait
          src={legislator.photo}
          name={legislator.fullName}
          className="card-photo"
        />
        <div className="card-identity">
          <h3 className="card-name">{legislator.fullName}</h3>
          <p className="card-role">{role}</p>
          <p className="card-chamber">
            {chamberLabel(legislator.chamber, lang)}
          </p>
          {legislator.committees.length > 0 && (
            <p className="card-committees">
              {legislator.committees
                .slice(0, 2)
                .map((committee) => translateCommittee(committee.name, lang))
                .join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="card-footer">
        <div className="card-footer-metrics">
          <span className="num">
            {t("home.cardBills", { count: legislator.bills.length })}
            <span className="card-primary">
              {t("home.cardPrimary", { count: primaryCount })}
            </span>
          </span>
          <span className="card-ratio-bar" aria-hidden="true">
            <span style={{ width: `${primaryPct}%` }} />
          </span>
        </div>
        <span className="card-arrow" aria-hidden="true">
          <svg viewBox="0 0 20 20">
            <path d="M4 10h11M11 5l5 5-5 5" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
