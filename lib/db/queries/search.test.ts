import { describe, it, expect } from "vitest";
import { fuseByRank } from "./search";
import type { Product } from "../schema";

// fuseByRank only reads `.id`; a bare object is enough for the ranking behaviour under test.
const p = (id: string) => ({ id }) as unknown as Product;
const ids = (rows: Product[]) => rows.map((r) => r.id);

describe("fuseByRank (reciprocal-rank fusion of keyword + semantic hits)", () => {
  it("preserves order when given a single list (keyword-only fallback path)", () => {
    expect(ids(fuseByRank([[p("a"), p("b"), p("c")]]))).toEqual(["a", "b", "c"]);
  });

  it("surfaces a semantic-only hit that keyword search would miss (the point of hybrid)", () => {
    const keyword = [p("k1"), p("k2")];
    const semantic = [p("semantic-only"), p("k1")];
    expect(ids(fuseByRank([keyword, semantic]))).toContain("semantic-only");
  });

  it("rewards agreement — an item ranked well in both lists rises to the top", () => {
    const keyword = [p("agree"), p("k2"), p("k3")];
    const semantic = [p("agree"), p("s2"), p("s3")];
    expect(ids(fuseByRank([keyword, semantic]))[0]).toBe("agree");
  });

  it("dedupes across lists (one row per id)", () => {
    const out = ids(fuseByRank([[p("a"), p("b")], [p("b"), p("a")]]));
    expect(out.sort()).toEqual(["a", "b"]);
    expect(out.length).toBe(2);
  });

  it("handles empty lists (semantic disabled)", () => {
    expect(ids(fuseByRank([[p("a"), p("b")], []]))).toEqual(["a", "b"]);
    expect(fuseByRank([[], []])).toEqual([]);
  });
});
