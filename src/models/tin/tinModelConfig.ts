/**
 * TiN Model Configuration & Constants
 * Completely isolated from Al2O3.
 */

export const TIN_CONFIG = {
  SURFACE_ID: 'TIN_OXOH_V01' as const,
  MODEL_ID: 'TIN_OXOH_LIT_V0.2' as const,
  MODEL_VERSION: '0.2' as const,
  TARGET_SURFACE: 'Oxidized/Hydroxylated TiN' as const,
  MODEL_TYPE: 'Exploratory Literature-Constrained Heuristic Screening' as const,
  DESCRIPTOR_SCHEMA_VERSION: '1.0.0' as const,

  // UNCALIBRATED HEURISTIC PARAMETERS (Sections 03 & 08):
  // Strictly labeled as uncalibrated. NOT fitted to TiN DFT literature.
  INTERCEPT_EV: -0.14,
  SLOPE_EV: -0.01667,
  PARAMETER_LABEL: 'UNCALIBRATED HEURISTIC PARAMETERS' as const,

  // Group Contribution Weights on Oxidized TiN
  WEIGHTS: {
    MW: 0.118,
    MolLogP: 2.4,
    TPSA: 0.22,
    HBD: 7.2,
    HBA: 4.6,
    OH: 18.2,
    carbonyl: 12.8,
    COOH: 21.5,
    ester: 5.2,
    ether: 4.1,
    amine: 16.2,
    amide: 16.4,
    nitrile: 9.2,
    aromatic_ring: 11.0,
    alkene_cc: 4.2,
  },
};
