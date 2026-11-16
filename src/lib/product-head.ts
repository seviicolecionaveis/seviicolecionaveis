import { productCover,productSlug,productPrice,productStock,type StoreProduct } from '@/lib/product-catalog';
export function productHead(item:StoreProduct|undefined,kind:'accessory'|'sealed') {
 const label=kind==='accessory'?'Acessório':'Produto lacrado';const title=item?`${item.title} | Sevii Colecionáveis`:`${label} indisponível | Sevii Colecionáveis`;
 const desc=item?.description?.slice(0,160)||`${item?.title??label} — Sevii Colecionáveis.`;
 const meta:Array<Record<string,string>>=[{title},{name:'description',content:desc},{property:'og:title',content:title},{property:'og:description',content:desc},{property:'og:type',content:'product'},{name:'twitter:card',content:'summary_large_image'}];
 if(!item)return {meta:[...meta,{name:'robots',content:'noindex'}]};
 const url=`https://seviicolecionaveis.com.br/${kind==='accessory'?'acessorios':'produtos-lacrados'}/${productSlug(item)}`;
 meta.push({property:'og:url',content:url});const image=productCover(item);
 if(image?.startsWith('https://'))meta.push({property:'og:image',content:image},{name:'twitter:image',content:image});
 return {meta,links:[{rel:'canonical',href:url}],scripts:[{type:'application/ld+json',children:JSON.stringify({'@context':'https://schema.org','@type':'Product',name:item.title,description:desc,image:image?[image]:undefined,sku:item.sku??undefined,offers:{'@type':'Offer',priceCurrency:'BRL',price:(productPrice(item)/100).toFixed(2),availability:productStock(item)>0||item.is_preorder?'https://schema.org/InStock':'https://schema.org/OutOfStock',url}})}]};
}
