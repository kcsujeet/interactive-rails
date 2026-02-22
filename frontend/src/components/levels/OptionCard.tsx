/**
 * OptionCard Component
 *
 * Reusable card for option items in level left-panels.
 * Size controls CSS only (sm | default | lg). Props control what renders.
 * Uses CVA + CSS variable pattern (like Button.tsx) for color theming.
 */

import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, Check, GripVertical, Sparkles } from 'lucide-react';
import type * as React from 'react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Color type + hex-to-name bridge
// ---------------------------------------------------------------------------

export type OptionCardColor =
	| 'primary'
	| 'success'
	| 'info'
	| 'warning'
	| 'destructive'
	| 'blue'
	| 'violet'
	| 'emerald'
	| 'amber'
	| 'red'
	| 'cyan'
	| 'purple'
	| 'pink'
	| 'teal'
	| 'slate'
	| 'orange'
	| 'rose'
	| 'green'
	| 'indigo'
	| 'sky'
	| 'gray';

const HEX_TO_COLOR: Record<string, OptionCardColor> = {
	'#3b82f6': 'blue',
	'#a78bfa': 'violet',
	'#10b981': 'emerald',
	'#f59e0b': 'amber',
	'#ef4444': 'red',
	'#22c55e': 'green',
	'#8b5cf6': 'purple',
	'#06b6d4': 'cyan',
	'#ec4899': 'pink',
	'#9333ea': 'purple',
	'#a855f7': 'purple',
	'#14b8a6': 'teal',
	'#64748b': 'slate',
	'#f97316': 'orange',
	'#f43f5e': 'rose',
	'#6366f1': 'indigo',
	'#0ea5e9': 'sky',
	'#6b7280': 'gray',
};

/** Resolve a hex color (from gameData) to a named OptionCardColor. */
export function resolveColor(input: string): OptionCardColor {
	return HEX_TO_COLOR[input.toLowerCase()] ?? 'primary';
}

// ---------------------------------------------------------------------------
// DotIcon: small colored circle for nodes without a Lucide icon
// ---------------------------------------------------------------------------

export function DotIcon({ className }: { className?: string }) {
	return <div className={cn('rounded-full bg-current', className)} />;
}

// ---------------------------------------------------------------------------
// CVA definitions
// ---------------------------------------------------------------------------

const colorVariants = {
	primary: '[--card-accent:var(--primary)]',
	success: '[--card-accent:var(--success)]',
	info: '[--card-accent:var(--info)]',
	warning: '[--card-accent:var(--warning)]',
	destructive: '[--card-accent:var(--destructive)]',
	blue: '[--card-accent:var(--color-blue-500)]',
	violet: '[--card-accent:var(--color-violet-400)]',
	emerald: '[--card-accent:var(--color-emerald-500)]',
	amber: '[--card-accent:var(--color-amber-500)]',
	red: '[--card-accent:var(--color-red-500)]',
	cyan: '[--card-accent:var(--color-cyan-500)]',
	purple: '[--card-accent:var(--color-purple-500)]',
	pink: '[--card-accent:var(--color-pink-500)]',
	teal: '[--card-accent:var(--color-teal-500)]',
	slate: '[--card-accent:var(--color-slate-500)]',
	orange: '[--card-accent:var(--color-orange-500)]',
	rose: '[--card-accent:var(--color-rose-500)]',
	green: '[--card-accent:var(--color-green-500)]',
	indigo: '[--card-accent:var(--color-indigo-500)]',
	sky: '[--card-accent:var(--color-sky-500)]',
	gray: '[--card-accent:var(--color-gray-500)]',
};

const optionCardVariants = cva(
	'relative w-full transition-all rounded-lg border flex items-center border-[var(--card-accent)]/40 bg-[var(--card-accent)]/10',
	{
		variants: {
			size: {
				sm: 'gap-1.5 px-3 py-1.5 rounded-md text-xs',
				default: 'gap-2.5 px-3 py-2.5 text-sm',
				lg: 'gap-3 p-3 text-sm',
			},
			color: colorVariants,
		},
		defaultVariants: {
			size: 'default',
			color: 'primary',
		},
	},
);

const iconAreaVariants = cva(
	'shrink-0 flex items-center justify-center text-[var(--card-accent)]',
	{
		variants: {
			size: {
				sm: 'w-4 h-4',
				default: 'w-5 h-5',
				lg: 'w-8 h-8 rounded-lg bg-[var(--card-accent)]/15',
			},
		},
		defaultVariants: {
			size: 'default',
		},
	},
);

const nameVariants = cva('font-medium truncate', {
	variants: {
		size: {
			sm: 'text-xs',
			default: 'text-sm text-[var(--card-accent)]',
			lg: 'text-sm text-foreground',
		},
	},
	defaultVariants: {
		size: 'default',
	},
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OptionCardProps
	extends Omit<VariantProps<typeof optionCardVariants>, 'color'> {
	name: string;
	description?: string;
	color?: OptionCardColor;
	icon?: React.ComponentType<{ className?: string }>;
	size?: 'sm' | 'default' | 'lg';
	mono?: boolean;

	// Interaction
	draggable?: boolean;
	dragType?: string;
	dragData?: string;
	onDragStart?: (e: React.DragEvent) => void;
	onDragEnd?: (e: React.DragEvent) => void;
	onClick?: () => void;

	// State
	disabled?: boolean;
	selected?: boolean;
	isDragging?: boolean;

	// Optional extras
	badge?: string;
	warning?: string;
	benefit?: string;
	className?: string;
	children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OptionCard({
	name,
	description,
	color = 'primary',
	icon: Icon,
	size = 'default',
	mono = false,
	draggable,
	dragType,
	dragData,
	onDragStart,
	onDragEnd,
	onClick,
	disabled = false,
	selected = false,
	isDragging = false,
	badge: badgeText,
	warning,
	benefit,
	className,
	children,
}: OptionCardProps) {
	const isInteractive = !!onClick || draggable;

	const handleDragStart = (e: React.DragEvent) => {
		if (disabled) {
			e.preventDefault();
			return;
		}
		if (dragType && dragData) {
			e.dataTransfer.setData(dragType, dragData);
		}
		onDragStart?.(e);
	};

	const Tag = onClick ? 'button' : 'div';
	const interactionProps = {
		...(onClick && !disabled ? { onClick, type: 'button' as const } : {}),
		...(draggable
			? {
					draggable: !disabled,
					onDragStart: handleDragStart,
					onDragEnd,
				}
			: {}),
	};

	return (
		<Tag
			className={cn(
				optionCardVariants({ size, color }),
				mono && 'font-mono [font-variant-ligatures:none]',
				selected && 'border-success bg-success/10',
				disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
				isDragging && 'opacity-50 border-dashed cursor-grabbing',
				!disabled && !isDragging && draggable && 'cursor-grab active:cursor-grabbing',
				!disabled && !isDragging && onClick && !draggable && 'cursor-pointer',
				!disabled && !isDragging && isInteractive && 'hover:border-(--card-accent)',
				className,
			)}
			{...interactionProps}
		>
			{/* Icon area */}
			{Icon && (
				<div
					className={cn(
						iconAreaVariants({ size }),
						selected && 'text-success bg-success/20',
					)}
				>
					{selected ? (
						<Check className="w-4 h-4 text-success" />
					) : (
						<Icon className="w-4 h-4" />
					)}
				</div>
			)}

			{/* Text content */}
			<div className="flex-1 min-w-0">
				<div className={cn('flex items-center gap-1.5', mono && 'block')}>
					<span className={cn(
						nameVariants({ size }),
						selected && 'text-success',
						mono && 'whitespace-pre-wrap wrap-anywhere [text-overflow:unset] block text-left',
					)}>
						{name}
					</span>
					{badgeText && (
						<Badge className="text-[10px] px-1.5 py-0 h-4" variant="secondary">
							{badgeText}
						</Badge>
					)}
				</div>
				{description && (
					<div className="text-xs text-muted-foreground truncate">
						{description}
					</div>
				)}
				{warning && (
					<p className="text-xs text-warning mt-1 flex items-center gap-1">
						<AlertTriangle className="w-3 h-3 shrink-0" />
						{warning}
					</p>
				)}
				{benefit && (
					<p className="text-xs text-success mt-1 flex items-center gap-1">
						<Sparkles className="w-3 h-3 shrink-0" />
						{benefit}
					</p>
				)}
			</div>

			{/* Trailing check */}
			{selected && <Check className="w-4 h-4 text-success shrink-0" />}

			{/* Drag handle */}
			{draggable && (
				<GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
			)}

			{children}
		</Tag>
	);
}
