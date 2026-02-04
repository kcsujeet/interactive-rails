import { useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
import ruby from 'highlight.js/lib/languages/ruby';
import 'highlight.js/styles/night-owl.css';

hljs.registerLanguage('ruby', ruby);

interface CodeBlockProps {
	code: string;
	language?: string;
}

export function CodeBlock({ code, language = 'ruby' }: CodeBlockProps) {
	const highlightedCode = useMemo(() => {
		try {
			return hljs.highlight(code.trim(), { language }).value;
		} catch {
			return code.trim();
		}
	}, [code, language]);

	return (
		<pre className="p-5 text-sm whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
			<code
				className={`language-${language} hljs`}
				dangerouslySetInnerHTML={{ __html: highlightedCode }}
			/>
		</pre>
	);
}
