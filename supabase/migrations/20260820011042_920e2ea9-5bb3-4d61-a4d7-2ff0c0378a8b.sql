update public.cards set stock = stock + 1 where id = '76e7be38-568f-44dc-9b43-25ef71d38095';
update public.order_items set cancelled_quantity = quantity, cancelled_at = now() where order_id = '68aa4e86-fa2b-4cf5-8626-c8ab977597cc';
update public.orders set status = 'cancelled', stock_decremented = false, updated_at = now() where id = '68aa4e86-fa2b-4cf5-8626-c8ab977597cc';
delete from public.stock_reservations where order_id = '68aa4e86-fa2b-4cf5-8626-c8ab977597cc';