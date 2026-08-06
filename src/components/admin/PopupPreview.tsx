import { PopupCard, type PopupCardData } from "@/components/PopupCard";

type PreviewPopup = PopupCardData;

/**
 * Renders the popup exactly like visitors see it (same widths/styles as SitePopups),
 * but inline and without any dismissal behaviour.
 */
export function PopupPreview({ popup }: { popup: PreviewPopup }) {
  return (
    <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-lg border border-border bg-background shadow-lg">
      <div className="max-h-[70vh] overflow-y-auto">
        <PopupCard popup={popup} disabled />
      </div>
    </div>
  );
}

export function PopupPreviewModal({
  popup,
  onClose,
}: {
  popup: PreviewPopup;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4"
      onClick={onClose}
    >
      <div className="my-8 w-full max-w-[480px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between text-xs text-white">
          <span className="font-semibold">Prévia — como o visitante vê</span>
          <button onClick={onClose} className="hover:underline">
            Fechar ✕
          </button>
        </div>
        <PopupPreview popup={popup} />
        {popup.link_url ? (
          <p className="mt-2 text-center text-[11px] text-white/70">
            Clique na imagem leva para: {popup.link_url}
          </p>
        ) : null}
      </div>
    </div>
  );
}
