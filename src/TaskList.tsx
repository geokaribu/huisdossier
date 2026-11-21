import { Circle, CheckCircle2, Pencil } from "lucide-react";
import { ReadableText } from "./ReadableText";
import { formatCost } from "./planning";
import { formatDate } from "./formatDate";
import type { Task, Dossier, Attachment } from "./types";
export function TaskList({
  tasks,
  compact = false,
  dossier,
  busy,
  onComplete,
  onReopen,
  onEdit,
  onDocument,
  onPhoto,
}: {
  tasks: Task[];
  compact?: boolean;
  dossier: Dossier;
  busy: boolean;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDocument: (id: string) => void;
  onPhoto: (file: Attachment) => void;
}) {
  return (
    <div className={compact ? "task-list compact" : "task-list"}>
      {tasks.map((task) => (
        <article className={`task-row ${task.status}`} key={task.id}>
          <button
            className="task-check"
            disabled={busy}
            title={
              task.status === "open"
                ? "Markeer als uitgevoerd"
                : "Heropen melding"
            }
            aria-label={`${task.status === "open" ? "Markeer als uitgevoerd" : "Heropen melding"}: ${task.title}`}
            onClick={() =>
              task.status === "open" ? onComplete(task) : onReopen(task)
            }
          >
            {task.status === "open" ? (
              <Circle size={22} />
            ) : (
              <CheckCircle2 size={22} />
            )}
          </button>
          <div>
            <h3>{task.title}</h3>

            <span className="task-meta">
              {dossier.assets.find((a) => a.id === task.assetId)?.name}{" "}
              <span>·</span>{" "}
              {task.status === "done"
                ? `Afgerond: ${task.completedAt || task.date ? formatDate(task.completedAt || task.date) : "datum niet vastgelegd"}`
                : formatDate(task.date)}
              {task.owner && (
                <>
                  {" "}
                  ·{" "}
                  {dossier.people?.find(
                    (person) => person.id === task.assigneeId,
                  )?.name ?? task.owner}
                </>
              )}
            </span>
            {(task.description ||
              task.source ||
              task.result ||
              task.costCents != null ||
              dossier.attachments.some((file) => file.taskId === task.id)) && (
              <details className="task-details">
                <summary>Toelichting{task.source ? " & bron" : ""}</summary>
                {task.costCents != null && (
                  <p>
                    Vastgelegde kosten:{" "}
                    <strong>{formatCost(task.costCents)}</strong>
                  </p>
                )}
                {task.result && (
                  <div className="task-result">
                    <strong>Uitvoering</strong>
                    <ReadableText text={task.result} />
                    {task.completedById && (
                      <>
                        {" "}
                        ·{" "}
                        {dossier.people?.find(
                          (person) => person.id === task.completedById,
                        )?.name ?? "Persoon niet bekend"}
                      </>
                    )}
                  </div>
                )}
                {task.description && <ReadableText text={task.description} />}
                {dossier.attachments
                  .filter((file) => file.taskId === task.id)
                  .map((file) => (
                    <button
                      key={file.id}
                      className="text-link task-evidence"
                      onClick={() =>
                        /^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)
                          ? onPhoto(file)
                          : onDocument(file.id)
                      }
                    >
                      Bekijk bijlage: {file.name}
                    </button>
                  ))}
                {task.source && (
                  <div className="task-source">
                    {task.sourceId &&
                    dossier.attachments.some((f) => f.id === task.sourceId) ? (
                      <button
                        className="text-link"
                        onClick={() => onDocument(task.sourceId!)}
                      >
                        Bekijk bron
                      </button>
                    ) : (
                      <span>Bron: {task.source}</span>
                    )}
                    {task.sourceDate && (
                      <span> · {formatDate(task.sourceDate)}</span>
                    )}
                  </div>
                )}
              </details>
            )}
          </div>
          <span
            className={`badge ${task.status === "done" ? "green" : task.state === "hold" ? "neutral" : task.state === "verify" ? "info" : "amber"}`}
          >
            {task.status === "done"
              ? "Afgerond"
              : task.state === "hold"
                ? "Wacht op"
                : task.state === "verify"
                  ? "Controleren"
                  : "Open"}
          </span>
          <button
            className="icon-button"
            aria-label={`Bewerk ${task.title}`}
            onClick={() => onEdit(task)}
          >
            <Pencil size={16} />
          </button>
        </article>
      ))}
    </div>
  );
}
