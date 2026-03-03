import type {
	PipelineConnection,
	PipelineStage,
} from '@/components/levels/PipelineFlow';
import { PipelineFlow } from '@/components/levels/PipelineFlow';

const STAGES: PipelineStage[] = [
	{ id: 'request', label: 'Request', variant: 'default' },
	{ id: 'router', label: 'Router', variant: 'active', sublabel: 'GET /posts' },
	{
		id: 'controller',
		label: 'Controller',
		variant: 'active',
		sublabel: 'PostsController',
	},
	{ id: 'model', label: 'Model', variant: 'default', sublabel: 'Post.all' },
	{
		id: 'database',
		label: 'Database',
		variant: 'danger',
		sublabel: '127 queries',
		badge: 'N+1!',
	},
];

const CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'clean' },
	{ from: 'router', to: 'controller', dots: 'clean' },
	{ from: 'controller', to: 'model', dots: 'mixed' },
	{ from: 'model', to: 'database', dots: 'mixed' },
];

export function HeroPipeline() {
	return (
		<div className="w-full h-[180px]">
			<PipelineFlow connections={CONNECTIONS} stages={STAGES} />
		</div>
	);
}
