import { useState, useMemo } from "react";
import { useTasks, useDeadlineOverrides, useSetDeadlineOverride } from "@/hooks/useSupabaseQuery";
import { CATEGORY_LABELS, type TaskCategory, type TaskStatus, type TaskPriority } from "@/types/database";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Plus, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import TaskFormDialog from "./TaskFormDialog";
import { parcelasDevidasEm } from "@/lib/ivaFlex";
import { useAuth } from "@/hooks/useAuth";
import { DEADLINE_KEYS as K, makeDayResolver, type DayResolver } from "@/lib/deadlineOverrides";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const categoryColors: Record<TaskCategory, string> = {
  IRS: "bg-blue-500",
  IRC: "bg-purple-500",
  IVA: "bg-emerald-500",
  SS: "bg-orange-500",
  contabilidade: "bg-cyan-500",
  SAFT: "bg-indigo-500",
  salarios: "bg-pink-500",
  DMR: "bg-rose-500",
  SS_TI: "bg-amber-500",
  retencao_fonte: "bg-teal-500",
  emissao_faturas: "bg-lime-500",
  fiscal: "bg-rose-500",
  outro: "bg-gray-500",
};

interface FiscalDeadline {
  key?: string;
  title: string;
  day: number;
  months: number[] | null;
  refType?: "month" | "quarter";
  overrides?: Record<number, number>;
}

// Quarter mapping
const QUARTER_REF: Record<number, string> = {
  1: "4ºT", 4: "1ºT", 7: "2ºT", 10: "3ºT",
};

const FISCAL_DEADLINES: FiscalDeadline[] = [
  { key: K.SAFT, title: "SAFT", day: 5, months: null, overrides: { 4: 8 } },
  { key: K.DMR_AT_GUIA, title: "DMR AT - Guia", day: 10, months: null },
  { key: K.DMR_SS_GUIA, title: "DMR SS - Guia", day: 10, months: null },
  { key: K.DMR_AT_PAG, title: "DMR AT - Pagamento", day: 20, months: null },
  { key: K.DMR_SS_PAG, title: "DMR SS - Pagamento", day: 25, months: null },
  { key: K.IVA_MENSAL, title: "IVA Periódica Mensal", day: 20, months: null, refType: "month" },
  { key: K.RECAP_MENSAL, title: "Recapitulativa Mensal", day: 20, months: null, refType: "month" },
  { key: K.IVA_TRIMESTRAL, title: "IVA Periódica Trimestral", day: 20, months: [2, 5, 8, 11] },
  { key: K.RECAP_TRIMESTRAL, title: "Recapitulativa Trimestral", day: 20, months: [1, 4, 7, 10], refType: "quarter" },
  { key: K.RETENCAO, title: "Retenção na Fonte", day: 20, months: null },
  { key: K.SS_TI_PAG, title: "SS TI - Pagamento", day: 20, months: null },
  { key: K.SALARIOS_PROC, title: "Salários - Processamento", day: 25, months: null },
  // Último dia do mês (30 em abril)
  { key: K.SS_TI_DT, title: "SS TI - Declaração Trimestral", day: 31, months: [1, 4, 7, 10] },
  { key: K.PEDIR_DOC, title: "Pedir documentação clientes", day: 15, months: null },
  { key: K.IVA_OSS, title: "IVA OSS", day: 15, months: [1, 4, 7, 10], refType: "quarter" },
];

type CalendarDeadline = { day: number; title: string; key?: string; defaultDay?: number };

const getFridaysInMonth = (year: number, monthIndex: number): number[] => {
  const fridays: number[] = [];
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, monthIndex, d).getDay() === 5) fridays.push(d);
  }
  return fridays;
};

const getDeadlinesForMonth = (monthIndex: number, daysInMonth: number, year: number, dayFor: DayResolver) => {
  const month1 = monthIndex + 1;
  const result: CalendarDeadline[] = [];
  FISCAL_DEADLINES.forEach((dl) => {
    if (dl.months === null || dl.months.includes(month1)) {
      const defaultDay = Math.min(dl.overrides?.[month1] ?? dl.day, daysInMonth);
      const day = dl.key ? dayFor(dl.key, year, monthIndex, defaultDay) : defaultDay;
      let title = dl.title;
      if (dl.refType === "month") {
        const refMonthIdx = (monthIndex - 2 + 12) % 12;
        title = `${dl.title} (${MONTH_NAMES_SHORT[refMonthIdx]})`;
      } else if (dl.refType === "quarter") {
        title = `${dl.title} (${QUARTER_REF[month1] || ""})`;
      }
      result.push({ day, title, key: dl.key, defaultDay });
    }
  });
  // IVA Flexibilização: parcelas que vencem no mês (dia 25)
  parcelasDevidasEm(year, monthIndex).forEach((p) => {
    const [qy, qm] = p.quarterEndMonth.split("-").map(Number);
    const quarter = `${Math.ceil(qm / 3)}ºT${qy !== year ? ` ${qy}` : ""}`;
    result.push({ day: Math.min(25, daysInMonth), title: `IVA Flexibilização - Parcela ${p.parcela}/${p.totalParcelas} (${quarter})` });
  });
  // Salários - Envio on last day of month
  result.push({ day: daysInMonth, title: "Salários - Envio" });
  // Weekly: Emissão de faturas on every Friday
  getFridaysInMonth(year, monthIndex).forEach((fri) => {
    result.push({ day: fri, title: "Emissão de faturas" });
  });
  return result;
};

const FiscalCalendarView = () => {
  const { data: tasks = [] } = useTasks();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const { data: overrides = [] } = useDeadlineOverrides();
  const setOverride = useSetDeadlineOverride();
  // Prazo em edição no painel do dia: chave + dia escolhido
  const [editing, setEditing] = useState<{ key: string; day: number } | null>(null);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;

  const tasksByDay = useMemo(() => {
    const map: Record<number, any[]> = {};
    tasks.forEach((t: any) => {
      const d = new Date(t.due_date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(t);
      }
    });
    return map;
  }, [tasks, year, month]);

  const deadlinesByDay = useMemo(() => {
    const map: Record<number, CalendarDeadline[]> = {};
    const dls = getDeadlinesForMonth(month, daysInMonth, year, makeDayResolver(overrides));
    dls.forEach((dl) => {
      if (!map[dl.day]) map[dl.day] = [];
      map[dl.day].push(dl);
    });
    return map;
  }, [month, daysInMonth, year, overrides]);

  const saveDeadlineDay = async (key: string, day: number | null) => {
    await setOverride.mutateAsync({ key, year, month: month + 1, day, userId: user?.id });
    setEditing(null);
    const dl = Object.values(deadlinesByDay).flat().find((d) => d.key === key);
    const newDay = day ?? dl?.defaultDay;
    if (newDay) setSelectedDay(newDay);
    toast({ title: day === null ? "Prazo reposto" : "Prazo alterado", description: `${dl?.title ?? ""} — dia ${newDay} de ${MONTH_NAMES[month]}` });
  };

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); setSelectedDay(null); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); setSelectedDay(null); };

  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const handleDayClick = (day: number) => {
    setSelectedDay(selectedDay === day ? null : day);
    setEditing(null);
  };

  const handleAddTask = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setEditingTask({ _prefillDate: dateStr });
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const selectedDayDeadlines = selectedDay ? (deadlinesByDay[selectedDay] || []) : [];
  const selectedDayTasks = selectedDay ? (tasksByDay[selectedDay] || []) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Calendário Fiscal</h2>
          <p className="text-muted-foreground text-sm mt-1">Prazos e obrigações fiscais</p>
        </div>
        <button
          onClick={() => {
            setEditingTask(null);
            setTaskDialogOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Nova Obrigação
        </button>
      </div>

      {/* Month nav */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <button onClick={prev} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <div className="relative">
            <button
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="font-bold text-lg hover:text-primary transition-colors cursor-pointer"
            >
              {MONTH_NAMES[month]} {year}
            </button>
            {showMonthPicker && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-card border rounded-xl shadow-lg p-4 w-[280px] animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setYear(y => y - 1)} className="p-1 rounded hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="font-bold">{year}</span>
                  <button onClick={() => setYear(y => y + 1)} className="p-1 rounded hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTH_NAMES_SHORT.map((m, idx) => (
                    <button
                      key={m}
                      onClick={() => { setMonth(idx); setShowMonthPicker(false); setSelectedDay(null); }}
                      className={cn(
                        "px-2 py-2 rounded-lg text-sm font-medium transition-colors",
                        idx === month ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={next} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {WEEKDAY_NAMES.map((d) => (
            <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground border-b">{d}</div>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r bg-muted/20" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayTasks = tasksByDay[day] || [];
            const dayDeadlines = deadlinesByDay[day] || [];
            const hasOverdue = dayTasks.some((t: any) => (t.status === "pendente" || t.status === "em_progresso") && new Date(t.due_date) < today);
            const isSelected = selectedDay === day;
            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "min-h-[80px] border-b border-r p-1.5 transition-colors cursor-pointer hover:bg-muted/30",
                  isToday(day) && "bg-accent/10",
                  isSelected && "ring-2 ring-primary ring-inset bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full", isToday(day) && "bg-accent text-accent-foreground")}>
                    {day}
                  </span>
                  {hasOverdue && <AlertTriangle className="w-3 h-3 text-destructive" />}
                </div>
                <div className="space-y-0.5">
                  {dayDeadlines.slice(0, 2).map((dl, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[10px]">
                      <CalendarDays className="w-2.5 h-2.5 text-destructive shrink-0" />
                      <span className="truncate font-medium text-destructive">{dl.title}</span>
                    </div>
                  ))}
                  {dayDeadlines.length > 2 && <span className="text-[10px] text-destructive font-medium">+{dayDeadlines.length - 2} prazos</span>}
                  {dayTasks.slice(0, 2).map((t: any) => (
                    <div key={t.id} className="flex items-center gap-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", categoryColors[t.category as TaskCategory])} />
                      <span className="text-[10px] truncate">{t.title}</span>
                    </div>
                  ))}
                  {dayTasks.length > 2 && <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 2} mais</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="bg-card rounded-xl border p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">
              {selectedDay} de {MONTH_NAMES[month]} {year}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAddTask(selectedDay)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
              <button onClick={() => setSelectedDay(null)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {selectedDayDeadlines.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Prazos Fiscais</h4>
              <div className="space-y-1.5">
                {selectedDayDeadlines.map((dl, idx) => {
                  const moved = dl.key && dl.defaultDay !== undefined && dl.day !== dl.defaultDay;
                  const isEditingThis = editing && editing.key === dl.key;
                  return (
                    <div key={idx} className="px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-destructive shrink-0" />
                        <span className="text-sm font-medium text-destructive flex-1">{dl.title}</span>
                        {moved && (
                          <span className="text-[11px] font-medium bg-warning/20 text-warning-foreground px-1.5 py-0.5 rounded-full">
                            Prorrogado · normal dia {dl.defaultDay}
                          </span>
                        )}
                        {isAdmin && dl.key && !isEditingThis && (
                          <button
                            onClick={() => setEditing({ key: dl.key!, day: dl.day })}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted"
                          >
                            <Pencil className="w-3 h-3" /> Alterar dia
                          </button>
                        )}
                      </div>
                      {isEditingThis && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 pl-6">
                          <span className="text-xs text-muted-foreground">Novo dia em {MONTH_NAMES[month]}:</span>
                          <select
                            value={editing.day}
                            onChange={(e) => setEditing({ key: editing.key, day: Number(e.target.value) })}
                            className="text-xs px-2 py-1 rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <button
                            disabled={setOverride.isPending}
                            onClick={() => saveDeadlineDay(editing.key, editing.day === dl.defaultDay ? null : editing.day)}
                            className="text-xs px-2.5 py-1 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            Guardar
                          </button>
                          {moved && (
                            <button
                              disabled={setOverride.isPending}
                              onClick={() => saveDeadlineDay(editing.key, null)}
                              className="text-xs px-2.5 py-1 rounded border hover:bg-muted disabled:opacity-50"
                            >
                              Repor dia {dl.defaultDay}
                            </button>
                          )}
                          <button onClick={() => setEditing(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedDayTasks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Tarefas</h4>
              <div className="space-y-1.5">
                {selectedDayTasks.map((t: any) => (
                  <div
                    key={t.id}
                    onClick={() => handleEditTask(t)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", categoryColors[t.category as TaskCategory])} />
                    <span className="text-sm flex-1">{t.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.status === "concluida" ? "✓" : t.status === "em_progresso" ? "⏳" : "○"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedDayDeadlines.length === 0 && selectedDayTasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sem prazos ou tarefas neste dia</p>
          )}
        </div>
      )}

      <TaskFormDialog
        open={taskDialogOpen}
        task={editingTask?._prefillDate ? { due_date: editingTask._prefillDate } : editingTask?.id ? editingTask : null}
        onClose={() => { setTaskDialogOpen(false); setEditingTask(null); }}
      />
    </div>
  );
};

export default FiscalCalendarView;
