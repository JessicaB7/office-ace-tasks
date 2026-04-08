import { useState, useMemo } from "react";
import { useTasks, useClients, useCollaborators, useUpsertTask } from "@/hooks/useSupabaseQuery";
import { CATEGORY_LABELS, type TaskCategory, type TaskStatus, type TaskPriority } from "@/types/database";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import TaskFormDialog from "./TaskFormDialog";

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
  { title: "SAFT", day: 5, months: null, overrides: { 4: 8 } },
  { title: "DMR AT - Guia", day: 10, months: null },
  { title: "DMR SS - Guia", day: 10, months: null },
  { title: "DMR AT - Pagamento", day: 20, months: null },
  { title: "DMR SS - Pagamento", day: 20, months: null },
  { title: "IVA Periódica Mensal", day: 20, months: null, refType: "month" },
  { title: "Recapitulativa Mensal", day: 20, months: null, refType: "month" },
  { title: "IVA Periódica Trimestral", day: 20, months: [2, 5, 8, 11] },
  { title: "Recapitulativa Trimestral", day: 20, months: [1, 4, 7, 10], refType: "quarter" },
  { title: "Retenção na Fonte", day: 20, months: null },
  { title: "SS TI - Pagamento", day: 20, months: null },
  { title: "Salários - Processamento", day: 25, months: null },
  { title: "SS TI - Declaração Trimestral", day: 31, months: [1, 7, 10] },
  { title: "SS TI - Declaração Trimestral", day: 30, months: [4] },
  { title: "Pedir documentação clientes", day: 15, months: null },
];

const getFridaysInMonth = (year: number, monthIndex: number): number[] => {
  const fridays: number[] = [];
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, monthIndex, d).getDay() === 5) fridays.push(d);
  }
  return fridays;
};

const getDeadlinesForMonth = (monthIndex: number, daysInMonth: number, year: number) => {
  const month1 = monthIndex + 1;
  const result: { day: number; title: string }[] = [];
  FISCAL_DEADLINES.forEach((dl) => {
    if (dl.months === null || dl.months.includes(month1)) {
      let day = dl.overrides?.[month1] ?? dl.day;
      day = Math.min(day, daysInMonth);
      let title = dl.title;
      if (dl.refType === "month") {
        const refMonthIdx = (monthIndex - 2 + 12) % 12;
        title = `${dl.title} (${MONTH_NAMES_SHORT[refMonthIdx]})`;
      } else if (dl.refType === "quarter") {
        title = `${dl.title} (${QUARTER_REF[month1] || ""})`;
      }
      result.push({ day, title });
    }
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
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
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
    const map: Record<number, { day: number; title: string }[]> = {};
    const dls = getDeadlinesForMonth(month, daysInMonth, year);
    dls.forEach((dl) => {
      if (!map[dl.day]) map[dl.day] = [];
      map[dl.day].push(dl);
    });
    return map;
  }, [month, daysInMonth]);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); setSelectedDay(null); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); setSelectedDay(null); };

  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const handleDayClick = (day: number) => {
    setSelectedDay(selectedDay === day ? null : day);
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
          <h3 className="font-bold text-lg">{MONTH_NAMES[month]} {year}</h3>
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
                {selectedDayDeadlines.map((dl, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20">
                    <CalendarDays className="w-4 h-4 text-destructive shrink-0" />
                    <span className="text-sm font-medium text-destructive">{dl.title}</span>
                  </div>
                ))}
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
