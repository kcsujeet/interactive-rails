/**
 * UI Store
 *
 * Manages all UI-related state including:
 * - Modal and panel visibility
 * - Toast notifications
 * - Theme and preferences
 * - Keyboard shortcuts
 * - Responsive breakpoints
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================
// Types
// ============================================

export type ModalType =
	| 'settings'
	| 'help'
	| 'node-config'
	| 'achievements'
	| 'level-complete'
	| 'level-failed'
	| 'confirm'
	| 'tutorial'
	| null;

export type PanelType =
	| 'inspector'
	| 'node-palette'
	| 'metrics'
	| 'timeline'
	| 'query-trace';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
	id: string;
	type: ToastType;
	title: string;
	message?: string;
	duration: number;
	dismissible: boolean;
	createdAt: number;
}

export interface ConfirmDialogOptions {
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: 'danger' | 'warning' | 'info';
	onConfirm: () => void;
	onCancel?: () => void;
}

export type Theme = 'dark' | 'light' | 'system';

export interface TutorialStep {
	id: string;
	title: string;
	content: string;
	target?: string; // CSS selector for highlighting
	position?: 'top' | 'bottom' | 'left' | 'right';
}

export interface UIPreferences {
	theme: Theme;
	reducedMotion: boolean;
	showMinimap: boolean;
	showGrid: boolean;
	snapToGrid: boolean;
	gridSize: number;
	soundEnabled: boolean;
	soundVolume: number;
	showTooltips: boolean;
	autoSave: boolean;
	compactMode: boolean;
}

export interface UIState {
	// Modals
	activeModal: ModalType;
	modalData: Record<string, unknown>;

	// Panels
	openPanels: Set<PanelType>;
	panelSizes: Record<PanelType, number>;

	// Toasts
	toasts: Toast[];

	// Confirm dialog
	confirmDialog: ConfirmDialogOptions | null;

	// Tutorial
	tutorialActive: boolean;
	tutorialSteps: TutorialStep[];
	tutorialCurrentStep: number;

	// Loading states
	isLoading: boolean;
	loadingMessage: string;

	// Responsive
	isMobile: boolean;
	isTablet: boolean;
	sidebarCollapsed: boolean;

	// Keyboard
	isKeyboardNavigation: boolean;

	// Preferences
	preferences: UIPreferences;

	// Context menu
	contextMenu: {
		isOpen: boolean;
		position: { x: number; y: number };
		items: ContextMenuItem[];
	};

	// Actions - Modals
	openModal: (modal: ModalType, data?: Record<string, unknown>) => void;
	closeModal: () => void;

	// Actions - Panels
	togglePanel: (panel: PanelType) => void;
	openPanel: (panel: PanelType) => void;
	closePanel: (panel: PanelType) => void;
	setPanelSize: (panel: PanelType, size: number) => void;

	// Actions - Toasts
	addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
	removeToast: (id: string) => void;
	clearToasts: () => void;

	// Actions - Confirm
	showConfirm: (options: ConfirmDialogOptions) => void;
	hideConfirm: () => void;

	// Actions - Tutorial
	startTutorial: (steps: TutorialStep[]) => void;
	nextTutorialStep: () => void;
	prevTutorialStep: () => void;
	skipTutorial: () => void;
	completeTutorial: () => void;

	// Actions - Loading
	setLoading: (isLoading: boolean, message?: string) => void;

	// Actions - Responsive
	setIsMobile: (isMobile: boolean) => void;
	setIsTablet: (isTablet: boolean) => void;
	toggleSidebar: () => void;

	// Actions - Keyboard
	setKeyboardNavigation: (isKeyboard: boolean) => void;

	// Actions - Preferences
	updatePreferences: (prefs: Partial<UIPreferences>) => void;
	resetPreferences: () => void;

	// Actions - Context Menu
	showContextMenu: (
		position: { x: number; y: number },
		items: ContextMenuItem[],
	) => void;
	hideContextMenu: () => void;

	// Actions - Convenience
	showSuccess: (title: string, message?: string) => void;
	showError: (title: string, message?: string) => void;
	showWarning: (title: string, message?: string) => void;
	showInfo: (title: string, message?: string) => void;
}

export interface ContextMenuItem {
	id: string;
	label: string;
	icon?: string;
	shortcut?: string;
	disabled?: boolean;
	danger?: boolean;
	onClick: () => void;
	divider?: boolean;
}

// ============================================
// Constants
// ============================================

const DEFAULT_PREFERENCES: UIPreferences = {
	theme: 'dark',
	reducedMotion: false,
	showMinimap: true,
	showGrid: true,
	snapToGrid: true,
	gridSize: 20,
	soundEnabled: true,
	soundVolume: 0.7,
	showTooltips: true,
	autoSave: true,
	compactMode: false,
};

const DEFAULT_PANEL_SIZES: Record<PanelType, number> = {
	inspector: 320,
	'node-palette': 280,
	metrics: 400,
	timeline: 200,
	'query-trace': 300,
};

const DEFAULT_TOAST_DURATION = 5000;

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
	return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================
// Store
// ============================================

export const useUIStore = create<UIState>()(
	devtools(
		persist(
			subscribeWithSelector(
				immer((set, get) => ({
					// Initial state
					activeModal: null,
					modalData: {},
					openPanels: new Set(['inspector', 'node-palette'] as PanelType[]),
					panelSizes: { ...DEFAULT_PANEL_SIZES },
					toasts: [],
					confirmDialog: null,
					tutorialActive: false,
					tutorialSteps: [],
					tutorialCurrentStep: 0,
					isLoading: false,
					loadingMessage: '',
					isMobile: false,
					isTablet: false,
					sidebarCollapsed: false,
					isKeyboardNavigation: false,
					preferences: { ...DEFAULT_PREFERENCES },
					contextMenu: {
						isOpen: false,
						position: { x: 0, y: 0 },
						items: [],
					},

					// Modals
					openModal: (modal, data = {}) => {
						set((state) => {
							state.activeModal = modal;
							state.modalData = data;
						});
					},

					closeModal: () => {
						set((state) => {
							state.activeModal = null;
							state.modalData = {};
						});
					},

					// Panels
					togglePanel: (panel) => {
						set((state) => {
							if (state.openPanels.has(panel)) {
								state.openPanels.delete(panel);
							} else {
								state.openPanels.add(panel);
							}
						});
					},

					openPanel: (panel) => {
						set((state) => {
							state.openPanels.add(panel);
						});
					},

					closePanel: (panel) => {
						set((state) => {
							state.openPanels.delete(panel);
						});
					},

					setPanelSize: (panel, size) => {
						set((state) => {
							state.panelSizes[panel] = Math.max(200, Math.min(600, size));
						});
					},

					// Toasts
					addToast: (toast) => {
						const id = generateId();
						const newToast: Toast = {
							...toast,
							id,
							duration: toast.duration ?? DEFAULT_TOAST_DURATION,
							dismissible: toast.dismissible ?? true,
							createdAt: Date.now(),
						};

						set((state) => {
							// Limit to 5 toasts
							if (state.toasts.length >= 5) {
								state.toasts.shift();
							}
							state.toasts.push(newToast);
						});

						// Auto-remove after duration
						if (newToast.duration > 0) {
							setTimeout(() => {
								get().removeToast(id);
							}, newToast.duration);
						}

						return id;
					},

					removeToast: (id) => {
						set((state) => {
							state.toasts = state.toasts.filter((t) => t.id !== id);
						});
					},

					clearToasts: () => {
						set((state) => {
							state.toasts = [];
						});
					},

					// Confirm
					showConfirm: (options) => {
						set((state) => {
							state.confirmDialog = options;
							state.activeModal = 'confirm';
						});
					},

					hideConfirm: () => {
						set((state) => {
							state.confirmDialog = null;
							state.activeModal = null;
						});
					},

					// Tutorial
					startTutorial: (steps) => {
						set((state) => {
							state.tutorialActive = true;
							state.tutorialSteps = steps;
							state.tutorialCurrentStep = 0;
							state.activeModal = 'tutorial';
						});
					},

					nextTutorialStep: () => {
						const { tutorialCurrentStep, tutorialSteps } = get();
						if (tutorialCurrentStep < tutorialSteps.length - 1) {
							set((state) => {
								state.tutorialCurrentStep += 1;
							});
						} else {
							get().completeTutorial();
						}
					},

					prevTutorialStep: () => {
						const { tutorialCurrentStep } = get();
						if (tutorialCurrentStep > 0) {
							set((state) => {
								state.tutorialCurrentStep -= 1;
							});
						}
					},

					skipTutorial: () => {
						set((state) => {
							state.tutorialActive = false;
							state.tutorialSteps = [];
							state.tutorialCurrentStep = 0;
							state.activeModal = null;
						});
					},

					completeTutorial: () => {
						set((state) => {
							state.tutorialActive = false;
							state.activeModal = null;
						});
						get().showSuccess(
							'Tutorial Complete',
							"You're ready to start building pipelines!",
						);
					},

					// Loading
					setLoading: (isLoading, message = '') => {
						set((state) => {
							state.isLoading = isLoading;
							state.loadingMessage = message;
						});
					},

					// Responsive
					setIsMobile: (isMobile) => {
						set((state) => {
							state.isMobile = isMobile;
							if (isMobile) {
								state.sidebarCollapsed = true;
							}
						});
					},

					setIsTablet: (isTablet) => {
						set((state) => {
							state.isTablet = isTablet;
						});
					},

					toggleSidebar: () => {
						set((state) => {
							state.sidebarCollapsed = !state.sidebarCollapsed;
						});
					},

					// Keyboard
					setKeyboardNavigation: (isKeyboard) => {
						set((state) => {
							state.isKeyboardNavigation = isKeyboard;
						});
					},

					// Preferences
					updatePreferences: (prefs) => {
						set((state) => {
							state.preferences = { ...state.preferences, ...prefs };
						});
					},

					resetPreferences: () => {
						set((state) => {
							state.preferences = { ...DEFAULT_PREFERENCES };
						});
					},

					// Context Menu
					showContextMenu: (position, items) => {
						set((state) => {
							state.contextMenu = {
								isOpen: true,
								position,
								items,
							};
						});
					},

					hideContextMenu: () => {
						set((state) => {
							state.contextMenu.isOpen = false;
							state.contextMenu.items = [];
						});
					},

					// Convenience toast methods
					showSuccess: (title, message) => {
						get().addToast({
							type: 'success',
							title,
							message,
							duration: DEFAULT_TOAST_DURATION,
							dismissible: true,
						});
					},

					showError: (title, message) => {
						get().addToast({
							type: 'error',
							title,
							message,
							duration: DEFAULT_TOAST_DURATION * 2, // Errors stay longer
							dismissible: true,
						});
					},

					showWarning: (title, message) => {
						get().addToast({
							type: 'warning',
							title,
							message,
							duration: DEFAULT_TOAST_DURATION,
							dismissible: true,
						});
					},

					showInfo: (title, message) => {
						get().addToast({
							type: 'info',
							title,
							message,
							duration: DEFAULT_TOAST_DURATION,
							dismissible: true,
						});
					},
				})),
			),
			{
				name: 'interactive-rails-ui',
				partialize: (state) => ({
					preferences: state.preferences,
					sidebarCollapsed: state.sidebarCollapsed,
				}),
			},
		),
		{ name: 'ui-store' },
	),
);

// ============================================
// Selectors
// ============================================

export const selectIsModalOpen = (modal: ModalType) => (state: UIState) =>
	state.activeModal === modal;

export const selectIsPanelOpen = (panel: PanelType) => (state: UIState) =>
	state.openPanels.has(panel);

export const selectPanelSize = (panel: PanelType) => (state: UIState) =>
	state.panelSizes[panel];

export const selectActiveToasts = (state: UIState) => state.toasts;

export const selectTheme = (state: UIState) => state.preferences.theme;

export const selectIsDarkMode = (state: UIState) => {
	const { theme } = state.preferences;
	if (theme === 'system') {
		// In a real app, you'd check window.matchMedia
		return true;
	}
	return theme === 'dark';
};

export const selectShouldReduceMotion = (state: UIState) =>
	state.preferences.reducedMotion;

export const selectTutorialProgress = (state: UIState) => ({
	current: state.tutorialCurrentStep + 1,
	total: state.tutorialSteps.length,
	percentage:
		state.tutorialSteps.length > 0
			? ((state.tutorialCurrentStep + 1) / state.tutorialSteps.length) * 100
			: 0,
});

export const selectCurrentTutorialStep = (state: UIState) =>
	state.tutorialSteps[state.tutorialCurrentStep] ?? null;
