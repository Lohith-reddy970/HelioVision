import { create } from 'zustand'

export type AnalysisState = 'idle' | 'analyzing' | 'estimating' | 'calculating' | 'success' | 'error'

interface AppState {
  analysisState: AnalysisState;
  imageUrl: string | null;
  roofDetectionResult: any | null;
  solarEstimationResult: any | null;
  savingsPredictionResult: any | null;
  
  setImageUrl: (url: string | null) => void;
  setAnalysisState: (state: AnalysisState) => void;
  setRoofDetectionResult: (result: any) => void;
  setSolarEstimationResult: (result: any) => void;
  setSavingsPredictionResult: (result: any) => void;
  
  resetAnalysis: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  analysisState: 'idle',
  imageUrl: null,
  roofDetectionResult: null,
  solarEstimationResult: null,
  savingsPredictionResult: null,
  
  setImageUrl: (url) => set({ imageUrl: url }),
  setAnalysisState: (state) => set({ analysisState: state }),
  setRoofDetectionResult: (result) => set({ roofDetectionResult: result }),
  setSolarEstimationResult: (result) => set({ solarEstimationResult: result }),
  setSavingsPredictionResult: (result) => set({ savingsPredictionResult: result }),
  
  resetAnalysis: () => set({ 
    analysisState: 'idle', 
    imageUrl: null, 
    roofDetectionResult: null, 
    solarEstimationResult: null, 
    savingsPredictionResult: null 
  }),
}))
