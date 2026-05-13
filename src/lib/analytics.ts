// Google Analytics 4 helpers
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export const GA_MEASUREMENT_ID = "G-2Y61Z4FGFL";

export function trackPageView(path: string) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackEvent(name: string, params?: Record<string, any>) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params ?? {});
}
