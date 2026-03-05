"use client";

interface JsonViewerProps {
  data: unknown;
  className?: string;
}

function syntaxHighlight(json: string): string {
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "text-[#b5cea8]"; // number — green
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "text-[#9cdcfe]"; // key — light blue
        } else {
          cls = "text-[#ce9178]"; // string — orange
        }
      } else if (/true|false/.test(match)) {
        cls = "text-[#569cd6]"; // boolean — blue
      } else if (/null/.test(match)) {
        cls = "text-[#808080]"; // null — grey
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

export function JsonViewer({ data, className }: JsonViewerProps) {
  const jsonString = JSON.stringify(data, null, 2);
  const highlighted = syntaxHighlight(jsonString);

  return (
    <pre
      className={`overflow-auto rounded-md bg-[#1e1e1e] p-4 text-xs whitespace-pre-wrap break-words font-mono ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}
