import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { StoreProduct } from '@/lib/product-catalog';
export const listStoreProducts = createServerFn({method:'GET'})
 .inputValidator((data: {kind: 'accessory'|'sealed'})=>data)
 .handler(async ({data})=>{
 const key=process.env['SUPABASE_PUBLISHABLE_KEY']; const url=process.env['SUPABASE_URL'];
 if(!key||!url) throw new Error('Não foi possível carregar os produtos.');
 const db=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{
 const headers=new Headers(init?.headers); if(key.startsWith('sb_')&&headers.get('Authorization')===`Bearer ${key}`) headers.delete('Authorization'); headers.set('apikey',key); return fetch(input,{...init,headers});
 }}});
 const table=data.kind==='accessory'?'accessories':'sealed_products';
 const fields=data.kind==='accessory'?'id,title,description,price_cents,stock,images,slug,sku,tags,category,variants':'id,title,description,price_cents,stock,images,sku,is_preorder,release_date,product_type,collection,language,distribution,condition,age_rating';
 const {data:rows,error}=await db.from(table).select(fields).eq('active',true).order('sort_order').order('created_at',{ascending:false});
 if(error) throw new Error('Não foi possível carregar os produtos.');
 const {data:history}=data.kind==='accessory'?await db.from('accessory_slug_history').select('slug,accessory_id'):{data:[]};
 return {items:(rows??[]) as unknown as StoreProduct[],history:history??[]};
 });
