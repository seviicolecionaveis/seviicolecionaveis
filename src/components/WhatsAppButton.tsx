function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 2C8.268 2 2 8.268 2 16c0 2.585.66 5.019 1.82 7.143L2 30l7.052-1.79A13.93 13.93 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm7.388 10.073c-.26 5.82-5.965 8.11-6.113 8.17-.148.059-.276.086-.433-.038-.157-.124-.61-.483-.768-.631-.157-.147-.276-.239-.484-.086-.207.153-.851.528-.1.986.45.315.905.752 1.198 1.096.293.343.53.723.99.38.46-.343 1.05-.98 1.327-1.352.277-.372.553-.31.858-.196.304.114 1.958.926 2.298 1.093.34.167.567.248.651.39.085.143.046 1.03-.242 2.014-.288.983-1.544 1.858-2.357 2.01-.814.153-1.611.189-2.115-.19-.367-.282-.713-.53-1.144-.803-.628-.393-1.418-.932-2.206-1.479-1.38-.952-2.445-2.147-2.858-3.06-.465-1.04-.298-2.028-.03-2.635.153-.34.383-.623.67-.835.34-.252.693-.302.9-.319.226-.019.453.002.652.062.274.083.555.263.746.389.191.126.35.238.466.313.116.075.22.143.316.2.095.057.185.107.274.155.188.102.375.203.587.332.262.159.434.386.48.617.047.231-.014.467-.12.679z"
        fill="currentColor"
      />
    </svg>
  );
}

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
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
