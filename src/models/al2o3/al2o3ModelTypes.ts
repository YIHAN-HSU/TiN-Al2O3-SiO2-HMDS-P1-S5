/**
 * Al2O3 Model Types & Interfaces
 * Surface: Hydroxylated Al2O3 (AL2O3_ALPHA_OH_V01)
 * Model ID: AL2O3_EXP_LIT_V0.1 (Version 0.1.2)
 */

export interface Al2O3ModelStatus {
  installed: boolean;
  code: 'AL2O3_MODEL_READY' | 'AL2O3_MODEL_NOT_INSTALLED' | 'PYTHON_ERROR';
  message: string;
}

export interface Al2O3FunctionalGroupContribution {
  raw_count: number;
  capped_count: number;
  cap_limit: number;
  delta_ev: number;
  unit_delta_ev: number;
  description: string;
}

export interface Al2O3PredictionResult {
  installed: boolean;
  status_code: 'SUCCESS' | 'AL2O3_MODEL_NOT_INSTALLED' | 'PYTHON_ERROR' | 'INVALID_MOLECULE' | 'INCHIKEY_MISMATCH';
  surface_id: 'AL2O3_ALPHA_OH_V01';
  target_surface: string;
  model_id: string;
  model_version: string;
  calibration_status: string;
  dft_status: string;
  source_inchikey: string;

  canonical_smiles?: string;
  formula?: string;
  molecular_weight?: number;

  predicted_eads_ev: number | null;
  raw_predicted_eads_ev: number | null;
  predicted_eads_display: string;
  relative_affinity_score: number | null;
  affinity_class: 'HIGH' | 'MODERATE' | 'LOW' | null;

  baseline_intercept_ev?: number;
  dispersion_contribution_ev?: number;
  detected_groups?: string[];
  functional_group_contributions?: Record<string, Al2O3FunctionalGroupContribution>;
  capped_counts?: Record<string, number>;
  raw_counts?: Record<string, number>;
  descriptors?: Record<string, any>;

  confidence?: number | null;
  uncertainty_ev?: number | null;
  error?: string;
  note?: string;
  created_at: string;
}
