import { useEffect, useMemo, useState } from "react";
import { loadBills, meta } from "../data";
import { useI18n } from "../lib/i18n";
import { billTypeLabel, billUrl } from "../lib/labels";
import type { Bill, Legislator } from "../types";

type TypeFilter = "all" | "P" | "C";

const PAGE_SIZE = 25;

export function BillExplorer({ legislator }: { legislator: Legislator }) {
  const { lang, t } = useI18n();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [billData, setBillData] = useState<Record<string, Bill> | null>(null);

  useEffect(() => {
    let active = true;
    loadBills().then((data) => {
      if (active) setBillData(data);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [query, type]);

  const counts = useMemo(() => {
    let primary = 0;
    let cosponsored = 0;
    for (const [, relationType] of legislator.bills) {
      if (relationType === "P") primary += 1;
      else cosponsored += 1;
    }
    return { primary, cosponsored, total: legislator.bills.length };
  }, [legislator.bills]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return legislator.bills
      .filter(([bill, relationType]) => {
        if (type !== "all" && relationType !== type) return false;
        if (!needle) return true;
        const record = billData?.[bill];
        return (
          bill.toLowerCase().includes(needle) ||
          (record?.synopsis ?? "").toLowerCase().includes(needle)
        );
      })
      .map(([bill, relationType]) => ({
        bill,
        synopsis: billData?.[bill]?.synopsis ?? "",
        session: billData?.[bill]?.session ?? 0,
        type: relationType,
      }));
  }, [legislator.bills, query, type, billData]);

  const visible = filtered.slice(0, limit);

  return (
    <div className="bill-explorer">
      <div className="bill-summary">
        <span>{t("bills.total", { count: counts.total })}</span>
        <span>{t("bills.primaryCount", { count: counts.primary })}</span>
        <span>
          {t("bills.cosponsoredCount", { count: counts.cosponsored })}
        </span>
      </div>

      <div className="bill-toolbar">
        <div className="search-field search-field-small">
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="search-icon"
          >
            <path d="M9 3a6 6 0 1 0 3.9 10.5L17 17.6 18.4 16.2l-4.1-4.1A6 6 0 0 0 9 3Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("bills.searchPlaceholder")}
            aria-label={t("bills.searchAria")}
          />
        </div>

        <div
          className="segmented"
          role="group"
          aria-label={t("bills.typeFilter")}
        >
          <button
            type="button"
            className={type === "all" ? "active" : ""}
            onClick={() => setType("all")}
            aria-pressed={type === "all"}
          >
            {t("bills.all")}
          </button>
          <button
            type="button"
            className={type === "P" ? "active" : ""}
            onClick={() => setType("P")}
            aria-pressed={type === "P"}
          >
            {t("bills.primaryFilter")}
          </button>
          <button
            type="button"
            className={type === "C" ? "active" : ""}
            onClick={() => setType("C")}
            aria-pressed={type === "C"}
          >
            {t("bills.cosponsoredFilter")}
          </button>
        </div>
      </div>

      <p className="bill-count-note">
        {billData ? (
          <>
            {t("bills.showing", {
              shown: visible.length,
              filtered: filtered.length,
              filteredNote:
                filtered.length !== counts.total
                  ? ` ${t("common.filteredFrom", { total: counts.total })}`
                  : "",
            })}
          </>
        ) : (
          t("bills.loadingSummaries", { count: counts.total })
        )}
      </p>

      {!billData ? (
        <div className="bill-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          {t("bills.loading")}
        </div>
      ) : visible.length > 0 ? (
        <div className="bill-list">
          {visible.map((bill) => (
            <a
              key={`${bill.bill}-${bill.type}`}
              className="bill-row"
              href={billUrl(bill.bill, bill.session || meta.session)}
              target="_blank"
              rel="noreferrer"
              aria-label={t("bills.openAria", { bill: bill.bill })}
            >
              <span className="bill-number">{bill.bill}</span>
              <span className="bill-synopsis">
                {bill.synopsis || t("bills.noSummary")}
              </span>
              <span className="bill-side">
                <span className={`bill-type type-${bill.type.toLowerCase()}`}>
                  {billTypeLabel(bill.type, lang)}
                </span>
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="bill-external"
                >
                  <path d="M6 2h8v8h-2V5.4L4.7 12.7l-1.4-1.4L10.6 4H6V2Z" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state-small">
          <p>{t("bills.noMatch")}</p>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setQuery("");
              setType("all");
            }}
          >
            {t("bills.clear")}
          </button>
        </div>
      )}

      {limit < filtered.length && (
        <div className="bill-more">
          <button
            type="button"
            className="button button-outline"
            onClick={() => setLimit((current) => current + PAGE_SIZE)}
          >
            {t("bills.showMore", {
              count: Math.min(PAGE_SIZE, filtered.length - limit),
            })}
          </button>
        </div>
      )}
    </div>
  );
}
