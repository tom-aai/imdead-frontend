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
            <h1 className="text-3xl font-bold mb-6 mt-8 first:mt-0 text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold mb-4 mt-8 text-foreground border-b border-separator1 pb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold mb-3 mt-6 text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-lg font-semibold mb-2 mt-4 text-foreground">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed text-fg1">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-6 mb-4 space-y-2 text-fg1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-6 mb-4 space-y-2 text-fg1">{children}</ol>
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
            <blockquote className="border-l-4 border-separator2 pl-4 italic my-4 text-fg2">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-bg2 px-1.5 py-0.5 rounded text-sm font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-bg2 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="mb-4">{children}</pre>,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-separator1">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-bg2">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-separator1 px-4 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-separator1 px-4 py-2">{children}</td>
          ),
          hr: () => <hr className="my-8 border-separator1" />,
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
