import { describe,it,expect } from 'vitest';
import { creditAllocation,originalAllocation,confirmedRefund,validateRefundAmount,REFUND_LINK_DAYS } from './customer-finance';
describe('Saldo financeiro',()=>{
  it('cobre o total sem cobrança externa',()=>expect(creditAllocation(10000,10000,10000)).toEqual({creditCents:10000,providerCents:0}));
  it('cobra somente a diferença',()=>expect(creditAllocation(10000,3000,3000)).toEqual({creditCents:3000,providerCents:7000}));
  it('impede saldo insuficiente',()=>expect(()=>creditAllocation(10000,3000,3001)).toThrow());
  it('não transforma contribuição em desconto nem excede o pedido',()=>expect(()=>creditAllocation(10000,20000,10001)).toThrow());
  it('não aceita fração de centavo',()=>expect(()=>creditAllocation(10000,3000,0.5)).toThrow());
  it('link dura sete dias',()=>expect(REFUND_LINK_DAYS).toBe(7));
  it('parcial misto preserva origens',()=>expect(originalAllocation(5000,10000,3000,3000,7000)).toEqual({creditCents:1500,providerCents:3500}));
  it('última parcela absorve arredondamento',()=>expect(originalAllocation(1,3,1,1,0)).toEqual({creditCents:1,providerCents:0}));
  it('não converte saldo em dinheiro',()=>expect(originalAllocation(3000,3000,3000,3000,0)).toEqual({creditCents:3000,providerCents:0}));
  it('limita reembolso às origens remanescentes',()=>expect(()=>originalAllocation(5001,10000,3000,1500,3500)).toThrow());
  it.each([0,-1,1.5])('reembolso %s não chega ao provedor',n=>expect(()=>validateRefundAmount(n)).toThrow());
  it('processamento pendente não é confirmação',()=>expect(confirmedRefund({id:123,amount:50,status:'pending'},5000)).toBe(false));
  it('valor divergente não conclui',()=>expect(confirmedRefund({id:123,amount:49,status:'approved'},5000)).toBe(false));
  it('estorno específico aprovado e exato pode concluir',()=>expect(confirmedRefund({id:123,amount:50,status:'approved'},5000)).toBe(true));
});