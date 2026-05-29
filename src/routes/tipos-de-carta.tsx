import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

const BRAND = "#20a5c9";

const TYPES = [
  {
    tag: "COMUM · INCOMUM · RARA",
    image: "https://sm.ign.com/ign_br/screenshot/default/pokemon-tcg-celebrations-mew-11-brpt_fv91.png",
    title: "Carta Normal",
    description:
      "São as cartas sem acabamento especial. Podem ser Comuns (●), Incomuns (◆) ou Raras (★), indicadas pelos símbolos no canto inferior direito. Formam a base de qualquer coleção e são as mais fáceis de encontrar em boosters.",
  },
  {
    tag: "REVERSE FOIL",
    image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/video-games/_tiles/tcg-pocket/2025/10/24/inline/full/01-en.png",
    title: "Reverse Foil",
    description:
      "Uma versão especial de cartas comuns, incomuns ou raras onde o brilho foil cobre o fundo da ilustração, e não o Pokémon em si. Cada booster contém exatamente uma carta Reverse Foil, o que as torna mais procuradas que a versão normal da mesma carta.",
  },
  {
    tag: "HOLO FOIL",
    image: "/images/foil-gengar.png",
    title: "Foil (Holográfica)",
    description:
      "O brilho holográfico aparece diretamente sobre o Pokémon, criando o efeito metálico característico. É uma das raridades mais clássicas do TCG, presente desde os primeiros sets. Ao mover a carta, a ilustração reflete a luz de forma única — cada ângulo revela um padrão diferente.",
  },
  {
    tag: "FULL ART",
    image: "https://dz3we2x72f7ol.cloudfront.net/expansions/twilight-masquerade/pt-br/SV06_PTBR_188.png",
    title: "Full Art",
    description:
      "A ilustração ocupa toda a superfície da carta, sem a borda branca tradicional. O resultado é uma arte muito mais imersiva e detalhada. Cartas Full Art costumam apresentar o Pokémon ou Treinador em cenários épicos e são altamente valorizadas tanto por jogadores quanto por colecionadores.",
  },
  {
    tag: "SECRET RARE · RAINBOW RARE",
    image: "https://tools.toywiz.com/_images/_webp/_products/lg/silvertempest200mawilevstar.webp",
    title: "Secret Rare & Rainbow Rare",
    description:
      "As Secret Rares têm número de coleção acima do total oficial do set — por isso o nome \"secreta\". Dentro dessa categoria, as Rainbow Rares apresentam um degradê multicolorido que cobre toda a arte da carta. São entre as mais difíceis de encontrar em um booster e figuram entre as mais valiosas de qualquer expansão.",
  },
  {
    tag: "SPECIAL ILLUSTRATION RARE",
    image: "https://efour.b-cdn.net/uploads/default/original/3X/a/2/a2763c6b19ab5a708f180de141beadd90467c85d.jpeg",
    title: "Special Illustration Rare (SIR)",
    description:
      "Combinam arte Full Art com acabamento texturizado e um estilo artístico único — muitas vezes ilustradas por artistas convidados com traços completamente diferentes do padrão oficial. São consideradas as cartas visualmente mais bonitas do jogo moderno e têm altíssima demanda no mercado colecionável.",
  },
  {
    tag: "GOLD CARD · HYPER RARE",
    image: "https://repositorio.sbrauble.com/arquivos/in/pokemon_bkp/cd/754/697cf2e13601d-pzxvo-irhcg-9a3cbb1b17fb0c24b5f4da3defde2c8b.jpg",
    title: "Gold Card (Hyper Rare)",
    description:
      "Todo o fundo da carta é dourado e brilhante, com textura em relevo. Geralmente são versões Gold de itens, energias ou Pokémon icônicos. A taxa de aparição em boosters é uma das menores do jogo, tornando cada Gold Card uma peça de destaque em qualquer coleção.",
  },
  {
    tag: "PROMO",
    image: "https://cdnx.jumpseller.com/rtgamer-store/image/62660106/resize/1079/1079?1745124590",
    title: "Carta Promo",
    description:
      "Cartas Promo não estão disponíveis em boosters comuns. Elas são distribuídas em eventos, torneios, coleções especiais, kits de presente ou como bônus de pré-lançamento. Identificadas pelo símbolo PROMO no lugar da numeração do set, carregam um charme exclusivo por serem ligadas a momentos e edições limitadas da franquia.",
  },
  {
    tag: "ENERGIA",
    image: "https://repositorio.sbrauble.com/arquivos/in/pokemon_bkp/cd/761/698105b0424db-b7slp-9ymxn-447f35d1fc824ee02c1187646107a29f.jpg",
    title: "Carta de Energia",
    description:
      "As cartas de Energia são peças fundamentais para jogar o TCG Pokémon — sem elas, os Pokémon não conseguem usar seus ataques. Existem 11 tipos de energia (Fogo, Água, Grama, Elétrico, Psíquico, Lutador, Sombrio, Metal, Fada, Dragão e Normal), além das Energias Especiais, que oferecem efeitos extras durante a batalha.",
  },
  {
    tag: "POKÉBOLA",
    image: "https://i.ebayimg.com/images/g/IaIAAeSwITNpKPh~/s-l400.jpg",
    title: "Pokébola",
    description:
      "Cartas com o símbolo de Pokébola no verso fazem parte de sets especiais e edições comemorativas do TCG. Esse padrão diferenciado no verso da carta as distingue visualmente das cartas convencionais, sendo muito procuradas por colecionadores que buscam peças únicas e fora do padrão tradicional.",
  },
];

export const Route = createFileRoute("/tipos-de-carta")({
  head: () => ({
    meta: [
      { title: "Guia de Tipos de Carta — Sevii Colecionáveis" },
      {
        name: "description",
        content:
          "Entenda as diferenças entre cada tipo de carta Pokémon: Normal, Reverse Foil, Foil, Full Art, Secret Rare, SIR, Gold, Promo, Energia e Pokébola.",
      },
      { property: "og:title", content: "Guia de Tipos de Carta — Sevii Colecionáveis" },
      {
        property: "og:description",
        content: "Guia completo dos tipos e raridades das cartas Pokémon.",
      },
    ],
  }),
  component: TiposDeCartaPage,
});

function TiposDeCartaPage() {
  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="text-lg font-bold">
            Sevii Colecionáveis
          </Link>
          <SiteNav className="hidden md:flex" />
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-12 pb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold">Guia de Tipos de Carta</h1>
          <p className="mt-3 text-neutral-600 max-w-2xl mx-auto">
            Entenda as diferenças entre cada tipo de carta Pokémon e saiba o que está comprando.
          </p>
          <div
            className="mx-auto mt-6 h-[3px] w-24 rounded-full"
            style={{ backgroundColor: BRAND }}
          />
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-12">
          <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
            {TYPES.map((t) => (
              <article
                key={t.title}
                className="group flex flex-col md:flex-row overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="md:w-60 lg:w-64 shrink-0 bg-neutral-50 flex items-center justify-center p-4">
                  <img
                    src={t.image}
                    alt={t.title}
                    loading="lazy"
                    className="h-64 w-full object-contain"
                  />
                </div>
                <div className="flex-1 p-5">
                  <span
                    className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    {t.tag}
                  </span>
                  <h2 className="mt-3 text-lg font-bold">{t.title}</h2>
                  <p className="mt-2 text-sm text-neutral-700 leading-relaxed">{t.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              Ver catálogo completo
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
