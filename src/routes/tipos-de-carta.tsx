import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Dialog, DialogContent } from "@/components/ui/dialog";


const BRAND = "#20a5c9";

const TYPES = [
  {
    tag: "COMUM · INCOMUM · RARA",
    image: "https://sm.ign.com/ign_br/screenshot/default/pokemon-tcg-celebrations-mew-11-brpt_fv91.png",
    title: "Carta Normal",
    description:
      "São as cartas sem acabamento especial. O símbolo no canto inferior direito indica a raridade: ● círculo preto = Comum (a mais fácil de encontrar), ◆ losango preto = Incomum, ★ estrela preta = Rara. Formam a base de qualquer coleção e são as mais fáceis de encontrar em boosters.",
  },
  {
    tag: "REVERSE FOIL",
    image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/video-games/_tiles/tcg-pocket/2025/10/24/inline/full/01-en.png",
    title: "Reverse Foil",
    description:
      "Uma versão especial de cartas comuns, incomuns ou raras onde o brilho foil cobre o fundo da ilustração, e não o Pokémon em si. O símbolo de raridade (●, ◆ ou ★) é o mesmo da versão normal, a diferença está no brilho do fundo. Cada booster contém exatamente uma carta Reverse Foil, o que as torna mais procuradas que a versão normal da mesma carta.",
  },
  {
    tag: "HOLO FOIL",
    image: "/images/foil-gengar.png",
    title: "Foil (Holográfica)",
    description:
      "O brilho holográfico aparece diretamente sobre o Pokémon, criando o efeito metálico característico. Identificada pela ★ estrela preta no canto inferior direito. É uma das raridades mais clássicas do TCG, presente desde os primeiros sets. Ao mover a carta, a ilustração reflete a luz de forma única, cada ângulo revela um padrão diferente.",
  },
  {
    tag: "FULL ART",
    image: "https://dz3we2x72f7ol.cloudfront.net/expansions/twilight-masquerade/pt-br/SV06_PTBR_188.png",
    title: "Full Art",
    description:
      "A ilustração ocupa toda a superfície da carta, sem a borda branca tradicional. Na era Escarlate & Violeta, é identificada por ★★ duas estrelas prateadas (prateado, não preto) no canto inferior direito. O resultado é uma arte muito mais imersiva e detalhada, com Pokémon ou Treinadores em cenários épicos, altamente valorizadas por jogadores e colecionadores.",
  },
  {
    tag: "SECRET RARE · RAINBOW RARE",
    image: "https://tools.toywiz.com/_images/_webp/_products/lg/silvertempest200mawilevstar.webp",
    title: "Secret Rare & Rainbow Rare",
    description:
      "As Secret Rares têm número de coleção acima do total oficial do set, por isso o nome \"secreta\". Uma dica fácil: se o número da carta for maior que o total do set (ex: 201/200), é uma Secret Rare. Dentro dessa categoria, as Rainbow Rares apresentam um degradê multicolorido que cobre toda a arte da carta. São entre as mais difíceis de encontrar em um booster e figuram entre as mais valiosas de qualquer expansão.",
  },
  {
    tag: "SPECIAL ILLUSTRATION RARE",
    image: "https://efour.b-cdn.net/uploads/default/original/3X/a/2/a2763c6b19ab5a708f180de141beadd90467c85d.jpeg",
    title: "Special Illustration Rare (SIR)",
    description:
      "Combinam arte Full Art com acabamento texturizado e um estilo artístico único, muitas vezes ilustradas por artistas convidados com traços completamente diferentes do padrão oficial. Na era Escarlate & Violeta, são identificadas por ★★ duas estrelas douradas no canto inferior direito (diferente das prateadas das Ultra Rares). São consideradas as cartas visualmente mais bonitas do jogo moderno e têm altíssima demanda no mercado colecionável.",
  },
  {
    tag: "GOLD CARD · HYPER RARE",
    image: "https://repositorio.sbrauble.com/arquivos/in/pokemon_bkp/cd/754/697cf2e13601d-pzxvo-irhcg-9a3cbb1b17fb0c24b5f4da3defde2c8b.jpg",
    title: "Gold Card (Hyper Rare)",
    description:
      "Todo o fundo da carta é dourado e brilhante, com textura em relevo. Identificada por ★★★ três estrelas douradas no canto inferior direito, o símbolo mais exclusivo do jogo atualmente. Geralmente são versões Gold de itens, energias ou Pokémon icônicos. A taxa de aparição em boosters é uma das menores do jogo, tornando cada Gold Card uma peça de destaque em qualquer coleção.",
  },
  {
    tag: "PROMO",
    image: "https://cdn11.bigcommerce.com/s-ua4dd/images/stencil/500x659/products/264513/469321/jolteon__87450.1762197366.jpg?c=2",
    title: "Carta Promo",
    description:
      "Cartas Promo não estão disponíveis em boosters comuns. A forma mais fácil de identificar: no lugar do número do set (ex: 045/198), aparece a palavra PROMO ou o símbolo de estrela com a letra P. São distribuídas em eventos, torneios, coleções especiais ou kits de presente, carregando um charme exclusivo por serem ligadas a momentos e edições limitadas da franquia.",
  },
  {
    tag: "ENERGIA",
    image: "https://repositorio.sbrauble.com/arquivos/in/pokemon_bkp/cd/761/6981059c0ca74-1fgs7-e8a2c-447f35d1fc824ee02c1187646107a29f.jpg",
    title: "Padrão de Símbolo de Energia",
    description:
      "As cartas com o padrão de símbolo de energia possuem um acabamento reverso holográfico, onde toda a superfície da carta brilha, exceto a ilustração principal do Pokémon. É presente no centro do fundo holográfico um único ícone do tipo do pokemon, como folhas para Pokémon de Grama, chamas para Fogo ou gotas para Água, criado num efeito metálico característico.",

  },
  {
    tag: "POKÉBOLA",
    image: "https://repositorio.sbrauble.com/arquivos/in/pokemon_bkp/cd/762/6981085644755-e3nfg-n4w5f-7e79422ad40f8e2917695d0713f7f6bb.jpg",
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
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);

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

        <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-12">
          <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
            {TYPES.map((t) => (
              <article
                key={t.title}
                className="group flex flex-col md:flex-row overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => setZoomImage({ src: t.image, alt: t.title })}
                  className="md:w-64 lg:w-72 shrink-0 bg-neutral-50 flex items-center justify-center p-4 cursor-zoom-in group/img"
                  aria-label={`Ampliar imagem: ${t.title}`}
                >
                  <img
                    src={t.image}
                    alt={t.title}
                    loading="lazy"
                    className="h-[22rem] w-full object-contain transition-transform group-hover/img:scale-105"
                  />
                </button>

                <div className="flex-1 p-5">
                  <span
                    className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    {t.tag}
                  </span>
                  <h2 className="mt-3 text-lg font-bold">{t.title}</h2>
                  <p className="mt-2 text-sm text-neutral-700 leading-relaxed text-justify">{t.description}</p>
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

      <Dialog open={!!zoomImage} onOpenChange={(open) => !open && setZoomImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-white">
          {zoomImage && (
            <img
              src={zoomImage.src}
              alt={zoomImage.alt}
              className="w-full h-auto max-h-[85vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

