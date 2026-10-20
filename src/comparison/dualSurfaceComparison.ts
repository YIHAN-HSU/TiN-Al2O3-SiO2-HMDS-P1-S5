/**
 * Dual-Surface Adsorption Comparison Engine
 * Computes comparative metrics (ΔEads = Eads_TiN - Eads_Al2O3)
 * with strict error isolation, provenance checks, and scientific governance.
 */

import { TiNPredictionResult } from '../models/tin/tinModelTypes';
import { Al2O3PredictionResult } from '../models/al2o3/al2o3ModelTypes';
import { DualSurfaceComparisonResult } from './comparisonTypes';
import { ImmutableMolecularFeaturePackage } from '../chemistry/featurePackage';

export function compareDualSurfaceAdsorption(
  features: ImmutableMolecularFeaturePackage,
  tinResult: TiNPredictionResult,
  al2o3Result: Al2O3PredictionResult
): DualSurfaceComparisonResult {
  // Validate that both models evaluated the exact same molecule identity
  if (tinResult.source_inchikey !== al2o3Result.source_inchikey) {
    throw new Error(
      `MOLECULE_IDENTITY_MISMATCH: TiN evaluated ${tinResult.source_inchikey} but Al2O3 evaluated ${al2o3Result.source_inchikey}. Dual comparison aborted.`
    );
  }

  let deltaEads: number | null = null;
  let deltaLabel = 'UNAVAILABLE';
  let status: 'COMPLETE' | 'AL2O3_UNAVAILABLE' | 'TIN_UNAVAILABLE' | 'PARTIAL_FAILED' | 'INCOMPATIBLE_ENERGY_DEFINITIONS' = 'AL2O3_UNAVAILABLE';
  let selectivity: 'TiN_MORE_NEGATIVE' | 'Al2O3_MORE_NEGATIVE' | 'EQUAL_AFFINITY' | 'INCONCLUSIVE' = 'INCONCLUSIVE';
  let interpretation = 'Cross-surface comparison requires both models to execute successfully.';

  const hasTin = tinResult && typeof tinResult.predicted_eads_ev === 'number' && Number.isFinite(tinResult.predicted_eads_ev);
  const hasAl2o3 = al2o3Result && typeof al2o3Result.predicted_eads_ev === 'number' && Number.isFinite(al2o3Result.predicted_eads_ev) && al2o3Result.installed;

  if (hasTin && hasAl2o3) {
    // Both engines use eV as unit and vacuum reference state for isolated molecule
    deltaEads = Number((tinResult.predicted_eads_ev! - al2o3Result.predicted_eads_ev!).toFixed(4));
    deltaLabel = `${deltaEads > 0 ? '+' : ''}${deltaEads.toFixed(3)} eV`;
    status = 'COMPLETE';

    // Section 05 interpretation rules:
    // ΔEads < 0: TiN prediction is more negative (stronger adsorption on TiN)
    // ΔEads > 0: Al2O3 prediction is more negative (stronger adsorption on Al2O3)
    // ΔEads = 0: Numerically equal predictions
    if (deltaEads < -0.05) {
      selectivity = 'TiN_MORE_NEGATIVE';
      interpretation = `ΔEads < 0 (${deltaLabel}): TiN predicted adsorption energy is more negative than Al2O3.`;
    } else if (deltaEads > 0.05) {
      selectivity = 'Al2O3_MORE_NEGATIVE';
      interpretation = `ΔEads > 0 (${deltaLabel}): Al2O3 predicted adsorption energy is more negative than TiN.`;
    } else {
      selectivity = 'EQUAL_AFFINITY';
      interpretation = `ΔEads ≈ 0 (${deltaLabel}): Numerically equivalent predicted adsorption energy on both surfaces.`;
    }
  } else if (!hasAl2o3 && hasTin) {
    status = 'AL2O3_UNAVAILABLE';
    deltaLabel = al2o3Result?.error || 'AL2O3_UNAVAILABLE';
    selectivity = 'INCONCLUSIVE';
    interpretation = 'Al2O3 model failed or is not available. TiN prediction succeeded independently.';
  } else if (!hasTin && hasAl2o3) {
    status = 'TIN_UNAVAILABLE';
    deltaLabel = 'TIN_UNAVAILABLE';
    selectivity = 'INCONCLUSIVE';
    interpretation = 'TiN model failed. Al2O3 prediction succeeded independently.';
  } else {
    status = 'PARTIAL_FAILED';
    deltaLabel = 'BOTH_MODELS_UNAVAILABLE';
    selectivity = 'INCONCLUSIVE';
    interpretation = 'Neither surface model produced a valid numerical adsorption energy.';
  }

  return {
    material_id: features.material_id,
    inchikey: features.inchikey,
    canonical_smiles: features.canonical_smiles,
    formula: features.formula,
    tin: tinResult,
    al2o3: al2o3Result,
    delta_eads_ev: deltaEads,
    delta_eads_label: deltaLabel,
    comparison_status: status,
    selectivity_preference: selectivity,
    interpretation,
    calibration_banner: 'EXPLORATORY CROSS-SURFACE COMPARISON · NOT QUANTITATIVELY CALIBRATED',
    disclaimer:
      'EXPLORATORY CROSS-SURFACE COMPARISON: Not quantitatively calibrated across surfaces. True adsorption selectivity and DFT-level accuracy are not verified. For preliminary relative screening only.',
    compared_at: new Date().toISOString(),
  };
}
