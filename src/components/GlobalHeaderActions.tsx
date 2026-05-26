import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { HeaderActions } from "@/components/HeaderActions";
import { CartDrawer } from "@/components/CartDrawer";

export function GlobalHeaderActions() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [cartOpen, setCartOpen] = useState(false);

  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <div className="fixed top-3 right-3 z-40 rounded-full border border-border bg-background/90 backdrop-blur shadow-md px-1.5 py-1">
        <HeaderActions onCartOpen={() => setCartOpen(true)} />
      </div>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
