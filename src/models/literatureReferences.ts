/**
 * TiN Literature Foundation & Support Levels v0.2
 *
 * Model ID: TIN_OXOH_LIT_V0.2
 * Target Surface: Oxidized/Hydroxylated TiN (TIN_OXOH_V01)
 *
 * Section 06 & 07 Governance:
 * - All published Eads data are candidate records PENDING_VERIFICATION against primary papers and SI.
 * - Functional Group Coverage Matrix: OH, COOH, ESTER, ETHER, AMINE, AMIDE, NITRILE, CARBONYL, AROMATIC, C=C.
 * - Every single group explicitly displays quantitative status: 'NO VERIFIED EADS'.
 * - Contact angle, XPS, TOF-SIMS, or grafting evidence does not constitute thermodynamic Eads.
 */

export interface LiteratureReference {
  id: 'Reference A' | 'Reference B' | 'Reference C' | 'Reference D' | 'Reference E';
  title: string;
  authors: string;
  journal: string;
  year: number;
  volume?: string;
  pages?: string;
  doi?: string;
  method?: string;
  system: string[];
  evidence: string[];
  use: string[];
  constraintNote?: string;
}

export const TIN_LITERATURE_REFERENCES: LiteratureReference[] = [
  {
    id: 'Reference A',
    title: 'TiO2–TiN interface and oxygen-defective TiO2-x–TiN water adsorption',
    authors: 'Gutierrez Moreno et al.',
    journal: 'J. Phys. Chem. C',
    year: 2018,
    volume: '122',
    pages: '15395–15408',
    doi: '10.1021/acs.jpcc.8b03520',
    system: ['TiO2–TiN interface', 'oxygen-defective TiO2-x–TiN', 'H2O'],
    evidence: [
      'TiN surface oxidation is relevant under ambient conditions.',
      'Isolated H2O preferentially adsorbs dissociatively forming surface Ti–OH.',
      'Higher water coverage favors molecular adsorption and H-bonding.',
      'Oxygen-defective interfaces show stronger water/OH adsorption.',
    ],
    use: ['Oxidized TiN surface justification', 'Water / OH qualitative interaction anchor'],
    constraintNote: 'Candidate values currently listed as PENDING_VERIFICATION. Cannot be used as direct organic training labels.',
  },
  {
    id: 'Reference B',
    title: 'Structure, stability and water adsorption on ultra-thin TiO2 supported on TiN',
    authors: 'PCCP Research Group',
    journal: 'Phys. Chem. Chem. Phys. (PCCP)',
    year: 2019,
    system: ['ultra-thin TiO2/TiN', 'H2O'],
    evidence: [
      'Ti–O interface formation and Ti3+ defect states observed.',
      'Water adsorption depends strongly on oxide/interface passivation state.',
    ],
    use: ['Oxidized TiN', 'Ti-O interface', 'Water interaction', 'Surface-state justification'],
    constraintNote: 'Qualitative surface model justification; no direct organic small molecule Eads.',
  },
  {
    id: 'Reference C',
    title: 'Methanol bond scission on TiN and hydroxylated TiN',
    authors: 'ACS Catalysis Group',
    journal: 'ACS Catalysis',
    year: 2025,
    system: ['TiN(111)', 'oxygen-covered TiN', 'hydroxylated TiN', 'methanol-related surface species (*O, *CH2O, *CH3)'],
    evidence: [
      'Supporting Information includes DFT optimized structures and binding energies.',
      'Surface intermediates: *O, *CH2O, *CH3 on hydroxylated TiN(111).',
      'Evaluated across diverse oxygen coverages.',
    ],
    use: ['OH', 'C-O', 'Carbonyl-related qualitative interaction anchor'],
    constraintNote: 'Covers C1 intermediate decomposition steps; requires SI verification before any quantitative calibration.',
  },
  {
    id: 'Reference D',
    title: 'Adsorption of NH3 on TiN and Si3N4 surfaces: A theoretical study',
    authors: 'Theoretical Chemistry Group',
    journal: 'Surface Science & Materials',
    year: 2025,
    method: 'VASP · PBE · D3BJ · PAW · 450 eV · 5 × 5 × 1 k-mesh',
    system: ['TiN(001)', 'NH3'],
    evidence: [
      'First-principles PBE-D3BJ characterization of NH3 coordination on TiN(001).',
      'Demonstrates Lewis base N-lone-pair coordination to surface Ti sites.',
    ],
    use: ['N-donor', 'NH3', 'Amine-like qualitative interaction anchor'],
    constraintNote: 'NH3 on pristine TiN is an inorganic anchor; does not quantify substituted alkyl/aryl amines on oxidized TiN.',
  },
  {
    id: 'Reference E',
    title: 'On the chemical grafting of titanium nitride by diazonium chemistry',
    authors: 'Diazonium Surface Functionalization Team',
    journal: 'RSC Advances',
    year: 2015,
    system: ['aminophenylene / TiN'],
    evidence: ['Near-monolayer aminophenylene can be grafted onto TiN via diazonium activation.'],
    use: ['Aminophenylene / TiN organic-surface interaction evidence'],
    constraintNote: 'CRITICAL: Grafting evidence, XPS, and contact angle CANNOT be directly converted into thermodynamic equilibrium Eads.',
  },
];

export type QuantitativeCoverageTier = 'NO VERIFIED EADS' | 'VERIFIED QUANTITATIVE DATA';
export type QualitativeSupportTier = 'QUALITATIVE LITERATURE SUPPORT' | 'NO VERIFIED EADS';

export interface GroupLiteratureSupport {
  key: string;
  label: string;
  smartsPatterns: string[];
  quantitativeStatus: QuantitativeCoverageTier;
  qualitativeSupport: QualitativeSupportTier;
  anchorRefs: string[];
  rationale: string;
  notes: string;
}

/**
 * Functional Group Coverage Matrix (Section 07)
 * OH, COOH, ESTER, ETHER, AMINE, AMIDE, NITRILE, CARBONYL, AROMATIC, C=C
 */
export const TIN_GROUP_LITERATURE_SUPPORT: Record<string, GroupLiteratureSupport> = {
  OH: {
    key: 'OH',
    label: 'Alcohol / Phenol OH',
    smartsPatterns: ['[OX2H1][CX4]', '[OX2H1][c]'],
    quantitativeStatus: 'NO VERIFIED EADS',
    qualitativeSupport: 'QUALITATIVE LITERATURE SUPPORT',
    anchorRefs: ['Reference A', 'Reference B', 'Reference C'],
    rationale: 'H2O / hydroxylated TiN / methanol-related qualitative DFT evidence exists.',
    notes: 'No internally consistent organic alcohol quantitative Eads dataset on oxidized TiN.',
  },
  COOH: {
    key: 'COOH',
    label: 'Carboxylic Acid (COOH)',
    smartsPatterns: ['[CX3](=O)[OX2H1]'],
    quantitativeStatus: 'NO VERIFIED EADS',
    qualitativeSupport: 'NO VERIFIED EADS',
    anchorRefs: [],
    rationale: 'Extrapolated bidentate/monodentate coordination.',
    notes: 'Lacks quantitative DFT benchmark on oxidized/hydroxylated TiN surfaces.',
  },
  ester: {
    key: 'ester',
    label: 'Ester',
    smartsPatterns: ['[CX3](=[OX1])[OX2H0][#6]'],
    quantitativeStatus: 'NO VERIFIED EADS',
    qualitativeSupport: 'NO VERIFIED EADS',
    anchorRefs: [],
    rationale: 'Extrapolated ester carbonyl dipole and alkoxy oxygen interaction.',
    notes: 'No verified quantitative literature Eads.',
  },
  ether: {
    key: 'ether',
    label: 'Ether',
    smartsPatterns: ['[OD2]([#6;!$(C=O)])[#6;!$(C=O)]'],
    quantitativeStatus: 'NO VERIFIED EADS',
    qualitativeSupport: 'NO VERIFIED EADS',
    anchorRefs: [],
    rationale: 'Extrapolated C-O-C lone pair coordination.',
    notes: 'No verified quantitative literature Eads.',
  },
  amine: {
    key: 'amine',
    label: 'Amine / N-Donor',
    smartsPatterns: [
      '[NX3;H2;!$(NC=O)]',
      '[NX3;H1;!$(NC=O)]',
      '[NX3;H0;!$(NC=O);!$([n])]',
    ],
    quantitativeStatus: 'NO VERIFIED EADS',
    qualitativeSupport: 'QUALITATIVE LITERATURE SUPPORT',
    anchorRefs: ['Reference D'],
    rationale: 'NH3 / TiN Lewis coordination qualitative anchor (Ref D, PBE-D3BJ).',
    notes: 'Inorganic NH3 cannot be treated as verified quantitative labels for organic amines.',
  },
  amide: {
    key: 'amide',
    label: 'Amide',
    smartsPatterns: ['[CX3](=[OX1])[NX3]'],
    quantitativeStatus: 'NO VERIFIED EADS',
    qualitativeSupport: 'NO VERIFIED EADS',
    anchorRefs: [],
    rationale: 'Extrapolated dual C=O / N-H interaction.',
    notes: 'No verified quantitative literature Eads.',
  },
  nitrile: {
    key: 'nitrile',
    label: 'Nitrile',
    smartsPatterns: ['[CX2]#[NX1]'],
    quantitativeStatus: 'NO VERIFIED EADS',
    qualitativeSupport: 'NO VERIFIED EADS',
    anchorRefs: [],
    rationale: 'Extrapolated end-on C#N Lewis donor coordination.',
    notes: 'No verified quantitative literature Eads.',
  },
  carbonyl: {
    key: 'carbonyl',
    label: 'Carbonyl (C=O)',
    smartsPatterns: [
      '[CX3;H1](=[OX1])[#6]',
      '[CX3;H0](=[OX1])([#6])[#6]',
      '[CX3;H2]=[OX1]',
    ],
    quantitativeStatus: 'NO VERIFIED EADS',
    qualitativeSupport: 'QUALITATIVE LITERATURE SUPPORT',
    anchorRefs: ['Reference C'],
    rationale: 'Methanol decomposition *CH2O intermediate qualitative evidence exists.',
    notes: 'No systematic organic aldehyde/ketone quantitative benchmark dataset.',
  },
  aromatic_ring: {
    key: 'aromatic_ring',
    label: 'Aromatic Ring',
    smartsPatterns: ['a1aaaa1', 'a1aaaaa1'],
    quantitativeStatus: 'NO VERIFIED EADS',
    qualitativeSupport: 'QUALITATIVE LITERATURE SUPPORT',
    anchorRefs: ['Reference E'],
    rationale: 'Diazonium grafting qualitative evidence exists.',
    notes: 'Grafting efficiency and XPS cannot be substituted for equilibrium adsorption energy Eads.',
  },
  alkene_cc: {
    key: 'alkene_cc',
    label: 'Alkene (C=C)',
    smartsPatterns: ['[CX3;!a]=[CX3;!a]'],
    quantitativeStatus: 'NO VERIFIED EADS',
    qualitativeSupport: 'NO VERIFIED EADS',
    anchorRefs: [],
    rationale: 'Extrapolated pi-electron dispersion interaction.',
    notes: 'No verified quantitative literature Eads.',
  },
};
