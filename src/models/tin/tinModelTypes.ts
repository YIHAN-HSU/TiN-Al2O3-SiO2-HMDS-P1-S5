/**
 * TiN Model Types & Interfaces
 * Surface: Oxidized/Hydroxylated TiN (TIN_OXOH_V01)
 * Model ID: TIN_OXOH_LIT_V0.2
 */

export type TiNAffinityClass = 'VERY LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';
export type TiNConfidenceTier = 'MEDIUM' | 'LOW';
export type TiNLiteratureCoverageTier = 'QUALITATIVE ANCHORS' | 'EXTRAPOLATED / NO QUANTITATIVE DATA';

export interface TiNPredictionResult {
  material_id?: number;
  source_inchikey: string;
  surface_id: 'TIN_OXOH_V01';
  target_surface: 'Oxidized/Hydroxylated TiN';
  model_id: 'TIN_OXOH_LIT_V0.2';
  model_version: '0.2';
  model_type: 'Exploratory Literature-Constrained Heuristic Screening';
  descriptor_schema_version: '1.0.0';

  raw_predicted_eads_ev: number;
  predicted_eads_ev: number;
  predicted_eads_display: string;

  relative_affinity_score: number;
  affinity_class: TiNAffinityClass;

  confidence: TiNConfidenceTier;
  uncertainty_ev: null;

  literature_coverage: TiNLiteratureCoverageTier;
  supported_groups: string[];
  extrapolated_groups: string[];

  applicability_domain: 'NOT ESTABLISHED';
  stereochemistry_sensitivity: 'NOT EXPLICITLY MODELED';
  dft_eads: 'NOT CALCULATED';

  prediction_type: 'HEURISTIC_EXPLORATORY';
  calibration_status: 'UNCALIBRATED HEURISTIC PARAMETERS';

  parameter_status: {
    intercept_ev: number;
    slope_ev_per_score: number;
    label: 'UNCALIBRATED HEURISTIC PARAMETERS';
    dft_fitted: false;
    validated_ml: false;
  };

  warning: string;
  transparency_explanation: {
    main_contributing_features: string[];
    literature_support: string;
    extrapolations: string[];
    parameter_provenance: string;
    score_breakdown: {
      component: string;
      value: number;
      description: string;
    }[];
  };
  created_at: string;
}
