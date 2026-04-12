/**
 * Standalone codebase viewer button for the dashboard.
 * Fetches progress internally and renders the dialog.
 */

import { useEffect, useMemo, useState } from 'react';
import { buildUnifiedProject } from '@/lib/codebase-registry';
import { getProgress } from '@/lib/progress';
import { CodebaseViewerDialog } from './CodebaseViewerDialog';

export function DashboardCodebaseButton() {
	const [completedLevels, setCompletedLevels] = useState<string[]>([]);

	useEffect(() => {
		getProgress()
			.then((p) => setCompletedLevels(p.completedLevels))
			.catch(() => {});
	}, []);

	const files = useMemo(
		() => buildUnifiedProject(completedLevels),
		[completedLevels],
	);

	return (
		<CodebaseViewerDialog
			files={files}
			levelCount={completedLevels.length}
		/>
	);
}
