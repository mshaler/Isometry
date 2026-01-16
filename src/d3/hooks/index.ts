/**
 * D3 Hooks Index
 *
 * Re-exports all D3-related hooks for easy importing.
 */

export {
  useD3ViewLayout,
  type UseD3ViewLayoutOptions,
  type D3ViewLayout,
} from './useD3ViewLayout';

export {
  useD3DataBinding,
  defaultGroupEnter,
  defaultRectEnter,
  defaultCircleEnter,
  defaultTextEnter,
  type DataBindingOptions,
  type DataBindingResult,
} from './useD3DataBinding';

export {
  useD3Scales,
  useLinearScale,
  useBandScale,
  useTimeScale,
  useColorScale,
  type UseD3ScalesOptions,
  type D3Scales,
} from './useD3Scales';
