import { useState } from "react";
import { useI18n } from "../lib/i18n";
import { getLegislatorInitials } from "../lib/labels";

interface PortraitProps {
  src: string | null;
  name: string;
  className?: string;
  eager?: boolean;
}

export function Portrait({ src, name, className = "", eager = false }: PortraitProps) {
  const [failed, setFailed] = useState(false);
  const { t } = useI18n();

  if (!src || failed) {
    return (
      <div className={`${className} portrait-fallback`} aria-hidden="true">
        {getLegislatorInitials(name)}
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
