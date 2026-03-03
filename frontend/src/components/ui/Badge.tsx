import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
	'inline-flex items-center justify-center rounded-full border border-transparent font-medium w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden',
	{
		variants: {
			variant: {
				default: 'bg-[var(--bdg)] text-[var(--bdg-fg)] [a&]:hover:opacity-90',
				secondary:
					'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
				outline: 'border-current/30 text-[var(--bdg)]',
				soft: 'bg-current/15 text-[var(--bdg)]',
				ghost: 'text-[var(--bdg)] [a&]:hover:bg-current/10',
				link: 'text-[var(--bdg)] underline-offset-4 [a&]:hover:underline',
			},
			size: {
				xs: 'px-1 py-0 text-[9px] [&>svg]:size-2',
				sm: 'px-1.5 py-0 text-[10px] [&>svg]:size-2.5',
				default: 'px-2 py-0.5 text-xs [&>svg]:size-3',
				md: 'px-2 py-0.5 text-[13px] [&>svg]:size-3',
				lg: 'px-2.5 py-1 text-sm [&>svg]:size-3.5',
				xl: 'px-3 py-1 text-base [&>svg]:size-4',
			},
			color: {
				primary: '[--bdg:var(--primary)] [--bdg-fg:var(--primary-foreground)]',
				success: '[--bdg:var(--success)] [--bdg-fg:var(--success-foreground)]',
				info: '[--bdg:var(--info)] [--bdg-fg:var(--info-foreground)]',
				warning: '[--bdg:var(--warning)] [--bdg-fg:var(--warning-foreground)]',
				destructive:
					'[--bdg:var(--destructive)] [--bdg-fg:var(--destructive-foreground)]',
			},
		},
		defaultVariants: {
			variant: 'default',
			color: 'primary',
			size: 'default',
		},
	},
);

function Badge({
	className,
	variant,
	color,
	size,
	asChild = false,
	...props
}: React.ComponentProps<'span'> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : 'span';

	return (
		<Comp
			className={cn(badgeVariants({ variant, color, size }), className)}
			data-slot="badge"
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
