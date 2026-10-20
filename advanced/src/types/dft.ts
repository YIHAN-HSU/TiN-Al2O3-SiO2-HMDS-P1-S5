export interface Atom {
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
  fixed?: boolean; // For selective dynamics (true = F F F in POSCAR)
}

export interface UnitCell {
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  lengths: [number, number, number]; // [a, b, c] in Å
  angles: [number, number, number];  // [alpha, beta, gamma] in degrees
  periodic: [boolean, boolean, boolean];
}

export interface NearestReferenceMolecule {
  name: string;
  eads_ev: number;
  smiles: string;
}

export interface AiScreeningResult {
  predictedEads: number; // in eV
  unit: string;          // 'eV'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_ESTABLISHED';
  uncertainty: number | null;   // Null until quantified by evidence.
  isOutOfDomain: boolean;
  applicabilityDomain?: 'IN DOMAIN' | 'OUT OF DOMAIN' | 'NOT_ESTABLISHED';
  domainNote: string;
  modelName: string;
  predictionMethod?: string;
  modelVersion: string;
  datasetVersion: string;
  targetSurface: string;
  status: 'PREDICTED';
  source: string;
  mainInteraction: string;
  predictedOrientation: string;
  nearestReference?: NearestReferenceMolecule[];
  descriptors?: Record<string, any>;
  predictedAt?: string;
}

export interface VaspOutputImportResult {
  fileName: string;
  calcType: string;
  electronicConverged: boolean;
  ionicConverged: boolean;
  finalEnergy: number | null; // TOTEN in eV
  numIonicSteps: number;
  maxForce: number | null;
  rawSummary: string;
  optimizedAtoms?: Atom[];
}

export interface Structure {
  name: string;
  formula: string;
  atoms: Atom[];
  cell: UnitCell;
  description: string;
  type: 'molecule' | 'slab' | 'adsorption_system' | 'custom';
  chemicalName?: string;
  iupacName?: string;
  casNumber?: string;
  smiles?: string;
  canonicalSmiles?: string;
  isomericSmiles?: string;
  inchi?: string;
  inchikey?: string;
  molecularWeight?: number;
  density?: number | null;       // g/cm³
  boilingPoint?: number | null;  // °C
  meltingPoint?: number | null;  // °C
  vaporPressure?: number | null; // kPa / mmHg
  state?: string;
  source?: string;
  conformerEngine?: string;
  conformerEnergy?: number | null;
  conformerStatus?: string;
  coordinatesType?: string;
  isReal3d?: boolean;
  energyUnit?: string;
  connectivityStatus?: 'VERIFIED' | 'MISMATCH';
  stereoStatus?: 'VERIFIED' | 'ASSIGNED_DURING_3D' | 'MISMATCH' | 'UNSPECIFIED';
  predictionAllowed?: boolean;
  identityWarning?: string | null;
  sourceInchikey?: string;
  output3dInchikey?: string;
  identityGate?: 'PASS' | 'FAILED';
  identityVerified?: boolean;
  aiPrediction?: AiScreeningResult;
  dftCalculatedEads?: number | null; // Always null until true VASP OUTCAR calculation
  predictionError?: string | null;   // Error reason if prediction failed (e.g. MODEL_NOT_AVAILABLE)
  targetSurfaceType?: 'Hydroxylated_Al2O3_0001' | 'Hydroxylated_Oxidized_TiN' | string;
}

export interface AnalysisHistoryItem {
  id: string;
  material_id?: string | null;
  material_name?: string;
  material_formula?: string;
  input_type: string;
  original_input: string;
  parse_status: string;
  connectivity_status?: string | null;
  stereo_status?: string | null;
  three_d_status?: string | null;
  prediction_status?: string | null;
  predicted_eads_ev?: number | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
}

export interface ConformerHistoryItem {
  id: string;
  material_id: string;
  material_name?: string;
  source_inchikey: string;
  conformer_inchikey: string;
  conformer_id?: string;
  generation_method?: string;
  optimization_method?: string;
  energy?: number;
  connectivity_status?: string;
  stereo_status?: string;
  stereo_assigned_during_3d?: number;
  coordinates_json?: string;
  created_at: string;
}

export interface PredictionHistoryItem {
  id: string;
  material_id: string;
  material_name?: string;
  material_formula?: string;
  conformer_id?: string;
  surface_id?: string;
  raw_predicted_eads_ev?: number;
  predicted_eads_ev?: number;
  prediction_method?: string;
  model_version?: string;
  dataset_version?: string;
  reference_range_min_ev?: number;
  reference_range_max_ev?: number;
  confidence?: string;
  uncertainty_ev?: number;
  applicability_domain?: string;
  stereo_status?: string;
  warning?: string | null;
  created_at: string;
}

export interface DftHistoryItem {
  id: string;
  material_id: string;
  material_name?: string;
  conformer_id?: string;
  surface_id?: string;
  configuration_id?: string;
  vasp_settings_id?: string;
  e_surface?: number;
  e_monomer?: number;
  e_surface_monomer?: number;
  dft_eads_ev?: number;
  convergence_status: string;
  optimized_structure_json?: string;
  created_at: string;
}

export interface ExperimentalHistoryItem {
  id: string;
  material_id: string;
  material_name?: string;
  substrate?: string;
  base_solution?: string;
  contact_angle_before?: number;
  contact_angle_after?: number;
  contact_angle_change?: number;
  xps_result?: string;
  tof_sims_result?: string;
  residue_classification?: string;
  notes?: string;
  experiment_date?: string;
  created_at: string;
}

export interface SavedMaterial {
  id: string;
  name: string;
  chemicalName: string;
  userMaterialName?: string;
  iupacName?: string;
  casNumber?: string;
  formula: string;
  molecularWeight?: number;
  smiles: string;
  canonicalSmiles?: string;
  isomericSmiles?: string;
  inchi: string;
  inchikey: string;
  sourceStereoStatus?: string;
  latest3dInchikey?: string;
  connectivityStatus?: string;
  structure?: Structure;
  density?: number | null;
  boilingPoint?: number | null;
  meltingPoint?: number | null;
  vaporPressure?: number | null;
  state?: string;
  identityGate?: 'PASS' | 'FAILED';
  identityVerified?: boolean;
  aiPrediction?: AiScreeningResult;
  dftCalculatedEads?: number | null;
  latestPredictedEads?: number | null;
  latestPredictionWarning?: string | null;
  latestDftEads?: number | null;
  targetSurfaceType?: 'Hydroxylated_Al2O3_0001' | 'Hydroxylated_Oxidized_TiN' | string;
  analysisHistory?: AnalysisHistoryItem[];
  conformerHistory?: ConformerHistoryItem[];
  predictionHistory?: PredictionHistoryItem[];
  dftHistory?: DftHistoryItem[];
  experimentalHistory?: ExperimentalHistoryItem[];
  savedAt: string;
  updatedAt?: string;
}

export type PropertyDataSource =
  | 'DATABASE'
  | 'EXPERIMENTAL'
  | 'CALCULATED'
  | 'DFT CALCULATED'
  | 'AI/ML PREDICTED'
  | 'LITERATURE REFERENCE'
  | 'USER INPUT'
  | 'NOT AVAILABLE'
  | 'PREDICTED';

export interface PropertyValue<T> {
  value: T;
  source: PropertyDataSource;
  unit?: string;
  notes?: string;
}

export interface MolecularRecord {
  iupacName: string;
  casNumber: PropertyValue<string>;
  molecularFormula: string;
  molecularWeight: PropertyValue<number>;
  canonicalSmiles: string;
  isomericSmiles: string;
  inchi: string;
  inchikey: string;
  formalCharge: PropertyValue<number>;
  stereochemistry: PropertyValue<string>;
  structure: Structure;
  properties: {
    boilingPoint: PropertyValue<number | null>;
    meltingPoint: PropertyValue<number | null>;
    density: PropertyValue<number | null>;
    vaporPressure: PropertyValue<number | null>;
  };
}

export interface ReferenceSurface {
  id: string;
  name: string;
  formula: string;
  structure: Structure;
  isLocked: boolean;
  lockedAt?: string;
  orientation: string;        // e.g. '(0001)'
  supercell: string;          // e.g. '2x2 (9.52 × 9.52 Å)'
  slabThickness: number;      // Å
  vacuumThickness: number;    // Å
  hydroxylationState: string; // e.g. 'Fully Hydroxylated (0001)-1x1 OH'
  surfaceOhArrangement: string;
  fixedLayersCount: number;
  periodicBoundary: [boolean, boolean, boolean];
  eSurface: number | null;    // eV (from actual DFT, null if Not Calculated)
  dftSettingsSnapshot?: VaspParameters;
}

export interface VaspParameters {
  // Centralized DFT Settings
  xcFunctional: 'PBE' | 'PBEsol' | 'RPBE';
  dispersion: 'DFT-D3 (zero damping)' | 'DFT-D3 (BJ damping)' | 'dDsC' | 'None';
  ivdw?: number;               // 0=none, 11=zero-damping, 12=BJ-damping
  calcType?: string;
  encut: number;               // Kinetic energy cutoff in eV (e.g. 500)
  prec: 'Accurate' | 'Normal' | 'Fast';
  ediff: number;               // Electronic convergence in eV (e.g. 1e-6)
  ediffg: number;              // Ionic convergence in eV/Å (e.g. -0.02)
  nelm: number;                // Max electronic steps
  ismear: number;              // 0 = Gaussian smearing
  sigma: number;               // Smearing width in eV (e.g. 0.05)
  algo: 'Fast' | 'Normal' | 'All';
  ispin: 1 | 2;                // 1 = non-spin-polarized, 2 = spin-polarized
  ibrion: number;              // 2 = conjugate gradient ionic relaxation
  nsw: number;                 // Max ionic steps (e.g. 300)
  isif: number;                // 2 = relax ions with fixed cell
  potim: number;               // Time step / initial trial step
  lreal: 'Auto' | 'False' | 'True';
  lasph: boolean;              // Non-spherical contributions inside PAW spheres
  ldipol: boolean;             // Dipole correction for slab
  idipol: number;              // 3 for z-direction dipole correction
  isym: number;                // 0 = turn off symmetry
  kpts: [number, number, number];        // Slab & adsorption [3, 3, 1]
  kptsMonomer: [number, number, number]; // Isolated monomer in box [1, 1, 1]
  kptType: 'Monkhorst-Pack' | 'Gamma';
}

export interface AdsorptionSite {
  id: string;
  name: string;
  type: string;
  position: [number, number, number];
  description: string;
}

export interface AdsorptionConfiguration {
  id: string;
  name: string;
  siteType: string;
  anchor: string;
  height: number;
  tilt: number;
  azimuth: number;
  description: string;
  structure: Structure;
  targetSite: AdsorptionSite;
}

export interface BatchOptimizationItem {
  id: string;
  folderName: string;
  name: string;
  mechanism: string;
  status: 'idle' | 'running' | 'converged' | 'error';
  initialEnergy: number;
  finalEnergy: number;
  deltaE: number;
  adsorptionEnergy: number;
  currentStep: number;
  maxSteps: number;
  currentForce: number;
  targetForce: number;
  energyTrajectory: number[];
  forceTrajectory: number[];
  structure: Structure;
  contcarAvailable: boolean;
}

export interface Step4AnalysisResult {
  configDir: string;
  name: string;
  totalEnergy: number;
  adsorptionEnergy: number;
  relativeEnergy: number;
  minDistance: number;
  contacts: InterfacialContact[];
  bondingType: string;
  vestaNotes: string;
  structure: Structure;
}

export interface InitialAdsorptionConfiguration {
  id: string;                  // 'config_001', 'config_002', etc.
  label: string;               // 'Config 01 – Carbonyl/O-facing'
  functionalGroupTarget: string; // 'Carbonyl C=O', 'Ester -COO-', 'Hydroxyl -OH', etc.
  adsorptionSite: string;      // 'Surface Al-OH (Brønsted acid site)', 'Lewis Al3+ site', etc.
  height: number;              // Distance above surface in Å
  tilt: number;                // Tilt angle in degrees
  azimuth: number;             // Azimuth angle in degrees
  initialStructure: Structure;
  collisionStatus: 'Clean' | 'Adjusted (Collision Resolved)';
  minInitialDistance: number;  // Å
  notes: string;
}

export type DftOptimizationStatus =
  | 'Not Calculated'
  | 'Queued'
  | 'Running'
  | 'Converged'
  | 'Not Converged'
  | 'Failed';

export interface InterfacialContact {
  type: 'h_bond' | 'lewis_coordination' | 'vdw_pi' | 'secondary_contact';
  atom1: string; // e.g. "O(monomer)"
  atom2: string; // e.g. "H(surface OH)"
  distance: number; // Å (calculated from atomic coordinates)
  typicalRange: string;
  strength: 'Strong' | 'Moderate' | 'Weak';
}

export interface InteractionAnalysis {
  shortestDistance: number | null; // Å
  shortestPair: string | null;     // e.g. "O(monomer)···H(surface OH)"
  hBonds: Array<{ donor: string; acceptor: string; distance: number }>;
  adsorptionSite: string;
  mainFunctionalGroup: string;
  numSurfaceContacts: number;
}

export interface DftOptimizationRecord {
  configId: string;
  configLabel: string;
  status: DftOptimizationStatus;
  initialStructure: Structure;
  optimizedStructure: Structure | null;
  eMonomer: number | null;         // E_monomer in eV (isolated)
  eSurface: number | null;         // E_surface in eV (bare slab)
  eSurfaceMonomer: number | null;  // E_surface+monomer in eV (adsorbed complex)
  eAds: number | null;             // Eads = E_surface+monomer - E_surface - E_monomer
  dftCalculatedEads?: number | null; // Explicit DFT Calculated Eads alias
  aiPredictedEads?: number | null;   // For comparison error calculation
  predictionError?: number | null;   // aiPredictedEads - dftCalculatedEads
  interactionAnalysis: InteractionAnalysis | null;
  calculationDate?: string;
  softwareVersion?: string;
  rawOutputSummary?: string;
  notes?: string;
}

export interface MonomerComparisonItem {
  id: string;
  name: string;
  cas: string;
  formula: string;
  molecularWeight: number;
  lowestEads: number | null;       // eV (null if Not Calculated)
  bestConfigId: string | null;
  status: string;
  experimental?: {
    contactAngle?: number;
    xpsResult?: string;
    soakingResult?: string;
    residueClass?: string;
  };
}

export interface CalculationAuditEntry {
  id: string;
  timestamp: string;
  monomerName: string;
  monomerFormula: string;
  surfaceModel: string;
  isSurfaceLocked: boolean;
  dftSettings: VaspParameters;
  numConfigurationsGenerated: number;
  convergedConfigurations: number;
  lowestEads: number | null;
  status: string;
}
