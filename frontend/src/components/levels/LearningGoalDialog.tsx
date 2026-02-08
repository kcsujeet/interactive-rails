/**
 * Learning Goal Dialog Component
 *
 * Shows the level's learning goal in a dialog triggered from the header.
 */

import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';

interface LearningGoalDialogProps {
	learningGoal?: string;
}

export function LearningGoalDialog({ learningGoal }: LearningGoalDialogProps) {
	if (!learningGoal) return null;

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-2"
					size="sm"
					variant="ghost"
				>
					<GraduationCap className="w-4 h-4" />
					Goal
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<GraduationCap className="w-5 h-5 text-success" />
						Learning Goal
					</DialogTitle>
				</DialogHeader>
				<MarkdownContent content={learningGoal} />
			</DialogContent>
		</Dialog>
	);
}
