import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_CATALOG,
  MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS,
  getMichaelResponseCatalogEntry,
  selectMichaelResponseCatalogEntry,
  selectionRequestForCatalogKey,
  validateMichaelResponseContract,
} from '../index.js';

// S2.18 — Selector <-> catalog parity. The selector is a pure, returned-only
// mapper over MICHAEL_RESPONSE_CATALOG: it must reach every entry, point at no
// phantom keys, return the catalog fixture object verbatim (no copy/mutation),
// and never mutate the catalog. All assertions use the 12 pre-authored fixtures.

describe('S2.18 Michael response catalog <-> selector parity', () => {
  it('#1 every catalog entry is selectable by its own metadata (byte-identical response)', () => {
    expect(MICHAEL_RESPONSE_CATALOG.length).toBe(12);

    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      const request = selectionRequestForCatalogKey(entry.catalogKey);
      expect(request, `request for ${entry.catalogKey}`).toBeDefined();

      const result = selectMichaelResponseCatalogEntry(request!);
      expect(result.ok, `selection for ${entry.catalogKey}`).toBe(true);
      if (!result.ok) continue;

      expect(result.catalogKey).toBe(entry.catalogKey);
      // Reference equality: the selector returns the same fixture object.
      expect(result.response).toBe(entry.response);
      expect(result.entry).toBe(entry);
    }
  });

  it('#2 no selectable key maps to a non-existent catalog entry', () => {
    expect(MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS.length).toBe(12);

    for (const key of MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS) {
      const entry = getMichaelResponseCatalogEntry(key);
      expect(entry, `catalog entry for selectable key ${key}`).toBeDefined();
    }
  });

  it('#3 no catalog entry is unreachable — selectable keys equal catalog keys', () => {
    const catalogKeys = [...MICHAEL_RESPONSE_CATALOG.map((entry) => entry.catalogKey)].sort();
    const selectableKeys = [...MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS].sort();

    expect(selectableKeys).toEqual(catalogKeys);

    // Set-equality both directions, in case of accidental duplicates.
    expect(new Set(selectableKeys).size).toBe(catalogKeys.length);
    for (const key of catalogKeys) {
      expect(selectableKeys).toContain(key);
    }
  });

  it('#4 selector output is byte-identical to the catalog entry response (no copy/mutation)', () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      const result = selectMichaelResponseCatalogEntry(selectionRequestForCatalogKey(entry.catalogKey)!);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;

      // Same object reference — the selector never clones or edits the fixture.
      expect(result.response).toBe(entry.response);
      expect(Object.is(result.response, entry.response)).toBe(true);
    }
  });

  it('#5 every selected entry validates with the response contract validator', () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      const result = selectMichaelResponseCatalogEntry(selectionRequestForCatalogKey(entry.catalogKey)!);
      expect(result.ok, `selection for ${entry.catalogKey}`).toBe(true);
      if (!result.ok) continue;

      const validation = validateMichaelResponseContract(result.response);
      expect(validation.ok, `contract validation for ${entry.catalogKey}`).toBe(true);
    }
  });

  it('#17 (shared) running all selections never mutates the catalog', () => {
    const before = JSON.stringify(MICHAEL_RESPONSE_CATALOG);

    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      const request = selectionRequestForCatalogKey(entry.catalogKey);
      expect(request).toBeDefined();
      selectMichaelResponseCatalogEntry(request!);
    }

    const after = JSON.stringify(MICHAEL_RESPONSE_CATALOG);
    expect(after).toBe(before);
  });
});
