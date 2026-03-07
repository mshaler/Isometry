// Isometry v5 — Phase 6 CalendarView
// HTML/CSS Grid calendar view with DensityProvider granularity integration.
//
// Design:
//   - Implements IView contract (mount/render/destroy)
//   - DensityProvider injected via constructor; granularity drives layout structure
//   - Granularity change triggers _buildStructure() DOM rebuild (not just data rebind)
//   - Card chips rendered via renderHtmlCard(); max 2 chips per day, "+N more" overflow
//   - Cards with null due_at are excluded from calendar display
//   - Date matching uses string slicing (card.due_at.slice(0, 10)) NOT Date local methods
//   - Navigation (prev/next) changes displayed period and re-renders
//
// Requirements: VIEW-04

import type { DensityProvider } from '../providers/DensityProvider';
import type { TimeGranularity } from '../providers/types';
import { renderHtmlCard } from './CardRenderer';
import type { CardDatum, IView } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHIPS = 2;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CalendarViewOptions {
	densityProvider: DensityProvider;
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

/**
 * HTML/CSS Grid calendar view with DensityProvider granularity integration.
 *
 * Supports five granularity modes:
 *   - 'month': 7-column CSS Grid with day cells for each day of the month
 *   - 'week': 7-column single-week grid
 *   - 'day': single expanded day view
 *   - 'quarter': 3 mini-months side-by-side
 *   - 'year': 12 mini-months in 4x3 grid
 */
export class CalendarView implements IView {
	private _container: HTMLElement | null = null;
	private _viewRoot: HTMLDivElement | null = null;
	private _navContainer: HTMLDivElement | null = null;
	private _periodLabel: HTMLSpanElement | null = null;
	private _gridContainer: HTMLDivElement | null = null;
	private _densityProvider: DensityProvider;
	private _currentYear: number;
	private _currentMonth: number; // 0-indexed
	private _currentDay: number;
	private _lastGranularity: TimeGranularity | null = null;
	private _densityUnsub: (() => void) | null = null;
	private _lastCards: CardDatum[] = [];

	constructor(options: CalendarViewOptions) {
		this._densityProvider = options.densityProvider;

		// Initialize to current date
		const now = new Date();
		this._currentYear = now.getFullYear();
		this._currentMonth = now.getMonth(); // 0-indexed
		this._currentDay = now.getDate();
	}

	// ---------------------------------------------------------------------------
	// IView — mount
	// ---------------------------------------------------------------------------

	mount(container: HTMLElement): void {
		this._container = container;

		// Root element
		this._viewRoot = document.createElement('div');
		this._viewRoot.className = 'calendar-view';

		// Navigation bar
		this._navContainer = document.createElement('div');
		this._navContainer.className = 'calendar-nav';

		const prevBtn = document.createElement('button');
		prevBtn.textContent = '<';
		prevBtn.addEventListener('click', () => this._navigate(-1));

		this._periodLabel = document.createElement('span');
		this._periodLabel.className = 'calendar-period';

		const nextBtn = document.createElement('button');
		nextBtn.textContent = '>';
		nextBtn.addEventListener('click', () => this._navigate(1));

		this._navContainer.appendChild(prevBtn);
		this._navContainer.appendChild(this._periodLabel);
		this._navContainer.appendChild(nextBtn);

		// Grid container
		this._gridContainer = document.createElement('div');
		this._gridContainer.className = 'calendar-grid';

		this._viewRoot.appendChild(this._navContainer);
		this._viewRoot.appendChild(this._gridContainer);
		container.appendChild(this._viewRoot);

		// Subscribe to density changes for re-render
		this._densityUnsub = this._densityProvider.subscribe(() => {
			this.render(this._lastCards);
		});
	}

	// ---------------------------------------------------------------------------
	// IView — render
	// ---------------------------------------------------------------------------

	render(cards: CardDatum[]): void {
		if (!this._gridContainer || !this._periodLabel) return;

		this._lastCards = cards;

		const { granularity, timeField } = this._densityProvider.getState();

		// Filter: only cards where the time field is not null
		const field = (timeField as keyof CardDatum) || 'due_at';
		const filteredCards = cards.filter((card) => card[field] != null);

		// Rebuild structure if granularity changed
		if (granularity !== this._lastGranularity) {
			this._buildStructure(granularity);
			this._lastGranularity = granularity;
		}

		// Update period label
		this._updatePeriodLabel(granularity);

		// Bind cards to cells (only for granularities that use day cells)
		if (granularity === 'month' || granularity === 'week' || granularity === 'day') {
			this._bindCards(filteredCards, field as string);
		}
	}

	// ---------------------------------------------------------------------------
	// Structure builders
	// ---------------------------------------------------------------------------

	private _buildStructure(granularity: TimeGranularity): void {
		if (!this._gridContainer) return;
		this._gridContainer.innerHTML = '';

		switch (granularity) {
			case 'month':
				this._buildMonthGrid(this._currentYear, this._currentMonth);
				break;
			case 'week':
				this._buildWeekGrid(this._currentYear, this._currentMonth, this._currentDay);
				break;
			case 'day':
				this._buildDayView(this._currentYear, this._currentMonth, this._currentDay);
				break;
			case 'quarter':
				this._buildQuarterView(this._currentYear, _getQuarter(this._currentMonth));
				break;
			case 'year':
				this._buildYearView(this._currentYear);
				break;
		}
	}

	private _buildMonthGrid(year: number, month: number): void {
		if (!this._gridContainer) return;

		// Set 7-column CSS grid
		this._gridContainer.style.display = 'grid';
		this._gridContainer.style.gridTemplateColumns = 'repeat(7, 1fr)';

		// Weekday header row
		WEEKDAY_LABELS.forEach((label) => {
			const header = document.createElement('div');
			header.className = 'calendar-weekday-header';
			header.textContent = label;
			this._gridContainer!.appendChild(header);
		});

		// Calculate days in month and first day of week
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun, 6=Sat

		// Day cells
		for (let day = 1; day <= daysInMonth; day++) {
			const cell = document.createElement('div');
			cell.className = 'calendar-day';

			const dateStr = _formatDate(year, month + 1, day);
			cell.dataset['date'] = dateStr;

			// Apply first-day offset using gridColumnStart
			if (day === 1 && firstDayOfWeek > 0) {
				cell.style.gridColumnStart = String(firstDayOfWeek + 1);
			}

			// Day number label
			const dayLabel = document.createElement('span');
			dayLabel.className = 'calendar-day-label';
			dayLabel.textContent = String(day);
			cell.appendChild(dayLabel);

			this._gridContainer!.appendChild(cell);
		}
	}

	private _buildWeekGrid(year: number, month: number, day: number): void {
		if (!this._gridContainer) return;

		// Set 7-column CSS grid
		this._gridContainer.style.display = 'grid';
		this._gridContainer.style.gridTemplateColumns = 'repeat(7, 1fr)';

		// Calculate the 7 dates of the week containing the current date
		const currentDate = new Date(year, month, day);
		const dayOfWeek = currentDate.getDay(); // 0=Sun
		const weekStart = new Date(currentDate);
		weekStart.setDate(currentDate.getDate() - dayOfWeek);

		for (let i = 0; i < 7; i++) {
			const date = new Date(weekStart);
			date.setDate(weekStart.getDate() + i);

			const cell = document.createElement('div');
			cell.className = 'calendar-day';
			cell.dataset['date'] = _formatDateFromDate(date);

			const dayLabel = document.createElement('span');
			dayLabel.className = 'calendar-day-label';
			dayLabel.textContent = String(date.getDate());
			cell.appendChild(dayLabel);

			this._gridContainer!.appendChild(cell);
		}
	}

	private _buildDayView(year: number, month: number, day: number): void {
		if (!this._gridContainer) return;

		this._gridContainer.style.display = 'grid';
		this._gridContainer.style.gridTemplateColumns = '1fr';

		const cell = document.createElement('div');
		cell.className = 'calendar-day';
		cell.dataset['date'] = _formatDate(year, month + 1, day);

		const dayLabel = document.createElement('span');
		dayLabel.className = 'calendar-day-label';
		dayLabel.textContent = String(day);
		cell.appendChild(dayLabel);

		this._gridContainer.appendChild(cell);
	}

	private _buildQuarterView(year: number, quarter: number): void {
		if (!this._gridContainer) return;

		// 3 mini-months side by side
		this._gridContainer.style.display = 'grid';
		this._gridContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';

		const quarterStartMonth = (quarter - 1) * 3; // 0-indexed month
		for (let i = 0; i < 3; i++) {
			const miniMonth = this._buildMiniMonth(year, quarterStartMonth + i);
			this._gridContainer.appendChild(miniMonth);
		}
	}

	private _buildYearView(year: number): void {
		if (!this._gridContainer) return;

		// 12 mini-months in 4x3 grid
		this._gridContainer.style.display = 'grid';
		this._gridContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';

		for (let month = 0; month < 12; month++) {
			const miniMonth = this._buildMiniMonth(year, month);
			this._gridContainer.appendChild(miniMonth);
		}
	}

	private _buildMiniMonth(year: number, month: number): HTMLDivElement {
		const container = document.createElement('div');
		container.className = 'mini-month';

		const label = document.createElement('div');
		label.className = 'mini-month-label';
		label.textContent = `${MONTH_NAMES[month] ?? ''} ${year}`;
		container.appendChild(label);

		// Simple mini-grid (no card chips in mini months)
		const miniGrid = document.createElement('div');
		miniGrid.className = 'mini-month-grid';
		miniGrid.style.display = 'grid';
		miniGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';

		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const firstDayOfWeek = new Date(year, month, 1).getDay();

		for (let day = 1; day <= daysInMonth; day++) {
			const cell = document.createElement('div');
			cell.className = 'mini-day';

			if (day === 1 && firstDayOfWeek > 0) {
				cell.style.gridColumnStart = String(firstDayOfWeek + 1);
			}

			cell.textContent = String(day);
			miniGrid.appendChild(cell);
		}

		container.appendChild(miniGrid);
		return container;
	}

	// ---------------------------------------------------------------------------
	// Card binding
	// ---------------------------------------------------------------------------

	private _bindCards(cards: CardDatum[], timeField: string): void {
		if (!this._gridContainer) return;

		// Group cards by date string (YYYY-MM-DD)
		const cardsByDate = new Map<string, CardDatum[]>();
		for (const card of cards) {
			const dateValue = card[timeField as keyof CardDatum] as string | null;
			if (dateValue == null) continue;
			const dateKey = dateValue.slice(0, 10);
			if (!cardsByDate.has(dateKey)) {
				cardsByDate.set(dateKey, []);
			}
			cardsByDate.get(dateKey)!.push(card);
		}

		// For each day cell, clear and re-populate
		const dayCells = this._gridContainer.querySelectorAll<HTMLElement>('.calendar-day');
		dayCells.forEach((cell) => {
			// Remove existing chip containers (but keep the day label)
			const existingChips = cell.querySelectorAll('.card');
			existingChips.forEach((chip) => chip.remove());
			const existingOverflow = cell.querySelector('.overflow-label');
			existingOverflow?.remove();

			const dateKey = cell.dataset['date'];
			if (!dateKey) return;

			const dayCards = cardsByDate.get(dateKey) ?? [];
			const visibleCards = dayCards.slice(0, MAX_CHIPS);
			const remaining = dayCards.length - visibleCards.length;

			// Render up to MAX_CHIPS card chips
			visibleCards.forEach((card) => {
				const chip = renderHtmlCard(card);
				chip.classList.add('calendar-card-chip');
				cell.appendChild(chip);
			});

			// Show overflow label if more cards exist
			if (remaining > 0) {
				const overflowLabel = document.createElement('span');
				overflowLabel.className = 'overflow-label';
				overflowLabel.textContent = `+${remaining} more`;
				cell.appendChild(overflowLabel);
			}
		});
	}

	// ---------------------------------------------------------------------------
	// Navigation
	// ---------------------------------------------------------------------------

	private _navigate(direction: number): void {
		const granularity = this._densityProvider.getState().granularity;

		switch (granularity) {
			case 'month':
				this._currentMonth += direction;
				if (this._currentMonth > 11) {
					this._currentMonth = 0;
					this._currentYear += 1;
				} else if (this._currentMonth < 0) {
					this._currentMonth = 11;
					this._currentYear -= 1;
				}
				break;

			case 'week':
				// Advance/retreat by 7 days
				{
					const d = new Date(this._currentYear, this._currentMonth, this._currentDay);
					d.setDate(d.getDate() + direction * 7);
					this._currentYear = d.getFullYear();
					this._currentMonth = d.getMonth();
					this._currentDay = d.getDate();
				}
				break;

			case 'day':
				{
					const d = new Date(this._currentYear, this._currentMonth, this._currentDay);
					d.setDate(d.getDate() + direction);
					this._currentYear = d.getFullYear();
					this._currentMonth = d.getMonth();
					this._currentDay = d.getDate();
				}
				break;

			case 'quarter':
				this._currentMonth += direction * 3;
				while (this._currentMonth > 11) {
					this._currentMonth -= 12;
					this._currentYear += 1;
				}
				while (this._currentMonth < 0) {
					this._currentMonth += 12;
					this._currentYear -= 1;
				}
				break;

			case 'year':
				this._currentYear += direction;
				break;
		}

		// Rebuild and re-bind
		this._buildStructure(granularity);
		this._updatePeriodLabel(granularity);
		if (granularity === 'month' || granularity === 'week' || granularity === 'day') {
			const { timeField } = this._densityProvider.getState();
			const field = timeField as keyof CardDatum;
			const filteredCards = this._lastCards.filter((card) => card[field] != null);
			this._bindCards(filteredCards, field as string);
		}
	}

	// ---------------------------------------------------------------------------
	// Period label
	// ---------------------------------------------------------------------------

	private _updatePeriodLabel(granularity: TimeGranularity): void {
		if (!this._periodLabel) return;

		switch (granularity) {
			case 'month':
				this._periodLabel.textContent = `${MONTH_NAMES[this._currentMonth] ?? ''} ${this._currentYear}`;
				break;
			case 'week': {
				const d = new Date(this._currentYear, this._currentMonth, this._currentDay);
				const dayOfWeek = d.getDay();
				const weekStart = new Date(d);
				weekStart.setDate(d.getDate() - dayOfWeek);
				const weekEnd = new Date(weekStart);
				weekEnd.setDate(weekStart.getDate() + 6);
				this._periodLabel.textContent = `${_formatDateFromDate(weekStart)} – ${_formatDateFromDate(weekEnd)}`;
				break;
			}
			case 'day':
				this._periodLabel.textContent = _formatDate(this._currentYear, this._currentMonth + 1, this._currentDay);
				break;
			case 'quarter':
				this._periodLabel.textContent = `${this._currentYear} Q${_getQuarter(this._currentMonth)}`;
				break;
			case 'year':
				this._periodLabel.textContent = String(this._currentYear);
				break;
		}
	}

	// ---------------------------------------------------------------------------
	// IView — destroy
	// ---------------------------------------------------------------------------

	destroy(): void {
		// Unsubscribe from density provider
		if (this._densityUnsub) {
			this._densityUnsub();
			this._densityUnsub = null;
		}

		// Remove viewRoot from container
		if (this._viewRoot && this._container) {
			this._container.removeChild(this._viewRoot);
		}

		// Null all references
		this._container = null;
		this._viewRoot = null;
		this._navContainer = null;
		this._periodLabel = null;
		this._gridContainer = null;
		this._lastCards = [];
		this._lastGranularity = null;
	}
}

// ---------------------------------------------------------------------------
// Private date helpers
// ---------------------------------------------------------------------------

/**
 * Format a date as YYYY-MM-DD using zero-padded month and day.
 * @param year - full year
 * @param month - 1-indexed month
 * @param day - day of month
 */
function _formatDate(year: number, month: number, day: number): string {
	const m = String(month).padStart(2, '0');
	const d = String(day).padStart(2, '0');
	return `${year}-${m}-${d}`;
}

/**
 * Format a Date object as YYYY-MM-DD.
 */
function _formatDateFromDate(date: Date): string {
	return _formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Get 1-indexed quarter from 0-indexed month.
 */
function _getQuarter(month: number): number {
	return Math.floor(month / 3) + 1;
}
