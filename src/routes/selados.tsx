import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/selados")({
  beforeLoad: () => {
    throw redirect({ to: "/produtos-lacrados", replace: true });
  },
  component: () => null,
});
