import { MessageCircle } from "lucide-react";

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
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
      style={{
        boxShadow: "0 4px 14px rgba(37, 211, 102, 0.4)",
      }}
    >
      <MessageCircle className="h-7 w-7 fill-white" />
    </a>
  );
}
