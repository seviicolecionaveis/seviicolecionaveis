/** Availability applies only to new choices; historical labels remain unchanged. */
export const ACTIVE_PICKUP_POINTS = ["aeroporto"] as const;

export function validatePickupPoint(point: string | null | undefined): string | null {
  if (point === "aeroporto") return null;
  return point === "aruana"
    ? "A retirada no Vista Aruana está desativada. Escolha o Aeroporto."
    : "Escolha o local da retirada: Aeroporto.";
}