import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function NotFoundPage() {
  const { t } = useI18n();
  useDocumentTitle(t("notfound.docTitle"));

  return (
    <main className="page narrow-page">
      <div className="empty-state">
        <p className="eyebrow eyebrow-dark">{t("common.error404")}</p>
        <h1>{t("notfound.title")}</h1>
        <p>{t("notfound.text")}</p>
        <Link className="button button-dark" to="/">
          {t("notfound.cta")}
        </Link>
      </div>
    </main>
  );
}
