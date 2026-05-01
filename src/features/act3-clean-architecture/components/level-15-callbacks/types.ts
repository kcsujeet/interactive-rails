export type Phase = 'observe' | 'build' | 'reward';

export interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}
