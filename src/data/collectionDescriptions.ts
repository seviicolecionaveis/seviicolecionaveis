// Descrições editoriais de coleções — usadas nas páginas /colecao/<slug>
// para SEO e contexto para colecionadores.

export const COLLECTION_DESCRIPTIONS: Record<string, string> = {
  "Base Set":
    "Lançada em 1999, a Base Set é a coleção original do TCG Pokémon — a coleção que começou tudo. Inclui ícones como Charizard, Blastoise e Venusaur. Cartas em bom estado têm altíssimo valor histórico e de mercado.",
  "Base Set 1st Edition":
    "A 1st Edition da Base Set é a primeira tiragem da coleção original, identificada pelo selo \"Edition 1\" no canto. É uma das cartas mais cobiçadas e valorizadas de todo o TCG Pokémon.",
  Jungle:
    "Lançada em 1999 como expansão da Base Set, Jungle traz Pokémon do habitat selvagem como Snorlax, Scyther e Wigglytuff. Marco para colecionadores da era WOTC.",
  Fossil:
    "Lançada em 1999, Fossil apresenta Pokémon pré-históricos como Aerodactyl, Lapras e Articuno. Completa a trilogia inicial Base/Jungle/Fossil.",
  "Team Rocket":
    "Coleção icônica de 2000 com cartas \"Dark\" — versões corrompidas de Pokémon clássicos. Dark Charizard é um dos itens mais procurados da era WOTC.",
  "151":
    "Coleção moderna inspirada nos 151 Pokémon originais de Kanto. Combina arte retrô com qualidade de impressão atual — perfeita pra colecionar e pra jogar.",
  "Scarlet & Violet":
    "Linha principal atual do TCG Pokémon, com Pokémon de Paldea, mecânicas Tera e arte de alta qualidade.",
  "Sword & Shield":
    "Geração de Galar (2020–2022) com Pokémon V, VMAX e VSTAR. Coleções com forte presença de Charizard e Pikachu de alto valor.",
  "Sun & Moon":
    "Geração de Alola (2017–2019) — introduziu Pokémon GX e arte alternativa Full Art. Coleção rica para colecionadores.",
  "XY":
    "Geração Kalos (2014–2016) com Mega Evoluções e cartas EX. Marco moderno do TCG.",
  "XY - XY":
    "Coleção base da era XY (Kalos), lançada em 2014. Introduziu as Mega Evoluções ao TCG Pokémon e cartas EX de Kalos como Xerneas e Yveltal.",
  "UNB - Elos Inquebráveis":
    "Unbroken Bonds (2019) — expansão da era Sun & Moon com 234 cartas. Famosa pelas cartas de Reshiram & Charizard-GX e Dedenne-GX, uma das coleções mais populares da era SM.",
  "LOT - Trovões Perdidos":
    "Lost Thunder (2018) — expansão da era Sun & Moon com 236 cartas. Destaca-se pelas cartas de Lugia-GX e Tyranitar-GX, além de introduzir o conceito de Prism Star. Uma das maiores coleções da era SM.",
  "BCR - Fronteiras Cruzadas":
    "Boundaries Crossed (2012) — expansão da era Black & White com 149 cartas. Introduziu mecânicas de ACE SPEC e cartas de Pokémon EX como Black Kyurem e White Kyurem. Uma das coleções mais completas da era BW, com arte marcante e forte presença competitiva.",
};

export function getCollectionDescription(name: string): string | undefined {
  return COLLECTION_DESCRIPTIONS[name];
}
