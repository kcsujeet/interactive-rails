// Request timeline showing waterfall diagram of request flow

import { Fragment, useMemo, useState } from 'react';
import type { NodeType } from "@/stores/pipeline";
import { Button } from '../ui/Button';
import type { QueryTrace } from './QueryTraceViewer';

// Simulated request for timeline visualization
export interface SimulatedRequest {
	id: string;
	path: NodeType[];
	status: 'pending' | 'processing' | 'completed' | 'error';
	totalLatency: number;
	queries: QueryTrace[];
	cacheHits: number;
	cacheMisses: number;
	errorMessage?: string;
}

interface RequestTimelineProps {
	requests: SimulatedRequest[];
	maxRequests?: number;
	className?: string;
}

// Node type to color mapping
const NODE_COLORS: Record<NodeType, string> = {
	request: '#3b82f6',
	router: '#a78bfa',
	controller: '#10b981',
	model: '#f59e0b',
	database: '#ef4444',
	cache: '#06b6d4',
	view: '#a855f7',
	response: '#22c55e',
	background_job: '#9333ea',
};

// Single request waterfall bar
function RequestBar({
	request,
	maxLatency,
	isSelected,
	onSelect,
}: {
	request: SimulatedRequest;
	maxLatency: number;
	isSelected: boolean;
	onSelect: () => void;
}) {
	const widthPercent =
		maxLatency > 0 ? (request.totalLatency / maxLatency) * 100 : 0;

	// Calculate segment widths based on path
	const segmentCount = request.path.length;
	const segmentWidth = widthPercent / segmentCount;

	const statusColors = {
		pending: 'bg-secondary',
		processing: 'bg-primary animate-pulse',
		completed: 'bg-success',
		error: 'bg-destructive',
	};

	return (
		<div
			className={`flex items-center gap-2 p-1 rounded cursor-pointer transition-colors ${
				isSelected ? 'bg-card' : 'hover:bg-secondary'
			}`}
			onClick={onSelect}
		>
			{/* Request ID */}
			<span className="text-xs text-muted-foreground w-20 truncate font-mono">
				{request.id.slice(0, 8)}
			</span>

			{/* Status indicator */}
			<div className={`w-2 h-2 rounded-full ${statusColors[request.status]}`} />

			{/* Timeline bar */}
			<div className="flex-1 h-4 bg-background rounded overflow-hidden relative">
				{/* Segments for each node type visited */}
				<div className="absolute inset-0 flex">
					{request.path.map((nodeType, index) => (
						<div
							className="h-full"
							key={`${request.id}-${index}`}
							style={{
								width: `${segmentWidth}%`,
								backgroundColor: NODE_COLORS[nodeType as NodeType] || '#6b7280',
							}}
							title={nodeType}
						/>
					))}
				</div>
			</div>

			{/* Latency */}
			<span
				className={`text-xs font-mono w-16 text-right ${
					request.totalLatency > 500
						? 'text-destructive'
						: request.totalLatency > 200
							? 'text-warning'
							: 'text-foreground'
				}`}
			>
				{request.totalLatency.toFixed(0)}ms
			</span>

			{/* Query count */}
			<span
				className={`text-xs font-mono w-8 text-right ${
					request.queries.length > 10
						? 'text-destructive'
						: 'text-muted-foreground'
				}`}
			>
				Q:{request.queries.length}
			</span>
		</div>
	);
}

// Request detail panel
function RequestDetail({ request }: { request: SimulatedRequest }) {
	return (
		<div className="bg-card rounded p-3 mt-2 text-sm">
			<div className="grid grid-cols-2 gap-2 text-xs">
				<div>
					<span className="text-muted-foreground">Status:</span>{' '}
					<span
						className={
							request.status === 'completed'
								? 'text-success'
								: request.status === 'error'
									? 'text-destructive'
									: 'text-primary'
						}
					>
						{request.status}
					</span>
				</div>
				<div>
					<span className="text-muted-foreground">Total latency:</span>{' '}
					<span className="text-foreground">
						{request.totalLatency.toFixed(1)}ms
					</span>
				</div>
				<div>
					<span className="text-muted-foreground">Queries:</span>{' '}
					<span className="text-foreground">{request.queries.length}</span>
				</div>
				<div>
					<span className="text-muted-foreground">Cache hits:</span>{' '}
					<span className="text-success">{request.cacheHits}</span>
					<span className="text-muted-foreground"> / misses:</span>{' '}
					<span className="text-warning">{request.cacheMisses}</span>
				</div>
			</div>

			{/* Path visualization */}
			<div className="mt-3">
				<span className="text-muted-foreground text-xs">Request path:</span>
				<div className="flex flex-wrap gap-1 mt-1">
					{request.path.map((nodeType, index) => (
						<Fragment key={index}>
							<span
								className="px-2 py-0.5 rounded text-xs text-foreground"
								style={{
									backgroundColor:
										NODE_COLORS[nodeType as NodeType] || '#6b7280',
								}}
							>
								{nodeType}
							</span>
							{index < request.path.length - 1 && (
								<span className="text-muted-foreground self-center">-&gt;</span>
							)}
						</Fragment>
					))}
				</div>
			</div>

			{/* Error message if present */}
			{request.errorMessage && (
				<div className="mt-2 p-2 bg-destructive/30 rounded">
					<span className="text-destructive text-xs">
						Error: {request.errorMessage}
					</span>
				</div>
			)}
		</div>
	);
}

export function RequestTimeline({
	requests,
	maxRequests = 50,
	className = '',
}: RequestTimelineProps) {
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
		null,
	);
	const [filter, setFilter] = useState<
		'all' | 'active' | 'completed' | 'error'
	>('all');

	// Filter requests
	const filteredRequests = useMemo(() => {
		let result = requests;

		if (filter === 'active') {
			result = requests.filter(
				(r) => r.status === 'pending' || r.status === 'processing',
			);
		} else if (filter === 'completed') {
			result = requests.filter((r) => r.status === 'completed');
		} else if (filter === 'error') {
			result = requests.filter((r) => r.status === 'error');
		}

		return result.slice(-maxRequests);
	}, [requests, filter, maxRequests]);

	// Find max latency for scaling
	const maxLatency = useMemo(
		() => Math.max(...filteredRequests.map((r) => r.totalLatency), 100),
		[filteredRequests],
	);

	const selectedRequest = selectedRequestId
		? requests.find((r) => r.id === selectedRequestId)
		: null;

	// Stats
	const activeCount = requests.filter(
		(r) => r.status === 'pending' || r.status === 'processing',
	).length;
	const errorCount = requests.filter((r) => r.status === 'error').length;

	return (
		<div className={`bg-card rounded-lg overflow-hidden ${className}`}>
			{/* Header */}
			<div className="p-3 border-b border-border">
				<div className="flex items-center justify-between mb-2">
					<h3 className="font-semibold text-foreground">Request Timeline</h3>
					<div className="flex gap-2 text-xs">
						<span className="text-primary">{activeCount} active</span>
						{errorCount > 0 && (
							<span className="text-destructive">{errorCount} errors</span>
						)}
					</div>
				</div>

				{/* Filter buttons */}
				<div className="flex gap-2">
					<Button
						onClick={() => setFilter('all')}
						size="sm"
						variant={filter === 'all' ? 'default' : 'secondary'}
					>
						All ({requests.length})
					</Button>
					<Button
						onClick={() => setFilter('active')}
						size="sm"
						variant={filter === 'active' ? 'default' : 'secondary'}
					>
						Active ({activeCount})
					</Button>
					<Button
						onClick={() => setFilter('completed')}
						size="sm"
						variant={filter === 'completed' ? 'default' : 'secondary'}
					>
						Completed
					</Button>
					<Button
						onClick={() => setFilter('error')}
						size="sm"
						color={filter === 'error' ? 'destructive' : undefined}
						variant={filter === 'error' ? 'default' : 'secondary'}
					>
						Errors ({errorCount})
					</Button>
				</div>
			</div>

			{/* Legend */}
			<div className="px-3 py-2 border-b border-border flex flex-wrap gap-2">
				{Object.entries(NODE_COLORS).map(([nodeType, color]) => (
					<div className="flex items-center gap-1" key={nodeType}>
						<div
							className="w-3 h-3 rounded"
							style={{ backgroundColor: color }}
						/>
						<span className="text-xs text-muted-foreground">{nodeType}</span>
					</div>
				))}
			</div>

			{/* Request list */}
			<div className="max-h-64 overflow-y-auto p-2 space-y-1">
				{filteredRequests.length === 0 ? (
					<p className="text-muted-foreground text-center py-4 text-sm">
						No requests to display
					</p>
				) : (
					filteredRequests.map((request) => (
						<RequestBar
							isSelected={request.id === selectedRequestId}
							key={request.id}
							maxLatency={maxLatency}
							onSelect={() =>
								setSelectedRequestId(
									request.id === selectedRequestId ? null : request.id,
								)
							}
							request={request}
						/>
					))
				)}
			</div>

			{/* Selected request detail */}
			{selectedRequest && (
				<div className="p-3 border-t border-border">
					<RequestDetail request={selectedRequest} />
				</div>
			)}
		</div>
	);
}
