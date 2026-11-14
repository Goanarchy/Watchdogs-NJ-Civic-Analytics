import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { campaign, demographics, districtMap, federal, meta } from "../data";
import { useI18n } from "../lib/i18n";

type CheckState = "idle" | "checking" | "ok" | "fail";

const ROSTER_WEB = "https://www.njleg.state.nj.us/legislative-roster";
const DONORS_SNAPSHOT_AT = "2026-11-14T02:42:23.944Z";
const LAST_CHECK_STORAGE_KEY = "watchdogs:last-sync-check:v2";
const AUTO_SYNC_STALE_MS = 60_000;

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
    second: "2-digit",
  }).format(date);
}

function getLatestSnapshotIso(): string {
  const candidates = [
    demographics.generatedAt,
    DONORS_SNAPSHOT_AT,
    campaign.generatedAt,
    federal.generatedAt,
    meta.generatedAt,
  ].filter(Boolean);
  let bestIso = meta.generatedAt;
  let bestTime = new Date(meta.generatedAt).getTime();
  for (const iso of candidates) {
    const ms = new Date(iso).getTime();
    if (!Number.isNaN(ms) && ms > bestTime) {
      bestTime = ms;
      bestIso = iso;
    }
  }
  return bestIso;
}

export function DataSyncPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, lang, formatNumber } = useI18n();
  const [check, setCheck] = useState<CheckState>("idle");
  const [checkedAt, setCheckedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_CHECK_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const didBootSync = useRef(false);

  const runCheck = useCallback(async (probeExternal = true) => {
    setCheck("checking");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    let ok = false;
    try {
      const isHttp =
        typeof window !== "undefined" &&
        (window.location.protocol === "http:" ||
          window.location.protocol === "https:");

      if (isHttp) {
        const selfRes = await fetch(`./index.html?_live=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        ok = selfRes.ok;
      } else {
        ok = Boolean(meta?.legislatorCount && demographics?.districts?.length);
      }

      if (probeExternal && typeof navigator !== "undefined" && navigator.onLine !== false) {
        try {
          await fetch(ROSTER_WEB, {
            mode: "no-cors",
            cache: "no-store",
            signal: controller.signal,
          });
          ok = true;
        } catch {
          // Keep same-origin verification status when external origin is unreachable.
        }
      }

      setCheck(ok ? "ok" : "fail");
    } catch {
      setCheck("fail");
    } finally {
      window.clearTimeout(timer);
      const nowIso = new Date().toISOString();
      setCheckedAt(nowIso);
      try {
        localStorage.setItem(LAST_CHECK_STORAGE_KEY, nowIso);
      } catch {
        // Ignore storage write errors.
      }
    }
  }, []);

  useEffect(() => {
    if (didBootSync.current) return;
    didBootSync.current = true;
    const lastMs = checkedAt ? new Date(checkedAt).getTime() : 0;
    if (!lastMs || Date.now() - lastMs > AUTO_SYNC_STALE_MS) {
      void runCheck(false);
    } else {
      setCheck("ok");
    }
  }, [checkedAt, runCheck]);

  useEffect(() => {
    if (!open) return;
    const lastMs = checkedAt ? new Date(checkedAt).getTime() : 0;
    if (!lastMs || Date.now() - lastMs > AUTO_SYNC_STALE_MS) {
      void runCheck(false);
    }
  }, [open, checkedAt, runCheck]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const latestSyncIso = getLatestSnapshotIso();
  const effectiveSyncIso = checkedAt || latestSyncIso;

  const rows = [
    {
      label: t("sync.state"),
      stamp: formatStamp(checkedAt || meta.generatedAt, lang),
      detail: t("sync.stateDetail", {
        legislators: formatNumber(meta.legislatorCount),
        bills: formatNumber(meta.billCount),
      }),
      href: meta.sourceUrl,
    },
    {
      label: t("sync.donors"),
      stamp: formatStamp(checkedAt || DONORS_SNAPSHOT_AT, lang),
      detail: t("sync.donorsDetail"),
      href: "https://www.njelecefilesearch.com/",
    },
    {
      label: t("sync.campaign"),
      stamp: formatStamp(checkedAt || campaign.generatedAt, lang),
      detail: t("sync.campaignDetail", {
        profiles: formatNumber(campaign.profiles.length),
        promises: formatNumber(
          campaign.profiles.reduce((total, profile) => total + profile.promises.length, 0),
        ),
      }),
      href: campaign.source.url,
    },
    {
      label: t("sync.census"),
      stamp: formatStamp(checkedAt || demographics.generatedAt, lang),
      detail: t("sync.censusDetail", {
        districts: formatNumber(demographics.districts.length),
        population: formatNumber(demographics.statewide.population),
      }),
      href: demographics.source.url,
    },
    {
      label: t("sync.federal"),
      stamp: formatStamp(checkedAt || federal.generatedAt, lang),
      detail: t("sync.federalDetail", {
        districts: formatNumber(federal.districts.length),
      }),
      href: federal.sources.finance.url,
    },
    {
      label: t("sync.map"),
      stamp: formatStamp(checkedAt || districtMap.source.retrievedAt, lang),
      detail: t("sync.mapDetail", {
        districts: formatNumber(districtMap.districts.length),
      }),
      href: districtMap.source.url,
    },
  ];

  return createPortal(
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

        <div className="sync-summary-grid">
          <div className="sync-summary-card">
            <span className="sync-summary-label">{t("sync.lastSyncLabel")}</span>
            <strong className="sync-summary-value num">
              {formatStamp(effectiveSyncIso, lang)}
            </strong>
          </div>
          <div className="sync-summary-card">
            <span className="sync-summary-label">{t("sync.lastVerifiedLabel")}</span>
            <strong className="sync-summary-value num">
              {checkedAt ? formatStamp(checkedAt, lang) : t("sync.notCheckedYet")}
            </strong>
          </div>
        </div>

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
                  <td className="num">
                    <span className="sync-live-pill">{t("sync.liveBadge")}</span>{" "}
                    <span className="sync-row-stamp">{row.stamp}</span>
                  </td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sync-actions">
          <button
            type="button"
            className="button button-primary button-small"
            onClick={() => void runCheck(true)}
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
            href={ROSTER_WEB}
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
            <span className="sync-checked num">
              {" "}
              · {t("sync.lastChecked", {
                time: formatStamp(checkedAt, lang),
              })}
            </span>
          )}
        </p>

        <p className="sync-note">{t("sync.note")}</p>
      </div>
    </div>,
    document.body,
  );
}
