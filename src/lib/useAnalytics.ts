import { useEffect, useState } from "react";
import { loadAnalytics, type Analytics } from "./analytics";

interface AnalyticsState {
  analytics: Analytics | null;
  error: boolean;
  loading: boolean;
}

export function useAnalytics(): AnalyticsState {
  const [state, setState] = useState<AnalyticsState>({
    analytics: null,
    error: false,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    loadAnalytics()
      .then((analytics) => {
        if (active) setState({ analytics, error: false, loading: false });
      })
      .catch(() => {
        if (active) setState({ analytics: null, error: true, loading: false });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
