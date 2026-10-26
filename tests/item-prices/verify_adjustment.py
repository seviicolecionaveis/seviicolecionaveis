"""Verify this one-off adjustment against before/after catalog exports.

Usage: python3 tests/item-prices/verify_adjustment.py before.json after.json
Exports must contain a rows array. No database writes are performed.
"""
import json
import sys

before = json.load(open(sys.argv[1]))['rows']
after = {row['id']: row for row in json.load(open(sys.argv[2]))['rows']}
assert set(after) == {row['id'] for row in before}, 'Catalog membership changed'

rules = [
    ('Normal', 1, 25, 25),
    ('Reverse Foil', 1, 25, 45),
    ('Normal', 26, 50, 49),
    ('Reverse Foil', 26, 50, 65),
]
for finish, low, high, target in rules:
    rows = [r for r in before if r['finish'] == finish and low <= r['base_price_cents'] <= high]
    assert rows, f'No data covering {finish} {low}-{high}'
    for row in rows:
        assert after[row['id']]['base_price_cents'] == target, row['id']
    print(f'PASS {finish} {low}-{high}: {len(rows)} cards at {target} cents')

boundary = [r for r in before if r['base_price_cents'] == 25]
assert boundary, 'No data covering exact 25-cent boundary'
for row in boundary:
    assert after[row['id']]['base_price_cents'] == (25 if row['finish'] == 'Normal' else 45)
print(f'PASS first-band inclusion of exactly 25 cents: {len(boundary)} cards')

review = [r for r in before if r['base_price_cents'] >= 51]
assert review, 'No review cards'
for row in review:
    assert after[row['id']] == row, f'Review card changed: {row["id"]}'
print(f'PASS review cards unchanged: {len(review)}')
for row in before:
    for field, value in row.items():
        if field != 'base_price_cents':
            assert after[row['id']][field] == value, f'{field} changed: {row["id"]}'
    if row['base_price_cents'] < 1:
        assert after[row['id']]['base_price_cents'] == row['base_price_cents']
print('PASS stock and other exported fields unchanged')