export function InlineText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(
          /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g,
        )
        .map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          if (part.startsWith("`") && part.endsWith("`"))
            return <code key={i}>{part.slice(1, -1)}</code>;
          const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
          if (link)
            return (
              <a key={i} href={link[2]} target="_blank" rel="noreferrer">
                {link[1]}
              </a>
            );
          if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(part))
            return (
              <a key={i} href={`mailto:${part}`}>
                {part}
              </a>
            );
          return part;
        })}
    </>
  );
}
