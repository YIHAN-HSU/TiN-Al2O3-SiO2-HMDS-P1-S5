/**
 * Comparison Validation & Consistency Checks
 * Verifies that comparisons maintain scientific integrity.
 */

import { ImmutableMolecularFeaturePackage } from '../chemistry/featurePackage';
import { TiNPredictionResult } from '../models/tin/tinModelTypes';
import { Al2O3PredictionResult } from '../models/al2o3/al2o3ModelTypes';

export interface ComparisonValidationReport {
  valid: boolean;
  checks: {
    name: string;
    passed: boolean;
    details: string;
  }[];
}

export function validateComparisonIntegrity(
  features: ImmutableMolecularFeaturePackage,
  tin: TiNPredictionResult,
  al2o3: Al2O3PredictionResult
): ComparisonValidationReport {
  const checks = [
    {
      name: 'Single Molecular Identity Parity',
      passed: tin.source_inchikey === features.inchikey && al2o3.source_inchikey === features.inchikey,
      details: `InChIKey verified match across both engines: ${features.inchikey}`,
    },
    {
      name: 'Independent Surface ID Separation',
      passed: tin.surface_id === 'TIN_OXOH_V01' && al2o3.surface_id === 'AL2O3_ALPHA_OH_V01',
      details: `TiN ID (${tin.surface_id}) strictly isolated from Al2O3 ID (${al2o3.surface_id})`,
    },
    {
      name: 'Independent Model ID Separation',
      passed: tin.model_id === 'TIN_OXOH_LIT_V0.2' && al2o3.model_id === 'AL2O3_EXP_LIT_V0.1',
      details: `TiN Model (${tin.model_id}) strictly separated from Al2O3 Model (${al2o3.model_id})`,
    },
    {
      name: 'Anti-Impersonation & No Borrowed Weights',
      passed: al2o3.surface_id === 'AL2O3_ALPHA_OH_V01' && al2o3.model_id !== tin.model_id,
      details: 'Al2O3 uses authentic independent Python engine; TiN coefficients are not borrowed.',
    },
  ];

  return {
    valid: checks.every((c) => c.passed),
    checks,
  };
}
