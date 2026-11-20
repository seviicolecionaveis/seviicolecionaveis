"""Verify the one-off supporter adjustment using original and persisted exports.

Usage: python3 tests/item-prices/verify_supporter_adjustment.py before.json after.json [concurrent-stock.json]
Optional stock exceptions must come from the database's timestamped stock audit.
No database writes or permanent catalog pricing rules are introduced.
"""
import json
import sys

before = json.load(open(sys.argv[1]))['rows']
after = {r['id']: r for r in json.load(open(sys.argv[2]))['rows']}
stock_audit = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
assert set(after) == {r['id'] for r in before}, 'Catalog membership changed'

for finish, low, high, target in [
    ('Normal', 1, 25, 25),
    ('Reverse Foil', 1, 25, 45),
    ('Normal', 26, 50, 49),
    ('Reverse Foil', 26, 50, 65),
]:
    rows = [r for r in before if r['subcategory'] == 'Apoiador'
            and r['finish'] == finish and low <= r['price'] <= high]
    assert rows, f'Missing coverage for {finish} {low}-{high}'
    for r in rows:
        assert after[r['id']]['price'] == target, r['id']
    print(f'PASS {finish} {low}-{high}: {len(rows)} at {target} cents')

boundary = [r for r in before if r['subcategory'] == 'Apoiador' and r['price'] == 25]
assert boundary, 'Missing 25-cent boundary coverage'
for r in boundary:
    assert after[r['id']]['price'] == (25 if r['finish'] == 'Normal' else 45)
print(f'PASS 25 cents belongs to first band: {len(boundary)}')

items = [r for r in before if r['subcategory'] == 'Item' and r['price'] >= 51]
assert items, 'Missing Item review coverage'
for r in items:
    assert after[r['id']] == r, f'Item changed: {r["id"]}'
print(f'PASS Item review records unchanged: {len(items)}')

for r in before:
    for field, value in r.items():
        if field != 'price':
            if field == 'stock' and r['id'] in stock_audit:
                audit = stock_audit[r['id']]
                assert audit['previous_stock'] == value
                assert audit['new_stock'] == after[r['id']][field]
                assert audit['changed_at'] and audit['changed_by'] and audit['id']
                continue
            assert after[r['id']][field] == value, f'{field} changed: {r["id"]}'
print(f'PASS other fields unchanged; {len(stock_audit)} independently audited concurrent stock edits')