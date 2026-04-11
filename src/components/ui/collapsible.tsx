import { Collapsible as CollapsiblePrimitive } from 'radix-ui';

function Collapsible({
	...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
	return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
	...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
	return (
		<CollapsiblePrimitive.CollapsibleTrigger
			data-slot="collapsible-trigger"
			{...props}
		/>
	);
}

function CollapsibleContent({
	className,
	...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent> & {
	className?: string;
}) {
	return (
		<CollapsiblePrimitive.CollapsibleContent
			className={`overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up ${className ?? ''}`}
			data-slot="collapsible-content"
			{...props}
		/>
	);
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
