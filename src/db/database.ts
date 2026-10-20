/**
 * SQLite Database Manager for TiN Adsorption Screening Workbench v0.2
 * File: data/materials.db
 * Uses Node 22 built-in node:sqlite with file persistence.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { AsyncLocalStorage } from 'node:async_hooks';
const requestDatabase = new AsyncLocalStorage<DatabaseSync>();
export async function withMemoryDatabase<T>(work:()=>Promise<T>):Promise<T> {
 const db=initializeDatabase(new DatabaseSync(':memory:'));
 try { return await requestDatabase.run(db,work); } finally { db.close(); }
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'materials.db');

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  const scoped=requestDatabase.getStore();
  if(scoped)return scoped;
  if(process.env.S5_PUBLIC_MODE==='1')throw new Error('PUBLIC_DATABASE_SCOPE_REQUIRED');
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  dbInstance = initializeDatabase(new DatabaseSync(DB_FILE));
  return dbInstance;
}

function initializeDatabase(dbInstance: DatabaseSync): DatabaseSync {

  // Initialize all required tables (Sections 06, 09)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inchikey TEXT UNIQUE NOT NULL,
      canonical_smiles TEXT NOT NULL,
      isomeric_smiles TEXT NOT NULL,
      inchi TEXT NOT NULL,
      formula TEXT NOT NULL,
      molecular_weight REAL NOT NULL,
      formal_charge INTEGER NOT NULL,
      stereo_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analysis_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER,
      input_type TEXT NOT NULL,
      raw_input TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conformer_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      conformer_id TEXT NOT NULL,
      optimization_method TEXT NOT NULL,
      energy REAL NOT NULL,
      coords_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prediction_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      surface_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      model_version TEXT NOT NULL,
      raw_predicted_eads_ev REAL NOT NULL,
      predicted_eads_ev REAL NOT NULL,
      relative_affinity_score REAL NOT NULL,
      affinity_class TEXT NOT NULL,
      confidence TEXT NOT NULL,
      uncertainty_ev REAL,
      literature_coverage TEXT NOT NULL,
      supported_groups_json TEXT NOT NULL,
      extrapolated_groups_json TEXT NOT NULL,
      applicability_domain TEXT NOT NULL,
      warning TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dft_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      surface_id TEXT NOT NULL,
      status TEXT NOT NULL,
      eads_dft_ev REAL,
      functional TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS literature_adsorption_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_id TEXT NOT NULL,
      DOI TEXT NOT NULL,
      year INTEGER NOT NULL,
      source_table_or_figure TEXT,
      surface_formula TEXT NOT NULL,
      facet TEXT,
      oxide_state TEXT,
      oxygen_vacancy TEXT,
      oxygen_coverage TEXT,
      hydroxyl_coverage TEXT,
      adsorbate TEXT NOT NULL,
      adsorption_mode TEXT NOT NULL,
      coverage_ML TEXT NOT NULL,
      reported_energy_ev REAL NOT NULL,
      energy_definition TEXT NOT NULL,
      reference_state TEXT,
      DFT_functional TEXT NOT NULL,
      dispersion_method TEXT,
      DFT_U TEXT,
      software TEXT,
      verification_status TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS comparison_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      tin_prediction_id INTEGER,
      al2o3_status TEXT NOT NULL,
      eads_tin_ev REAL,
      eads_al2o3_ev REAL,
      delta_eads_ev REAL,
      selectivity_preference TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Migrate prediction_history if uncertainty_ev still has NOT NULL constraint
  try {
    const tableInfo = dbInstance.prepare("PRAGMA table_info(prediction_history)").all() as any[];
    const uncertaintyCol = tableInfo.find((col: any) => col.name === 'uncertainty_ev');
    if (uncertaintyCol && uncertaintyCol.notnull === 1) {
      dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS prediction_history_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          material_id INTEGER NOT NULL,
          surface_id TEXT NOT NULL,
          model_id TEXT NOT NULL,
          model_version TEXT NOT NULL,
          raw_predicted_eads_ev REAL NOT NULL,
          predicted_eads_ev REAL NOT NULL,
          relative_affinity_score REAL NOT NULL,
          affinity_class TEXT NOT NULL,
          confidence TEXT NOT NULL,
          uncertainty_ev REAL,
          literature_coverage TEXT NOT NULL,
          supported_groups_json TEXT NOT NULL,
          extrapolated_groups_json TEXT NOT NULL,
          applicability_domain TEXT NOT NULL,
          warning TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        INSERT INTO prediction_history_v2 SELECT * FROM prediction_history;
        DROP TABLE prediction_history;
        ALTER TABLE prediction_history_v2 RENAME TO prediction_history;
      `);
    }
  } catch (migErr) {
    console.error('Migration notice:', migErr);
  }

  // Seed literature records if empty
  if(process.env.S5_PUBLIC_MODE!=='1')seedLiteratureRecordsIfEmpty(dbInstance);

  return dbInstance;
}

export interface LiteratureRecordRow {
  id?: number;
  reference_id: string;
  DOI: string;
  year: number;
  source_table_or_figure: string;
  surface_formula: string;
  facet: string;
  oxide_state: string;
  oxygen_vacancy: string;
  oxygen_coverage: string;
  hydroxyl_coverage: string;
  adsorbate: string;
  adsorption_mode: string;
  coverage_ML: string;
  reported_energy_ev: number;
  energy_definition: string;
  reference_state: string;
  DFT_functional: string;
  dispersion_method: string;
  DFT_U: string;
  software: string;
  verification_status: 'PENDING_VERIFICATION' | 'VERIFIED';
  notes: string;
}

const INITIAL_LITERATURE_RECORDS: Omit<LiteratureRecordRow, 'id'>[] = [
  // Gutierrez Moreno et al. 2018 (DOI: 10.1021/acs.jpcc.8b03520)
  {
    reference_id: 'REF_GM2018_01',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 2',
    surface_formula: 'TiO2–TiN',
    facet: 'interface',
    oxide_state: 'Stoichiometric TiO2 overlay',
    oxygen_vacancy: 'None',
    oxygen_coverage: '1.0 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'molecular',
    coverage_ML: '1/6 ML',
    reported_energy_ev: -1.14,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending primary literature check. Isolated water molecular adsorption.',
  },
  {
    reference_id: 'REF_GM2018_02',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 2',
    surface_formula: 'TiO2–TiN',
    facet: 'interface',
    oxide_state: 'Stoichiometric TiO2 overlay',
    oxygen_vacancy: 'None',
    oxygen_coverage: '1.0 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'dissociative',
    coverage_ML: '1/6 ML',
    reported_energy_ev: -1.48,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending primary literature check. Isolated water dissociative adsorption (Ti-OH formation).',
  },
  {
    reference_id: 'REF_GM2018_03',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 2',
    surface_formula: 'TiO2–TiN',
    facet: 'interface',
    oxide_state: 'Stoichiometric TiO2 overlay',
    oxygen_vacancy: 'None',
    oxygen_coverage: '1.0 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'molecular',
    coverage_ML: '1/2 ML',
    reported_energy_ev: -1.03,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending verification. Medium coverage molecular H2O.',
  },
  {
    reference_id: 'REF_GM2018_04',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 2',
    surface_formula: 'TiO2–TiN',
    facet: 'interface',
    oxide_state: 'Stoichiometric TiO2 overlay',
    oxygen_vacancy: 'None',
    oxygen_coverage: '1.0 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'dissociative',
    coverage_ML: '1/2 ML',
    reported_energy_ev: -0.92,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending verification. Medium coverage dissociative H2O.',
  },
  {
    reference_id: 'REF_GM2018_05',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 2',
    surface_formula: 'TiO2–TiN',
    facet: 'interface',
    oxide_state: 'Stoichiometric TiO2 overlay',
    oxygen_vacancy: 'None',
    oxygen_coverage: '1.0 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'molecular',
    coverage_ML: '1 ML',
    reported_energy_ev: -1.01,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending verification. Full monolayer molecular H2O.',
  },
  {
    reference_id: 'REF_GM2018_06',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 2',
    surface_formula: 'TiO2–TiN',
    facet: 'interface',
    oxide_state: 'Stoichiometric TiO2 overlay',
    oxygen_vacancy: 'None',
    oxygen_coverage: '1.0 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'dissociative',
    coverage_ML: '1 ML',
    reported_energy_ev: -0.94,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending verification. Full monolayer dissociative H2O.',
  },
  {
    reference_id: 'REF_GM2018_07',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 3',
    surface_formula: 'TiO1.94–TiN',
    facet: 'interface',
    oxide_state: 'Defective TiO1.94',
    oxygen_vacancy: 'Low defect density',
    oxygen_coverage: '0.94 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'molecular',
    coverage_ML: '1/6 ML',
    reported_energy_ev: -1.85,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending verification. Oxygen vacancy enhances molecular binding.',
  },
  {
    reference_id: 'REF_GM2018_08',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 3',
    surface_formula: 'TiO1.94–TiN',
    facet: 'interface',
    oxide_state: 'Defective TiO1.94',
    oxygen_vacancy: 'Low defect density',
    oxygen_coverage: '0.94 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'dissociative',
    coverage_ML: '1/6 ML',
    reported_energy_ev: -2.04,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending verification. Oxygen vacancy strongly stabilizes OH.',
  },
  {
    reference_id: 'REF_GM2018_09',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 3',
    surface_formula: 'TiO1.88–TiN',
    facet: 'interface',
    oxide_state: 'Defective TiO1.88',
    oxygen_vacancy: 'High defect density',
    oxygen_coverage: '0.88 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'molecular',
    coverage_ML: '1/6 ML',
    reported_energy_ev: -1.58,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending verification. TiO1.88 interface molecular adsorption.',
  },
  {
    reference_id: 'REF_GM2018_10',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 3',
    surface_formula: 'TiO1.88–TiN',
    facet: 'interface',
    oxide_state: 'Defective TiO1.88',
    oxygen_vacancy: 'High defect density',
    oxygen_coverage: '0.88 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'dissociative',
    coverage_ML: '1/6 ML',
    reported_energy_ev: -5.08,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending verification. Strong chemisorption / surface healing into deep oxygen vacancy.',
  },
  {
    reference_id: 'REF_GM2018_11',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 4',
    surface_formula: 'O/N exchanged TiN',
    facet: 'interface',
    oxide_state: 'Nitrogen-doped oxide boundary',
    oxygen_vacancy: 'Exchanged sites',
    oxygen_coverage: 'Sub-monolayer',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'molecular',
    coverage_ML: '1/6 ML',
    reported_energy_ev: -0.82,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending verification. O/N site substitution effect.',
  },
  {
    reference_id: 'REF_GM2018_12',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'Table 4',
    surface_formula: 'O/N exchanged TiN',
    facet: 'interface',
    oxide_state: 'Nitrogen-doped oxide boundary',
    oxygen_vacancy: 'Exchanged sites',
    oxygen_coverage: 'Sub-monolayer',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'dissociative',
    coverage_ML: '1/6 ML',
    reported_energy_ev: -0.75,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Candidate value pending verification. O/N exchanged dissociative adsorption.',
  },
  // Other literature candidates
  {
    reference_id: 'REF_TIN_LIT_01',
    DOI: '10.1021/acscatal.5c07156',
    year: 2016,
    source_table_or_figure: 'Text / SI',
    surface_formula: 'TiN(100)',
    facet: '(100)',
    oxide_state: 'Pristine TiN',
    oxygen_vacancy: 'N/A',
    oxygen_coverage: '0.0 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'molecular',
    coverage_ML: '0.25 ML',
    reported_energy_ev: -0.94,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Pristine TiN(100) reference candidate. Not equivalent to oxidized TiN.',
  },
  {
    reference_id: 'REF_TIN_LIT_02',
    DOI: '10.1021/acscatal.5c07156',
    year: 2016,
    source_table_or_figure: 'Text / SI',
    surface_formula: 'TiN(111)',
    facet: '(111)',
    oxide_state: 'Pristine TiN',
    oxygen_vacancy: 'N/A',
    oxygen_coverage: '0.0 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'molecular',
    coverage_ML: '0.25 ML',
    reported_energy_ev: -0.78,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Pristine TiN(111) reference candidate.',
  },
  {
    reference_id: 'REF_TIN_LIT_03',
    DOI: '10.1021/acs.jpcc.8b03520',
    year: 2018,
    source_table_or_figure: 'SI Table S1',
    surface_formula: 'TiN(110)',
    facet: '(110)',
    oxide_state: 'High-energy facet',
    oxygen_vacancy: 'N/A',
    oxygen_coverage: '0.0 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'H2O',
    adsorption_mode: 'dissociative',
    coverage_ML: '0.50 ML',
    reported_energy_ev: -2.44,
    energy_definition: 'Eads = E(slab+mol) - E(slab) - E(mol)',
    reference_state: 'isolated gas-phase H2O',
    DFT_functional: 'PBE',
    dispersion_method: 'DFT-D3',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'TiN(110) reactive facet dissociative adsorption.',
  },
  {
    reference_id: 'REF_TIN_LIT_04',
    DOI: '10.1021/acscatal.5c07156',
    year: 2016,
    source_table_or_figure: 'Table 1',
    surface_formula: 'TiN(100)',
    facet: '(100)',
    oxide_state: 'Pristine TiN',
    oxygen_vacancy: 'N/A',
    oxygen_coverage: '0.0 ML',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'atomic H',
    adsorption_mode: 'chemisorption (atomic)',
    coverage_ML: '0.25 ML',
    reported_energy_ev: -2.88,
    energy_definition: 'Eads = E(slab+H) - E(slab) - 0.5*E(H2)',
    reference_state: 'gas-phase 0.5 H2',
    DFT_functional: 'PBE',
    dispersion_method: 'None',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Atomic H reference energy. Cannot be directly compared with molecular organic adsorption.',
  },
  {
    reference_id: 'REF_TIN_LIT_05',
    DOI: '10.1021/acscatal.5c07156',
    year: 2016,
    source_table_or_figure: 'Table 1',
    surface_formula: 'TiN',
    facet: 'polycrystalline / mixed',
    oxide_state: 'Native oxide',
    oxygen_vacancy: 'N/A',
    oxygen_coverage: 'Variable',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'atomic O',
    adsorption_mode: 'chemisorption (atomic)',
    coverage_ML: '0.25 ML',
    reported_energy_ev: -4.74,
    energy_definition: 'Eads = E(slab+O) - E(slab) - 0.5*E(O2)',
    reference_state: 'gas-phase 0.5 O2',
    DFT_functional: 'PBE',
    dispersion_method: 'None',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Atomic O binding energy into surface lattice. Very strong chemical bonding.',
  },
  {
    reference_id: 'REF_TIN_LIT_06',
    DOI: '10.1021/acscatal.5c07156',
    year: 2016,
    source_table_or_figure: 'Table 3',
    surface_formula: 'Pt/TiN',
    facet: 'composite interface',
    oxide_state: 'Pt decorated TiN',
    oxygen_vacancy: 'N/A',
    oxygen_coverage: 'N/A',
    hydroxyl_coverage: '0.0 ML',
    adsorbate: 'atomic O',
    adsorption_mode: 'chemisorption (atomic)',
    coverage_ML: '0.25 ML',
    reported_energy_ev: -1.37,
    energy_definition: 'Eads = E(slab+O) - E(slab) - 0.5*E(O2)',
    reference_state: 'gas-phase 0.5 O2',
    DFT_functional: 'PBE',
    dispersion_method: 'None',
    DFT_U: 'None',
    software: 'VASP',
    verification_status: 'PENDING_VERIFICATION',
    notes: 'Pt/TiN supported catalyst oxygen adsorption.',
  },
];

function seedLiteratureRecordsIfEmpty(db: DatabaseSync) {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM literature_adsorption_records').get() as { cnt: number };
  if (countRow && countRow.cnt === 0) {
    const insertStmt = db.prepare(`
      INSERT INTO literature_adsorption_records (
        reference_id, DOI, year, source_table_or_figure, surface_formula, facet,
        oxide_state, oxygen_vacancy, oxygen_coverage, hydroxyl_coverage,
        adsorbate, adsorption_mode, coverage_ML, reported_energy_ev, energy_definition,
        reference_state, DFT_functional, dispersion_method, DFT_U, software,
        verification_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION');
    try {
      for (const rec of INITIAL_LITERATURE_RECORDS) {
        insertStmt.run(
          rec.reference_id,
          rec.DOI,
          rec.year,
          rec.source_table_or_figure,
          rec.surface_formula,
          rec.facet,
          rec.oxide_state,
          rec.oxygen_vacancy,
          rec.oxygen_coverage,
          rec.hydroxyl_coverage,
          rec.adsorbate,
          rec.adsorption_mode,
          rec.coverage_ML,
          rec.reported_energy_ev,
          rec.energy_definition,
          rec.reference_state,
          rec.DFT_functional,
          rec.dispersion_method,
          rec.DFT_U,
          rec.software,
          rec.verification_status,
          rec.notes
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      console.error('Failed to seed literature records:', err);
    }
  }
}

export interface MaterialRow {
  id: number;
  inchikey: string;
  canonical_smiles: string;
  isomeric_smiles: string;
  inchi: string;
  formula: string;
  molecular_weight: number;
  formal_charge: number;
  stereo_status: string;
  created_at: string;
  updated_at: string;
}

export function upsertMaterial(data: {
  inchikey: string;
  canonical_smiles: string;
  isomeric_smiles: string;
  inchi: string;
  formula: string;
  molecular_weight: number;
  formal_charge: number;
  stereo_status: string;
}): MaterialRow {
  const db = getDatabase();
  const now = new Date().toISOString();

  const selectStmt = db.prepare('SELECT * FROM materials WHERE inchikey = ?');
  const existing = selectStmt.get(data.inchikey) as MaterialRow | undefined;

  if (existing) {
    const updateStmt = db.prepare(`
      UPDATE materials 
      SET canonical_smiles = ?, isomeric_smiles = ?, inchi = ?, formula = ?, molecular_weight = ?, formal_charge = ?, stereo_status = ?, updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(
      data.canonical_smiles,
      data.isomeric_smiles,
      data.inchi,
      data.formula,
      data.molecular_weight,
      data.formal_charge,
      data.stereo_status,
      now,
      existing.id
    );
    return { ...existing, ...data, updated_at: now };
  } else {
    const insertStmt = db.prepare(`
      INSERT INTO materials (inchikey, canonical_smiles, isomeric_smiles, inchi, formula, molecular_weight, formal_charge, stereo_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = insertStmt.run(
      data.inchikey,
      data.canonical_smiles,
      data.isomeric_smiles,
      data.inchi,
      data.formula,
      data.molecular_weight,
      data.formal_charge,
      data.stereo_status,
      now,
      now
    );
    const newId = Number(info.lastInsertRowid);
    return { id: newId, ...data, created_at: now, updated_at: now };
  }
}

export function logAnalysisHistory(data: {
  material_id: number | null;
  input_type: string;
  raw_input: string;
  status: string;
}): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO analysis_history (material_id, input_type, raw_input, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = insertStmt.run(
    data.material_id,
    data.input_type,
    data.raw_input.length > 500 ? data.raw_input.slice(0, 500) + '...' : data.raw_input,
    data.status,
    now
  );
  return Number(info.lastInsertRowid);
}

export function logConformerHistory(data: {
  material_id: number;
  conformer_id: string;
  optimization_method: string;
  energy: number;
  coords_json: string;
}): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO conformer_history (material_id, conformer_id, optimization_method, energy, coords_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = insertStmt.run(
    data.material_id,
    data.conformer_id,
    data.optimization_method,
    data.energy,
    data.coords_json,
    now
  );
  return Number(info.lastInsertRowid);
}

export function insertPredictionHistory(data: {
  material_id: number;
  surface_id: string;
  model_id: string;
  model_version: string;
  raw_predicted_eads_ev: number;
  predicted_eads_ev: number;
  relative_affinity_score: number;
  affinity_class: string;
  confidence: string;
  uncertainty_ev: number | null;
  literature_coverage: string;
  supported_groups_json: string;
  extrapolated_groups_json: string;
  applicability_domain: string;
  warning: string;
}): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO prediction_history (
      material_id, surface_id, model_id, model_version,
      raw_predicted_eads_ev, predicted_eads_ev, relative_affinity_score,
      affinity_class, confidence, uncertainty_ev, literature_coverage,
      supported_groups_json, extrapolated_groups_json, applicability_domain,
      warning, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = insertStmt.run(
    data.material_id,
    data.surface_id,
    data.model_id,
    data.model_version,
    data.raw_predicted_eads_ev,
    data.predicted_eads_ev,
    data.relative_affinity_score,
    data.affinity_class,
    data.confidence,
    data.uncertainty_ev,
    data.literature_coverage,
    data.supported_groups_json,
    data.extrapolated_groups_json,
    data.applicability_domain,
    data.warning,
    now
  );
  return Number(info.lastInsertRowid);
}

export function getLiteratureRecords(searchTerm?: string) {
  const db = getDatabase();
  if (searchTerm && searchTerm.trim()) {
    const q = `%${searchTerm.trim()}%`;
    return db.prepare(`
      SELECT * FROM literature_adsorption_records
      WHERE surface_formula LIKE ? OR adsorbate LIKE ? OR DOI LIKE ? OR reference_id LIKE ? OR adsorption_mode LIKE ?
      ORDER BY id ASC
    `).all(q, q, q, q, q);
  }
  return db.prepare('SELECT * FROM literature_adsorption_records ORDER BY id ASC').all();
}

export function logComparisonHistory(data: {
  material_id: number;
  tin_prediction_id?: number | null;
  al2o3_status: string;
  eads_tin_ev?: number | null;
  eads_al2o3_ev?: number | null;
  delta_eads_ev?: number | null;
  selectivity_preference: string;
}): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO comparison_history (
      material_id, tin_prediction_id, al2o3_status,
      eads_tin_ev, eads_al2o3_ev, delta_eads_ev,
      selectivity_preference, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    data.material_id,
    data.tin_prediction_id ?? null,
    data.al2o3_status,
    data.eads_tin_ev ?? null,
    data.eads_al2o3_ev ?? null,
    data.delta_eads_ev ?? null,
    data.selectivity_preference,
    now
  );
  return Number(info.lastInsertRowid);
}

export function getAllDatabaseHistory() {
  const db = getDatabase();
  const materials = db.prepare('SELECT * FROM materials ORDER BY id DESC').all();
  const analysis = db.prepare('SELECT * FROM analysis_history ORDER BY id DESC LIMIT 100').all();
  const conformers = db.prepare('SELECT * FROM conformer_history ORDER BY id DESC LIMIT 100').all();
  const predictions = db.prepare(`
    SELECT p.*, m.canonical_smiles, m.formula, m.inchikey
    FROM prediction_history p
    LEFT JOIN materials m ON p.material_id = m.id
    ORDER BY p.id DESC LIMIT 100
  `).all();
  const comparisons = db.prepare(`
    SELECT c.*, m.canonical_smiles, m.formula, m.inchikey
    FROM comparison_history c
    LEFT JOIN materials m ON c.material_id = m.id
    ORDER BY c.id DESC LIMIT 100
  `).all();
  const dftRecords = db.prepare('SELECT * FROM dft_history ORDER BY id DESC LIMIT 100').all();
  const literatureCount = (db.prepare('SELECT COUNT(*) as count FROM literature_adsorption_records').get() as { count: number }).count;

  return { materials, analysis, conformers, predictions, comparisons, dftRecords, literatureCount };
}
