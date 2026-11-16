"""Run only against disposable fixture DB on the explicit local socket."""
import concurrent.futures, subprocess
base=['psql','-h','/tmp/accessory-pg','-p','55439','-U','nobody','-d','postgres','-v','ON_ERROR_STOP=1','-Atc']
def sql(q): return subprocess.run(base+[q],capture_output=True,text=True)
def check(q):
 r=sql(q)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout.strip()
check("INSERT INTO accessories(id,title,stock) VALUES('00000000-0000-0000-0000-000000000004','Última unidade',1); INSERT INTO orders(id) VALUES('00000000-0000-0000-0000-000000000014'),('00000000-0000-0000-0000-000000000015'); INSERT INTO order_items(order_id,card_id,quantity) VALUES('00000000-0000-0000-0000-000000000014','accessory:00000000-0000-0000-0000-000000000004',1),('00000000-0000-0000-0000-000000000015','accessory:00000000-0000-0000-0000-000000000004',1)")
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 results=list(pool.map(lambda i:sql(f"SELECT accessory_reserve_order('00000000-0000-0000-0000-0000000000{i}',now()+interval '1 hour')"),[14,15]))
assert sum(r.returncode==0 for r in results)==1, 'exactly one last-unit reservation must succeed'
assert check("SELECT sum(quantity) FROM accessory_stock_reservations WHERE accessory_id='00000000-0000-0000-0000-000000000004'")=='1'
print('Concurrent last-unit reservations: exactly one accepted')
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 results=list(pool.map(lambda i:sql(f"SELECT accessory_decrement_order('00000000-0000-0000-0000-0000000000{i}')"),[14,15]))
assert sum(r.returncode==0 for r in results)==1
assert check("SELECT stock FROM accessories WHERE id='00000000-0000-0000-0000-000000000004'")=='0'
print('Concurrent last-unit purchases: exactly one accepted; stock zero')
