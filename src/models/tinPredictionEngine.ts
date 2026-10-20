/**
 * TiN ADSORPTION SCREENING ENGINE v0.2
 * Exploratory Literature-Constrained Heuristic Screening Model
 *
 * Model ID: TIN_OXOH_LIT_V0.2
 * Model Version: 0.2
 * Surface ID: TIN_OXOH_V01
 * Target Surface: Oxidized/Hydroxylated TiN
 * Model Type: Exploratory Literature-Constrained Heuristic Screening
 *
 * STRICT GOVERNANCE (Sections 04 & 05):
 * - NO PRESET Eads LOWER LIMIT.
 * - NO CLAMP, CLIP, OR TRUNCATION OF Eads. Preserves full raw range.
 *   UNCALIBRATED HEURISTIC PARAMETERS. They are NOT fitted to TiN DFT literature.
 * - Heuristic model is NEVER declared as validated ML or DFT prediction.
 * - Calibration window is removed: Applicability Domain is 'NOT ESTABLISHED'.
 * - Uncertainty is 'NOT CALIBRATED' (stored as null in SQLite).
 * - DFT Eads is 'NOT CALCULATED'.
 * - Relative Affinity is an independent 0–100 heuristic screening score.
 */

import { TIN_GROUP_LITERATURE_SUPPORT } from './literatureReferences';

export interface DescriptorsInput {
  MW: number;
  MolLogP: number;
  TPSA: number;
  HBD: number;
  HBA: number;
  RotatableBonds: number;
  HeavyAtomCount: number;
  RingCount: number;
  AromaticRingCount: number;
  FractionCsp3: number;
  FormalCharge: number;
  OAtomCount: number;
  NAtomCount: number;
  HeteroatomCount: number;
  MorganFingerprint?: any;
}

export interface FunctionalGroupDetectionMap {
  [groupKey: string]: {
    count: number;
    label: string;
    smarts: string;
    matchedAtoms?: number[][];
  };
}

export type AffinityClass = 'VERY LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';
export type ConfidenceTier = 'MEDIUM' | 'LOW';
export type LiteratureCoverageTier = 'QUALITATIVE ANCHORS' | 'EXTRAPOLATED / NO QUANTITATIVE DATA';

export interface TiNPredictionResult {
  surface_id: 'TIN_OXOH_V01';
  target_surface: 'Oxidized/Hydroxylated TiN';
  model_id: 'TIN_OXOH_LIT_V0.2';
  model_version: '0.2';
  model_type: 'Exploratory Literature-Constrained Heuristic Screening';

  raw_predicted_eads_ev: number;
  predicted_eads_ev: number;
  predicted_eads_display: string; // 2 decimal places, e.g. "-1.37 eV"

  relative_affinity_score: number; // 0–100 independent heuristic screening score
  affinity_class: AffinityClass;

  confidence: ConfidenceTier;
  uncertainty_ev: null; // Section 05: 'NOT CALIBRATED', null in database

  literature_coverage: LiteratureCoverageTier;
  supported_groups: string[];
  extrapolated_groups: string[];

  applicability_domain: 'NOT ESTABLISHED';
  stereochemistry_sensitivity: 'NOT EXPLICITLY MODELED';
  dft_eads: 'NOT CALCULATED';

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
}

/**
 * Pure physical descriptor and group contribution functions for Oxidized/Hydroxylated TiN.
 * NO CLAMPING IS USED ANYWHERE.
 */
export function calculate_tin_components(
  desc: DescriptorsInput,
  fg: FunctionalGroupDetectionMap
) {
  // 1. Molecular size & dispersion component (contact footprint on oxidized TiN)
  const size_component = 0.118 * desc.MW + 2.4 * desc.MolLogP;

  // 2. Polarity component (dipole interaction with Ti-O / Ti-OH surface dipoles)
  const polarity_component = 0.22 * desc.TPSA;

  // 3. Hydrogen bonding component
  // HBD binds surface bridging O and N sites; HBA binds surface Ti-OH protons and Ti lewis acid sites
  const hbond_component = 7.2 * desc.HBD + 4.6 * desc.HBA;

  // 4. Oxygen groups component
  let oxygen_interaction_component = 0;
  if (fg.OH && fg.OH.count > 0) {
    // Qualitative anchor from Ref A/B/C: dissociative and molecular water/alcohol H-bonding
    oxygen_interaction_component += 18.2 * fg.OH.count;
  }
  if (fg.carbonyl && fg.carbonyl.count > 0) {
    // Qualitative anchor from Ref C: *CH2O / C=O coordination
    oxygen_interaction_component += 12.8 * fg.carbonyl.count;
  }
  if (fg.COOH && fg.COOH.count > 0) {
    // Extrapolated bidentate coordination
    oxygen_interaction_component += 21.5 * fg.COOH.count;
  }
  if (fg.ester && fg.ester.count > 0) {
    // Extrapolated ester carbonyl dipole interaction
    oxygen_interaction_component += 5.2 * fg.ester.count;
  }
  if (fg.ether && fg.ether.count > 0) {
    // Extrapolated ether C-O-C lone pair coordination
    oxygen_interaction_component += 4.1 * fg.ether.count;
  }

  // 5. Nitrogen groups component
  let nitrogen_interaction_component = 0;
  if (fg.amine && fg.amine.count > 0) {
    // Qualitative anchor from Ref D: NH3 / Lewis base coordination to surface Ti
    nitrogen_interaction_component += 16.2 * fg.amine.count;
  }
  if (fg.amide && fg.amide.count > 0) {
    // Extrapolated dual C=O / N-H interaction
    nitrogen_interaction_component += 16.4 * fg.amide.count;
  }
  if (fg.nitrile && fg.nitrile.count > 0) {
    // Extrapolated end-on C#N coordination
    nitrogen_interaction_component += 9.2 * fg.nitrile.count;
  }

  // 6. Aromatic component
  let aromatic_component = 0;
  if (fg.aromatic_ring && fg.aromatic_ring.count > 0) {
    // Qualitative anchor from Ref E diazonium grafting; planar pi-dispersion
    aromatic_component += 11.0 * fg.aromatic_ring.count;
  }

  // 7. Olefinic / functional group component
  let functional_group_component = 0;
  if (fg.alkene_cc && fg.alkene_cc.count > 0) {
    // Extrapolated pi-electron interaction
    functional_group_component += 4.2 * fg.alkene_cc.count;
  }

  const raw_interaction_score =
    size_component +
    polarity_component +
    hbond_component +
    oxygen_interaction_component +
    nitrogen_interaction_component +
    aromatic_component +
    functional_group_component;

  return {
    size_component,
    polarity_component,
    hbond_component,
    oxygen_interaction_component,
    nitrogen_interaction_component,
    aromatic_component,
    functional_group_component,
    raw_interaction_score,
  };
}

/**
 * Predicts adsorption on Oxidized/Hydroxylated TiN (TIN_OXOH_V01).
 * NO CLAMPING IS EVER APPLIED TO Eads.
 * Raw values are preserved exactly.
 */
export function predict_tin_oxoh_adsorption(
  desc: DescriptorsInput,
  fg: FunctionalGroupDetectionMap
): TiNPredictionResult {
  const comp = calculate_tin_components(desc, fg);

  // UNCALIBRATED HEURISTIC PARAMETERS (Sections 04 & 05):
  // -0.14 eV intercept, -0.01667 eV/score slope
  // Strictly labeled as uncalibrated. NOT fitted to TiN DFT literature.
  const INTERCEPT_EV = -0.14;
  const SLOPE_EV = -0.01667;

  // ABSOLUTELY NO LIMITS / BOUNDS / CLAMP / CLIP (Section 05):
  const raw_predicted_eads_ev = INTERCEPT_EV + SLOPE_EV * comp.raw_interaction_score;
  const predicted_eads_ev = raw_predicted_eads_ev;

  // Relative Surface Affinity:
  // Independently scored 0–100 heuristic screening score based on interaction potential.
  // CRITICAL RULE (Section 05): NOT mapped from fixed min/max Eads linear clipping!
  let relative_affinity_score = Math.round(
    100 / (1 + Math.exp(-0.045 * (comp.raw_interaction_score - 45)))
  );
  if (relative_affinity_score < 0) relative_affinity_score = 0;
  if (relative_affinity_score > 100) relative_affinity_score = 100;

  // Affinity Class (Section 08):
  let affinity_class: AffinityClass = 'MODERATE';
  if (relative_affinity_score <= 20) affinity_class = 'VERY LOW';
  else if (relative_affinity_score <= 40) affinity_class = 'LOW';
  else if (relative_affinity_score <= 60) affinity_class = 'MODERATE';
  else if (relative_affinity_score <= 80) affinity_class = 'HIGH';
  else affinity_class = 'VERY HIGH';

  // Identify supported vs extrapolated groups
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

  // Literature Coverage determination
  let literature_coverage: LiteratureCoverageTier = 'EXTRAPOLATED / NO QUANTITATIVE DATA';
  const hasQualitativeAnchor = supported_groups.length > 0;
  if (hasQualitativeAnchor && extrapolated_groups.length === 0) {
    literature_coverage = 'QUALITATIVE ANCHORS';
  } else {
    literature_coverage = 'EXTRAPOLATED / NO QUANTITATIVE DATA';
  }

  // Confidence determination
  let confidence: ConfidenceTier = 'LOW';
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

  // Warning (Section 04):
  const warning =
    'EXPLORATORY SCREENING ESTIMATE: Parameters (-0.14 eV intercept, -0.01667 eV/score slope) are UNCALIBRATED HEURISTIC PARAMETERS and are NOT fitted to TiN DFT literature. Not a converged DFT adsorption energy nor a validated ML model.';

  // Build transparent explanation (Section 08)
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
    surface_id: 'TIN_OXOH_V01',
    target_surface: 'Oxidized/Hydroxylated TiN',
    model_id: 'TIN_OXOH_LIT_V0.2',
    model_version: '0.2',
    model_type: 'Exploratory Literature-Constrained Heuristic Screening',

    raw_predicted_eads_ev,
    predicted_eads_ev,
    predicted_eads_display: `${predicted_eads_ev.toFixed(2)} eV`,

    relative_affinity_score,
    affinity_class,

    confidence,
    uncertainty_ev: null, // NOT CALIBRATED

    literature_coverage,
    supported_groups,
    extrapolated_groups,

    applicability_domain: 'NOT ESTABLISHED',
    stereochemistry_sensitivity: 'NOT EXPLICITLY MODELED',
    dft_eads: 'NOT CALCULATED',

    parameter_status: {
      intercept_ev: INTERCEPT_EV,
      slope_ev_per_score: SLOPE_EV,
      label: 'UNCALIBRATED HEURISTIC PARAMETERS',
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
          value: Number(comp.size_component.toFixed(2)),
          description: 'Molecular contact area on oxidized TiN interface',
        },
        {
          component: 'Polar Coupling',
          value: Number(comp.polarity_component.toFixed(2)),
          description: 'TPSA interaction with surface Ti-O/Ti-OH dipoles',
        },
        {
          component: 'H-Bonding Network',
          value: Number(comp.hbond_component.toFixed(2)),
          description: 'HBD and HBA interaction with surface oxygens and Ti centers',
        },
        {
          component: 'Oxygen Interaction Potential',
          value: Number(comp.oxygen_interaction_component.toFixed(2)),
          description: 'OH and Carbonyl qualitative anchors + model-estimated O groups',
        },
        {
          component: 'Nitrogen Interaction Potential',
          value: Number(comp.nitrogen_interaction_component.toFixed(2)),
          description: 'Amine / N-donor Lewis coordination qualitative anchor + amides/nitriles',
        },
        {
          component: 'Aromatic & Alkene Pi-Dispersion',
          value: Number((comp.aromatic_component + comp.functional_group_component).toFixed(2)),
          description: 'Planar ring and pi-electron dispersion',
        },
      ],
    },
  };
}
