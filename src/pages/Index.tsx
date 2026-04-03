import { useState } from "react";
import { Task } from "@/types/task";
import { mockTasks } from "@/data/mockTasks";
import AppSidebar from "@/components/AppSidebar";
import DashboardView from "@/components/DashboardView";
import TaskListView from "@/components/TaskListView";
import TaskFormDialog from "@/components/TaskFormDialog";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [activeView, setActiveView] = useState("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { toast } = useToast();

  const handleNewTask = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleSave = (task: Task) => {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === task.id);
      if (exists) return prev.map((t) => (t.id === task.id ? task : t));
      return [task, ...prev];
    });
    setDialogOpen(false);
    toast({
      title: editingTask ? "Tarefa atualizada" : "Tarefa criada",
      description: task.title,
    });
  };

  const handleDelete = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDialogOpen(false);
    toast({ title: "Tarefa eliminada" });
  };

  return (
    <div className="flex min-h-screen">
      <AppSidebar activeView={activeView} onViewChange={setActiveView} onNewTask={handleNewTask} />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        {activeView === "dashboard" && <DashboardView tasks={tasks} />}
        {activeView === "tasks" && <TaskListView tasks={tasks} onEditTask={handleEditTask} />}
      </main>
      <TaskFormDialog
        open={dialogOpen}
        task={editingTask}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default Index;
