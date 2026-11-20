"""Validate the one-off 66–98-cent trainer adjustment against persisted exports.

Usage: python3 tests/item-prices/verify_trainer_099.py before.json after.json [stock-audit.json]
Optional concurrent stock edits must be supported by the database stock audit.
"""
import json
import sys

before = json.load(open(sys.argv[1]))['rows']
after = {r['id']: r for r in json.load(open(sys.argv[2]))['rows']}
stock_audit = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
assert set(after) == {r['id'] for r in before}, 'Catalog membership changed'
finishes = {'Normal', 'Reverse Foil', 'Foil', 'Shattered Holo'}
for subtype in ['Apoiador', 'Item', 'Ferramenta Pokémon', 'Estádio']:
    matched = [r for r in before if r['subcategory'] == subtype
               and r['finish'] in finishes and r['price'] is not None
               and 66 <= r['price'] <= 98]
    assert matched, f'Missing concrete coverage: {subtype}'
    for r in matched:
        assert after[r['id']]['price'] == 99, r['id']
    print(f'PASS {subtype}: {len(matched)} at 99 cents')

untouched = 0
for r in before:
    eligible = r['finish'] in finishes and r['price'] is not None and 66 <= r['price'] <= 98
    if not eligible:
        assert after[r['id']]['price'] == r['price'], f'Out-of-scope price changed: {r["id"]}'
        untouched += 1
    for field, value in r.items():
        if field == 'price':
            continue
        if field == 'stock' and r['id'] in stock_audit:
            audit = stock_audit[r['id']]
            assert audit['previous_stock'] == value and audit['new_stock'] == after[r['id']][field]
            assert audit['id'] and audit['changed_at'] and audit['changed_by']
            continue
        assert after[r['id']][field] == value, f'{field} changed: {r["id"]}'
print(f'PASS {untouched} out-of-scope prices unchanged; {len(stock_audit)} audited concurrent stock edits')