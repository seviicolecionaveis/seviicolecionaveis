import { parseVariants } from '@/lib/accessory-variants';
import type { StoreProduct } from '@/lib/product-catalog';
export function manualAccessoryRows(a:StoreProduct) {
 const vs=parseVariants(a.variants);
 return (vs.length?vs:[null]).map(v=>({cardId:`accessory:${a.id}${v?':'+v.id:''}`,name:a.title+(v?' — '+v.name:''),detail:'Acessório'+(a.sku?' · '+a.sku:''),priceCents:v?.price_cents??a.price_cents,stock:v?.stock??a.stock,image:v?.images[0]??a.images[0]??null,type:'accessory' as const}));
}
