import { useState } from "react";
import { useI18n } from "../lib/i18n";

interface PortraitProps {
  src: string | null;
  name: string;
  className?: string;
  eager?: boolean;
}

function initials(name: string): string {
  return name
    .replace(/["“”]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Portrait({ src, name, className = "", eager = false }: PortraitProps) {
  const [failed, setFailed] = useState(false);
  const { t } = useI18n();

  if (!src || failed) {
    return (
      <div className={`${className} portrait-fallback`} aria-hidden="true">
        {initials(name)}
      </div>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={t("home.portraitAlt", { name })}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}
