import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { groupLabel } from "@/lib/fulfillment-groups";

export function FulfillmentGroupBadge({ order, count, onClick }: { order: any; count: number; onClick: () => void }) {
  if (!order.fulfillment_group_id || count < 2) return null;
  return <Button variant="secondary" size="sm" className="h-6 text-xs" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}><Package className="h-3 w-3" />{groupLabel(order, order.fulfillment_data?.service_code)} · {count}</Button>;
}