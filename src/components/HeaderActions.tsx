import { Link } from "@tanstack/react-router";
import { ShoppingBag, User as UserIcon, LogOut, LayoutDashboard, Heart, UserCog, Layers } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useState } from "react";
import { AdminCancellationBell } from "@/components/AdminCancellationBell";

interface Props {
  onCartOpen: () => void;
}

export function HeaderActions({ onCartOpen }: Props) {
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {user && isAdmin && <AdminCancellationBell />}
      <button
        onClick={onCartOpen}
        className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-secondary transition"
        aria-label="Carrinho"
      >
        <ShoppingBag className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
            {count}
          </span>
        )}
      </button>

      {user ? (
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
            aria-label="Conta"
          >
            <UserIcon className="h-5 w-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-card shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground truncate">
                  {user.email}
                </div>
                <Link
                  to="/conta"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"
                >
                  <UserCog className="h-4 w-4" /> Minha conta
                </Link>
                <Link
                  to="/favoritos"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"
                >
                  <Heart className="h-4 w-4" /> Meus favoritos
                </Link>
                <Link
                  to="/orders"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"
                >
                  <ShoppingBag className="h-4 w-4" /> Meus pedidos
                </Link>
                {isAdmin && (
                  <>
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"
                    >
                      <LayoutDashboard className="h-4 w-4" /> Admin
                    </Link>
                  </>
                )}
                <button
                  onClick={async () => {
                    await signOut();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-left"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <Link
          to="/auth"
          className="text-xs font-semibold uppercase tracking-wide rounded-full border border-border px-3 py-2 hover:bg-secondary"
        >
          Entrar
        </Link>
      )}
    </div>
  );
}
