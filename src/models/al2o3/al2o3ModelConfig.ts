/**
 * Al2O3 Model Configuration
 * Surface: AL2O3_ALPHA_OH_V01
 * Model ID: AL2O3_EXP_LIT_V0.1 (Version 0.1.2)
 * Target Surface: Hydroxylated Alpha-Al2O3(0001)
 *
 * Section 01 & 04 Governance:
 * - Must NOT copy TiN parameters or weights.
 * - Must NOT fabricate coefficients.
 * - Executes authentic Python RDKit screening engine via isolated adapter.
 */

export const AL2O3_CONFIG = {
  SURFACE_ID: 'AL2O3_ALPHA_OH_V01' as const,
  MODEL_ID: 'AL2O3_EXP_LIT_V0.1' as const,
  MODEL_VERSION: '0.1.2' as const,
  TARGET_SURFACE: 'Hydroxylated alpha-Al2O3(0001)' as const,
  STATUS: 'AL2O3_MODEL_READY' as const,
  IS_INSTALLED: true as const,
  CALIBRATION_STATUS: 'EXPLORATORY_DESCRIPTOR_HEURISTIC_UNCALIBRATED' as const,
  DFT_STATUS: 'NOT CALCULATED' as const,
  ENGINE_SCRIPT: 'backend/engines/al2o3/rdkit_engine.py' as const,
  CLI_SCRIPT: 'scripts/rdkit_engine.py' as const,
  NOTICE:
    'Independent Hydroxylated Al2O3(0001) screening engine. Strictly isolated from TiN model parameters.',
};
