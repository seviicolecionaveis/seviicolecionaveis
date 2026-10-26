import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({ meta: [
    { title: "Clientes — Admin" },
    { name: "description", content: "Cadastros e histórico dos clientes da Sevii Colecionáveis." },
  ] }),
  component: () => <Outlet />,
});
