import { useCallback, useEffect, useRef, useState } from 'react';
import type { PipelineFrame } from './data/pipeline-stages';

interface UsePipelineFramesReturn {
	currentFrame: PipelineFrame | null;
	isPlaying: boolean;
	play: (frames: PipelineFrame[]) => void;
}

/**
 * Plays a sequence of PipelineFrame objects, each shown for its durationMs.
 * After the last frame, it stays on screen (no auto-reset). Calling `play`
 * again interrupts the current sequence and starts the new one.
 */
export function usePipelineFrames(): UsePipelineFramesReturn {
	const [currentFrame, setCurrentFrame] = useState<PipelineFrame | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearTimers = useCallback(() => {
		for (const t of timeoutsRef.current) clearTimeout(t);
		timeoutsRef.current = [];
	}, []);

	const play = useCallback(
		(frames: PipelineFrame[]) => {
			clearTimers();
			if (frames.length === 0) return;

			setIsPlaying(true);
			setCurrentFrame(frames[0]);

			let elapsed = frames[0].durationMs;
			for (let i = 1; i < frames.length; i++) {
				const frame = frames[i];
				const t = setTimeout(() => setCurrentFrame(frame), elapsed);
				timeoutsRef.current.push(t);
				elapsed += frame.durationMs;
			}

			const done = setTimeout(() => setIsPlaying(false), elapsed);
			timeoutsRef.current.push(done);
		},
		[clearTimers],
	);

	useEffect(() => {
		return clearTimers;
	}, [clearTimers]);

	return { currentFrame, isPlaying, play };
}
