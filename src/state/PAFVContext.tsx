import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { PAFVState } from '../types/pafv';
import { DEFAULT_PAFV } from '../types/pafv';

type PAFVAction =
  | { type: 'SET_X_AXIS'; payload: string | null }
  | { type: 'SET_Y_AXIS'; payload: string | null }
  | { type: 'SET_Z_AXIS'; payload: string | null }
  | { type: 'MOVE_TO_AVAILABLE'; payload: string }
  | { type: 'RESET' };

function pafvReducer(state: PAFVState, action: PAFVAction): PAFVState {
  switch (action.type) {
    case 'SET_X_AXIS': {
      const oldX = state.xAxis;
      const newAvailable = state.available.filter(id => id !== action.payload);
      if (oldX) newAvailable.push(oldX);
      return { ...state, xAxis: action.payload, available: newAvailable };
    }
    case 'SET_Y_AXIS': {
      const oldY = state.yAxis;
      const newAvailable = state.available.filter(id => id !== action.payload);
      if (oldY) newAvailable.push(oldY);
      return { ...state, yAxis: action.payload, available: newAvailable };
    }
    case 'SET_Z_AXIS': {
      const oldZ = state.zAxis;
      const newAvailable = state.available.filter(id => id !== action.payload);
      if (oldZ) newAvailable.push(oldZ);
      return { ...state, zAxis: action.payload, available: newAvailable };
    }
    case 'MOVE_TO_AVAILABLE': {
      const facetId = action.payload;
      return {
        ...state,
        xAxis: state.xAxis === facetId ? null : state.xAxis,
        yAxis: state.yAxis === facetId ? null : state.yAxis,
        zAxis: state.zAxis === facetId ? null : state.zAxis,
        available: state.available.includes(facetId) 
          ? state.available 
          : [...state.available, facetId],
      };
    }
    case 'RESET':
      return DEFAULT_PAFV;
    default:
      return state;
  }
}

interface PAFVContextValue {
  pafv: PAFVState;
  setXAxis: (facetId: string | null) => void;
  setYAxis: (facetId: string | null) => void;
  setZAxis: (facetId: string | null) => void;
  moveToAvailable: (facetId: string) => void;
  reset: () => void;
}

const PAFVContext = createContext<PAFVContextValue | null>(null);

export function PAFVProvider({ children }: { children: React.ReactNode }) {
  const [pafv, dispatch] = useReducer(pafvReducer, DEFAULT_PAFV);
  
  const setXAxis = useCallback((facetId: string | null) => {
    dispatch({ type: 'SET_X_AXIS', payload: facetId });
  }, []);
  
  const setYAxis = useCallback((facetId: string | null) => {
    dispatch({ type: 'SET_Y_AXIS', payload: facetId });
  }, []);
  
  const setZAxis = useCallback((facetId: string | null) => {
    dispatch({ type: 'SET_Z_AXIS', payload: facetId });
  }, []);
  
  const moveToAvailable = useCallback((facetId: string) => {
    dispatch({ type: 'MOVE_TO_AVAILABLE', payload: facetId });
  }, []);
  
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);
  
  return (
    <PAFVContext.Provider value={{ pafv, setXAxis, setYAxis, setZAxis, moveToAvailable, reset }}>
      {children}
    </PAFVContext.Provider>
  );
}

export function usePAFV(): PAFVContextValue {
  const context = useContext(PAFVContext);
  if (!context) {
    throw new Error('usePAFV must be used within PAFVProvider');
  }
  return context;
}
