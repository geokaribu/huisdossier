export const formatDate = (date: string) =>
  !date
    ? "Nog te plannen"
    : new Date(
        date.length === 10 ? `${date}T12:00:00` : date,
      ).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
