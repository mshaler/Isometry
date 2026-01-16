/**
 * @cardboard/components
 *
 * D3.js component system for CardBoard's polymorphic data visualization.
 * Darwin-UI inspired, built on the reusable chart pattern.
 *
 * @example
 * ```ts
 * import { cbCard, cbCanvas, cbButton } from '@cardboard/components';
 * import '@cardboard/components/styles';
 *
 * const card = cbCard()
 *   .variant('glass')
 *   .interactive(true)
 *   .on('select', (e) => console.log('Selected:', e.data.id));
 *
 * d3.select('#container')
 *   .selectAll('.card-wrapper')
 *   .data(cards, d => d.id)
 *   .join('div')
 *   .call(card);
 * ```
 */

// Re-export everything from components
export * from './components';
