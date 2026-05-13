import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import pokeballPattern from "@/assets/pokeball-pattern.png";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { WishlistProvider } from "@/hooks/useWishlist";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sevii Colecionáveis" },
      { name: "description", content: "A Pokémon Card Gallery website for cataloging and displaying Pokémon cards with advanced filtering and image viewing." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Sevii Colecionáveis" },
      { property: "og:description", content: "A Pokémon Card Gallery website for cataloging and displaying Pokémon cards with advanced filtering and image viewing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Sevii Colecionáveis" },
      { name: "twitter:description", content: "A Pokémon Card Gallery website for cataloging and displaying Pokémon cards with advanced filtering and image viewing." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/25b6f12f-a487-4cc6-9c81-8cd9418a012f/id-preview-be88fb60--392637a4-5b2d-43f0-a643-ac0dba0c2366.lovable.app-1777949491317.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/25b6f12f-a487-4cc6-9c81-8cd9418a012f/id-preview-be88fb60--392637a4-5b2d-43f0-a643-ac0dba0c2366.lovable.app-1777949491317.png" },
      { name: "theme-color", content: "#0f172a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Sevii" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
    ],
    scripts: [
      { src: "https://www.googletagmanager.com/gtag/js?id=G-2Y61Z4FGFL", async: true },
      {
        children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', 'G-2Y61Z4FGFL', { send_page_view: false });`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

if (typeof window !== "undefined") {
  // Auto-recover from stale chunk imports after a deploy.
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    if (!sessionStorage.getItem("__chunk_reload__")) {
      sessionStorage.setItem("__chunk_reload__", "1");
      window.location.reload();
    }
  });
  window.addEventListener("load", () => {
    sessionStorage.removeItem("__chunk_reload__");
  });
}

function RootComponent() {
  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 bg-background"
            style={{
              backgroundImage: `url(${pokeballPattern})`,
              backgroundRepeat: "repeat",
              backgroundSize: "180px 180px",
              opacity: 0.08,
            }}
          />
          <PaymentTestModeBanner />
          
          <Outlet />
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}
