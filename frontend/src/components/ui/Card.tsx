import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../../lib/utils';

const cardVariants = cva(
	'rounded-xl border bg-card text-card-foreground shadow',
	{
		variants: {
			variant: {
				default: 'border-border',
				elevated: 'border-border bg-accent shadow-lg',
				interactive:
					'border-border cursor-pointer hover:bg-accent hover:shadow-lg transition-all',
				game: 'border-primary/25 hover:border-primary/40 transition-colors',
				ghost: 'border-transparent bg-transparent shadow-none',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
);

export interface CardProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
	({ className, variant, ...props }, ref) => (
		<div
			className={cn(cardVariants({ variant, className }))}
			ref={ref}
			{...props}
		/>
	),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		className={cn('flex flex-col space-y-1.5 p-6', className)}
		ref={ref}
		{...props}
	/>
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		className={cn(
			'font-semibold leading-none tracking-tight text-foreground',
			className,
		)}
		ref={ref}
		{...props}
	/>
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		className={cn('text-sm text-muted-foreground', className)}
		ref={ref}
		{...props}
	/>
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div className={cn('p-6 pt-0', className)} ref={ref} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		className={cn('flex items-center p-6 pt-0', className)}
		ref={ref}
		{...props}
	/>
));
CardFooter.displayName = 'CardFooter';

export {
	Card,
	CardHeader,
	CardFooter,
	CardTitle,
	CardDescription,
	CardContent,
	cardVariants,
};
