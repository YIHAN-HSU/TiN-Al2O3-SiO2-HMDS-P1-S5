/**
 * Comparison Types & Interfaces
 * Governs dual-surface comparative adsorption (TiN vs Al2O3)
 */

import { TiNPredictionResult } from '../models/tin/tinModelTypes';
import { Al2O3PredictionResult } from '../models/al2o3/al2o3ModelTypes';

export interface DualSurfaceComparisonResult {
  material_id?: number;
  inchikey: string;
  canonical_smiles: string;
  formula: string;

  // Surface 1: TiN
  tin: TiNPredictionResult;

  // Surface 2: Al2O3
  al2o3: Al2O3PredictionResult;

  // Comparative metrics
  delta_eads_ev: number | null;
  delta_eads_label: string;
  comparison_status: 'COMPLETE' | 'AL2O3_UNAVAILABLE' | 'TIN_UNAVAILABLE' | 'PARTIAL_FAILED' | 'INCOMPATIBLE_ENERGY_DEFINITIONS';
  selectivity_preference: 'TiN_MORE_NEGATIVE' | 'Al2O3_MORE_NEGATIVE' | 'EQUAL_AFFINITY' | 'INCONCLUSIVE';
  interpretation: string;
  calibration_banner: string;

  disclaimer: string;
  compared_at: string;
}
