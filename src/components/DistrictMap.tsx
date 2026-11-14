import { useId, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { districtMap } from "../data";
import { useI18n } from "../lib/i18n";

interface DistrictMapProps {
  /** Totals by district used to color the map (for example, bills, income, ELEC). */
  values?: Map<number, number>;
  /** Custom formatter for hover tooltip / aria description. */
  formatValue?: (value: number) => string;
  /** Choropleth color scale palette. */
  palette?: "navy" | "gold" | "emerald";
  /** District to outline, for the district detail page. */
  highlight?: number;
  /** Compact version without permanent number labels. */
  compact?: boolean;
  ariaLabel: string;
  /** Hide the interactive layer (used for decorative mini maps). */
  staticMap?: boolean;
}

const PALETTES: Record<"navy" | "gold" | "emerald", [number, number, number]> = {
  navy: [16, 42, 60],
  gold: [154, 103, 18],
  emerald: [15, 118, 110],
};

/**
 * Mapa coroplético real de los 40 distritos legislativos de Nueva Jersey.
 * Geometría oficial del U.S. Census Bureau (TIGERweb).
 */
export function DistrictMap({
  values,
  formatValue,
  palette = "navy",
  highlight,
  compact = false,
  ariaLabel,
  staticMap = false,
}: DistrictMapProps) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const titleId = useId();

  const totals = values ? [...values.values()] : [];
  const max = totals.length ? Math.max(...totals) : 1;
  const min = totals.length ? Math.min(...totals) : 0;
  const [r, g, b] = PALETTES[palette];

  function openDistrict(district: number) {
    if (staticMap) return;
    navigate(`/district/${district}`);
  }

  return (
    <div className={`district-map${compact ? " district-map-compact" : ""}`}>
      <svg
        viewBox={districtMap.viewBox}
        role="group"
        aria-labelledby={titleId}
        className="district-map-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>{ariaLabel}</title>
        <rect
          x="0"
          y="0"
          width="500"
          height="1000"
          fill="transparent"
          aria-hidden="true"
        />
        {districtMap.districts.map((shape) => {
          const total = values?.get(shape.district);
          const ratio = total === undefined ? 0 : (total - min) / (max - min || 1);
          const background = values
            ? `rgba(${r}, ${g}, ${b}, ${0.09 + ratio * 0.84})`
            : "#12354c";
          const textColor = ratio > 0.5 ? "#f7f3e9" : "#0f172a";
          const isHighlighted = highlight === shape.district;
          const label = t("superTools.districtLabel", {
            district: shape.district,
          });
          const formatted =
            total === undefined
              ? ""
              : formatValue
                ? formatValue(total)
                : `${t("superTools.billsShort")} ${total.toLocaleString(lang === "es" ? "es-US" : "en-US")}`;
          const description =
            total === undefined ? label : `${label}: ${formatted}`;
          const interactiveProps = staticMap
            ? {}
            : {
                role: "link" as const,
                tabIndex: 0,
                onClick: () => openDistrict(shape.district),
                onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDistrict(shape.district);
                  }
                },
              };

          return (
            <g
              key={shape.district}
              className={`district-shape${isHighlighted ? " is-highlighted" : ""}${
                staticMap ? " is-static" : ""
              }`}
              aria-label={description}
              {...interactiveProps}
            >
              <title>{description}</title>
              <path
                d={shape.path}
                fill={isHighlighted ? "#c9852b" : background}
                fillRule="evenodd"
                stroke="#f7f3e9"
                strokeWidth={isHighlighted ? 3 : 1}
                vectorEffect="non-scaling-stroke"
              />
              {!compact && shape.label && (
                <text
                  x={shape.label[0]}
                  y={shape.label[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="district-map-label"
                  fill={isHighlighted ? "#1b1204" : textColor}
                  aria-hidden="true"
                >
                  {shape.district}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="district-map-source">
        {t("superTools.mapSource")}
      </p>
    </div>
  );
}
