export type Notice = {
  id: string;
  title: string;
  date: string; // ISO or human-readable
  category: "Pagamentos" | "Estoque" | "Comunidade" | "Promoção" | "Geral";
  summary: string;
  body: string[];
  active: boolean;
};

export const NOTICES: Notice[] = [
  {
    id: "welcome-coupon",
    title: "Cupom de boas-vindas — 10% OFF na primeira compra",
    date: "Permanente",
    category: "Promoção",
    summary:
      "Novos clientes ganham 10% de desconto na primeira compra com o cupom PRIMEIRACOMPRA10.",
    body: [
      "Como boas-vindas, oferecemos 10% de desconto na primeira compra.",
      "Use o cupom PRIMEIRACOMPRA10 no checkout. Válido apenas para a primeira compra de cada cliente.",
    ],
    active: true,
  },
  {
    id: "payment-notice",
    title: "Instabilidade nas formas de pagamento",
    date: "2026",
    category: "Pagamentos",
    summary:
      "Estamos enfrentando instabilidade no checkout. Para finalizar sua compra, entre em contato pelo e-mail.",
    body: [
      "Estamos enfrentando instabilidade nas formas de pagamento do site.",
      "Para finalizar sua compra, entre em contato pelo e-mail seviicolecionaveis@gmail.com.",
    ],
    active: true,
  },
  {
    id: "stock-sync-notice",
    title: "Aviso importante sobre o estoque",
    date: "2026",
    category: "Estoque",
    summary:
      "Estamos realizando uma conferência manual do estoque carta por carta. Podem ocorrer divergências.",
    body: [
      "Nosso site está passando por alguns problemas de sincronização de estoque e estamos trabalhando para corrigir tudo o mais rápido possível.",
      "Algumas cartas que temos em estoque estavam aparecendo como indisponíveis, enquanto outras já esgotadas apareciam como disponíveis para compra.",
      "Já estamos há alguns dias realizando uma conferência manual do estoque, carta por carta. Como trabalhamos com mais de 3000 cartas cadastradas, ainda podem ocorrer divergências. Por esse motivo, em alguns casos poderemos entrar em contato após a compra para informar que determinada carta não está disponível no momento.",
      "Informamos também que o estoque das cartas ex, Ilustração Rara (IR) e Ultra Rara (UR) já foi revisado e corrigido. Neste momento, estamos realizando a conferência das cartas normais, reverse e foil, que representam a maior parte do nosso catálogo.",
      "Pedimos desculpas pelo transtorno e agradecemos a compreensão de todos. Estamos empenhados em normalizar a situação o quanto antes.",
      "Caso tenha dúvidas sobre a disponibilidade de alguma carta, entre em contato conosco antes da compra. Teremos prazer em ajudar!",
    ],
    active: true,
  },
  {
    id: "whatsapp-group",
    title: "Entre no nosso grupo do WhatsApp",
    date: "Permanente",
    category: "Comunidade",
    summary:
      "Participe do nosso grupo exclusivo e fique por dentro de lançamentos, promoções e novidades.",
    body: [
      "Entre no nosso grupo exclusivo do WhatsApp e fique por dentro de lançamentos, promoções e novidades do mundo Pokémon.",
      "Link do grupo: https://chat.whatsapp.com/LfG18YtcQMJ8PBjNz5IogS",
    ],
    active: true,
  },
];
