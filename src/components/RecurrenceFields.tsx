import { Repeat } from "lucide-react";
import {
  FREQUENCY_LABELS,
  WEEKDAY_LABELS,
  firstOccurrence,
  nextOccurrence,
  repeatToRule,
  type RecurrenceDayMode,
  type RecurrenceFrequency,
  type RepeatForm,
} from "@/lib/taskRecurrence";

const UNIT: Record<RecurrenceFrequency, [string, string]> = {
  semanal: ["semana", "semanas"],
  mensal: ["mês", "meses"],
  trimestral: ["trimestre", "trimestres"],
  anual: ["ano", "anos"],
};

const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-PT");

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring";

interface Props {
  value: RepeatForm;
  onChange: (next: RepeatForm) => void;
  /** Data de referência da série (o prazo da 1.ª ocorrência). */
  startDate: string;
  /** Esconde a opção "Não repete" (edição de uma série existente). */
  required?: boolean;
}

/** Campos «Repetir» (frequência, intervalo, dia, data de fim) + pré-visualização das próximas datas. */
const RecurrenceFields = ({ value, onChange, startDate, required }: Props) => {
  const set = <K extends keyof RepeatForm>(k: K, v: RepeatForm[K]) => onChange({ ...value, [k]: v });
  const rule = startDate ? repeatToRule(value, startDate) : null;

  const preview: string[] = [];
  if (rule) {
    let d = firstOccurrence(rule);
    while (d && preview.length < 3) {
      preview.push(d);
      d = nextOccurrence(rule, d);
    }
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5" /> Repetir
          </label>
          <select value={value.frequency} onChange={(e) => set("frequency", e.target.value as RepeatForm["frequency"])} className={inputCls}>
            {!required && <option value="nao">Não repete</option>}
            {(Object.keys(FREQUENCY_LABELS) as RecurrenceFrequency[]).map((f) => (
              <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
            ))}
          </select>
        </div>
        {value.frequency !== "nao" && (
          <div>
            <label className="text-sm font-medium mb-1 block">A cada</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={52}
                value={value.interval}
                onChange={(e) => set("interval", Math.max(1, Number(e.target.value) || 1))}
                className={`${inputCls} w-20`}
              />
              <span className="text-sm text-muted-foreground">{UNIT[value.frequency][value.interval === 1 ? 0 : 1]}</span>
            </div>
          </div>
        )}
      </div>

      {value.frequency !== "nao" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {value.frequency === "semanal" ? (
              <div>
                <label className="text-sm font-medium mb-1 block">Dia da semana</label>
                <select value={value.weekday} onChange={(e) => set("weekday", Number(e.target.value))} className={inputCls}>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{WEEKDAY_LABELS[d]}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium mb-1 block">Dia</label>
                <div className="flex items-center gap-2">
                  <select value={value.day_mode} onChange={(e) => set("day_mode", e.target.value as RecurrenceDayMode)} className={inputCls}>
                    <option value="dia">Dia do mês</option>
                    <option value="ultimo_dia_util">Último dia útil</option>
                    <option value="ultimo_dia">Último dia do mês</option>
                  </select>
                  {value.day_mode === "dia" && (
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={value.day_of_month}
                      onChange={(e) => set("day_of_month", Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                      className={`${inputCls} w-20`}
                    />
                  )}
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">Termina em <span className="text-muted-foreground font-normal">(opcional)</span></label>
              <input type="date" value={value.end_date} min={startDate} onChange={(e) => set("end_date", e.target.value)} className={inputCls} />
            </div>
          </div>
          {preview.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Próximas datas: {preview.map(fmt).join(", ")}…
              {value.frequency !== "semanal" && value.day_mode === "dia" && value.day_of_month > 28 && " (nos meses mais curtos usa o último dia)"}
            </p>
          ) : (
            <p className="text-xs text-destructive">A data de fim é anterior à primeira ocorrência.</p>
          )}
        </>
      )}
    </div>
  );
};

export default RecurrenceFields;
