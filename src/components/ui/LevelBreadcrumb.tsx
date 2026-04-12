import * as React from 'react';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from './breadcrumb';

interface LevelBreadcrumbProps {
	actId: number;
	actName: string;
	levelNumber: number;
	currentPage?: 'level' | 'complete';
}

export function LevelBreadcrumb({
	actId,
	actName,
	levelNumber,
	currentPage = 'level',
}: LevelBreadcrumbProps) {
	return (
		<Breadcrumb className="mb-6">
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink href="/acts">Acts</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					<BreadcrumbLink href="/acts">{actName}</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					{currentPage === 'level' ? (
						<BreadcrumbPage>Level {levelNumber}</BreadcrumbPage>
					) : (
						<BreadcrumbPage>Complete</BreadcrumbPage>
					)}
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}
