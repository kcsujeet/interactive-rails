/**
 * Error Feedback Component
 *
 * Animated inline error card that explains why a wrong option was wrong.
 * Slides in from top. Stays visible until the player selects another option
 * or gets the correct answer (parent sets message to null).
 * Never auto-dismisses.
 */

import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ErrorFeedbackProps {
	message: string | null;
	onDismiss?: () => void;
}

export function ErrorFeedback({ message, onDismiss }: ErrorFeedbackProps) {
	const [visible, setVisible] = useState(false);
	const [displayMessage, setDisplayMessage] = useState<string | null>(null);

	useEffect(() => {
		if (message) {
			setDisplayMessage(message);
			setVisible(true);
		} else {
			setVisible(false);
			const timer = setTimeout(() => {
				setDisplayMessage(null);
				onDismiss?.();
			}, 200);
			return () => clearTimeout(timer);
		}
	}, [message, onDismiss]);

	if (!displayMessage) return null;

	return (
		<div
			className={`transition-all duration-200 ${
				visible
					? 'animate-in slide-in-from-top-3 opacity-100'
					: 'opacity-0 -translate-y-1'
			}`}
		>
			<div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
				<AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
				<p className="text-sm text-destructive">{displayMessage}</p>
			</div>
		</div>
	);
}

export default ErrorFeedback;
