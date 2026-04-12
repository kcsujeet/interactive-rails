/**
 * Sandbox App - Production Architecture Simulator
 *
 * Pre-loaded with a full production stack. Users start the simulation
 * and watch requests flow through the architecture. Nodes can be
 * added/removed to see how the system adapts.
 */

import {
	applyEdgeChanges,
	applyNodeChanges,
	Background,
	Controls,
	type EdgeChange,
	MiniMap,
	type NodeChange,
	type NodeTypes,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import {
	INITIAL_EDGES,
	INITIAL_NODES,
	type SandboxNodeData,
	type SandboxNode as SandboxNodeType,
} from '../utils/sandbox-layout';
import {
	createInitialMetrics,
	type SimMetrics,
	simulationTick,
} from '../utils/sandbox-simulation';
import { SandboxNode } from './SandboxNode';

const nodeTypes: NodeTypes = {
	sandbox: SandboxNode,
};

export function SandboxApp() {
	const [nodes, setNodes] = useNodesState(INITIAL_NODES);
	const [edges, setEdges] = useEdgesState(INITIAL_EDGES);
	const [running, setRunning] = useState(false);
	const [metrics, setMetrics] = useState<SimMetrics>(createInitialMetrics());
	const [trafficRate, setTrafficRate] = useState(100);
	const tickRef = useRef(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const onNodesChange = useCallback(
		(changes: NodeChange[]) =>
			setNodes((nds) => applyNodeChanges(changes, nds) as SandboxNodeType[]),
		[setNodes],
	);

	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) =>
			setEdges((eds) => applyEdgeChanges(changes, eds)),
		[setEdges],
	);

	const startSimulation = useCallback(() => {
		setRunning(true);
	}, []);

	const stopSimulation = useCallback(() => {
		setRunning(false);
	}, []);

	const resetSimulation = useCallback(() => {
		setRunning(false);
		setMetrics(createInitialMetrics());
		tickRef.current = 0;
		setNodes(INITIAL_NODES);
		setEdges(INITIAL_EDGES);
	}, [setNodes, setEdges]);

	// Toggle edge animation when simulation starts/stops
	useEffect(() => {
		setEdges((eds) => eds.map((e) => ({ ...e, animated: running })));
	}, [running, setEdges]);

	// Simulation loop
	useEffect(() => {
		if (!running) {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			return;
		}

		intervalRef.current = setInterval(() => {
			tickRef.current += 1;

			setNodes((currentNodes) => {
				// Build data map from current nodes
				const dataMap = new Map<string, SandboxNodeData>();
				for (const n of currentNodes) {
					dataMap.set(n.id, n.data);
				}

				// Run tick
				const result = simulationTick(
					dataMap,
					metrics,
					tickRef.current,
					trafficRate,
				);
				setMetrics(result.metrics);

				// Apply node updates
				return currentNodes.map((node) => {
					const update = result.nodeUpdates.get(node.id);
					if (!update) return node;
					return {
						...node,
						data: { ...node.data, ...update } as SandboxNodeData,
					};
				});
			});
		}, 1000 / 30); // 30 FPS

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [running, trafficRate, metrics, setNodes]);

	return (
		<div className="flex h-full overflow-hidden">
			{/* Left sidebar: info + controls */}
			<div className="w-72 shrink-0 border-r border-border bg-card overflow-y-auto p-4 space-y-4">
				<div>
					<h2 className="text-lg font-semibold text-foreground">
						Production Simulator
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Watch how a real Rails application handles traffic at scale.
					</p>
				</div>

				{/* Controls */}
				<div className="space-y-3">
					<div className="flex gap-2">
						{!running ? (
							<Button className="flex-1" onClick={startSimulation} size="sm">
								<Play className="w-4 h-4 mr-1" />
								Start
							</Button>
						) : (
							<Button
								className="flex-1"
								onClick={stopSimulation}
								size="sm"
								variant="secondary"
							>
								<Pause className="w-4 h-4 mr-1" />
								Pause
							</Button>
						)}
						<Button onClick={resetSimulation} size="sm" variant="outline">
							<RotateCcw className="w-4 h-4" />
						</Button>
					</div>

					{/* Traffic slider */}
					<div>
						<div className="flex items-center justify-between mb-1">
							<span className="text-xs text-muted-foreground">
								Traffic Volume
							</span>
							<span className="text-xs font-mono text-foreground">
								{trafficRate} req/s
							</span>
						</div>
						<input
							className="w-full accent-primary"
							max={1000}
							min={10}
							onChange={(e) =>
								setTrafficRate(Number.parseInt(e.target.value, 10))
							}
							step={10}
							type="range"
							value={trafficRate}
						/>
					</div>
				</div>

				{/* Tips */}
				<div className="space-y-2 pt-2 border-t border-border">
					<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Try it
					</h3>
					<ul className="space-y-1.5 text-xs text-muted-foreground">
						<li>Hit Start and watch requests flow through the stack</li>
						<li>Crank up traffic to 500+ req/s and watch threads fill up</li>
						<li>Delete the Cache node and see latency spike</li>
						<li>Remove the Rate Limiter and watch error rates climb</li>
						<li>Click any node to see its live metrics</li>
					</ul>
				</div>
			</div>

			{/* Main canvas */}
			<div className="flex-1 min-w-0">
				<ReactFlow
					edges={edges}
					fitView
					fitViewOptions={{ padding: 0.15 }}
					nodes={nodes}
					nodeTypes={nodeTypes}
					onEdgesChange={onEdgesChange}
					onNodesChange={onNodesChange}
					proOptions={{ hideAttribution: true }}
				>
					<Background gap={20} size={1} />
					<Controls />
					<MiniMap
						nodeColor={(node) => {
							const d = node.data as SandboxNodeData;
							return d.color;
						}}
						style={{ height: 80, width: 120 }}
					/>
				</ReactFlow>
			</div>

			{/* Right sidebar: metrics */}
			<div className="w-72 shrink-0 border-l border-border bg-card overflow-y-auto p-4 space-y-4">
				<h3 className="text-sm font-semibold text-foreground">Live Metrics</h3>

				<MetricCard
					label="Throughput"
					suffix=" req/s"
					value={metrics.reqPerSec}
				/>
				<MetricCard
					label="Avg Latency"
					suffix="ms"
					value={metrics.avgLatency}
					warn={metrics.avgLatency > 100}
				/>
				<MetricCard
					label="p95 Latency"
					suffix="ms"
					value={metrics.p95Latency}
					warn={metrics.p95Latency > 200}
				/>
				<MetricCard
					label="Cache Hit Rate"
					suffix="%"
					value={metrics.cacheHitRate}
				/>
				<MetricCard
					label="Error Rate"
					suffix="%"
					value={metrics.errorRate}
					warn={metrics.errorRate > 1}
				/>
				<MetricCard label="DB Queries" value={metrics.dbQueryCount} />
				<MetricCard
					label="Queue Depth"
					value={metrics.queueDepth}
					warn={metrics.queueDepth > 20}
				/>
				<MetricCard label="Rate Limited" value={metrics.blockedByRateLimit} />

				{/* Status */}
				<div className="pt-2 border-t border-border">
					<div className="flex items-center gap-2">
						<span
							className={cn(
								'w-2.5 h-2.5 rounded-full',
								running ? 'bg-success animate-pulse' : 'bg-muted-foreground',
							)}
						/>
						<span className="text-xs text-muted-foreground">
							{running ? 'Simulation running' : 'Simulation paused'}
						</span>
					</div>
					<p className="text-xs text-muted-foreground mt-2">
						{metrics.totalRequests.toLocaleString()} total requests processed
					</p>
				</div>
			</div>
		</div>
	);
}

function MetricCard({
	label,
	value,
	suffix,
	warn,
}: {
	label: string;
	value: number;
	suffix?: string;
	warn?: boolean;
}) {
	return (
		<Card className="p-3 gap-0">
			<div className="flex items-center justify-between">
				<span className="text-xs text-muted-foreground">{label}</span>
				<span
					className={cn(
						'text-sm font-mono font-semibold',
						warn ? 'text-destructive' : 'text-foreground',
					)}
				>
					{Math.round(value)}
					{suffix}
				</span>
			</div>
		</Card>
	);
}

export default SandboxApp;
