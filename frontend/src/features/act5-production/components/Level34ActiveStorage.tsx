/**
 * Level 31: Active Storage
 *
 * Direct upload to S3 bypasses app server.
 * Shows memory usage difference between traditional and direct upload.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ValidationResult } from '@/components/levels';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

interface Upload {
	id: number;
	filename: string;
	size: number;
	progress: number;
	method: 'traditional' | 'direct';
	status: 'uploading' | 'completed' | 'failed';
}

export function Level34ActiveStorage({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [directUploadEnabled, setDirectUploadEnabled] = useState(false);
	const [uploads, setUploads] = useState<Upload[]>([]);
	const [memoryUsage, setMemoryUsage] = useState(0);
	const [memoryPeak, setMemoryPeak] = useState(0);
	const [directUploadsCompleted, setDirectUploadsCompleted] = useState(0);

	const handleValidate = useCallback((): ValidationResult => {
		if (!directUploadEnabled) {
			return {
				valid: false,
				message: 'Enable direct upload',
				details: ['Click "Enable Direct Upload" to bypass the app server'],
			};
		}
		if (directUploadsCompleted < 2) {
			return {
				valid: false,
				message: 'Upload more files',
				details: [
					`Upload video files using direct upload (${directUploadsCompleted}/2)`,
				],
			};
		}
		if (memoryPeak >= 100) {
			return {
				valid: false,
				message: 'Memory too high',
				details: ['Peak memory must stay below 100MB with direct uploads'],
			};
		}
		return { valid: true, message: 'Direct upload keeps memory flat!' };
	}, [directUploadEnabled, directUploadsCompleted, memoryPeak]);

	const startUpload = () => {
		const id = Date.now();
		const size = 50 + Math.floor(Math.random() * 100); // 50-150 MB
		const upload: Upload = {
			id,
			filename: `video_${id}.mp4`,
			size,
			progress: 0,
			method: directUploadEnabled ? 'direct' : 'traditional',
			status: 'uploading',
		};

		setUploads((prev) => [...prev.slice(-4), upload]);

		// Simulate upload progress
		const interval = setInterval(() => {
			setUploads((prev) =>
				prev.map((u) => {
					if (u.id !== id) return u;
					if (u.progress >= 100) {
						clearInterval(interval);
						if (u.method === 'direct') {
							setDirectUploadsCompleted((c) => c + 1);
						}
						return { ...u, status: 'completed' };
					}
					return { ...u, progress: u.progress + 10 };
				}),
			);

			// Memory simulation
			if (!directUploadEnabled) {
				// Traditional: memory increases during upload
				setMemoryUsage((prev) => {
					const newUsage = Math.min(200, prev + size / 10);
					setMemoryPeak((p) => Math.max(p, newUsage));
					return newUsage;
				});
			}
		}, 300);

		// Memory decreases after upload
		setTimeout(() => {
			clearInterval(interval);
			if (!directUploadEnabled) {
				setMemoryUsage((prev) => Math.max(0, prev - size));
			}
		}, 3500);
	};

	// Memory decay
	useEffect(() => {
		const interval = setInterval(() => {
			setMemoryUsage((prev) => Math.max(0, prev - 5));
		}, 500);
		return () => clearInterval(interval);
	}, []);

	const handleComplete = async () => {
		const success = await completeLevel('act5-level34-active-storage', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn ActiveStorage direct upload to bypass your app server for large files."
					instructions={[
						'Upload a video and watch memory spike',
						'Enable direct upload to S3',
						'Upload again - memory stays flat!',
					]}
					scenario="Users upload 4K videos (100MB+). The entire file goes through our Rails app, causing memory to spike and sometimes crash the server!"
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${directUploadEnabled ? 'bg-success text-success-foreground cursor-default' : ''}`}
							disabled={directUploadEnabled}
							onClick={() => {
								setDirectUploadEnabled(true);
								setMemoryPeak(memoryUsage);
							}}
							variant={directUploadEnabled ? 'secondary' : 'default'}
						>
							{directUploadEnabled
								? 'Direct Upload Enabled'
								: 'Enable Direct Upload'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<Button
							className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-foreground"
							onClick={startUpload}
							variant="secondary"
						>
							Upload Video File
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Server Memory
						</div>
						<div
							className={`text-3xl font-bold mb-2 ${
								memoryUsage > 150
									? 'text-destructive'
									: memoryUsage > 100
										? 'text-warning'
										: 'text-success'
							}`}
						>
							{Math.round(memoryUsage)} MB
						</div>
						<div className="bg-secondary rounded-full h-4 overflow-hidden">
							<div
								className={`h-full transition-all ${
									memoryUsage > 150
										? 'bg-destructive'
										: memoryUsage > 100
											? 'bg-warning'
											: 'bg-success'
								}`}
								style={{ width: `${Math.min(100, memoryUsage / 2)}%` }}
							/>
						</div>
						<div className="text-xs text-muted-foreground mt-2">
							Peak: {Math.round(memoryPeak)} MB
							{memoryPeak > 150 && (
								<span className="text-destructive ml-2">Danger zone!</span>
							)}
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="Cloud Storage"
					levelNumber={34}
					onComplete={handleComplete}
					onReset={() => {
						setDirectUploadEnabled(false);
						setUploads([]);
						setMemoryUsage(0);
						setMemoryPeak(0);
						setDirectUploadsCompleted(0);
					}}
					onValidate={handleValidate}
				/>

				<div className="flex-1 relative bg-background p-8">
					{/* Architecture */}
					<div className="flex items-center justify-center gap-4 mb-8">
						{/* Browser */}
						<div className="bg-card border border-border rounded-xl p-4 w-32 text-center">
							<div className="text-2xl mb-2">B</div>
							<div className="text-muted-foreground text-sm">Browser</div>
						</div>

						{directUploadEnabled ? (
							<>
								{/* Direct to S3 */}
								<div className="flex flex-col items-center gap-2">
									<div className="flex items-center">
										<svg
											className="w-6 h-6 text-muted-foreground"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												d="M14 5l7 7m0 0l-7 7m7-7H3"
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
											/>
										</svg>
										<span className="text-xs text-muted-foreground ml-1">
											presigned URL
										</span>
									</div>
								</div>

								<div className="bg-card border border-border rounded-xl p-3 w-28 text-center">
									<div className="text-lg mb-1">A</div>
									<div className="text-muted-foreground text-xs">App</div>
									<div className="text-success text-xs mt-1">Low mem</div>
								</div>

								<div className="flex flex-col items-center gap-2">
									<div className="flex items-center">
										<svg
											className="w-10 h-10 text-success"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												d="M14 5l7 7m0 0l-7 7m7-7H3"
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
											/>
										</svg>
										<span className="text-xs text-success ml-1">
											direct upload
										</span>
									</div>
								</div>
							</>
						) : (
							<>
								{/* Through app */}
								<svg
									className="w-8 h-8 text-destructive"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										d="M14 5l7 7m0 0l-7 7m7-7H3"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
									/>
								</svg>

								<div
									className={`border rounded-xl p-4 w-32 text-center transition-colors ${
										memoryUsage > 100
											? 'bg-destructive/20 border-destructive'
											: 'bg-card border-border'
									}`}
								>
									<div className="text-2xl mb-2">A</div>
									<div
										className={`text-sm ${memoryUsage > 100 ? 'text-destructive' : 'text-muted-foreground'}`}
									>
										App Server
									</div>
									{memoryUsage > 100 && (
										<div className="text-destructive text-xs mt-1">
											Memory spike!
										</div>
									)}
								</div>

								<svg
									className="w-8 h-8 text-muted-foreground"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										d="M14 5l7 7m0 0l-7 7m7-7H3"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
									/>
								</svg>
							</>
						)}

						{/* S3 */}
						<div className="bg-warning/20 border border-warning rounded-xl p-4 w-32 text-center">
							<div className="text-2xl mb-2">S3</div>
							<div className="text-warning text-sm">Storage</div>
						</div>
					</div>

					{/* Upload List */}
					<div className="bg-card rounded-xl p-4 max-w-xl mx-auto">
						<div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
							Uploads
						</div>
						<div className="space-y-3">
							{uploads.map((u) => (
								<div className="bg-secondary rounded-lg p-3" key={u.id}>
									<div className="flex items-center justify-between mb-2">
										<span className="text-foreground text-sm">
											{u.filename}
										</span>
										<span className="text-muted-foreground text-xs">
											{u.size} MB
										</span>
									</div>
									<div className="bg-background rounded-full h-2 overflow-hidden mb-2">
										<div
											className={`h-full transition-all ${
												u.method === 'direct' ? 'bg-success' : 'bg-warning'
											}`}
											style={{ width: `${u.progress}%` }}
										/>
									</div>
									<div className="flex justify-between text-xs">
										<span
											className={
												u.method === 'direct' ? 'text-success' : 'text-warning'
											}
										>
											{u.method === 'direct'
												? 'Direct to S3'
												: 'Via App Server'}
										</span>
										<span
											className={
												u.status === 'completed'
													? 'text-success'
													: 'text-muted-foreground'
											}
										>
											{u.status === 'completed' ? 'Done' : `${u.progress}%`}
										</span>
									</div>
								</div>
							))}
							{uploads.length === 0 && (
								<div className="text-muted-foreground text-center py-4">
									Click "Upload Video" to start
								</div>
							)}
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/javascript/direct_upload.js',
							language: 'javascript',
							code: `import { DirectUpload } from "@rails/activestorage"

class Uploader {
  constructor(file, url) {
    this.upload = new DirectUpload(file, url, this)
  }

  start(callback) {
    this.upload.create((error, blob) => {
      if (error) {
        callback(error)
      } else {
        // File uploaded directly to S3!
        // Only blob metadata sent to Rails
        callback(null, blob.signed_id)
      }
    })
  }

  directUploadWillStoreFileWithXHR(request) {
    request.upload.addEventListener("progress",
      event => this.progress(event)
    )
  }
}

// config/storage.yml
amazon:
  service: S3
  access_key_id: <%= ENV['AWS_ACCESS_KEY_ID'] %>
  secret_access_key: <%= ENV['AWS_SECRET_ACCESS_KEY'] %>
  bucket: <%= ENV['S3_BUCKET'] %>
  direct_upload: true  # Enable direct upload!`,
							highlight: [5, 12, 13, 14, 31],
						},
					]}
					learningGoal="Direct upload sends files straight to S3, bypassing your app server. This prevents memory spikes and speeds up uploads."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level34ActiveStorage;
