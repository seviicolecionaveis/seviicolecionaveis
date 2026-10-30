import { useState } from "react";
import { useRecentProducts } from "@/hooks/useRecentProducts";
import { OtherProductTile } from "./OtherProductTile";
import { SealedModal, type Sealed } from "./SealedModal";
import { PanelModal, type Panel } from "./PanelModal";
import { AccessoryModal, type Accessory } from "./AccessoryModal";

interface Props {
  /** Janela em dias. Padrão 30. */
  windowDays?: number;
  /** Máximo de itens exibidos. Padrão 24. */
  limit?: number;
}

/**
 * Painéis, produtos lacrados e acessórios adicionados ou reabastecidos
 * recentemente, exibidos na página de Novidades junto ao catálogo de cartas.
 */
export function RecentOtherProducts({ windowDays = 30, limit = 24 }: Props) {
  const { entries, loading } = useRecentProducts(windowDays);
  const [activePanel, setActivePanel] = useState<Panel | null>(null);
  const [activeSealed, setActiveSealed] = useState<Sealed | null>(null);
  const [activeAccessory, setActiveAccessory] = useState<Accessory | null>(null);

  if (loading || entries.length === 0) return null;
  const shown = entries.slice(0, limit);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest">
          Outros produtos adicionados recentemente
        </h2>
        <p className="text-xs text-muted-foreground">
          Painéis, produtos lacrados e acessórios dos últimos {windowDays} dias
        </p>
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-4 lg:grid-cols-6">
        {shown.map((entry) => (
          <OtherProductTile
            key={`${entry.kind}-${entry.kind === "panel" ? entry.panel.id : entry.kind === "sealed" ? entry.sealed.id : entry.accessory.id}`}
            entry={entry}
            onClick={() => {
              if (entry.kind === "panel") setActivePanel(entry.panel);
              else if (entry.kind === "sealed") setActiveSealed(entry.sealed);
              else setActiveAccessory(entry.accessory);
            }}
          />
        ))}
      </div>
      <PanelModal panel={activePanel} onClose={() => setActivePanel(null)} />
      <SealedModal item={activeSealed} onClose={() => setActiveSealed(null)} />
      <AccessoryModal item={activeAccessory} onClose={() => setActiveAccessory(null)} />
    </section>
  );
}
