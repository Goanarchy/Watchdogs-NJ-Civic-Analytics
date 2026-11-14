import { useEffect, useRef, useState } from "react";
import { campaign, districtMap, federal, meta } from "../data";
import { useI18n } from "../lib/i18n";

type CheckState = "idle" | "checking" | "ok" | "fail";

const ROSTER_API =
  "https://www.njleg.state.nj.us/api/legislatorData/legislatorBio/1";

function formatStamp(value: string | undefined, lang: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function DataSyncPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [check, setCheck] = useState<CheckState>("idle");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        "button, a[href], [tabindex]:not([tabindex='-1'])",
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function runCheck() {
    setCheck("checking");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(ROSTER_API, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await response.json();
      setCheck("ok");
    } catch {
      setCheck("fail");
    } finally {
      window.clearTimeout(timer);
      setCheckedAt(new Date().toISOString());
    }
  }

  async function copyInstructions() {
    const text = "npm run refresh-data\nnpm run build:single";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const rows = [
    {
      label: t("sync.state"),
      stamp: formatStamp(meta.generatedAt, lang),
      detail: t("sync.stateDetail", {
        legislators: meta.legislatorCount,
        bills: meta.billCount,
      }),
      href: meta.sourceUrl,
    },
    {
      label: t("sync.campaign"),
      stamp: formatStamp(campaign.generatedAt, lang),
      detail: t("sync.campaignDetail", {
        profiles: campaign.profiles.length,
        promises: campaign.profiles.reduce(
          (total, profile) => total + profile.promises.length,
          0,
        ),
      }),
      href: campaign.source.url,
    },
    {
      label: t("sync.federal"),
      stamp: formatStamp(federal.generatedAt, lang),
      detail: t("sync.federalDetail", {
        districts: federal.districts.length,
      }),
      href: federal.sources.finance.url,
    },
    {
      label: t("sync.map"),
      stamp: formatStamp(districtMap.source.retrievedAt, lang),
      detail: t("sync.mapDetail", {
        districts: districtMap.districts.length,
      }),
      href: districtMap.source.url,
    },
    {
      label: t("sync.donors"),
      stamp: t("sync.onDemand"),
      detail: t("sync.donorsDetail"),
      href: "https://www.elec.state.nj.us/",
    },
  ];

  return (
    <div
      className="sync-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="sync-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-title"
        ref={panelRef}
      >
        <div className="sync-head">
          <div>
            <p className="panel-kicker">{t("sync.kicker")}</p>
            <h2 id="sync-title">{t("sync.title")}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="sync-close"
            onClick={onClose}
            aria-label={t("sync.close")}
          >
            ✕
          </button>
        </div>
        <p className="panel-intro">{t("sync.sub")}</p>

        <div className="sync-table-wrap">
          <table className="sync-table">
            <thead>
              <tr>
                <th scope="col">{t("sync.module")}</th>
                <th scope="col">{t("sync.updated")}</th>
                <th scope="col">{t("sync.detail")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>
                    <a href={row.href} target="_blank" rel="noreferrer">
                      {row.label}
                    </a>
                  </td>
                  <td>{row.stamp}</td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sync-actions">
          <button
            type="button"
            className="button button-dark button-small"
            onClick={runCheck}
            disabled={check === "checking"}
          >
            {check === "checking" ? t("sync.checking") : t("sync.check")}
          </button>
          <button
            type="button"
            className="button button-outline button-small"
            onClick={() => window.location.reload()}
          >
            {t("sync.reload")}
          </button>
          <a
            className="button button-outline button-small"
            href="https://www.njleg.state.nj.us/legislative-roster"
            target="_blank"
            rel="noreferrer"
          >
            {t("sync.openSource")}
          </a>
        </div>

        <p
          className={`sync-status sync-status-${check}`}
          role="status"
          aria-live="polite"
        >
          {check === "idle" && t("sync.idle")}
          {check === "checking" && t("sync.checking")}
          {check === "ok" && t("sync.checkOk")}
          {check === "fail" && t("sync.checkFail")}
          {checkedAt && check !== "checking" && (
            <span className="sync-checked">
              {" "}
              · {t("sync.lastChecked", {
                time: formatStamp(checkedAt, lang),
              })}
            </span>
          )}
        </p>

        <div className="sync-steps">
          <p>{t("sync.howTo")}</p>
          <pre>
            <code>npm run refresh-data{"\n"}npm run build:single</code>
          </pre>
          <button
            type="button"
            className="button button-outline button-small"
            onClick={copyInstructions}
          >
            {copied ? t("sync.copied") : t("sync.copy")}
          </button>
        </div>
        <p className="sync-note">{t("sync.note")}</p>
      </div>
    </div>
  );
}
