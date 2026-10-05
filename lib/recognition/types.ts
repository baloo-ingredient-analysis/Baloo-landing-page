// Shapes the recognition engine (Igor's partner API, docs/PARTNER_RECOGNITION_API.md) returns. We
// type only the fields the web consumes; everything is optional/defensive because this is an external
// service we don't control and the contract is still evolving (1 Oct 2026: nutrition + product_summary
// were just added). The adapter (./adapt) turns these into our own lib/schema shapes.

export type EngineProcessingTag = "natural" | "processed" | "artificial";

export type EngineIngredient = {
  id?: string;
  profile_item_id?: string;
  canonical_name: string;
  rank?: number;
  percent?: number | null;
  percent_type?: "stated" | "estimated" | null;
  percent_basis?: "product" | "parent" | null;
  processing_tag?: EngineProcessingTag | string;
  general_explanation?: string | null; // → our what_it_is (product-independent)
  product_context?: string | null; // → our why_its_here (product-specific)
  significance_note?: string | null; // → our percentage_note
  role_tags?: string[];
  original_name?: string;
  attributes?: string[];
  component_of_item_id?: string | null;
};

export type EngineNutrient = {
  id: string;
  amount: number | null;
  unit: string;
  reference?: number;
  percent?: number;
  kind?: string;
};

export type EngineDailyReference = {
  standard?: string;
  name?: string;
  basis?: string;
  basis_label?: string;
  context?: string;
  nutrients?: EngineNutrient[];
};

// The nutrition panel is a FLAT object (one field per nutrient) plus the derived reference-intake block.
export type EngineNutrition = {
  amount_basis?: "100g" | "100ml" | "serving";
  energy_kcal?: number | null;
  fat_g?: number | null;
  saturates_g?: number | null;
  carbohydrate_g?: number | null;
  sugars_g?: number | null;
  fibre_g?: number | null;
  protein_g?: number | null;
  salt_g?: number | null;
  daily_reference?: EngineDailyReference | null;
  context_interpretation?: string | null;
};

export type ExplainResponse = {
  variant_id?: string;
  display_name?: string;
  brand?: string;
  category?: string;
  profile_id?: string;
  product_summary?: string | null;
  nutrition?: EngineNutrition | null;
  ingredients?: EngineIngredient[];
};

export type FindCandidate = {
  variant_id: string;
  display_name?: string;
  brand?: string;
  confidence?: number;
  size_value?: number;
  size_unit?: string;
  has_ingredients?: boolean;
};

export type FindResponse =
  | { status: "found"; variant_id: string; display_name?: string; brand?: string; category?: string; size_value?: number; size_unit?: string }
  | { status: "disambiguation"; display_name?: string; brand?: string; candidates?: FindCandidate[] }
  | { status: "not_found"; fallback?: string; message?: string; brand?: string; display_name?: string };
