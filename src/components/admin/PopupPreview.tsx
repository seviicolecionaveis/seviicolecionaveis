type PreviewPopup = {
  title: string;
  body_html: string;
  image_url: string | null;
  link_url: string | null;
};

/**
 * Renders the popup exactly like visitors see it (same widths/styles as SitePopups),
 * but inline and without any dismissal behaviour.
 */
export function PopupPreview({ popup }: { popup: PreviewPopup }) {
  return (
    <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-lg border border-border bg-background shadow-lg">
      <div className="max-h-[70vh] overflow-y-auto">
        {popup.image_url ? (
          <img src={popup.image_url} alt={popup.title} className="block h-auto w-full" />
        ) : null}

        {popup.body_html?.trim() ? (
          <div
            className="prose prose-sm max-w-none px-5 pt-4 text-sm text-foreground [&_a]:underline [&_img]:max-w-full"
            dangerouslySetInnerHTML={{ __html: popup.body_html }}
          />
        ) : null}

        <div className="bg-background px-4 py-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" disabled />
            Não mostrar novamente
          </label>
        </div>
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
