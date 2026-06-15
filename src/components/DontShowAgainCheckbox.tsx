import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  className?: string;
};

export function DontShowAgainCheckbox({ checked, onCheckedChange, id = "dont-show-again", className = "" }: Props) {
  return (
    <label
      htmlFor={id}
      className={`mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground cursor-pointer select-none ${className}`}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
      Não mostrar novamente
    </label>
  );
}
