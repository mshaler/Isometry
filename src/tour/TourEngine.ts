// Isometry v5 — Phase 134 Plan 01
// TourEngine: driver.js-backed guided tour with 7 steps and view-switch survival.
//
// Requirements: TOUR-01, TOUR-03

import { type Driver, driver } from 'driver.js';
import { TOUR_STEPS } from './tourSteps';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TourEngineConfig {
	getAxisNames: () => { rowAxis: string | null; columnAxis: string | null };
}

// ---------------------------------------------------------------------------
// TourEngine
// ---------------------------------------------------------------------------

/**
 * TourEngine wraps driver.js to provide a 7-step guided tour.
 *
 * - start(): creates driver instance, resolves axis templates, filters missing
 *   DOM targets (D-07), and drives from step 0.
 * - destroy(): tears down active driver instance.
 * - isActive(): returns whether tour is running.
 * - handleViewSwitch(): re-queries current step target after view switch and
 *   repositions or advances to next valid step (D-06).
 * - onComplete setter: callback invoked when driver.js fires onDestroyed.
 */
export class TourEngine {
	private readonly _config: TourEngineConfig;
	private _driverInstance: Driver | null = null;
	private _onCompleteCb: (() => void) | undefined;

	constructor(config: TourEngineConfig) {
		this._config = config;
	}

	set onComplete(cb: () => void) {
		this._onCompleteCb = cb;
	}

	start(): void {
		// Destroy any existing instance before starting fresh
		if (this._driverInstance) {
			this._driverInstance.destroy();
			this._driverInstance = null;
		}

		const { rowAxis, columnAxis } = this._config.getAxisNames();

		// Build driver.js DriveStep array from TOUR_STEPS
		const steps = TOUR_STEPS.filter((step) => {
			// D-07: silently skip steps whose target is not in the DOM
			return document.querySelector(step.target) !== null;
		}).map((step) => {
			// Resolve body template placeholders
			let body: string;
			if (rowAxis !== null && columnAxis !== null) {
				body = step.bodyTemplate
					.replace('{rowAxis}', rowAxis)
					.replace('{columnAxis}', columnAxis);
			} else {
				body = step.bodyFallback;
			}

			return {
				element: step.target,
				popover: {
					title: step.title,
					description: body,
					showButtons: step.isLastStep
						? (['previous', 'close'] as Array<'next' | 'previous' | 'close'>)
						: (['next', 'previous', 'close'] as Array<'next' | 'previous' | 'close'>),
					doneBtnText: 'Done',
				},
			};
		});

		if (steps.length === 0) {
			// No valid targets — nothing to tour
			return;
		}

		const self = this;

		this._driverInstance = driver({
			steps,
			showProgress: true,
			progressText: 'Step {{current}} of {{total}}',
			overlayOpacity: 0.5,
			animate: true,
			allowClose: true,
			showButtons: ['next', 'previous', 'close'],
			nextBtnText: 'Next',
			prevBtnText: 'Back',
			doneBtnText: 'Done',
			onDestroyed(): void {
				self._onCompleteCb?.();
			},
		});

		this._driverInstance.drive();
	}

	destroy(): void {
		if (this._driverInstance) {
			this._driverInstance.destroy();
			this._driverInstance = null;
		}
	}

	isActive(): boolean {
		return this._driverInstance?.isActive() ?? false;
	}

	/**
	 * Called after ViewManager.switchTo() resolves (D-06/D-07).
	 *
	 * Uses requestAnimationFrame to wait for the new view's DOM to settle,
	 * then re-queries the current step's target. If found, calls refresh() to
	 * reposition the spotlight. If not found, advances to the next step whose
	 * target exists in the DOM. If no valid steps remain, destroys the tour.
	 */
	handleViewSwitch(): void {
		if (!this._driverInstance || !this._driverInstance.isActive()) return;

		requestAnimationFrame(() => {
			const inst = this._driverInstance;
			if (!inst || !inst.isActive()) return;

			const activeStep = inst.getActiveStep();
			const target =
				typeof activeStep?.element === 'string' ? activeStep.element : null;

			if (target && document.querySelector(target) !== null) {
				// Target still present — reposition spotlight
				inst.refresh();
				return;
			}

			// Target missing — advance through remaining steps until one is found
			this._advanceToNextValidStep();
		});
	}

	private _advanceToNextValidStep(): void {
		const inst = this._driverInstance;
		if (!inst) return;

		const config = inst.getConfig();
		const steps = config.steps ?? [];
		const currentIndex = inst.getActiveIndex() ?? 0;

		// Find next step index with a valid DOM target
		for (let i = currentIndex + 1; i < steps.length; i++) {
			const step = steps[i];
			const el = step?.element;
			if (typeof el === 'string' && document.querySelector(el) !== null) {
				inst.moveTo(i);
				return;
			}
		}

		// No more valid steps — end the tour
		inst.destroy();
		this._driverInstance = null;
	}
}
