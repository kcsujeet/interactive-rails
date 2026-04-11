import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const alertVariants = cva(
	'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
	{
		variants: {
			variant: {
				default: 'bg-card text-card-foreground',
				destructive:
					'border-destructive/30 bg-destructive/5 text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current',
				warning:
					'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 *:data-[slot=alert-description]:text-amber-600/90 dark:*:data-[slot=alert-description]:text-amber-400/90 [&>svg]:text-current',
				info: 'border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400 *:data-[slot=alert-description]:text-blue-600/90 dark:*:data-[slot=alert-description]:text-blue-400/90 [&>svg]:text-current',
				success:
					'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 *:data-[slot=alert-description]:text-emerald-600/90 dark:*:data-[slot=alert-description]:text-emerald-400/90 [&>svg]:text-current',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
);

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
	return (
		<div
			className={cn(alertVariants({ variant }), className)}
			data-slot="alert"
			role="alert"
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			className={cn(
				'col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight',
				className,
			)}
			data-slot="alert-title"
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<'div'>) {
	return (
		<div
			className={cn(
				'col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed',
				className,
			)}
			data-slot="alert-description"
			{...props}
		/>
	);
}

export { Alert, AlertTitle, AlertDescription };
