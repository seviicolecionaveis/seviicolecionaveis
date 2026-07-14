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
  "EPO - Poderes Emergentes":
    "Emerging Powers (2011) — expansão da era Black & White com 98 cartas. Destaca-se por trazer Pokémon de Unova como Darmanitan, Scolipede e Chandelure, além de introduzir mecânicas de deck building com Energia Prismática. Uma coleção essencial para completar a era BW e para fãs da região de Unova.",
  "BLW - Black and White":
    "Black & White (2011) — coleção base da quinta geração do TCG Pokémon, com 114 cartas. Marca o início da era Black & White e introduz Pokémon lendários de Unova como Reshiram e Zekrom, além de trazer novas mecânicas de jogo e cartas de Treinador atualizadas. Essencial para colecionadores da era BW.",
  "HIF - Destinos Ocultos":
    "Hidden Fates / Destinos Ocultos (2019) — coleção especial da era Sun & Moon com 69 cartas no set principal e um subset Shiny Vault de 94 cartas. Famosa por trazer versões Shiny de Pokémon populares como Charizard-GX, Mewtwo-GX e Rayquaza-GX em arte alternativa. Uma das coleções mais desejadas pelos colecionadores devido à raridade dos Shiny Vault e ao valor de mercado das cartas especiais.",
  "M4 - Ninja Spinner":
    "M4 - Ninja Spinner — coleção especial do TCG Pokémon com foco em itens de batalha e Pokémon com habilidades ágeis. Inclui cartas de Treinador e Pokémon com temática ninja, ideal para completistas e jogadores que buscam mecânicas diferenciadas.",
  "PBL - Escuridão Absoluta":
    "PBL - Escuridão Absoluta — expansão do TCG Pokémon com temática sombria, destacando Pokémon do tipo Sombrio e Psíquico em arte marcante. Traz cartas raras e ilustrações alternativas muito procuradas por colecionadores.",
};

export function getCollectionDescription(name: string): string | undefined {
  return COLLECTION_DESCRIPTIONS[name];
}
