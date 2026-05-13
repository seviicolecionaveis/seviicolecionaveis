import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CARD_CATEGORIES } from "@/data/cards";
import { toast } from "sonner";
import { X } from "lucide-react";

export function PreferencesForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pokemons, setPokemons] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [pokemonInput, setPokemonInput] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("favorite_pokemons, favorite_categories")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPokemons(data.favorite_pokemons ?? []);
          setCategories(data.favorite_categories ?? []);
        }
        setLoading(false);
      });
  }, [user]);

  const addPokemon = () => {
    const v = pokemonInput.trim();
    if (!v || pokemons.includes(v)) return;
    setPokemons([...pokemons, v]);
    setPokemonInput("");
  };

  const toggleCategory = (c: string) =>
    setCategories(categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ favorite_pokemons: pokemons, favorite_categories: categories })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Preferências salvas");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-8 max-w-xl">
      <section>
        <h3 className="text-sm font-semibold mb-3">Pokémons favoritos</h3>
        <div className="flex gap-2">
          <input
            value={pokemonInput}
            onChange={(e) => setPokemonInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPokemon(); } }}
            placeholder="Ex.: Charizard"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addPokemon}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Adicionar
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {pokemons.map((p) => (
            <span key={p} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
              {p}
              <button onClick={() => setPokemons(pokemons.filter((x) => x !== p))} aria-label="Remover">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {pokemons.length === 0 && <p className="text-xs text-muted-foreground">Nenhum ainda.</p>}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Categorias favoritas</h3>
        <div className="flex flex-wrap gap-2">
          {CARD_CATEGORIES.map((c) => {
            const active = categories.includes(c);
            return (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  active ? "bg-foreground text-background border-foreground" : "border-border hover:bg-secondary"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-foreground text-background px-5 py-2 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar preferências"}
      </button>
    </div>
  );
}
