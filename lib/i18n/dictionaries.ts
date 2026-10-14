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
  // Homepage three-step explainer.
  howItWorks: {
    heading: "How it works",
    step1Title: "Paste a link",
    step1Body: "Copy a product page from a supported supermarket and drop it in above.",
    step2Title: "We read the label",
    step2Body: "Baloo pulls the full ingredient list, kept in the exact order it’s printed.",
    step3Title: "See it explained",
    step3Body: "What each ingredient is, why it’s in there, and whether it’s natural or processed.",
  },
  // Idle-homepage activity board.
  board: {
    heading: "On Baloo right now",
    subtitle: "What people are scanning — every scan quietly adds to the board.",
    recentlyScanned: "Recently scanned",
    last30: "last 30",
    emptyRecent: "Nothing scanned yet. Paste a link above and you’ll be first on the board.",
    topSupermarkets: "Top supermarkets",
    topCountries: "Top countries",
    topScanners: "Top scanners",
    topScannersNote: "Arrives with Baloo accounts — scan history and streaks.",
    comingSoon: "Coming soon",
    noScans: "No scans yet.",
    privacyNote: "Recorded at country level only — no personal data, no exact location.",
    justNow: "just now",
    ago: "{v} ago", // {v} is a compact span built in code, e.g. "5m", "3h", "2d"
  },
  footer: {
    disclaimer:
      "Baloo explains what’s in packaged food to help you understand labels — it isn’t medical or dietary advice, and never tells you what to buy or avoid.",
    prototype: "A prototype for the upcoming Baloo app.",
  },
  popular: {
    heading: "Popular lists this week",
    browseAll: "Browse all →",
  },
  loading: {
    readingLabel: "Reading ingredients…",
    readingSub: "Fetching the product page and finding the label.",
    analysingLabel: "Analysing with AI…",
    analysingSub: "Explaining each ingredient in plain language.",
  },
  email: {
    doneTitle: "You’re on the list.",
    doneSub: "We’ll be in touch when the app is ready.",
    heading: "Get early access to the Baloo app",
    body: "This is a prototype. Leave your email to be first to know when Baloo launches on iOS and Android.",
    ariaLabel: "Email address",
    notify: "Notify me",
    noSpam: "No spam. Unsubscribe anytime.",
  },
  // Search box (homepage + Discover). {n}/{name}/{q} are filled in code.
  search: {
    placeholder: "Search products and lists…",
    ariaLabel: "Search products and lists",
    resultOne: "result",
    resultMany: "results",
    listOne: "list",
    listMany: "lists",
    productOne: "product",
    productMany: "products",
    filterAll: "All",
    filterProducts: "Products",
    filterLists: "Lists",
    sectionLists: "Lists",
    sectionProducts: "Products",
    showMore: "Show {n} more",
    searching: "Searching…",
    analysing: "Analysing {name}…",
    analysingSub:
      "This takes a few seconds — we’re reading the label and explaining every ingredient.",
    offErr404: "That product has no ingredient list on Open Food Facts.",
    offErrGeneric: "We couldn’t analyse that right now. Please try again in a moment.",
    emptyTitle: "No matches for “{q}”.",
    emptyBody:
      "We couldn’t find it in our catalog or on Open Food Facts — try a more specific name or brand.",
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
  howItWorks: {
    heading: "Cómo funciona",
    step1Title: "Pega un enlace",
    step1Body: "Copia la página de un producto de un supermercado compatible y pégala arriba.",
    step2Title: "Leemos la etiqueta",
    step2Body: "Baloo extrae la lista completa de ingredientes, en el mismo orden en que está impresa.",
    step3Title: "Te lo explicamos",
    step3Body: "Qué es cada ingrediente, por qué está ahí y si es natural o procesado.",
  },
  board: {
    heading: "En Baloo ahora mismo",
    subtitle: "Lo que la gente está escaneando: cada escaneo se suma al tablón.",
    recentlyScanned: "Escaneado hace poco",
    last30: "últimos 30",
    emptyRecent: "Aún no hay escaneos. Pega un enlace arriba y serás el primero en el tablón.",
    topSupermarkets: "Supermercados destacados",
    topCountries: "Países destacados",
    topScanners: "Escáneres destacados",
    topScannersNote: "Llega con las cuentas de Baloo: historial de escaneos y rachas.",
    comingSoon: "Próximamente",
    noScans: "Aún no hay escaneos.",
    privacyNote: "Registrado solo a nivel de país: sin datos personales ni ubicación exacta.",
    justNow: "ahora mismo",
    ago: "hace {v}",
  },
  footer: {
    disclaimer:
      "Baloo explica qué hay en los alimentos envasados para ayudarte a entender las etiquetas; no es consejo médico ni dietético, y nunca te dice qué comprar o evitar.",
    prototype: "Un prototipo de la futura app de Baloo.",
  },
  popular: {
    heading: "Listas populares esta semana",
    browseAll: "Ver todas →",
  },
  loading: {
    readingLabel: "Leyendo ingredientes…",
    readingSub: "Abriendo la página del producto y buscando la etiqueta.",
    analysingLabel: "Analizando con IA…",
    analysingSub: "Explicando cada ingrediente en lenguaje claro.",
  },
  email: {
    doneTitle: "Ya estás en la lista.",
    doneSub: "Te avisaremos cuando la app esté lista.",
    heading: "Consigue acceso anticipado a la app de Baloo",
    body: "Esto es un prototipo. Déjanos tu correo para ser de los primeros en saber cuándo llega Baloo a iOS y Android.",
    ariaLabel: "Dirección de correo",
    notify: "Avísame",
    noSpam: "Sin spam. Cancela cuando quieras.",
  },
  search: {
    placeholder: "Busca productos y listas…",
    ariaLabel: "Busca productos y listas",
    resultOne: "resultado",
    resultMany: "resultados",
    listOne: "lista",
    listMany: "listas",
    productOne: "producto",
    productMany: "productos",
    filterAll: "Todo",
    filterProducts: "Productos",
    filterLists: "Listas",
    sectionLists: "Listas",
    sectionProducts: "Productos",
    showMore: "Ver {n} más",
    searching: "Buscando…",
    analysing: "Analizando {name}…",
    analysingSub: "Tarda unos segundos: estamos leyendo la etiqueta y explicando cada ingrediente.",
    offErr404: "Ese producto no tiene lista de ingredientes en Open Food Facts.",
    offErrGeneric: "No pudimos analizarlo ahora mismo. Inténtalo de nuevo en un momento.",
    emptyTitle: "Sin resultados para “{q}”.",
    emptyBody:
      "No lo encontramos en nuestro catálogo ni en Open Food Facts: prueba con un nombre o una marca más específicos.",
  },
};

export type Dictionary = typeof en;
const dictionaries: Record<Locale, Dictionary> = { en, es };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}
