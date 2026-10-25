import {beforeEach,describe,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({attempts:[] as Array<Record<string,unknown>>,remote:vi.fn(),paid:vi.fn(),rpc:vi.fn(),queryError:false}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{
  from:(table:string)=>({select:()=>({
    eq:()=>({single:async()=>({data:{status:'pending'},error:null}),in:()=>({maybeSingle:async()=>({data:m.attempts[0]??null,error:m.queryError?{message:'unavailable'}:null})})}),
    in:()=>({order:()=>({limit:async()=>({data:m.attempts,error:null})})}),
  })}),rpc:m.rpc,
}}));
vi.mock('./orders.server',()=>({markOrderPaid:m.paid}));
vi.mock('./mercadopago.server',()=>({getPixPayment:m.remote}));
vi.mock('./email/send.server',()=>({sendTransactionalEmailSafe:vi.fn()}));
import {reconcileCreditPayments,releaseStoreCreditIfTerminal} from './customer-finance.server';
describe('recuperação de pagamentos com saldo',()=>{
 beforeEach(()=>{vi.clearAllMocks();m.queryError=false;m.attempts=[];m.rpc.mockResolvedValue({error:null});});
 it('repete a finalização de saldo total sem criar cobrança externa',async()=>{
  m.attempts=[{id:'attempt',order_id:'order',provider:'credit',status:'approved'}];
  expect(await reconcileCreditPayments()).toEqual({recovered:1,released:0,unresolved:0});
  expect(m.paid).toHaveBeenCalledWith('order');expect(m.remote).not.toHaveBeenCalled();
 });
 it('recupera aprovação do pagamento complementar com sua referência',async()=>{
  m.attempts=[{id:'attempt',order_id:'order',provider:'mercadopago',provider_id:'123',status:'pending'}];m.remote.mockResolvedValue({status:'approved'});
  expect((await reconcileCreditPayments()).recovered).toBe(1);expect(m.paid).toHaveBeenCalledWith('order',{mercadopagoPaymentId:'123'});
 });
 it('mantém reserva quando a criação externa tem resultado desconhecido',async()=>{
  m.attempts=[{id:'attempt',order_id:'order',provider:'mercadopago',provider_id:null,status:'reserved'}];
  expect((await reconcileCreditPayments()).unresolved).toBe(1);expect(m.rpc).not.toHaveBeenCalled();expect(m.paid).not.toHaveBeenCalled();
 });
 it('não libera tentativa já aprovada',async()=>{
  m.attempts=[{id:'attempt',status:'approved'}];expect(await releaseStoreCreditIfTerminal('order')).toBe(false);expect(m.rpc).not.toHaveBeenCalled();
 });
 it('falha fechada quando a consulta da reserva falha',async()=>{
  m.queryError=true;await expect(releaseStoreCreditIfTerminal('order')).rejects.toThrow('Nenhuma'.toLowerCase());expect(m.rpc).not.toHaveBeenCalled();
 });
});