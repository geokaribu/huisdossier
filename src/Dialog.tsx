import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const cancel = (event: Event) => {
      event.preventDefault();
      close.current();
    };
    element?.addEventListener("cancel", cancel);
    return () => {
      element?.removeEventListener("cancel", cancel);
      element?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={wide ? "dialog wide" : "dialog"}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Sluiten"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
