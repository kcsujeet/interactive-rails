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
        <h3 className="text-sm font-semibold text-white">Generated Rails Code</h3>

        {files.map((file, index) => (
          <div key={index} className="bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
            {/* File header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-gray-500 ml-2 font-mono">{file.filename}</span>
            </div>

            {/* Code content */}
            <pre className="p-3 text-sm font-mono overflow-x-auto">
              {file.code.split('\n').map((line, lineIndex) => {
                const isHighlighted = file.highlight?.includes(lineIndex + 1);
                return (
                  <div
                    key={lineIndex}
                    className={`${isHighlighted ? 'bg-cyan-900/30 -mx-3 px-3' : ''}`}
                  >
                    <span className="text-gray-600 select-none w-8 inline-block text-right mr-4">
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
        <div className="p-4 border-t border-gray-800">
          <div className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">
            Learning Goal
          </div>
          <p className="text-sm text-gray-300">{learningGoal}</p>
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
    return <span className="text-gray-300">{code}</span>;
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
    [/^#.*$/, 'text-gray-500'], // Comments
    [/^(def|end|class|module|do|if|else|elsif|unless|case|when|return|yield|begin|rescue|ensure|raise|private|protected|public)\b/, 'text-purple-400'], // Keywords
    [/^(has_many|has_one|belongs_to|has_and_belongs_to_many|validates|before_action|after_action|scope|delegate)\b/, 'text-cyan-400'], // Rails methods
    [/^(true|false|nil)\b/, 'text-orange-400'], // Literals
    [/^:[a-zA-Z_][a-zA-Z0-9_]*/, 'text-green-400'], // Symbols
    [/^@[a-zA-Z_][a-zA-Z0-9_]*/, 'text-blue-400'], // Instance variables
    [/^"[^"]*"/, 'text-yellow-400'], // Double-quoted strings
    [/^'[^']*'/, 'text-yellow-400'], // Single-quoted strings
    [/^[A-Z][a-zA-Z0-9_]*/, 'text-yellow-300'], // Constants/Classes
    [/^\d+/, 'text-orange-400'], // Numbers
    [/^[a-zA-Z_][a-zA-Z0-9_]*/, 'text-gray-300'], // Identifiers
    [/^./, 'text-gray-300'], // Everything else
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
      tokens.push({ text: remaining[0], className: 'text-gray-300' });
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

export default CodePreviewPanel;
