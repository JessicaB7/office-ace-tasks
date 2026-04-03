import { useState, useMemo } from "react";
import { useTasks, useFiscalDeadlines } from "@/hooks/useSupabaseQuery";
import { CATEGORY_LABELS, STATUS_LABELS, type TaskCategory } from "@/types/database";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const categoryColors: Record<TaskCategory, string> = {
  IRS: "bg-blue-500",
  IRC: "bg-purple-500",
  IVA: "bg-emerald-500",
  SS: "bg-orange-500",
  contabilidade: "bg-cyan-500",
  fiscal: "bg-rose-500",
  outro: "bg-gray-500",
};

const FiscalCalendarView = () => {
  const { data: tasks = [] } = useTasks();
  const { data: deadlines = [] } = useFiscalDeadlines();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday=0

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
    const map: Record<number, any[]> = {};
    deadlines.forEach((dl) => {
      if (dl.month === null || dl.month === month + 1) {
        if (dl.day_of_month <= daysInMonth) {
          if (!map[dl.day_of_month]) map[dl.day_of_month] = [];
          map[dl.day_of_month].push(dl);
        }
      }
    });
    return map;
  }, [deadlines, month, daysInMonth]);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Calendário Fiscal</h2>
        <p className="text-muted-foreground text-sm mt-1">Prazos e obrigações fiscais</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((cat) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs">
            <span className={cn("w-2.5 h-2.5 rounded-full", categoryColors[cat])} />
            <span className="text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
          </div>
        ))}
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
            return (
              <div key={day} className={cn("min-h-[80px] border-b border-r p-1.5 transition-colors hover:bg-muted/30", isToday(day) && "bg-accent/10")}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full", isToday(day) && "bg-accent text-accent-foreground")}>
                    {day}
                  </span>
                  {hasOverdue && <AlertTriangle className="w-3 h-3 text-destructive" />}
                </div>
                <div className="space-y-0.5">
                  {dayDeadlines.map((dl) => (
                    <div key={dl.id} className="flex items-center gap-1 text-[10px]">
                      <CalendarDays className="w-2.5 h-2.5 text-destructive" />
                      <span className="truncate font-medium text-destructive">{dl.title}</span>
                    </div>
                  ))}
                  {dayTasks.slice(0, 3).map((t: any) => (
                    <div key={t.id} className="flex items-center gap-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", categoryColors[t.category as TaskCategory])} />
                      <span className="text-[10px] truncate">{t.title}</span>
                    </div>
                  ))}
                  {dayTasks.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} mais</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FiscalCalendarView;
