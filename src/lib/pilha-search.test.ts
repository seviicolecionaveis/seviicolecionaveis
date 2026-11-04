import { describe, expect, it } from "vitest";
import {
  normalizeSearchText,
  serviceOrderMatchesSearch,
  stackMatchesSearch,
} from "./pilha-search";

const order = {
  id: "3f2a1b9c-1111-2222-3333-444455556666",
  code: 1042,
  customer_name: "João da Silva",
  customer_email: "Joao@Example.com",
  phone: "(79) 99988-7766",
  items: [
    { card_name: "Charizard ex", order_id: "aabbccdd-0000-0000-0000-000000000001" },
    { card_name: "Pikachu", order_id: null },
  ],
};

const stack = {
  id: "9z8y7x6w-aaaa-bbbb-cccc-dddddddddddd",
  customer_name: "Maria José",
  customer_email: "maria@teste.com",
  items: [{ card_name: "Mewtwo VMAX", order_id: "ffee0011-2222-3333-4444-555566667777" }],
};

describe("normalizeSearchText", () => {
  it("ignora acentos e maiúsculas", () => {
    expect(normalizeSearchText("  João ÉÇÃO ")).toBe("joao ecao");
  });
});

describe("serviceOrderMatchesSearch", () => {
  it("busca vazia retorna tudo", () => {
    expect(serviceOrderMatchesSearch(order, "")).toBe(true);
    expect(serviceOrderMatchesSearch(order, "   ")).toBe(true);
  });

  it("encontra por nº da OS com ou sem #", () => {
    expect(serviceOrderMatchesSearch(order, "1042")).toBe(true);
    expect(serviceOrderMatchesSearch(order, "#1042")).toBe(true);
    expect(serviceOrderMatchesSearch(order, "#10")).toBe(true);
    expect(serviceOrderMatchesSearch(order, "4321")).toBe(false);
  });

  it("encontra por ID do pedido completo ou parcial", () => {
    expect(serviceOrderMatchesSearch(order, "3f2a1b9c-1111-2222-3333-444455556666")).toBe(true);
    expect(serviceOrderMatchesSearch(order, "3f2a1b9c")).toBe(true);
    expect(serviceOrderMatchesSearch(order, "aabbccdd")).toBe(true);
  });

  it("encontra por nome e e-mail ignorando acentos e caixa", () => {
    expect(serviceOrderMatchesSearch(order, "joao")).toBe(true);
    expect(serviceOrderMatchesSearch(order, "SILVA")).toBe(true);
    expect(serviceOrderMatchesSearch(order, "joao@example.com")).toBe(true);
  });

  it("encontra por telefone com ou sem formatação", () => {
    expect(serviceOrderMatchesSearch(order, "79999887766")).toBe(true);
    expect(serviceOrderMatchesSearch(order, "(79) 99988")).toBe(true);
  });

  it("encontra por nome da carta na pilha", () => {
    expect(serviceOrderMatchesSearch(order, "charizard")).toBe(true);
    expect(serviceOrderMatchesSearch(order, "pikachu")).toBe(true);
    expect(serviceOrderMatchesSearch(order, "lugia")).toBe(false);
  });
});

describe("stackMatchesSearch", () => {
  it("encontra por nome, e-mail, carta e ID do pedido", () => {
    expect(stackMatchesSearch(stack, "maria jose")).toBe(true);
    expect(stackMatchesSearch(stack, "MARIA@TESTE")).toBe(true);
    expect(stackMatchesSearch(stack, "mewtwo")).toBe(true);
    expect(stackMatchesSearch(stack, "ffee0011")).toBe(true);
    expect(stackMatchesSearch(stack, "carlos")).toBe(false);
  });
});
