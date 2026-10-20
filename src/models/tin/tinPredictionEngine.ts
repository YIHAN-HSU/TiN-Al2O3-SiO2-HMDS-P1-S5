/**
 * TiN ADSORPTION SCREENING ENGINE v0.2
 * Model ID: TIN_OXOH_LIT_V0.2
 * Surface ID: TIN_OXOH_V01
 * Target Surface: Oxidized/Hydroxylated TiN
 *
 * Isolated TiN Prediction Engine (Section 03):
 * - Reads only from models/tin/*
 * - Uses shared ImmutableMolecularFeaturePackage
 * - NO CLAMP, NO CLIP, NO Eads PRESET LIMITS
 * - Uncalibrated heuristic parameters (-0.14 eV intercept, -0.01667 eV slope)
 */

import { ImmutableMolecularFeaturePackage } from '../../chemistry/featurePackage';
import { TiNPredictionResult, TiNAffinityClass, TiNConfidenceTier, TiNLiteratureCoverageTier } from './tinModelTypes';
import { TIN_CONFIG } from './tinModelConfig';
import { TIN_GROUP_LITERATURE_SUPPORT } from './tinLiteratureDataset';

export * from './tinModelTypes';
export * from './tinModelConfig';
export * from './tinLiteratureDataset';

/**
 * Predicts adsorption on Oxidized/Hydroxylated TiN (TIN_OXOH_V01).
 * Consumes the shared Immutable Molecular Feature Package.
 */
export function predictTiNOxOH(
  features: ImmutableMolecularFeaturePackage
): TiNPredictionResult {
  const desc = features.descriptors;
  const fg = features.functional_groups;
  const W = TIN_CONFIG.WEIGHTS;

  // 1. Molecular size & dispersion
  const size_component = W.MW * desc.MW + W.MolLogP * desc.MolLogP;

  // 2. Polarity coupling
  const polarity_component = W.TPSA * desc.TPSA;

  // 3. Hydrogen bonding network
  const hbond_component = W.HBD * desc.HBD + W.HBA * desc.HBA;

  // 4. Oxygen groups interaction potential
  let oxygen_interaction_component = 0;
  if (fg.OH && fg.OH.count > 0) oxygen_interaction_component += W.OH * fg.OH.count;
  if (fg.carbonyl && fg.carbonyl.count > 0) oxygen_interaction_component += W.carbonyl * fg.carbonyl.count;
  if (fg.COOH && fg.COOH.count > 0) oxygen_interaction_component += W.COOH * fg.COOH.count;
  if (fg.ester && fg.ester.count > 0) oxygen_interaction_component += W.ester * fg.ester.count;
  if (fg.ether && fg.ether.count > 0) oxygen_interaction_component += W.ether * fg.ether.count;

  // 5. Nitrogen groups interaction potential
  let nitrogen_interaction_component = 0;
  if (fg.amine && fg.amine.count > 0) nitrogen_interaction_component += W.amine * fg.amine.count;
  if (fg.amide && fg.amide.count > 0) nitrogen_interaction_component += W.amide * fg.amide.count;
  if (fg.nitrile && fg.nitrile.count > 0) nitrogen_interaction_component += W.nitrile * fg.nitrile.count;

  // 6. Aromatic component
  let aromatic_component = 0;
  if (fg.aromatic_ring && fg.aromatic_ring.count > 0) {
    aromatic_component += W.aromatic_ring * fg.aromatic_ring.count;
  }

  // 7. Olefinic component
  let functional_group_component = 0;
  if (fg.alkene_cc && fg.alkene_cc.count > 0) {
    functional_group_component += W.alkene_cc * fg.alkene_cc.count;
  }

  const raw_interaction_score =
    size_component +
    polarity_component +
    hbond_component +
    oxygen_interaction_component +
    nitrogen_interaction_component +
    aromatic_component +
    functional_group_component;

  // UNCALIBRATED HEURISTIC PARAMETERS (Sections 03 & 08):
  // raw_predicted_eads_ev = -0.14 - 0.01667 * interaction_score
  // NO CLAMP, NO CLIP, NO MIN/MAX BOUNDS.
  const raw_predicted_eads_ev =
    TIN_CONFIG.INTERCEPT_EV + TIN_CONFIG.SLOPE_EV * raw_interaction_score;
  const predicted_eads_ev = raw_predicted_eads_ev;

  // Relative Surface Affinity (independent 0–100 heuristic scale)
  let relative_affinity_score = Math.round(
    100 / (1 + Math.exp(-0.045 * (raw_interaction_score - 45)))
  );
  if (relative_affinity_score < 0) relative_affinity_score = 0;
  if (relative_affinity_score > 100) relative_affinity_score = 100;

  let affinity_class: TiNAffinityClass = 'MODERATE';
  if (relative_affinity_score <= 20) affinity_class = 'VERY LOW';
  else if (relative_affinity_score <= 40) affinity_class = 'LOW';
  else if (relative_affinity_score <= 60) affinity_class = 'MODERATE';
  else if (relative_affinity_score <= 80) affinity_class = 'HIGH';
  else affinity_class = 'VERY HIGH';

  const supported_groups: string[] = [];
  const extrapolated_groups: string[] = [];
  const detectedKeys = Object.keys(fg).filter((k) => fg[k] && fg[k].count > 0);

  for (const k of detectedKeys) {
    const meta = TIN_GROUP_LITERATURE_SUPPORT[k];
    if (meta) {
      if (meta.qualitativeSupport === 'QUALITATIVE LITERATURE SUPPORT') {
        supported_groups.push(meta.label);
      } else {
        extrapolated_groups.push(meta.label);
      }
    }
  }

  let literature_coverage: TiNLiteratureCoverageTier = 'EXTRAPOLATED / NO QUANTITATIVE DATA';
  if (supported_groups.length > 0 && extrapolated_groups.length === 0) {
    literature_coverage = 'QUALITATIVE ANCHORS';
  } else {
    literature_coverage = 'EXTRAPOLATED / NO QUANTITATIVE DATA';
  }

  let confidence: TiNConfidenceTier = 'LOW';
  if (
    literature_coverage === 'QUALITATIVE ANCHORS' &&
    desc.MW <= 180 &&
    desc.RingCount <= 1 &&
    extrapolated_groups.length === 0
  ) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  const warning =
    'EXPLORATORY HEURISTIC ESTIMATE: Parameters (-0.14 eV intercept, -0.01667 eV/score slope) are UNCALIBRATED HEURISTIC PARAMETERS and are NOT fitted to TiN DFT literature. Not a converged DFT adsorption energy nor a validated ML model.';

  const mainFeatures: string[] = [];
  if (desc.MW > 150) mainFeatures.push(`Molecular contact footprint (MW = ${desc.MW.toFixed(1)})`);
  else mainFeatures.push(`Compact molecular footprint (MW = ${desc.MW.toFixed(1)})`);

  if (desc.TPSA > 30) mainFeatures.push(`Surface dipole coupling (TPSA = ${desc.TPSA.toFixed(1)} Å²)`);
  if (desc.HBD > 0) mainFeatures.push(`${desc.HBD} H-bond donor(s)`);
  if (desc.HBA > 0) mainFeatures.push(`${desc.HBA} H-bond acceptor(s)`);

  detectedKeys.forEach((k) => {
    mainFeatures.push(`${fg[k].label} × ${fg[k].count}`);
  });

  return {
    material_id: features.material_id,
    source_inchikey: features.inchikey,
    surface_id: TIN_CONFIG.SURFACE_ID,
    target_surface: TIN_CONFIG.TARGET_SURFACE,
    model_id: TIN_CONFIG.MODEL_ID,
    model_version: TIN_CONFIG.MODEL_VERSION,
    model_type: TIN_CONFIG.MODEL_TYPE,
    descriptor_schema_version: TIN_CONFIG.DESCRIPTOR_SCHEMA_VERSION,

    raw_predicted_eads_ev,
    predicted_eads_ev,
    predicted_eads_display: `${predicted_eads_ev.toFixed(2)} eV`,

    relative_affinity_score,
    affinity_class,

    confidence,
    uncertainty_ev: null,

    literature_coverage,
    supported_groups,
    extrapolated_groups,

    applicability_domain: 'NOT ESTABLISHED',
    stereochemistry_sensitivity: 'NOT EXPLICITLY MODELED',
    dft_eads: 'NOT CALCULATED',

    prediction_type: 'HEURISTIC_EXPLORATORY',
    calibration_status: 'UNCALIBRATED HEURISTIC PARAMETERS',

    parameter_status: {
      intercept_ev: TIN_CONFIG.INTERCEPT_EV,
      slope_ev_per_score: TIN_CONFIG.SLOPE_EV,
      label: TIN_CONFIG.PARAMETER_LABEL,
      dft_fitted: false,
      validated_ml: false,
    },

    warning,
    transparency_explanation: {
      main_contributing_features: mainFeatures,
      literature_support: literature_coverage,
      extrapolations: extrapolated_groups,
      parameter_provenance:
        'Parameters (-0.14 eV intercept, -0.01667 eV/score) are UNCALIBRATED HEURISTIC PARAMETERS. No published quantitative multi-group DFT dataset on oxidized TiN currently exists.',
      score_breakdown: [
        {
          component: 'Size & Dispersion',
          value: Number(size_component.toFixed(2)),
          description: 'Molecular contact area on oxidized TiN interface',
        },
        {
          component: 'Polar Coupling',
          value: Number(polarity_component.toFixed(2)),
          description: 'TPSA interaction with surface Ti-O/Ti-OH dipoles',
        },
        {
          component: 'H-Bonding Network',
          value: Number(hbond_component.toFixed(2)),
          description: 'HBD and HBA interaction with surface oxygens and Ti centers',
        },
        {
          component: 'Oxygen Interaction Potential',
          value: Number(oxygen_interaction_component.toFixed(2)),
          description: 'OH and Carbonyl qualitative anchors + model-estimated O groups',
        },
        {
          component: 'Nitrogen Interaction Potential',
          value: Number(nitrogen_interaction_component.toFixed(2)),
          description: 'Amine / N-donor Lewis coordination qualitative anchor + amides/nitriles',
        },
        {
          component: 'Aromatic & Alkene Pi-Dispersion',
          value: Number((aromatic_component + functional_group_component).toFixed(2)),
          description: 'Planar ring and pi-electron dispersion',
        },
      ],
    },
    created_at: new Date().toISOString(),
  };
}
