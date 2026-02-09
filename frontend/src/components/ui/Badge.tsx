import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
	'inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden',
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
		},
	},
);

function Badge({
	className,
	variant,
	color,
	asChild = false,
	...props
}: React.ComponentProps<'span'> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : 'span';

	return (
		<Comp
			className={cn(badgeVariants({ variant, color }), className)}
			data-slot="badge"
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
