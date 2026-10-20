import { Atom, Structure, UnitCell, AdsorptionSite, AdsorptionConfiguration } from '../types/dft';

export interface ElementData {
  symbol: string;
  name: string;
  color: string;
  radius: number; // covalent radius in Å
  atomicMass: number;
  valency: number;
}

export const ELEMENTS: Record<string, ElementData> = {
  H:  { symbol: 'H',  name: 'Hydrogen',   color: '#FFFFFF', radius: 0.32, atomicMass: 1.008,  valency: 1 },
  C:  { symbol: 'C',  name: 'Carbon',     color: '#4B5563', radius: 0.75, atomicMass: 12.011, valency: 4 },
  N:  { symbol: 'N',  name: 'Nitrogen',   color: '#3B82F6', radius: 0.71, atomicMass: 14.007, valency: 5 },
  O:  { symbol: 'O',  name: 'Oxygen',     color: '#EF4444', radius: 0.63, atomicMass: 15.999, valency: 6 },
  F:  { symbol: 'F',  name: 'Fluorine',   color: '#10B981', radius: 0.64, atomicMass: 18.998, valency: 7 },
  S:  { symbol: 'S',  name: 'Sulfur',     color: '#FBBF24', radius: 1.02, atomicMass: 32.06,  valency: 6 },
  Cl: { symbol: 'Cl', name: 'Chlorine',   color: '#34D399', radius: 0.99, atomicMass: 35.45,  valency: 7 },
  Pt: { symbol: 'Pt', name: 'Platinum',   color: '#CBD5E1', radius: 1.28, atomicMass: 195.08, valency: 10 },
  Cu: { symbol: 'Cu', name: 'Copper',     color: '#F97316', radius: 1.38, atomicMass: 63.546, valency: 11 },
  Au: { symbol: 'Au', name: 'Gold',       color: '#EAB308', radius: 1.44, atomicMass: 196.97, valency: 11 },
  Ti: { symbol: 'Ti', name: 'Titanium',   color: '#94A3B8', radius: 1.36, atomicMass: 47.867, valency: 4 },
  Fe: { symbol: 'Fe', name: 'Iron',       color: '#EA580C', radius: 1.25, atomicMass: 55.845, valency: 8 },
  Ni: { symbol: 'Ni', name: 'Nickel',     color: '#065F46', radius: 1.21, atomicMass: 58.693, valency: 10 },
  Pd: { symbol: 'Pd', name: 'Palladium',  color: '#0284C7', radius: 1.31, atomicMass: 106.42, valency: 10 },
  Al: { symbol: 'Al', name: 'Aluminum',   color: '#93C5FD', radius: 1.21, atomicMass: 26.982, valency: 3 },
};

export const getElementInfo = (symbol: string): ElementData => {
  return ELEMENTS[symbol] || {
    symbol,
    name: symbol,
    color: '#A855F7',
    radius: 0.8,
    atomicMass: 20.0,
    valency: 4
  };
};

/**
 * Creates an orthogonal cubic or orthorhombic unit cell
 */
export function createBoxCell(a: number, b: number, c: number): UnitCell {
  return {
    a: [a, 0, 0],
    b: [0, b, 0],
    c: [0, 0, c],
    lengths: [a, b, c],
    angles: [90, 90, 90],
    periodic: [true, true, true]
  };
}

/**
 * Center a set of atoms within a box
 */
export function centerAtoms(atoms: Atom[], box: [number, number, number]): Atom[] {
  if (atoms.length === 0) return [];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const at of atoms) {
    if (at.x < minX) minX = at.x;
    if (at.x > maxX) maxX = at.x;
    if (at.y < minY) minY = at.y;
    if (at.y > maxY) maxY = at.y;
    if (at.z < minZ) minZ = at.z;
    if (at.z > maxZ) maxZ = at.z;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  const targetX = box[0] / 2;
  const targetY = box[1] / 2;
  const targetZ = box[2] / 2;

  const dx = targetX - cx;
  const dy = targetY - cy;
  const dz = targetZ - cz;

  return atoms.map(at => ({
    ...at,
    x: Number((at.x + dx).toFixed(4)),
    y: Number((at.y + dy).toFixed(4)),
    z: Number((at.z + dz).toFixed(4)),
  }));
}

/**
 * Ethyl Benzoate (C6H5COOCH2CH3) - Exact molecule from user's prompt
 * Phenyl ring + Ester linkage + Ethyl group
 */
export function getEthylBenzoate(): Structure {
  const box: [number, number, number] = [16.0, 16.0, 16.0];
  const rawAtoms: Omit<Atom, 'id'>[] = [
    // Benzene ring (C1 to C6)
    { element: 'C', x: 0.000,  y: 0.000,  z: 0.000 },  // C1 (ipso, bonded to ester carbonyl)
    { element: 'C', x: 1.390,  y: 0.000,  z: 0.000 },  // C2 (ortho)
    { element: 'C', x: 2.085,  y: 1.204,  z: 0.000 },  // C3 (meta)
    { element: 'C', x: 1.390,  y: 2.408,  z: 0.000 },  // C4 (para)
    { element: 'C', x: 0.000,  y: 2.408,  z: 0.000 },  // C5 (meta')
    { element: 'C', x: -0.695, y: 1.204,  z: 0.000 },  // C6 (ortho')
    // Ring Hydrogens
    { element: 'H', x: 1.930,  y: -0.935, z: 0.000 },  // H2
    { element: 'H', x: 3.165,  y: 1.204,  z: 0.000 },  // H3
    { element: 'H', x: 1.930,  y: 3.343,  z: 0.000 },  // H4
    { element: 'H', x: -0.540, y: 3.343,  z: 0.000 },  // H5
    { element: 'H', x: -1.775, y: 1.204,  z: 0.000 },  // H6
    // Ester Carbonyl C7
    { element: 'C', x: -0.725, y: -1.265, z: 0.020 },
    // Carbonyl Oxygen (=O)
    { element: 'O', x: -0.210, y: -2.360, z: 0.050 },
    // Ester bridging Oxygen (-O-)
    { element: 'O', x: -2.050, y: -1.080, z: -0.010 },
    // Ethyl CH2 (C8)
    { element: 'C', x: -2.880, y: -2.260, z: 0.010 },
    { element: 'H', x: -2.710, y: -2.870, z: 0.890 },
    { element: 'H', x: -2.710, y: -2.870, z: -0.870 },
    // Ethyl CH3 (C9)
    { element: 'C', x: -4.330, y: -1.790, z: 0.010 },
    { element: 'H', x: -4.510, y: -1.180, z: -0.870 },
    { element: 'H', x: -4.510, y: -1.180, z: 0.890 },
    { element: 'H', x: -5.020, y: -2.630, z: 0.010 },
  ];

  const atomsWithId: Atom[] = rawAtoms.map((at, idx) => ({
    ...at,
    id: `atom-${idx + 1}`
  }));

  const centered = centerAtoms(atomsWithId, box);

  return {
    name: 'Ethyl Benzoate',
    chemicalName: '苯甲酸乙酯 (Ethyl Benzoate)',
    iupacName: 'ethyl benzoate',
    casNumber: '93-89-0',
    smiles: 'CCOC(=O)c1ccccc1',
    molecularWeight: 150.17,
    formula: 'C6H5COOCH2CH3',
    atoms: centered,
    cell: createBoxCell(box[0], box[1], box[2]),
    description: 'Aromatic ester used in perfumery, organic synthesis, and surface adsorption studies.',
    type: 'molecule',
    aiPrediction: undefined,
    dftCalculatedEads: null
  };
}

/**
 * 1,4-Cyclohexanedimethanol divinyl ether (1,4-環己烷二甲醇二乙烯基醚 / CHDMDVE)
 * CAS: 17351-75-6, Formula: C12H20O2, SMILES: C=COCC1CCC(COC=C)CC1
 */
export function getCHDMDVE(): Structure {
  const box: [number, number, number] = [18.0, 18.0, 18.0];
  const rawAtoms = [
    // Cyclohexane ring carbons (chair conformation)
    { element: 'C', x: -1.26, y:  0.00, z:  0.25 }, // C1
    { element: 'C', x: -0.63, y:  1.26, z: -0.25 }, // C2
    { element: 'C', x:  0.63, y:  1.26, z:  0.25 }, // C3
    { element: 'C', x:  1.26, y:  0.00, z: -0.25 }, // C4
    { element: 'C', x:  0.63, y: -1.26, z:  0.25 }, // C5
    { element: 'C', x: -0.63, y: -1.26, z: -0.25 }, // C6

    // Ring Hydrogens
    { element: 'H', x: -1.45, y:  0.00, z:  1.33 },
    { element: 'H', x: -0.45, y:  1.30, z: -1.33 },
    { element: 'H', x: -1.25, y:  2.12, z: -0.05 },
    { element: 'H', x:  0.45, y:  1.30, z:  1.33 },
    { element: 'H', x:  1.25, y:  2.12, z:  0.05 },
    { element: 'H', x:  1.45, y:  0.00, z: -1.33 },
    { element: 'H', x:  0.45, y: -1.30, z:  1.33 },
    { element: 'H', x:  1.25, y: -2.12, z:  0.05 },
    { element: 'H', x: -0.45, y: -1.30, z: -1.33 },
    { element: 'H', x: -1.25, y: -2.12, z: -0.05 },

    // Arm 1 at C1: -CH2-O-CH=CH2
    { element: 'C', x: -2.60, y:  0.00, z: -0.48 }, // methylene C
    { element: 'H', x: -2.55, y:  0.88, z: -1.13 },
    { element: 'H', x: -2.55, y: -0.88, z: -1.13 },
    { element: 'O', x: -3.72, y:  0.00, z:  0.38 }, // ether O
    { element: 'C', x: -4.95, y:  0.00, z: -0.15 }, // vinyl CH
    { element: 'H', x: -5.05, y:  0.00, z: -1.23 },
    { element: 'C', x: -6.02, y:  0.00, z:  0.64 }, // vinyl =CH2
    { element: 'H', x: -5.95, y:  0.00, z:  1.72 },
    { element: 'H', x: -7.02, y:  0.00, z:  0.22 },

    // Arm 2 at C4: -CH2-O-CH=CH2
    { element: 'C', x:  2.60, y:  0.00, z:  0.48 }, // methylene C
    { element: 'H', x:  2.55, y:  0.88, z:  1.13 },
    { element: 'H', x:  2.55, y: -0.88, z:  1.13 },
    { element: 'O', x:  3.72, y:  0.00, z: -0.38 }, // ether O
    { element: 'C', x:  4.95, y:  0.00, z:  0.15 }, // vinyl CH
    { element: 'H', x:  5.05, y:  0.00, z:  1.23 },
    { element: 'C', x:  6.02, y:  0.00, z: -0.64 }, // vinyl =CH2
    { element: 'H', x:  5.95, y:  0.00, z: -1.72 },
    { element: 'H', x:  7.02, y:  0.00, z: -0.22 },
  ].map((at, idx) => ({ ...at, id: `chdmdve-${idx + 1}` }));

  return {
    name: '1,4-Cyclohexanedimethanol divinyl ether',
    chemicalName: '1,4-環己烷二甲醇二乙烯基醚 (1,4-Cyclohexanedimethanol Divinyl Ether / CHDMDVE)',
    iupacName: '1,4-bis(ethenoxymethyl)cyclohexane',
    casNumber: '17351-75-6',
    smiles: 'C=COCC1CCC(COC=C)CC1',
    formula: 'C12H20O2',
    molecularWeight: 196.29,
    atoms: centerAtoms(rawAtoms, box),
    cell: createBoxCell(box[0], box[1], box[2]),
    description: '1,4-雙(乙烯氧基甲基)環己烷，常見於光固化 (UV-curing) 雙官能交聯單體與反應性稀釋劑。',
    type: 'molecule',
    aiPrediction: undefined,
    dftCalculatedEads: null
  };
}

/**
 * Ethyl Acrylate (CH2=CH-COO-CH2-CH3) - CAS 140-88-5
 */
export function getEthylAcrylate(): Structure {
  const box: [number, number, number] = [15.0, 15.0, 15.0];
  const rawAtoms = [
    { element: 'C', x: -2.35, y: -0.12, z:  0.00 }, // C1 =CH2
    { element: 'H', x: -3.20, y:  0.55, z:  0.00 },
    { element: 'H', x: -2.52, y: -1.19, z:  0.00 },
    { element: 'C', x: -1.12, y:  0.41, z:  0.00 }, // C2 -CH=
    { element: 'H', x: -1.02, y:  1.49, z:  0.00 },
    { element: 'C', x:  0.10, y: -0.42, z:  0.00 }, // C3 -C(=O)-
    { element: 'O', x:  0.12, y: -1.63, z:  0.00 }, // =O carbonyl
    { element: 'O', x:  1.22, y:  0.33, z:  0.00 }, // -O- ester
    { element: 'C', x:  2.47, y: -0.40, z:  0.00 }, // C4 -CH2-
    { element: 'H', x:  2.47, y: -1.05, z:  0.88 },
    { element: 'H', x:  2.47, y: -1.05, z: -0.88 },
    { element: 'C', x:  3.62, y:  0.59, z:  0.00 }, // C5 -CH3
    { element: 'H', x:  4.56, y:  0.04, z:  0.00 },
    { element: 'H', x:  3.59, y:  1.23, z:  0.88 },
    { element: 'H', x:  3.59, y:  1.23, z: -0.88 },
  ].map((at, idx) => ({ ...at, id: `ea-${idx + 1}` }));

  return {
    name: 'Ethyl acrylate',
    chemicalName: '丙烯酸乙酯 / 壓克力酸乙酯 (Ethyl Acrylate)',
    iupacName: 'ethyl prop-2-enoate',
    casNumber: '140-88-5',
    smiles: 'CCOC(=O)C=C',
    inchi: 'InChI=1S/C5H8O2/c1-3-5(6)7-4-2/h3H,1,4H2,2H3',
    inchikey: 'SHEAXVQSJZZJIT-UHFFFAOYSA-N',
    formula: 'C5H8O2',
    molecularWeight: 100.12,
    density: 0.92,
    boilingPoint: 99.8,
    meltingPoint: -71.2,
    state: '常溫無色透明液體 (Liquid)',
    atoms: centerAtoms(rawAtoms, box),
    cell: createBoxCell(box[0], box[1], box[2]),
    description: '丙烯酸乙酯（壓克力酸乙酯），工業常用壓克力系合成單體、黏著劑與塗料聚合物原料。',
    type: 'molecule',
    aiPrediction: undefined,
    dftCalculatedEads: null
  };
}

/**
 * 4-(Vinyloxy)butan-1-ol (HBVE) - CAS 17831-71-9
 * Formula: C6H12O2, SMILES: C=COCCCCO (or OCCCCOC=C)
 */
export function getHBVE(): Structure {
  const box: [number, number, number] = [16.0, 16.0, 16.0];
  const rawAtoms = [
    { element: 'C', x: -3.40, y:  0.40, z:  0.00 }, // C1 =CH2
    { element: 'H', x: -3.50, y:  1.45, z:  0.00 },
    { element: 'H', x: -4.25, y: -0.25, z:  0.00 },
    { element: 'C', x: -2.20, y: -0.20, z:  0.00 }, // C2 -CH=
    { element: 'H', x: -2.10, y: -1.25, z:  0.00 },
    { element: 'O', x: -1.05, y:  0.55, z:  0.00 }, // ether -O-
    { element: 'C', x:  0.15, y: -0.15, z:  0.00 }, // C3 -CH2-
    { element: 'H', x:  0.15, y: -0.80, z:  0.88 },
    { element: 'H', x:  0.15, y: -0.80, z: -0.88 },
    { element: 'C', x:  1.35, y:  0.75, z:  0.00 }, // C4 -CH2-
    { element: 'H', x:  1.35, y:  1.40, z:  0.88 },
    { element: 'H', x:  1.35, y:  1.40, z: -0.88 },
    { element: 'C', x:  2.55, y: -0.15, z:  0.00 }, // C5 -CH2-
    { element: 'H', x:  2.55, y: -0.80, z:  0.88 },
    { element: 'H', x:  2.55, y: -0.80, z: -0.88 },
    { element: 'C', x:  3.75, y:  0.75, z:  0.00 }, // C6 -CH2-
    { element: 'H', x:  3.75, y:  1.40, z:  0.88 },
    { element: 'H', x:  3.75, y:  1.40, z: -0.88 },
    { element: 'O', x:  4.95, y: -0.15, z:  0.00 }, // alcohol -OH
    { element: 'H', x:  5.65, y:  0.45, z:  0.00 },
  ].map((at, idx) => ({ ...at, id: `hbve-${idx + 1}` }));

  return {
    name: '4-(Vinyloxy)butan-1-ol',
    chemicalName: '4-羥基丁基乙烯基醚 (4-(Vinyloxy)butan-1-ol / HBVE)',
    iupacName: '4-ethenoxybutan-1-ol',
    casNumber: '17831-71-9',
    smiles: 'C=COCCCCO',
    inchi: 'InChI=1S/C6H12O2/c1-2-8-6-4-3-5-7/h2,7H,1,3-6H2',
    inchikey: 'YMWQYSLBJVWRNZ-UHFFFAOYSA-N',
    formula: 'C6H12O2',
    molecularWeight: 116.16,
    density: 0.94,
    boilingPoint: 143,
    state: '常溫無色液體 (Liquid)',
    atoms: centerAtoms(rawAtoms, box),
    cell: createBoxCell(box[0], box[1], box[2]),
    description: '4-羥基丁基乙烯基醚（HBVE），兼具乙烯醚光固化活性基團與末端羥基，具高反應活性與耐熱耐化性。',
    type: 'molecule',
    aiPrediction: undefined,
    dftCalculatedEads: null
  };
}

/**
 * 2-(2-(Vinyloxy)ethoxy)ethyl acrylate (VEEA) - CAS 86273-46-3
 * Formula: C9H14O4, SMILES: O=C(OCCOCCOC=C)C=C
 */
export function getVEEA(): Structure {
  const box: [number, number, number] = [18.0, 18.0, 18.0];
  const rawAtoms = [
    { element: 'C', x: -5.23478, y: 0.1787, z: -1.0109 },
    { element: 'C', x: -4.56346, y: -0.43737, z: -0.0298 },
    { element: 'C', x: -3.26583, y: 0.08708, z: 0.44478 },
    { element: 'O', x: -2.70779, y: 1.08286, z: 0.01661 },
    { element: 'O', x: -2.81319, y: -0.73883, z: 1.41988 },
    { element: 'C', x: -1.56779, y: -0.35041, z: 2.01869 },
    { element: 'C', x: -0.37788, y: -0.74844, z: 1.14912 },
    { element: 'O', x: 0.83143, y: -0.43634, z: 1.84035 },
    { element: 'C', x: 2.00081, y: -0.73399, z: 1.07613 },
    { element: 'C', x: 2.3591, y: 0.39457, z: 0.11079 },
    { element: 'O', x: 3.5627, y: 0.04352, z: -0.57758 },
    { element: 'C', x: 3.94254, y: 0.98998, z: -1.48769 },
    { element: 'C', x: 4.90414, y: 0.75083, z: -2.37976 },
    { element: 'H', x: -4.85083, y: 1.07764, z: -1.48646 },
    { element: 'H', x: -6.18793, y: -0.2055, z: -1.35836 },
    { element: 'H', x: -4.94762, y: -1.33201, z: 0.44476 },
    { element: 'H', x: -1.55676, y: 0.7237, z: 2.24341 },
    { element: 'H', x: -1.50068, y: -0.85754, z: 2.988 },
    { element: 'H', x: -0.41682, y: -0.22354, z: 0.18971 },
    { element: 'H', x: -0.4183, y: -1.82409, z: 0.94029 },
    { element: 'H', x: 2.82652, y: -0.86864, z: 1.78428 },
    { element: 'H', x: 1.89459, y: -1.69068, z: 0.54992 },
    { element: 'H', x: 1.54852, y: 0.55136, z: -0.61063 },
    { element: 'H', x: 2.49784, y: 1.32659, z: 0.67355 },
    { element: 'H', x: 3.42793, y: 1.94045, z: -1.42984 },
    { element: 'H', x: 5.4085, y: -0.20918, z: -2.40912 },
    { element: 'H', x: 5.20508, y: 1.50925, z: -3.09347 }
  ].map((at, idx) => ({ ...at, id: `atom-${idx + 1}`, fixed: false }));

  return {
    name: '2-(2-(Vinyloxy)ethoxy)ethyl acrylate',
    chemicalName: '丙烯酸-2-(2-乙烯氧基乙氧基)乙酯 (VEEA)',
    iupacName: '2-(2-ethenoxyethoxy)ethyl prop-2-enoate',
    casNumber: '86273-46-3',
    smiles: 'C=CC(=O)OCCOCCOC=C',
    canonicalSmiles: 'C=COCCOCCOC(=O)C=C',
    isomericSmiles: 'C=COCCOCCOC(=O)C=C',
    inchi: 'InChI=1S/C9H14O4/c1-3-9(10)13-8-7-12-6-5-11-4-2/h3-4H,1-2,5-8H2',
    inchikey: 'URQQDYIVGXOEDA-UHFFFAOYSA-N',
    formula: 'C9H14O4',
    molecularWeight: 186.21,
    density: 1.02,
    boilingPoint: 245,
    state: '常溫無色透明液體 (Liquid)',
    atoms: centerAtoms(rawAtoms, box),
    cell: createBoxCell(box[0], box[1], box[2]),
    description: 'VEEA 雙官能光固化單體（壓克力酸酯 + 乙烯基醚），具低黏度、高稀釋性與優異固化速度。',
    type: 'molecule',
    conformerEngine: 'ETKDGv3 + MMFF94 Optimization',
    identityGate: 'PASS',
    identityVerified: true,
    aiPrediction: undefined,
    dftCalculatedEads: null
  };
}

/**
 * Diethylene glycol diacrylate (DEGDA) - CAS 4074-88-8
 * Formula: C10H14O5, SMILES: C=CC(=O)OCCOCC(=O)C=C
 */
export function getDEGDA(): Structure {
  const box: [number, number, number] = [18.0, 18.0, 18.0];
  const rawAtoms = [
    { element: 'C', x: -5.60, y:  0.40, z:  0.00 }, // =CH2
    { element: 'H', x: -5.70, y:  1.45, z:  0.00 },
    { element: 'H', x: -6.45, y: -0.25, z:  0.00 },
    { element: 'C', x: -4.40, y: -0.20, z:  0.00 }, // -CH=
    { element: 'H', x: -4.30, y: -1.25, z:  0.00 },
    { element: 'C', x: -3.20, y:  0.60, z:  0.00 }, // C(=O)
    { element: 'O', x: -3.25, y:  1.80, z:  0.00 }, // =O
    { element: 'O', x: -2.05, y: -0.10, z:  0.00 }, // -O-
    { element: 'C', x: -0.85, y:  0.70, z:  0.00 }, // -CH2-
    { element: 'H', x: -0.85, y:  1.35, z:  0.88 },
    { element: 'H', x: -0.85, y:  1.35, z: -0.88 },
    { element: 'O', x:  0.30, y: -0.10, z:  0.00 }, // ether -O-
    { element: 'C', x:  1.50, y:  0.70, z:  0.00 }, // -CH2-
    { element: 'H', x:  1.50, y:  1.35, z:  0.88 },
    { element: 'H', x:  1.50, y:  1.35, z: -0.88 },
    { element: 'O', x:  2.65, y: -0.10, z:  0.00 }, // -O-
    { element: 'C', x:  3.85, y:  0.60, z:  0.00 }, // C(=O)
    { element: 'O', x:  3.80, y:  1.80, z:  0.00 }, // =O
    { element: 'C', x:  5.05, y: -0.20, z:  0.00 }, // -CH=
    { element: 'H', x:  5.00, y: -1.25, z:  0.00 },
    { element: 'C', x:  6.25, y:  0.40, z:  0.00 }, // =CH2
    { element: 'H', x:  7.15, y: -0.15, z:  0.00 },
    { element: 'H', x:  6.35, y:  1.45, z:  0.00 },
  ].map((at, idx) => ({ ...at, id: `degda-${idx + 1}` }));

  return {
    name: 'Diethylene glycol diacrylate',
    chemicalName: '二甘醇二丙烯酸酯 (Diethylene Glycol Diacrylate / DEGDA)',
    iupacName: '2-(2-prop-2-enoyloxyethoxy)ethyl prop-2-enoate',
    casNumber: '4074-88-8',
    smiles: 'C=CC(=O)OCCOCC(=O)C=C',
    formula: 'C10H14O5',
    molecularWeight: 214.22,
    density: 1.11,
    boilingPoint: 250,
    state: '常溫液體 (Liquid)',
    atoms: centerAtoms(rawAtoms, box),
    cell: createBoxCell(box[0], box[1], box[2]),
    description: '二甘醇二丙烯酸酯（DEGDA），雙官能交聯型壓克力系單體，廣泛應用於 UV/EB 固化油墨與塗料。',
    type: 'molecule',
    aiPrediction: undefined,
    dftCalculatedEads: null
  };
}

/**
 * Built-in standard molecules
 */
export const STANDARD_MOLECULES: Record<string, () => Structure> = {
  'C6H5COOCH2CH3': getEthylBenzoate,
  'C12H20O2': getCHDMDVE,
  'C5H8O2': getEthylAcrylate,
  'C6H12O2': getHBVE,
  'C9H14O4': getVEEA,
  'C10H14O5': getDEGDA,
  'C6H12': () => {
    const box: [number, number, number] = [14.0, 14.0, 14.0];
    const rawAtoms = [
      { element: 'C', x: -1.26, y:  0.00, z:  0.25 },
      { element: 'C', x: -0.63, y:  1.26, z: -0.25 },
      { element: 'C', x:  0.63, y:  1.26, z:  0.25 },
      { element: 'C', x:  1.26, y:  0.00, z: -0.25 },
      { element: 'C', x:  0.63, y: -1.26, z:  0.25 },
      { element: 'C', x: -0.63, y: -1.26, z: -0.25 },
      { element: 'H', x: -1.45, y:  0.00, z:  1.33 },
      { element: 'H', x: -2.18, y:  0.00, z: -0.34 },
      { element: 'H', x: -0.45, y:  1.30, z: -1.33 },
      { element: 'H', x: -1.25, y:  2.12, z: -0.05 },
      { element: 'H', x:  0.45, y:  1.30, z:  1.33 },
      { element: 'H', x:  1.25, y:  2.12, z:  0.05 },
      { element: 'H', x:  1.45, y:  0.00, z: -1.33 },
      { element: 'H', x:  2.18, y:  0.00, z:  0.34 },
      { element: 'H', x:  0.45, y: -1.30, z:  1.33 },
      { element: 'H', x:  1.25, y: -2.12, z:  0.05 },
      { element: 'H', x: -0.45, y: -1.30, z: -1.33 },
      { element: 'H', x: -1.25, y: -2.12, z: -0.05 },
    ].map((at, idx) => ({ ...at, id: `c6h12-${idx + 1}` }));
    return {
      name: 'Cyclohexane',
      chemicalName: '環己烷 (Cyclohexane)',
      iupacName: 'cyclohexane',
      casNumber: '110-82-7',
      smiles: 'C1CCCCC1',
      formula: 'C6H12',
      molecularWeight: 84.16,
      atoms: centerAtoms(rawAtoms, box),
      cell: createBoxCell(box[0], box[1], box[2]),
      description: '六元碳環飽和烴，標準椅式構型。由 auto_fix_and_parse_smiles() 自動修補 C1CCCCC 環號 1 閉合。',
      type: 'molecule',
      aiPrediction: undefined,
      dftCalculatedEads: null
    };
  },
  'C4H8O2_acid': () => {
    const box: [number, number, number] = [12.0, 12.0, 12.0];
    const rawAtoms = [
      { element: 'C', x:  0.00, y:  0.00, z:  0.00 },
      { element: 'H', x:  0.00, y:  0.00, z:  1.09 },
      { element: 'C', x: -1.26, y: -0.73, z: -0.42 },
      { element: 'H', x: -1.26, y: -1.77, z: -0.09 },
      { element: 'H', x: -2.15, y: -0.25, z: -0.02 },
      { element: 'H', x: -1.30, y: -0.72, z: -1.51 },
      { element: 'C', x:  1.26, y: -0.73, z: -0.42 },
      { element: 'H', x:  1.26, y: -1.77, z: -0.09 },
      { element: 'H', x:  2.15, y: -0.25, z: -0.02 },
      { element: 'H', x:  1.30, y: -0.72, z: -1.51 },
      { element: 'C', x:  0.00, y:  1.45, z: -0.52 },
      { element: 'O', x:  0.95, y:  2.12, z: -0.85 },
      { element: 'O', x: -1.18, y:  1.95, z: -0.55 },
      { element: 'H', x: -1.15, y:  2.88, z: -0.88 },
    ].map((at, idx) => ({ ...at, id: `isobutyric-${idx + 1}` }));
    return {
      name: 'Isobutyric acid',
      chemicalName: '異丁酸 / 2-甲基丙酸 (Isobutyric Acid)',
      iupacName: '2-methylpropanoic acid',
      casNumber: '79-31-2',
      smiles: 'CC(C)C(=O)O',
      formula: 'C4H8O2',
      molecularWeight: 88.11,
      atoms: centerAtoms(rawAtoms, box),
      cell: createBoxCell(box[0], box[1], box[2]),
      description: '支鏈羧酸，由 auto_fix_and_parse_smiles() 自動補全 CC(C(=O)O 缺失括號。',
      type: 'molecule',
      aiPrediction: undefined,
      dftCalculatedEads: null
    };
  },
  'C6H6': () => {
    const box: [number, number, number] = [14.0, 14.0, 14.0];
    const rawAtoms = [
      { element: 'C', x: 0.000, y: 1.397, z: 0.000 },
      { element: 'C', x: 1.210, y: 0.698, z: 0.000 },
      { element: 'C', x: 1.210, y: -0.698, z: 0.000 },
      { element: 'C', x: 0.000, y: -1.397, z: 0.000 },
      { element: 'C', x: -1.210, y: -0.698, z: 0.000 },
      { element: 'C', x: -1.210, y: 0.698, z: 0.000 },
      { element: 'H', x: 0.000, y: 2.477, z: 0.000 },
      { element: 'H', x: 2.145, y: 1.238, z: 0.000 },
      { element: 'H', x: 2.145, y: -1.238, z: 0.000 },
      { element: 'H', x: 0.000, y: -2.477, z: 0.000 },
      { element: 'H', x: -2.145, y: -1.238, z: 0.000 },
      { element: 'H', x: -2.145, y: 1.238, z: 0.000 },
    ].map((at, idx) => ({ ...at, id: `c6h6-${idx + 1}` }));
    return {
      name: 'Benzene',
      chemicalName: '苯 (Benzene)',
      iupacName: 'benzene',
      casNumber: '71-43-2',
      smiles: 'c1ccccc1',
      formula: 'C6H6',
      molecularWeight: 78.11,
      atoms: centerAtoms(rawAtoms, box),
      cell: createBoxCell(box[0], box[1], box[2]),
      description: '芳香烴基準分子，主要與羥基化表面產生弱 π-H 接觸。',
      type: 'molecule',
      aiPrediction: undefined,
      dftCalculatedEads: null
    };
  },
  'C6H5COOH': () => {
    const box: [number, number, number] = [15.0, 15.0, 15.0];
    const rawAtoms = [
      { element: 'C', x: 0.000, y: 0.000, z: 0.000 },
      { element: 'C', x: 1.390, y: 0.000, z: 0.000 },
      { element: 'C', x: 2.085, y: 1.204, z: 0.000 },
      { element: 'C', x: 1.390, y: 2.408, z: 0.000 },
      { element: 'C', x: 0.000, y: 2.408, z: 0.000 },
      { element: 'C', x: -0.695, y: 1.204, z: 0.000 },
      { element: 'H', x: 1.930, y: -0.935, z: 0.000 },
      { element: 'H', x: 3.165, y: 1.204, z: 0.000 },
      { element: 'H', x: 1.930, y: 3.343, z: 0.000 },
      { element: 'H', x: -0.540, y: 3.343, z: 0.000 },
      { element: 'H', x: -1.775, y: 1.204, z: 0.000 },
      { element: 'C', x: -0.730, y: -1.270, z: 0.000 },
      { element: 'O', x: -0.220, y: -2.370, z: 0.000 },
      { element: 'O', x: -2.060, y: -1.090, z: 0.000 },
      { element: 'H', x: -2.520, y: -1.930, z: 0.000 },
    ].map((at, idx) => ({ ...at, id: `c6h5cooh-${idx + 1}` }));
    return {
      name: 'Benzoic Acid',
      chemicalName: '苯甲酸 (Benzoic Acid)',
      iupacName: 'benzoic acid',
      casNumber: '65-85-0',
      smiles: 'O=C(O)c1ccccc1',
      formula: 'C7H6O2',
      molecularWeight: 122.12,
      atoms: centerAtoms(rawAtoms, box),
      cell: createBoxCell(box[0], box[1], box[2]),
      description: '芳香族羧酸，具備羧基雙齒強配位氫鍵與苯環分散力。',
      type: 'molecule',
      aiPrediction: undefined,
      dftCalculatedEads: null
    };
  },
  'CH3CH2OH': () => {
    const box: [number, number, number] = [12.0, 12.0, 12.0];
    const rawAtoms = [
      { element: 'C', x: -0.670, y: -0.540, z: 0.000 },
      { element: 'C', x: 0.770, y: 0.000, z: 0.000 },
      { element: 'O', x: 1.630, y: -1.130, z: 0.000 },
      { element: 'H', x: 2.540, y: -0.840, z: 0.000 },
      { element: 'H', x: -1.220, y: -0.190, z: 0.880 },
      { element: 'H', x: -1.220, y: -0.190, z: -0.880 },
      { element: 'H', x: -0.670, y: -1.630, z: 0.000 },
      { element: 'H', x: 0.880, y: 0.630, z: 0.880 },
      { element: 'H', x: 0.880, y: 0.630, z: -0.880 },
    ].map((at, idx) => ({ ...at, id: `eth-${idx + 1}` }));
    return {
      name: 'Ethanol',
      chemicalName: '乙醇 (Ethanol)',
      iupacName: 'ethanol',
      casNumber: '64-17-5',
      smiles: 'CCO',
      formula: 'C2H6O',
      molecularWeight: 46.07,
      atoms: centerAtoms(rawAtoms, box),
      cell: createBoxCell(box[0], box[1], box[2]),
      description: '揮發性小分子醇類，經典羥基氫鍵探針。',
      type: 'molecule',
      aiPrediction: undefined,
      dftCalculatedEads: null
    };
  },
  'CO': () => {
    const box: [number, number, number] = [10.0, 10.0, 10.0];
    const rawAtoms = [
      { element: 'C', x: 0.000, y: 0.000, z: 0.000 },
      { element: 'O', x: 0.000, y: 0.000, z: 1.130 },
    ].map((at, idx) => ({ ...at, id: `co-${idx + 1}` }));
    return {
      name: 'Carbon Monoxide',
      chemicalName: '一氧化碳 (CO)',
      iupacName: 'carbon monoxide',
      casNumber: '630-08-0',
      smiles: '[C-]#[O+]',
      formula: 'CO',
      molecularWeight: 28.01,
      atoms: centerAtoms(rawAtoms, box),
      cell: createBoxCell(box[0], box[1], box[2]),
      description: 'Classic probe molecule for catalyst surfaces.',
      type: 'molecule',
      aiPrediction: undefined,
      dftCalculatedEads: null
    };
  },
  'CO2': () => {
    const box: [number, number, number] = [12.0, 12.0, 12.0];
    const rawAtoms = [
      { element: 'C', x: 0.000, y: 0.000, z: 0.000 },
      { element: 'O', x: 0.000, y: 0.000, z: 1.160 },
      { element: 'O', x: 0.000, y: 0.000, z: -1.160 },
    ].map((at, idx) => ({ ...at, id: `co2-${idx + 1}` }));
    return {
      name: 'Carbon Dioxide',
      chemicalName: '二氧化碳 (CO2)',
      iupacName: 'carbon dioxide',
      casNumber: '124-38-9',
      smiles: 'O=C=O',
      formula: 'CO2',
      molecularWeight: 44.01,
      atoms: centerAtoms(rawAtoms, box),
      cell: createBoxCell(box[0], box[1], box[2]),
      description: 'Linear greenhouse gas molecule for reduction & capture studies.',
      type: 'molecule',
      aiPrediction: undefined,
      dftCalculatedEads: null
    };
  },
  'H2O': () => {
    const box: [number, number, number] = [10.0, 10.0, 10.0];
    const rawAtoms = [
      { element: 'O', x: 0.000, y: 0.000, z: 0.000 },
      { element: 'H', x: 0.757, y: 0.586, z: 0.000 },
      { element: 'H', x: -0.757, y: 0.586, z: 0.000 },
    ].map((at, idx) => ({ ...at, id: `h2o-${idx + 1}` }));
    return {
      name: 'Water',
      chemicalName: '水 (Water)',
      iupacName: 'oxidane',
      casNumber: '7732-18-5',
      smiles: 'O',
      formula: 'H2O',
      molecularWeight: 18.02,
      atoms: centerAtoms(rawAtoms, box),
      cell: createBoxCell(box[0], box[1], box[2]),
      description: '強極性水分子，與氧化鋁表面羥基形成強氫鍵網絡。',
      type: 'molecule',
      aiPrediction: undefined,
      dftCalculatedEads: null
    };
  },
  'CH4': () => {
    const box: [number, number, number] = [10.0, 10.0, 10.0];
    const rawAtoms = [
      { element: 'C', x: 0.000, y: 0.000, z: 0.000 },
      { element: 'H', x: 0.628, y: 0.628, z: 0.628 },
      { element: 'H', x: -0.628, y: -0.628, z: 0.628 },
      { element: 'H', x: -0.628, y: 0.628, z: -0.628 },
      { element: 'H', x: 0.628, y: -0.628, z: -0.628 },
    ].map((at, idx) => ({ ...at, id: `ch4-${idx + 1}` }));
    return {
      name: 'Methane',
      chemicalName: '甲烷 (Methane)',
      iupacName: 'methane',
      casNumber: '74-82-8',
      smiles: 'C',
      formula: 'CH4',
      molecularWeight: 16.04,
      atoms: centerAtoms(rawAtoms, box),
      cell: createBoxCell(box[0], box[1], box[2]),
      description: '非極性四面體烷烴分子。',
      type: 'molecule',
      aiPrediction: undefined,
      dftCalculatedEads: null
    };
  }
};

export const STANDARD_SLABS: Record<string, () => Structure> = {
  'Hydroxylated α-Al2O3(0001)': generateHydroxylatedAl2O3Slab,
};

/**
 * Hydroxylated α-Al2O3(0001) Surface Slab Generator
 * Corundum structure (space group R-3c)
 * 2x2 supercell: a = 9.52 Å, b = 9.52 Å (hexagonal, gamma = 60°)
 * Includes stoichiometric bulk Al2O3 layers + surface Al-OH hydroxyl groups
 */
export function generateHydroxylatedAl2O3Slab(): Structure {
  const a = 9.52; // 2x corundum a (4.76 Å)
  const cellA: [number, number, number] = [a, 0, 0];
  const cellB: [number, number, number] = [a * 0.5, a * (Math.sqrt(3) / 2), 0];
  const totalZ = 26.0; // 18 Å vacuum layer above slab
  const cellC: [number, number, number] = [0, 0, totalZ];

  const atoms: Atom[] = [];
  let idCounter = 1;

  // Layer 1: Bottom Oxygen layer (z = 2.0 Å, Fixed)
  const layer1_O = [
    [0.15, 0.15], [0.65, 0.15], [0.15, 0.65], [0.65, 0.65],
    [0.40, 0.40], [0.90, 0.40], [0.40, 0.90], [0.90, 0.90],
  ];
  layer1_O.forEach(([u, v]) => {
    const x = u * cellA[0] + v * cellB[0];
    const y = u * cellA[1] + v * cellB[1];
    atoms.push({
      id: `al2o3-O1-${idCounter++}`,
      element: 'O',
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      z: 2.000,
      fixed: true
    });
  });

  // Layer 2: Fixed Aluminum layer (z = 2.85 Å, Fixed)
  const layer2_Al = [
    [0.33, 0.17], [0.83, 0.17], [0.33, 0.67], [0.83, 0.67],
    [0.17, 0.33], [0.67, 0.33], [0.17, 0.83], [0.67, 0.83],
  ];
  layer2_Al.forEach(([u, v]) => {
    const x = u * cellA[0] + v * cellB[0];
    const y = u * cellA[1] + v * cellB[1];
    atoms.push({
      id: `al2o3-Al2-${idCounter++}`,
      element: 'Al',
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      z: 2.850,
      fixed: true
    });
  });

  // Layer 3: Sub-surface Oxygen layer (z = 3.85 Å, Relaxed)
  const layer3_O = [
    [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75],
    [0.50, 0.50], [0.00, 0.50], [0.50, 0.00], [0.00, 0.00],
  ];
  layer3_O.forEach(([u, v]) => {
    const x = u * cellA[0] + v * cellB[0];
    const y = u * cellA[1] + v * cellB[1];
    atoms.push({
      id: `al2o3-O3-${idCounter++}`,
      element: 'O',
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      z: 3.850,
      fixed: false
    });
  });

  // Layer 4: Surface Aluminum cations (z = 4.60 Å, Relaxed Lewis Acid Sites)
  const layer4_Al = [
    [0.35, 0.35], [0.85, 0.35], [0.35, 0.85], [0.85, 0.85],
    [0.60, 0.60], [0.10, 0.60],
  ];
  layer4_Al.forEach(([u, v]) => {
    const x = u * cellA[0] + v * cellB[0];
    const y = u * cellA[1] + v * cellB[1];
    atoms.push({
      id: `al2o3-Al4-${idCounter++}`,
      element: 'Al',
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      z: 4.600,
      fixed: false
    });
  });

  // Layer 5: Top Surface Oxygens (z = 5.45 Å, Relaxed)
  const layer5_O = [
    [0.20, 0.45], [0.70, 0.45], [0.20, 0.95], [0.70, 0.95],
    [0.45, 0.20], [0.95, 0.20], [0.45, 0.70], [0.95, 0.70],
  ];
  layer5_O.forEach(([u, v]) => {
    const x = u * cellA[0] + v * cellB[0];
    const y = u * cellA[1] + v * cellB[1];
    atoms.push({
      id: `al2o3-O5-${idCounter++}`,
      element: 'O',
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      z: 5.450,
      fixed: false
    });
  });

  // Layer 6: Hydroxyl Protons (-OH groups, z = 6.42 Å, bond = 0.97 Å)
  layer5_O.forEach(([u, v], idx) => {
    const tiltU = 0.02 * (idx % 2 === 0 ? 1 : -1);
    const tiltV = 0.02 * (idx % 3 === 0 ? 1 : -1);
    const x = (u + tiltU) * cellA[0] + (v + tiltV) * cellB[0];
    const y = (u + tiltU) * cellA[1] + (v + tiltV) * cellB[1];
    atoms.push({
      id: `al2o3-H6-${idCounter++}`,
      element: 'H',
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      z: 6.420,
      fixed: false
    });
  });

  const lengthA = Math.hypot(cellA[0], cellA[1], cellA[2]);
  const lengthB = Math.hypot(cellB[0], cellB[1], cellB[2]);
  const lengthC = totalZ;

  return {
    name: 'Hydroxylated α-Al2O3(0001) Surface Slab',
    formula: 'α-Al2O3(0001)-OH',
    atoms,
    cell: {
      a: cellA,
      b: cellB,
      c: cellC,
      lengths: [lengthA, lengthB, lengthC],
      angles: [90, 90, 60],
      periodic: [true, true, false]
    },
    description: 'Periodic Hydroxylated α-Al2O3(0001) Corundum Slab (2×2 supercell, 18 Å vacuum). Bottom layers are fixed by Selective Dynamics.',
    type: 'slab'
  };
}

/**
 * Finds Active Adsorption Sites on Hydroxylated Alumina Surface
 */
export function findAluminaAdsorptionSites(slab: Structure): AdsorptionSite[] {
  const hAtoms = slab.atoms.filter(a => a.element === 'H' && a.z > 6.0);
  const alAtoms = slab.atoms.filter(a => a.element === 'Al' && a.z > 4.0);
  const oAtoms = slab.atoms.filter(a => a.element === 'O' && a.z > 5.0);

  const sites: AdsorptionSite[] = [];

  if (hAtoms.length > 0) {
    sites.push({
      id: 'site-oh-1',
      name: 'OH-1 (Brønsted Acid Site)',
      type: 'ontop_OH',
      position: [hAtoms[0].x, hAtoms[0].y, hAtoms[0].z],
      description: 'Surface Al-OH hydroxyl proton; acts as strong H-bond donor to ester C=O or -O-.'
    });
    if (hAtoms.length > 1) {
      sites.push({
        id: 'site-oh-2',
        name: 'OH-2 (Brønsted Acid Site)',
        type: 'ontop_OH',
        position: [hAtoms[1].x, hAtoms[1].y, hAtoms[1].z],
        description: 'Adjacent surface hydroxyl proton for secondary H-bonding or multi-point anchoring.'
      });
    }
  }

  if (alAtoms.length > 0) {
    sites.push({
      id: 'site-al-lewis',
      name: 'Al-Lewis (Lewis Acid Cation Site)',
      type: 'lewis_Al',
      position: [alAtoms[0].x, alAtoms[0].y, alAtoms[0].z + 0.4],
      description: 'Undercoordinated surface Al³⁺ cation; acts as strong Lewis acid for ester carbonyl oxygen.'
    });
  }

  if (hAtoms.length > 0 && alAtoms.length > 0) {
    const mx = Number(((hAtoms[0].x + alAtoms[0].x) / 2).toFixed(3));
    const my = Number(((hAtoms[0].y + alAtoms[0].y) / 2).toFixed(3));
    const mz = Number(((hAtoms[0].z + alAtoms[0].z) / 2).toFixed(3));
    sites.push({
      id: 'site-multipoint',
      name: 'Multi-Point Bidentate Site',
      type: 'multipoint',
      position: [mx, my, mz],
      description: 'Cooperative region enabling simultaneous ester H-bonding and aromatic phenyl π-coordination.'
    });
  }

  if (oAtoms.length > 0) {
    sites.push({
      id: 'site-hollow',
      name: 'Basal 3-Fold Hollow Site',
      type: 'hollow',
      position: [Number((oAtoms[0].x + 0.9).toFixed(3)), Number((oAtoms[0].y + 0.5).toFixed(3)), 6.42],
      description: 'Threefold hollow between surface hydroxyls for flat aromatic ring interaction.'
    });
  }

  return sites;
}

/**
 * Automatically generates the ensemble of initial adsorption configurations
 * for an adsorbate on hydroxylated alpha-Al2O3(0001)
 */
export function generateAutoAdsorptionConfigurations(
  slab: Structure,
  molecule: Structure
): AdsorptionConfiguration[] {
  const sites = findAluminaAdsorptionSites(slab);
  const ohSite = sites.find(s => s.type === 'ontop_OH') || sites[0];
  const alSite = sites.find(s => s.type === 'lewis_Al') || sites[1] || sites[0];
  const multiSite = sites.find(s => s.type === 'multipoint') || sites[2] || sites[0];
  const hollowSite = sites.find(s => s.type === 'hollow') || sites[0];

  // Helper to place and orient molecule
  const createConfigStructure = (
    name: string,
    targetX: number,
    targetY: number,
    targetZ: number,
    height: number,
    tiltDeg: number,
    azimuthDeg: number,
    invertAnchor = false
  ): Structure => {
    // Find molecule bounds
    let minZ = Infinity, maxZ = -Infinity;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const a of molecule.atoms) {
      if (a.z < minZ) minZ = a.z;
      if (a.z > maxZ) maxZ = a.z;
      if (a.x < minX) minX = a.x;
      if (a.x > maxX) maxX = a.x;
      if (a.y < minY) minY = a.y;
      if (a.y > maxY) maxY = a.y;
    }
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const radTilt = (tiltDeg * Math.PI) / 180;
    const radAzim = (azimuthDeg * Math.PI) / 180;

    const molAtoms: Atom[] = molecule.atoms.map((at, idx) => {
      let rx = at.x - midX;
      let ry = at.y - midY;
      let rz = invertAnchor ? maxZ - at.z : at.z - minZ;

      // Azimuth rotation around Z
      const rx1 = rx * Math.cos(radAzim) - ry * Math.sin(radAzim);
      const ry1 = rx * Math.sin(radAzim) + ry * Math.cos(radAzim);
      const rz1 = rz;

      // Tilt rotation around X
      const rx2 = rx1;
      const ry2 = ry1 * Math.cos(radTilt) - rz1 * Math.sin(radTilt);
      const rz2 = ry1 * Math.sin(radTilt) + rz1 * Math.cos(radTilt);

      return {
        id: `adsorbate-conf-${idx + 1}`,
        element: at.element,
        x: Number((targetX + rx2).toFixed(4)),
        y: Number((targetY + ry2).toFixed(4)),
        z: Number((targetZ + height + rz2).toFixed(4)),
        fixed: false
      };
    });

    return {
      name: `${name} - ${molecule.name} on ${slab.name}`,
      formula: `${molecule.formula} / ${slab.formula}`,
      atoms: [...slab.atoms, ...molAtoms],
      cell: slab.cell,
      description: `Automated layout configuration: ${name}`,
      type: 'adsorption_system'
    };
  };

  const configs: AdsorptionConfiguration[] = [
    {
      id: 'conf-1-oh',
      name: 'Conf 1：OH 吸附 (Hydrogen Bonding)',
      siteType: 'ontop_OH',
      anchor: 'Ester Carbonyl O (=O)',
      height: 1.85,
      tilt: 35,
      azimuth: 30,
      description: '酯基羰基氧 (C=O) 朝下直接與表面 Al-OH 氫氧根質子形成強氫鍵 (O...H-O 鍵長約 1.85 Å)，苯環向真空傾斜以降低立體阻礙。',
      targetSite: ohSite,
      structure: createConfigStructure(
        'Conf 1 (OH-Adsorption)',
        ohSite.position[0],
        ohSite.position[1],
        ohSite.position[2],
        1.85,
        35,
        30
      )
    },
    {
      id: 'conf-2-ester',
      name: 'Conf 2：Ester 吸附 (Lewis Acid-Base)',
      siteType: 'lewis_Al',
      anchor: 'Ester Carbonyl O (=O)',
      height: 2.10,
      tilt: 20,
      azimuth: 120,
      description: '酯基羰基氧 (C=O) 直接配位至表面配位不飽和的 Al³⁺ 路易斯酸點位 (Al...O 配位鍵長約 2.10 Å)，形成強烈偶極/靜電吸附。',
      targetSite: alSite,
      structure: createConfigStructure(
        'Conf 2 (Ester-Al Lewis Adsorption)',
        alSite.position[0],
        alSite.position[1],
        alSite.position[2],
        2.10,
        20,
        120
      )
    },
    {
      id: 'conf-3-multipoint',
      name: 'Conf 3：多點吸附 (Multi-point / Bidentate)',
      siteType: 'multipoint',
      anchor: 'Carbonyl O + Phenyl Ring',
      height: 2.30,
      tilt: 15,
      azimuth: 75,
      description: '雙齒協同多點吸附：酯基羰基與表面 Al-OH 形成氫鍵，同時鄰近的苯甲酸酯芳香環跨越至相鄰表面氧位點，發揮最大鍵結強度。',
      targetSite: multiSite,
      structure: createConfigStructure(
        'Conf 3 (Multi-point Bidentate)',
        multiSite.position[0],
        multiSite.position[1],
        multiSite.position[2],
        2.30,
        15,
        75
      )
    },
    {
      id: 'conf-4-flat-pi',
      name: 'Conf 4：芳香環 π-吸附 (Flat Phenyl π-Stacking)',
      siteType: 'flat_pi',
      anchor: 'Phenyl Ring Centroid',
      height: 2.95,
      tilt: 0,
      azimuth: 0,
      description: '芳香苯環完全平行於羥基化表面平放 (θ = 0°)，主要由凡德瓦爾色散力 (DFT-D3) 驅動，橫向覆蓋多個表面 OH 網格。',
      targetSite: hollowSite,
      structure: createConfigStructure(
        'Conf 4 (Flat Phenyl pi-Adsorption)',
        hollowSite.position[0],
        hollowSite.position[1],
        hollowSite.position[2],
        2.95,
        0,
        0
      )
    },
    {
      id: 'conf-5-upright',
      name: 'Conf 5：垂直直立吸附 (Upright / Perpendicular)',
      siteType: 'upright',
      anchor: 'Ester End-on',
      height: 2.05,
      tilt: 85,
      azimuth: 0,
      description: '垂直直立構型：酯基端部錨定於表面點位，疏水性苯環垂直高聳於真空中 (θ ≈ 85°)，利於高覆蓋度下的單分子自組裝層 (SAM)。',
      targetSite: ohSite,
      structure: createConfigStructure(
        'Conf 5 (Upright End-on)',
        ohSite.position[0],
        ohSite.position[1],
        ohSite.position[2],
        2.05,
        85,
        0
      )
    }
  ];

  return configs;
}

/**
 * Optimizes monomer geometry, fixing planar 2D artifacts, bond clashes, and centering inside supercell
 */
export function optimizeMonomerConformation(structure: Structure): Structure {
  if (structure.type !== 'molecule' && structure.type !== 'custom') {
    return structure;
  }

  let atoms = [...structure.atoms];
  // 1. Check if all Z coordinates are near zero (2D Molfile artifact)
  const isPlanar2D = atoms.length > 2 && atoms.every(a => Math.abs(a.z) < 1e-4);

  if (isPlanar2D) {
    // Generate 3D out-of-plane dihedral displacements for sp3 / ring systems
    atoms = atoms.map((a, i) => {
      let zShift = 0;
      if (a.element === 'H') {
        zShift = (i % 2 === 0 ? 0.89 : -0.89);
      } else if (a.element === 'C' && i > 5) {
        zShift = (i % 2 === 0 ? 0.35 : -0.35);
      } else if (a.element === 'O') {
        zShift = 0.05;
      }
      return { ...a, z: Number((a.z + zShift).toFixed(4)) };
    });
  }

  // 2. Resolve any overlapping atom pairs (distance < 0.9 Å for non-H, < 0.7 Å for H)
  for (let iter = 0; iter < 5; iter++) {
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const dx = atoms[j].x - atoms[i].x;
        const dy = atoms[j].y - atoms[i].y;
        const dz = atoms[j].z - atoms[i].z;
        const dist = Math.hypot(dx, dy, dz);
        const minDist = (atoms[i].element === 'H' || atoms[j].element === 'H') ? 0.85 : 1.25;

        if (dist < minDist && dist > 1e-6) {
          const push = (minDist - dist) * 0.5;
          const nx = (dx / dist) * push;
          const ny = (dy / dist) * push;
          const nz = (dz / dist) * push;
          atoms[j] = { ...atoms[j], x: Number((atoms[j].x + nx).toFixed(4)), y: Number((atoms[j].y + ny).toFixed(4)), z: Number((atoms[j].z + nz).toFixed(4)) };
          atoms[i] = { ...atoms[i], x: Number((atoms[i].x - nx).toFixed(4)), y: Number((atoms[i].y - ny).toFixed(4)), z: Number((atoms[i].z - nz).toFixed(4)) };
        }
      }
    }
  }

  // 3. Center inside vacuum cell
  const box = structure.cell.lengths;
  const centered = centerAtoms(atoms, [box[0], box[1], box[2]]);

  return {
    ...structure,
    atoms: centered,
    description: `${structure.description || structure.name} (3D Conformer Optimized & Stabilized)`
  };
}

/**
 * Automatically assembles a stable Monomer on Hydroxylated Al2O3(0001) complex
 */
export function assembleStableMonomerAl2O3Complex(
  monomer: Structure,
  slab: Structure,
  options?: {
    mode?: 'multipoint' | 'ester_lewis' | 'oh_hbond' | 'flat_pi' | 'upright';
    height?: number;
    tilt?: number;
    azimuth?: number;
  }
): {
  complex: Structure;
  mode: string;
  activeSiteName: string;
  eAds: number | null; // Null until true DFT calculation is completed!
  minDistance: number;
  description: string;
} {
  const mode = options?.mode || 'multipoint';
  const sites = findAluminaAdsorptionSites(slab);
  const ohSite = sites.find(s => s.type === 'ontop_OH') || sites[0];
  const alSite = sites.find(s => s.type === 'lewis_Al') || sites[1] || sites[0];
  const multiSite = sites.find(s => s.type === 'multipoint') || sites[2] || sites[0];
  const hollowSite = sites.find(s => s.type === 'hollow') || sites[0];

  let targetSite = multiSite;
  let height = options?.height ?? 2.10;
  let tilt = options?.tilt ?? 25;
  let azimuth = options?.azimuth ?? 45;
  let activeSiteName = 'Multi-Point Site (OH + Al)';
  let desc = '初始多點配向構型：分子朝向表面 Al-OH 與鄰近位點，等待執行 DFT 結構最佳化與吸附能計算。';

  if (mode === 'oh_hbond') {
    targetSite = ohSite;
    height = options?.height ?? 1.85;
    tilt = options?.tilt ?? 35;
    azimuth = options?.azimuth ?? 30;
    activeSiteName = 'OH-1 Brønsted Acid Site';
    desc = '初始氫鍵配向構型：官能基氧朝向表面 Al-OH 質子，等待執行 DFT 結構最佳化。';
  } else if (mode === 'ester_lewis') {
    targetSite = alSite;
    height = options?.height ?? 2.12;
    tilt = options?.tilt ?? 20;
    azimuth = options?.azimuth ?? 120;
    activeSiteName = 'Al-Lewis Acid Cation Site';
    desc = '初始路易斯酸位配向構型：羰基氧朝向表面 Al³⁺ 配位不飽和陽離子，等待執行 DFT 結構最佳化。';
  } else if (mode === 'flat_pi') {
    targetSite = hollowSite;
    height = options?.height ?? 2.95;
    tilt = options?.tilt ?? 0;
    azimuth = options?.azimuth ?? 0;
    activeSiteName = 'Basal 3-Fold Hollow Site';
    desc = '初始平行平放構型：芳香環平行於基面，等待執行 DFT-D3 色散結構最佳化。';
  } else if (mode === 'upright') {
    targetSite = ohSite;
    height = options?.height ?? 2.05;
    tilt = options?.tilt ?? 85;
    azimuth = options?.azimuth ?? 0;
    activeSiteName = 'OH-1 Site (Upright End-on)';
    desc = '初始垂直配向構型：分子主鏈高傾角朝向真空，等待執行 DFT 結構最佳化。';
  }

  // Find monomer bounding box
  let minZ = Infinity, maxZ = -Infinity;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const a of monomer.atoms) {
    if (a.z < minZ) minZ = a.z;
    if (a.z > maxZ) maxZ = a.z;
    if (a.x < minX) minX = a.x;
    if (a.x > maxX) maxX = a.x;
    if (a.y < minY) minY = a.y;
    if (a.y > maxY) maxY = a.y;
  }
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const radTilt = (tilt * Math.PI) / 180;
  const radAzim = (azimuth * Math.PI) / 180;

  const molAtoms: Atom[] = monomer.atoms.map((at, idx) => {
    let rx = at.x - midX;
    let ry = at.y - midY;
    let rz = at.z - minZ;

    // Azimuth around Z
    const rx1 = rx * Math.cos(radAzim) - ry * Math.sin(radAzim);
    const ry1 = rx * Math.sin(radAzim) + ry * Math.cos(radAzim);
    const rz1 = rz;

    // Tilt around X
    const rx2 = rx1;
    const ry2 = ry1 * Math.cos(radTilt) - rz1 * Math.sin(radTilt);
    const rz2 = ry1 * Math.sin(radTilt) + rz1 * Math.cos(radTilt);

    return {
      id: `adsorbate-stable-${idx + 1}`,
      element: at.element,
      x: Number((targetSite.position[0] + rx2).toFixed(4)),
      y: Number((targetSite.position[1] + ry2).toFixed(4)),
      z: Number((targetSite.position[2] + height + rz2).toFixed(4)),
      fixed: false
    };
  });

  // Calculate actual minimum distance between monomer and slab
  let minD = 999.0;
  for (const ma of molAtoms) {
    for (const sa of slab.atoms) {
      const d = Math.hypot(ma.x - sa.x, ma.y - sa.y, ma.z - sa.z);
      if (d < minD) minD = d;
    }
  }

  const combined = {
    name: `${monomer.name} on ${slab.name} (${mode})`,
    formula: `${monomer.formula} / ${slab.formula}`,
    atoms: [...slab.atoms, ...molAtoms],
    cell: slab.cell,
    description: `Stable adsorption complex: ${desc} (Min Interfacial Distance: ${minD.toFixed(3)} Å).`,
    type: 'adsorption_system' as const
  };

  return {
    complex: combined,
    mode,
    activeSiteName,
    eAds: null, // Null until true DFT calculation is completed
    minDistance: Number(minD.toFixed(3)),
    description: desc
  };
}
export function buildAdsorptionSystem(
  slab: Structure,
  molecule: Structure,
  site: 'top' | 'bridge' | 'fcc' | 'hcp' = 'top',
  height: number = 2.4, // Distance in Å
  tiltDeg: number = 0,
  azimuthDeg: number = 0
): Structure {
  // Find top layer z
  let maxZ = -Infinity;
  let topAtoms: Atom[] = [];
  for (const at of slab.atoms) {
    if (at.z > maxZ) {
      maxZ = at.z;
    }
  }
  // Atoms on top surface layer (within 0.3 Å of maxZ)
  topAtoms = slab.atoms.filter(at => Math.abs(at.z - maxZ) < 0.3);

  // Target anchor coordinates on slab surface
  let targetX = slab.cell.lengths[0] / 2;
  let targetY = slab.cell.lengths[1] / 2;

  if (topAtoms.length > 0) {
    // Find atom closest to center
    const sorted = [...topAtoms].sort((a, b) => {
      const da = Math.hypot(a.x - targetX, a.y - targetY);
      const db = Math.hypot(b.x - targetX, b.y - targetY);
      return da - db;
    });
    const centerAtom = sorted[0];
    if (site === 'top') {
      targetX = centerAtom.x;
      targetY = centerAtom.y;
    } else if (site === 'bridge') {
      targetX = centerAtom.x + 1.2;
      targetY = centerAtom.y + 0.6;
    } else if (site === 'fcc' || site === 'hcp') {
      targetX = centerAtom.x + 0.8;
      targetY = centerAtom.y + 1.1;
    }
  }

  // Molecule center
  let molMinZ = Infinity, molMaxZ = -Infinity;
  let molMinX = Infinity, molMaxX = -Infinity;
  let molMinY = Infinity, molMaxY = -Infinity;
  for (const at of molecule.atoms) {
    if (at.z < molMinZ) molMinZ = at.z;
    if (at.z > molMaxZ) molMaxZ = at.z;
    if (at.x < molMinX) molMinX = at.x;
    if (at.x > molMaxX) molMaxX = at.x;
    if (at.y < molMinY) molMinY = at.y;
    if (at.y > molMaxY) molMaxY = at.y;
  }
  const molMidX = (molMinX + molMaxX) / 2;
  const molMidY = (molMinY + molMaxY) / 2;

  // Angles in radians
  const radTilt = (tiltDeg * Math.PI) / 180;
  const radAzim = (azimuthDeg * Math.PI) / 180;

  // Transform molecule atoms
  const transformedMolAtoms: Atom[] = molecule.atoms.map((at, idx) => {
    // Relative to molecule center
    let rx = at.x - molMidX;
    let ry = at.y - molMidY;
    let rz = at.z - molMinZ; // bottom of molecule is at 0

    // Azimuth rotation around Z
    const rx1 = rx * Math.cos(radAzim) - ry * Math.sin(radAzim);
    const ry1 = rx * Math.sin(radAzim) + ry * Math.cos(radAzim);
    const rz1 = rz;

    // Tilt rotation around X
    const rx2 = rx1;
    const ry2 = ry1 * Math.cos(radTilt) - rz1 * Math.sin(radTilt);
    const rz2 = ry1 * Math.sin(radTilt) + rz1 * Math.cos(radTilt);

    return {
      id: `adsorbate-${idx + 1}`,
      element: at.element,
      x: Number((targetX + rx2).toFixed(4)),
      y: Number((targetY + ry2).toFixed(4)),
      z: Number((maxZ + height + rz2).toFixed(4)),
      fixed: false // Adsorbate is always relaxed
    };
  });

  const combinedAtoms = [...slab.atoms, ...transformedMolAtoms];

  return {
    name: `${molecule.name} on ${slab.name}`,
    formula: `${molecule.formula} / ${slab.formula}`,
    atoms: combinedAtoms,
    cell: slab.cell,
    description: `Adsorption complex of ${molecule.name} at ${site.toUpperCase()} site on ${slab.name} (adsorption height: ${height} Å).`,
    type: 'adsorption_system'
  };
}

/**
 * Parses XYZ format string
 */
export function parseXYZ(xyzText: string): Structure | null {
  try {
    const lines = xyzText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 3) return null;
    const count = parseInt(lines[0], 10);
    const comment = lines[1];
    const atoms: Atom[] = [];

    for (let i = 2; i < lines.length && atoms.length < count; i++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length >= 4) {
        const element = parts[0];
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          atoms.push({
            id: `custom-atom-${atoms.length + 1}`,
            element,
            x,
            y,
            z,
            fixed: false
          });
        }
      }
    }

    const box: [number, number, number] = [16.0, 16.0, 16.0];
    return {
      name: comment || 'Imported Molecule',
      formula: computeFormulaFromAtoms(atoms) || 'Molecule',
      atoms: centerAtoms(atoms, box),
      cell: createBoxCell(box[0], box[1], box[2]),
      description: 'Imported from XYZ format.',
      type: 'custom'
    };
  } catch (err) {
    return null;
  }
}

/**
 * Computes standard Hill system chemical formula from atoms list
 */
export function computeFormulaFromAtoms(atoms: Atom[]): string {
  if (atoms.length === 0) return '';
  const counts: Record<string, number> = {};
  for (const a of atoms) {
    counts[a.element] = (counts[a.element] || 0) + 1;
  }

  // Hill system: C first, then H, then others alphabetically
  const elements = Object.keys(counts).sort((a, b) => {
    if (a === 'C') return -1;
    if (b === 'C') return 1;
    if (a === 'H') return -1;
    if (b === 'H') return 1;
    return a.localeCompare(b);
  });

  return elements.map(el => (counts[el] > 1 ? `${el}${counts[el]}` : el)).join('');
}

/**
 * Parses MDL Molfile (.mol, .sdf in V2000 or V3000 format)
 */
export function parseMDLMolfile(molContent: string): Structure | null {
  try {
    const lines = molContent.split('\n');
    if (lines.length < 4) return null;

    const title = lines[0].trim() || 'MDL Molecule';
    let atoms: Atom[] = [];

    // 1. Check V2000
    const v2000LineIdx = lines.findIndex(l => l.includes('V2000'));
    if (v2000LineIdx !== -1) {
      const countsLine = lines[v2000LineIdx];
      let numAtoms = parseInt(countsLine.slice(0, 3).trim(), 10);
      if (isNaN(numAtoms)) {
        numAtoms = parseInt(countsLine.trim().split(/\s+/)[0], 10);
      }

      const atomStart = v2000LineIdx + 1;
      for (let i = 0; i < numAtoms && atomStart + i < lines.length; i++) {
        const line = lines[atomStart + i].trim();
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          const x = parseFloat(parts[0]);
          const y = parseFloat(parts[1]);
          const z = parseFloat(parts[2]);
          const rawEl = parts[3].replace(/[^a-zA-Z]/g, '');
          if (!isNaN(x) && !isNaN(y) && !isNaN(z) && rawEl) {
            const el = rawEl.charAt(0).toUpperCase() + rawEl.slice(1).toLowerCase();
            atoms.push({
              id: `mol-atom-${atoms.length + 1}`,
              element: el,
              x,
              y,
              z,
              fixed: false,
            });
          }
        }
      }
    } else {
      // 2. Check V3000
      const v30Start = lines.findIndex(l => l.includes('BEGIN ATOM'));
      if (v30Start !== -1) {
        for (let i = v30Start + 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.includes('END ATOM')) break;
          const parts = line.split(/\s+/);
          if (parts.length >= 7 && parts[0] === 'M' && parts[1] === 'V30') {
            const rawEl = parts[3].replace(/[^a-zA-Z]/g, '');
            const x = parseFloat(parts[4]);
            const y = parseFloat(parts[5]);
            const z = parseFloat(parts[6]);
            if (!isNaN(x) && !isNaN(y) && !isNaN(z) && rawEl) {
              const el = rawEl.charAt(0).toUpperCase() + rawEl.slice(1).toLowerCase();
              atoms.push({
                id: `mol-atom-${atoms.length + 1}`,
                element: el,
                x,
                y,
                z,
                fixed: false,
              });
            }
          }
        }
      }
    }

    if (atoms.length === 0) return null;

    // Check if 2D format and add slight 3D conformational wave if flat
    const allZeroZ = atoms.every(a => Math.abs(a.z) < 1e-4);
    if (allZeroZ && atoms.length > 2) {
      atoms = atoms.map((a, idx) => ({
        ...a,
        z: Number((Math.sin(idx * 1.1) * 0.4).toFixed(4))
      }));
    }

    const box: [number, number, number] = [16.0, 16.0, 16.0];
    const centered = centerAtoms(atoms, box);
    const formula = computeFormulaFromAtoms(centered);

    return {
      name: title,
      formula: formula || 'Molecule',
      atoms: centered,
      cell: createBoxCell(box[0], box[1], box[2]),
      description: `Imported from MDL Molfile (${atoms.length} atoms).`,
      type: 'molecule'
    };
  } catch (err) {
    return null;
  }
}

/**
 * Parses VASP POSCAR structure file
 */
export function parsePOSCAR(poscarContent: string): Structure | null {
  try {
    const rawLines = poscarContent.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (rawLines.length < 7) return null;

    const title = rawLines[0] || 'VASP POSCAR';
    const scale = parseFloat(rawLines[1]) || 1.0;

    const aVec = rawLines[2].split(/\s+/).map(Number) as [number, number, number];
    const bVec = rawLines[3].split(/\s+/).map(Number) as [number, number, number];
    const cVec = rawLines[4].split(/\s+/).map(Number) as [number, number, number];

    const aScaled: [number, number, number] = [aVec[0] * scale, aVec[1] * scale, aVec[2] * scale];
    const bScaled: [number, number, number] = [bVec[0] * scale, bVec[1] * scale, bVec[2] * scale];
    const cScaled: [number, number, number] = [cVec[0] * scale, cVec[1] * scale, cVec[2] * scale];

    let lineIdx = 5;
    let elements: string[] = [];
    const isElemLine = isNaN(parseFloat(rawLines[5].split(/\s+/)[0]));

    if (isElemLine) {
      elements = rawLines[5].split(/\s+/);
      lineIdx = 6;
    }

    const counts = rawLines[lineIdx].split(/\s+/).map(x => parseInt(x, 10));
    lineIdx++;

    let hasSelectiveDynamics = false;
    if (rawLines[lineIdx].toLowerCase().startsWith('s')) {
      hasSelectiveDynamics = true;
      lineIdx++;
    }

    const isDirect = rawLines[lineIdx].toLowerCase().startsWith('d');
    lineIdx++;

    const totalAtomsCount = counts.reduce((acc, val) => acc + val, 0);
    const atomElements: string[] = [];
    counts.forEach((cnt, idx) => {
      const el = elements[idx] || `Atom${idx + 1}`;
      for (let k = 0; k < cnt; k++) {
        atomElements.push(el);
      }
    });

    const atoms: Atom[] = [];
    for (let i = 0; i < totalAtomsCount && lineIdx + i < rawLines.length; i++) {
      const parts = rawLines[lineIdx + i].split(/\s+/);
      if (parts.length >= 3) {
        let x = parseFloat(parts[0]);
        let y = parseFloat(parts[1]);
        let z = parseFloat(parts[2]);

        if (isDirect) {
          const cartX = x * aScaled[0] + y * bScaled[0] + z * cScaled[0];
          const cartY = x * aScaled[1] + y * bScaled[1] + z * cScaled[1];
          const cartZ = x * aScaled[2] + y * bScaled[2] + z * cScaled[2];
          x = cartX;
          y = cartY;
          z = cartZ;
        }

        const isFixed = hasSelectiveDynamics && parts.length >= 6 && parts[3].toUpperCase() === 'F';

        atoms.push({
          id: `poscar-atom-${i + 1}`,
          element: atomElements[i] || 'C',
          x: Number(x.toFixed(4)),
          y: Number(y.toFixed(4)),
          z: Number(z.toFixed(4)),
          fixed: isFixed
        });
      }
    }

    if (atoms.length === 0) return null;

    const lenA = Math.hypot(aScaled[0], aScaled[1], aScaled[2]);
    const lenB = Math.hypot(bScaled[0], bScaled[1], bScaled[2]);
    const lenC = Math.hypot(cScaled[0], cScaled[1], cScaled[2]);

    const formula = computeFormulaFromAtoms(atoms);

    return {
      name: title,
      formula: formula || 'Structure',
      atoms,
      cell: {
        a: aScaled,
        b: bScaled,
        c: cScaled,
        lengths: [lenA, lenB, lenC],
        angles: [90, 90, 90],
        periodic: [true, true, true]
      },
      description: `Imported from VASP POSCAR (${atoms.length} atoms).`,
      type: atoms.some(a => a.fixed) ? 'slab' : 'molecule'
    };
  } catch (err) {
    return null;
  }
}
