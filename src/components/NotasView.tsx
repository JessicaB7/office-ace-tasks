import PersonalNotesCard from "@/components/PersonalNotesCard";

/** Visão geral → Notas: bloco de notas pessoal de cada utilizador. */
const NotasView = () => (
  <div className="space-y-5">
    <div>
      <h2 className="text-2xl font-bold">Notas</h2>
      <p className="text-muted-foreground text-sm mt-1">
        As suas notas, lembretes e pendentes — só visíveis para si. Gravam automaticamente.
      </p>
    </div>
    <PersonalNotesCard tall />
  </div>
);

export default NotasView;
