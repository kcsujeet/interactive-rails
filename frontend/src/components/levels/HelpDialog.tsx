/**
 * Help Dialog Component
 *
 * "?" button that opens a dialog with level-specific scenario/instructions
 * (from context) and generic pipeline connection tips.
 */

import {
	AlertTriangle,
	ArrowRight,
	HelpCircle,
	Keyboard,
	ListOrdered,
	MousePointer2,
	Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { useLevelHelp } from './LevelHelpContext';

export function HelpDialog() {
	const { scenario, instructions } = useLevelHelp();

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-2"
					size="sm"
					variant="ghost"
				>
					<HelpCircle className="w-4 h-4" />
					Help
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Level Help</DialogTitle>
				</DialogHeader>

				<div className="space-y-5">
					{/* Level-specific scenario */}
					{scenario && (
						<section>
							<h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
								<AlertTriangle className="w-4 h-4 text-warning" />
								Scenario
							</h4>
							<p className="text-sm text-muted-foreground ml-6 leading-relaxed">
								{scenario}
							</p>
						</section>
					)}

					{/* Level-specific instructions */}
					{instructions && instructions.length > 0 && (
						<section>
							<h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
								<ListOrdered className="w-4 h-4 text-primary" />
								Instructions
							</h4>
							<ol className="text-sm text-muted-foreground space-y-1.5 ml-6 list-decimal list-inside">
								{instructions.map((instruction, i) => (
									<li key={instruction}>{instruction}</li>
								))}
							</ol>
						</section>
					)}

					{/* Separator between level-specific and generic content */}
					{(scenario || (instructions && instructions.length > 0)) && (
						<div className="border-t border-border" />
					)}

					<section>
						<h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
							<ArrowRight className="w-4 h-4 text-primary" />
							How to Connect Nodes
						</h4>
						<ul className="text-sm text-muted-foreground space-y-1.5 ml-6">
							<li>Drag from a node's right port to another node's left port</li>
							<li>Request node has no input port (it's the entry point)</li>
							<li>Response node has no output port (it's the exit point)</li>
						</ul>
					</section>

					<section>
						<h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
							<MousePointer2 className="w-4 h-4 text-primary" />
							Adding Nodes
						</h4>
						<ul className="text-sm text-muted-foreground space-y-1.5 ml-6">
							<li>Drag a node from the left sidebar onto the canvas</li>
							<li>Position nodes to build your pipeline flow</li>
						</ul>
					</section>

					<section>
						<h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
							<Trash2 className="w-4 h-4 text-primary" />
							Removing Connections
						</h4>
						<ul className="text-sm text-muted-foreground space-y-1.5 ml-6">
							<li>Click on a connection line to delete it</li>
						</ul>
					</section>

					<section>
						<h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
							<Keyboard className="w-4 h-4 text-primary" />
							Tips
						</h4>
						<ul className="text-sm text-muted-foreground space-y-1.5 ml-6">
							<li>Use the Reset button to restore the initial pipeline</li>
							<li>Submit your solution when the pipeline is complete</li>
							<li>Watch the live metrics to see how your changes affect performance</li>
						</ul>
					</section>
				</div>
			</DialogContent>
		</Dialog>
	);
}
