import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function ArteEmCardsTermsDialog({ open, onAccept, onCancel }: Props) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (open) setChecked(false);
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Bloqueia fechar sem aceitar — só fecha via botões internos.
        if (!next) onCancel();
      }}
    >
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">🃏 Retirada na Arte em Cards</DialogTitle>
          <DialogDescription>
            Leia com atenção os termos antes de prosseguir com esta modalidade de retirada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm text-foreground">
          <p>
            Para facilitar a vida de quem faz várias compras durante a semana, teremos um sistema
            de retirada na Arte em Cards.
          </p>
          <p>A retirada possui uma taxa fixa de R$ 5,00.</p>
          <p>
            Esse valor refere-se ao transporte dos pedidos dos nossos pontos de coleta até a loja
            Arte em Cards, além da manutenção da caixa de correios exclusiva que disponibilizamos
            no local para armazenamento e organização dos pedidos dos nossos clientes.
          </p>
          <p>
            Após o pagamento da primeira retirada, você receberá um código exclusivo que permitirá
            realizar quantas compras desejar dentro do mesmo período semanal sem pagar novamente a
            taxa.
          </p>

          <div>
            <h3 className="font-semibold mb-1">📅 Como funciona a validade?</h3>
            <p>Os códigos funcionam em ciclos semanais fixos:</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li>Início: toda sexta-feira às 12h00.</li>
              <li>Encerramento: sexta-feira seguinte às 11h59.</li>
            </ul>
            <p className="mt-1">
              Durante esse período, basta informar seu código nas novas compras para não ser
              cobrado novamente.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-1">🚚 Envio dos pedidos para a Arte em Cards</h3>
            <p>
              Todos os pedidos solicitados para retirada na Arte em Cards até sexta-feira às 12h00
              serão transportados para a loja durante a tarde da própria sexta-feira.
            </p>
            <p className="mt-1">
              Após a chegada dos pedidos à Arte em Cards, os clientes terão até 30 dias corridos
              para realizar a retirada.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-1">📦 Como retirar seu pedido?</h3>
            <p>
              Ao chegar na Arte em Cards, procure um gerente ou colaborador da loja e informe:
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li>Número do pedido;</li>
              <li>Documento oficial com foto.</li>
            </ul>
            <p className="mt-1">
              Essa medida foi adotada para garantir a segurança dos clientes e evitar retiradas
              não autorizadas por terceiros.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-1">⚠️ Prazo máximo para retirada</h3>
            <p>Os pedidos permanecerão disponíveis para retirada por até 30 dias corridos.</p>
            <p className="mt-1">Caso o pedido não seja retirado dentro desse prazo:</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li>O pedido retornará para nossa posse.</li>
              <li>Entraremos em contato com o cliente.</li>
              <li>
                O cliente terá mais 7 dias corridos para escolher entre:
                <ul className="list-[circle] pl-5 mt-1 space-y-0.5">
                  <li>Retirada em mãos nos pontos de coleta disponíveis;</li>
                  <li>Envio por aplicativo de entrega (custos por conta do cliente).</li>
                </ul>
              </li>
            </ul>
            <p className="mt-1">
              Caso não haja retorno ou retirada dentro desse prazo adicional de 7 dias, será
              realizado um reembolso correspondente a 80% do valor pago pelo pedido, sendo os 20%
              restantes destinados à cobertura de custos operacionais, logística, armazenamento e
              processamento.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-1">📝 Exemplo</h3>
            <p>Você faz uma compra no sábado e paga os R$ 5,00 da retirada.</p>
            <p className="mt-1">
              Recebe um código exclusivo e poderá utilizá-lo em todas as compras feitas até a
              sexta-feira seguinte às 11h59, sem nova cobrança da taxa.
            </p>
            <p className="mt-1">
              Quando iniciar um novo ciclo semanal, será necessário gerar um novo código mediante
              o pagamento de uma nova taxa de R$ 5,00.
            </p>
          </div>

          <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
            <h3 className="font-semibold mb-1">⚠️ Importante:</h3>
            <ul className="list-disc pl-5 space-y-0.5 text-amber-900">
              <li>O código é pessoal e vinculado à conta do cliente.</li>
              <li>Não é possível compartilhar o código com outras pessoas.</li>
              <li>Compras sem um código válido terão a taxa de retirada cobrada normalmente.</li>
              <li>
                O prazo de retirada na Arte em Cards é de 30 dias corridos após a disponibilização
                do pedido na loja.
              </li>
            </ul>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-4 border-t bg-background px-6 py-4 space-y-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={checked}
              onCheckedChange={(c) => setChecked(c === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              Declaro que li e aceito integralmente os termos da retirada na Arte em Cards.
            </span>
          </label>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" disabled={!checked} onClick={onAccept}>
              Li e aceitei os termos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
