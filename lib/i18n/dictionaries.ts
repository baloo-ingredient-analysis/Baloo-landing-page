import type { Locale } from "./config";

// UI message catalog. Slice 1 covers the app shell (nav), the homepage, and common bits; more
// surfaces are added slice by slice. EN and ES stay in lockstep: `es` is typed `typeof en`, so a
// missing or mis-shaped key fails typecheck. No `as const` — these are display strings, never
// literal discriminants, so values widen to `string` and the Spanish text satisfies the shape.
// This is UI CHROME only — ingredient analysis content comes from the engine per locale, and
// user-generated content (list titles, comments) is shown as written.

const en = {
  nav: {
    following: "Following",
    discover: "Discover",
    lists: "Lists",
    admin: "Admin",
    home: "Baloo home",
    search: "Search",
  },
  lang: { label: "Language" },
  home: {
    title1: "Know what’s in ",
    titleYour: "your",
    title2: " food.",
    subtitle:
      "Search any product for a calm, plain-language breakdown of every ingredient — what it is, and why it’s there.",
    sample: "See a sample analysis →",
    tagline: "Free · No sign-up · No score, ever",
    newSearch: "New search",
    errorHelp: "Use New search above, or search for the product by name.",
    notConfigured: "The analyser isn’t configured yet — add API keys to .env.local.",
  },
  errors: {
    friendly:
      "We couldn’t read that page. Some store pages block automated reading, or don’t list ingredients — try a different product, or a link from another store.",
  },
};

const es: typeof en = {
  nav: {
    following: "Siguiendo",
    discover: "Descubrir",
    lists: "Listas",
    admin: "Admin",
    home: "Inicio de Baloo",
    search: "Buscar",
  },
  lang: { label: "Idioma" },
  home: {
    title1: "Descubre qué hay en ",
    titleYour: "tu",
    title2: " comida.",
    subtitle:
      "Busca cualquier producto y obtén una explicación clara y tranquila de cada ingrediente: qué es y por qué está ahí.",
    sample: "Ver un análisis de ejemplo →",
    tagline: "Gratis · Sin registro · Sin puntuación, nunca",
    newSearch: "Nueva búsqueda",
    errorHelp: "Usa Nueva búsqueda arriba, o busca el producto por su nombre.",
    notConfigured: "El analizador aún no está configurado — añade las claves API a .env.local.",
  },
  errors: {
    friendly:
      "No pudimos leer esa página. Algunas páginas de tiendas bloquean la lectura automática o no listan los ingredientes: prueba con otro producto o con un enlace de otra tienda.",
  },
};

export type Dictionary = typeof en;
const dictionaries: Record<Locale, Dictionary> = { en, es };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}
