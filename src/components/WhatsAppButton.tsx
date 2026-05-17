import whatsappIcon from "@/assets/whatsapp-icon.png";

const WHATSAPP_NUMBER = "5579981509552";
const DEFAULT_MESSAGE = "Olá! Vim pelo site da SeVII Colecionáveis e gostaria de mais informações 👋";

export function WhatsAppButton() {
  const encodedMessage = encodeURIComponent(DEFAULT_MESSAGE);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conversar no WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
    >
      <img src={whatsappIcon} alt="" className="h-full w-full object-contain" />
    </a>
  );
}
