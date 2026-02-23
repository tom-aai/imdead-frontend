import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-foreground mt-8 mb-6 text-3xl font-bold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-foreground border-separator1 mt-8 mb-4 border-b pb-2 text-2xl font-bold">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-foreground mt-6 mb-3 text-xl font-semibold">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-foreground mt-4 mb-2 text-lg font-semibold">{children}</h4>
          ),
          p: ({ children }) => <p className="text-fg1 mb-4 leading-relaxed">{children}</p>,
          ul: ({ children }) => (
            <ul className="text-fg1 mb-4 ml-6 list-outside list-disc space-y-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="text-fg1 mb-4 ml-6 list-outside list-decimal space-y-2">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-fgAccent hover:underline"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-separator2 text-fg2 my-4 border-l-4 pl-4 italic">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-bg2 rounded px-1.5 py-0.5 font-mono text-sm">{children}</code>
              );
            }
            return (
              <code className="bg-bg2 block overflow-x-auto rounded-lg p-4 font-mono text-sm">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="mb-4">{children}</pre>,
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="border-separator1 min-w-full border">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-bg2">{children}</thead>,
          th: ({ children }) => (
            <th className="border-separator1 border px-4 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-separator1 border px-4 py-2">{children}</td>,
          hr: () => <hr className="border-separator1 my-8" />,
          strong: ({ children }) => (
            <strong className="text-foreground font-bold">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
