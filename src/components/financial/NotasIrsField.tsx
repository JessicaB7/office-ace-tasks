import { Textarea } from "@/components/ui/textarea";

/** Notas IRS (TI RS / TI CO): campo interno, não é renderizado durante a exportação do PDF. */
export function NotasIrsField({
  value,
  disabled,
  onSave,
  className,
}: {
  value: string | null | undefined;
  disabled?: boolean;
  onSave: (v: string | null) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-sm font-medium mb-1">Notas IRS</div>
      <p className="text-[11px] text-muted-foreground mb-2">
        Notas internas (não aparecem no PDF exportado). Gravam ao sair do campo.
      </p>
      <Textarea
        key={value ?? ""}
        defaultValue={value ?? ""}
        disabled={disabled}
        placeholder="Ex.: dependentes, despesas de saúde e educação, rendimentos de outras categorias…"
        className="min-h-[70px] text-sm resize-y"
        onBlur={(e) => {
          const v = e.target.value.trim() || null;
          if (v !== (value ?? null)) onSave(v);
        }}
      />
    </div>
  );
}
