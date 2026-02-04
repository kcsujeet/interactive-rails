/**
 * Pipeline Node Components
 *
 * Custom React Flow node components for each Rails pipeline node type.
 * Each node visualizes a different part of the Rails request/response cycle.
 */

import { memo } from 'react';
import type { PipelineNodeData } from '../../../stores';
import BaseNode from './BaseNode';

// Custom node props that React Flow passes
interface CustomNodeProps {
	data: PipelineNodeData;
	selected?: boolean;
}

// ============================================
// Node Type Components
// ============================================

export const RequestNode = memo(function RequestNode({
	data,
	selected,
}: CustomNodeProps) {
	return (
		<BaseNode
			color="#3b82f6"
			data={data}
			icon={
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						d="M13 10V3L4 14h7v7l9-11h-7z"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				</svg>
			}
			selected={selected}
			showTargetHandle={false}
		/>
	);
});

export const RouterNode = memo(function RouterNode({
	data,
	selected,
}: CustomNodeProps) {
	return (
		<BaseNode
			color="#a78bfa"
			data={data}
			icon={
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				</svg>
			}
			selected={selected}
		/>
	);
});

export const ControllerNode = memo(function ControllerNode({
	data,
	selected,
}: CustomNodeProps) {
	return (
		<BaseNode
			color="#10b981"
			data={data}
			icon={
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				</svg>
			}
			selected={selected}
		/>
	);
});

export const ModelNode = memo(function ModelNode({
	data,
	selected,
}: CustomNodeProps) {
	return (
		<BaseNode
			color="#f59e0b"
			data={data}
			icon={
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				</svg>
			}
			selected={selected}
		/>
	);
});

export const DatabaseNode = memo(function DatabaseNode({
	data,
	selected,
}: CustomNodeProps) {
	return (
		<BaseNode
			color="#ef4444"
			data={data}
			icon={
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				</svg>
			}
			selected={selected}
		/>
	);
});

export const CacheNode = memo(function CacheNode({
	data,
	selected,
}: CustomNodeProps) {
	return (
		<BaseNode
			color="#06b6d4"
			data={data}
			icon={
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						d="M13 10V3L4 14h7v7l9-11h-7z"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				</svg>
			}
			selected={selected}
		/>
	);
});

export const ViewNode = memo(function ViewNode({
	data,
	selected,
}: CustomNodeProps) {
	return (
		<BaseNode
			color="#a855f7"
			data={data}
			icon={
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
					<path
						d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				</svg>
			}
			selected={selected}
		/>
	);
});

export const ResponseNode = memo(function ResponseNode({
	data,
	selected,
}: CustomNodeProps) {
	return (
		<BaseNode
			color="#22c55e"
			data={data}
			icon={
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				</svg>
			}
			selected={selected}
			showSourceHandle={false}
		/>
	);
});

export const BackgroundJobNode = memo(function BackgroundJobNode({
	data,
	selected,
}: CustomNodeProps) {
	return (
		<BaseNode
			color="#9333ea"
			data={data}
			icon={
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				</svg>
			}
			selected={selected}
		/>
	);
});

// ============================================
// Node Types Map for React Flow
// ============================================

export const nodeTypes = {
	request: RequestNode,
	router: RouterNode,
	controller: ControllerNode,
	model: ModelNode,
	database: DatabaseNode,
	cache: CacheNode,
	view: ViewNode,
	response: ResponseNode,
	background_job: BackgroundJobNode,
};
