// Isometry v5 -- Phase 52 SampleDataManager
// Thin orchestrator for loading/clearing sample data via the Worker bridge.
//
// Requirements:
//   SMPL-06: Three curated datasets with connections for visual impact
//   SMPL-02: Sample data visually identifiable in audit overlay (source='sample')

import type { WorkerBridgeLike } from '../views/types';
import type { SampleCard, SampleConnection, SampleDataset } from './types';

export class SampleDataManager {
	private bridge: WorkerBridgeLike;
	private datasets: SampleDataset[];

	constructor(bridge: WorkerBridgeLike, datasets: SampleDataset[]) {
		this.bridge = bridge;
		this.datasets = datasets;
	}

	/**
	 * Load a dataset by ID. Clears existing sample data first (idempotent).
	 * Cards use INSERT OR REPLACE; connections use INSERT OR IGNORE.
	 */
	async load(datasetId: string): Promise<void> {
		const dataset = this.datasets.find((d) => d.id === datasetId);
		if (!dataset) throw new Error(`Unknown dataset: ${datasetId}`);

		// Clear existing sample data first (idempotent reload)
		await this.clear();

		// Insert cards
		for (const card of dataset.cards) {
			await this._insertCard(card);
		}

		// Insert connections
		for (const conn of dataset.connections) {
			await this._insertConnection(conn);
		}
	}

	/**
	 * Remove all sample data. Connections cascade via FK ON DELETE CASCADE.
	 */
	async clear(): Promise<void> {
		await this.bridge.send('db:exec', {
			sql: "DELETE FROM cards WHERE source = 'sample'",
			params: [],
		});
	}

	/**
	 * Check if any sample data is currently loaded.
	 */
	async hasSampleData(): Promise<boolean> {
		const result = (await this.bridge.send('db:query', {
			sql: "SELECT COUNT(*) as count FROM cards WHERE source = 'sample'",
			params: [],
		})) as { columns: string[]; rows: Array<{ count: number }> };
		const firstRow = result.rows[0];
		return result.rows.length > 0 && firstRow !== undefined && firstRow.count > 0;
	}

	/**
	 * Returns the full dataset registry.
	 */
	getDatasets(): SampleDataset[] {
		return this.datasets;
	}

	/**
	 * Returns a dataset based on day-of-year rotation.
	 */
	getDefaultDataset(): SampleDataset {
		const dayOfYear = Math.floor(
			(Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
		);
		// Non-null assertion safe: datasets.length > 0 is a constructor invariant
		return this.datasets[dayOfYear % this.datasets.length]!;
	}

	// -----------------------------------------------------------------------
	// Private helpers
	// -----------------------------------------------------------------------

	private async _insertCard(card: SampleCard): Promise<void> {
		await this.bridge.send('db:exec', {
			sql: `INSERT OR REPLACE INTO cards (
				id, card_type, name, content, summary,
				latitude, longitude, location_name,
				created_at, modified_at, due_at, completed_at,
				event_start, event_end,
				folder, tags, status,
				priority, sort_order,
				url, mime_type, is_collective,
				source, source_id, source_url
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			params: [
				card.id,
				card.card_type,
				card.name,
				card.content,
				card.summary,
				card.latitude,
				card.longitude,
				card.location_name,
				card.created_at,
				card.modified_at,
				card.due_at,
				card.completed_at,
				card.event_start,
				card.event_end,
				card.folder,
				JSON.stringify(card.tags),
				card.status,
				card.priority,
				card.sort_order,
				card.url,
				card.mime_type,
				card.is_collective ? 1 : 0,
				card.source,
				card.source_id,
				card.source_url,
			],
		});
	}

	private async _insertConnection(conn: SampleConnection): Promise<void> {
		await this.bridge.send('db:exec', {
			sql: `INSERT OR IGNORE INTO connections
				(id, source_id, target_id, via_card_id, label, weight, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
			params: [
				conn.id,
				conn.source_id,
				conn.target_id,
				conn.via_card_id,
				conn.label,
				conn.weight,
				conn.created_at,
			],
		});
	}
}
