/**
 * Code Preview Panel Component
 *
 * Right panel showing live Rails code based on player actions.
 */

import type { ReactNode } from 'react';

interface CodeFile {
  filename: string;
  language: string;
  code: string;
  highlight?: number[]; // Lines to highlight
}

interface CodePreviewPanelProps {
  files: CodeFile[];
  learningGoal?: string;
  children?: ReactNode; // For additional content below code
}

export function CodePreviewPanel({ files, learningGoal, children }: CodePreviewPanelProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Code Files */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Generated Rails Code</h3>

        {files.map((file, index) => (
          <div key={index} className="bg-background rounded-lg border border-border overflow-hidden">
            {/* File header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-warning" />
                <div className="w-3 h-3 rounded-full bg-success" />
              </div>
              <span className="text-xs text-muted-foreground ml-2 font-mono">{file.filename}</span>
            </div>

            {/* Code content */}
            <pre className="p-3 text-sm font-mono overflow-x-auto">
              {file.code.split('\n').map((line, lineIndex) => {
                const isHighlighted = file.highlight?.includes(lineIndex + 1);
                return (
                  <div
                    key={lineIndex}
                    className={`${isHighlighted ? 'bg-primary/10 -mx-3 px-3' : ''}`}
                  >
                    <span className="text-muted-foreground select-none w-8 inline-block text-right mr-4">
                      {lineIndex + 1}
                    </span>
                    <CodeLine code={line} language={file.language} />
                  </div>
                );
              })}
            </pre>
          </div>
        ))}
      </div>

      {/* Learning Goal */}
      {learningGoal && (
        <div className="p-4 border-t border-border">
          <div className="text-xs font-semibold text-success uppercase tracking-wider mb-2">
            Learning Goal
          </div>
          <p className="text-sm text-muted-foreground">{learningGoal}</p>
        </div>
      )}

      {/* Additional content */}
      {children}
    </div>
  );
}

// Simple syntax highlighting for Ruby/Rails code
function CodeLine({ code, language }: { code: string; language: string }) {
  if (language !== 'ruby') {
    return <span className="text-muted-foreground">{code}</span>;
  }

  // Simple Ruby syntax highlighting
  const tokens = tokenizeRuby(code);
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} className={token.className}>
          {token.text}
        </span>
      ))}
    </>
  );
}

interface Token {
  text: string;
  className: string;
}

function tokenizeRuby(code: string): Token[] {
  const tokens: Token[] = [];
  let remaining = code;

  const patterns: [RegExp, string][] = [
    [/^#.*$/, 'text-muted-foreground'], // Comments
    [/^(def|end|class|module|do|if|else|elsif|unless|case|when|return|yield|begin|rescue|ensure|raise|private|protected|public)\b/, 'text-purple-400'], // Keywords
    [/^(has_many|has_one|belongs_to|has_and_belongs_to_many|validates|before_action|after_action|scope|delegate)\b/, 'text-primary'], // Rails methods
    [/^(true|false|nil)\b/, 'text-warning'], // Literals
    [/^:[a-zA-Z_][a-zA-Z0-9_]*/, 'text-success'], // Symbols
    [/^@[a-zA-Z_][a-zA-Z0-9_]*/, 'text-primary'], // Instance variables
    [/^"[^"]*"/, 'text-warning'], // Double-quoted strings
    [/^'[^']*'/, 'text-warning'], // Single-quoted strings
    [/^[A-Z][a-zA-Z0-9_]*/, 'text-warning'], // Constants/Classes
    [/^\d+/, 'text-warning'], // Numbers
    [/^[a-zA-Z_][a-zA-Z0-9_]*/, 'text-foreground'], // Identifiers
    [/^./, 'text-foreground'], // Everything else
  ];

  while (remaining.length > 0) {
    let matched = false;
    for (const [pattern, className] of patterns) {
      const match = remaining.match(pattern);
      if (match) {
        tokens.push({ text: match[0], className });
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push({ text: remaining[0], className: 'text-foreground' });
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

export default CodePreviewPanel;
