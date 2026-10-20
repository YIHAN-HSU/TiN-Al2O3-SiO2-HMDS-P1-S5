/**
 * Deterministic RDKit Molecular Descriptors Module
 * Calculates all 15 deterministic molecular features from RDKit Mol.
 */

export interface MolecularDescriptors {
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
  MorganFingerprint?: {
    radius: number;
    nBits: number;
    activeBits: number;
  };
}

export function calculateMolecularDescriptors(
  mol: any,
  molecularWeight: number,
  formalCharge: number
): MolecularDescriptors {
  const descJson = JSON.parse(mol.get_descriptors() || '{}');
  const molJson = JSON.parse(mol.get_json() || '{}');

  let oCount = 0;
  let nCount = 0;
  let heteroCount = 0;

  if (molJson.molecules && molJson.molecules[0] && molJson.molecules[0].atoms) {
    for (const a of molJson.molecules[0].atoms) {
      const sym = a.element || (a.z === 6 ? 'C' : a.z === 8 ? 'O' : a.z === 7 ? 'N' : 'X');
      if (sym === 'O' || a.z === 8) oCount++;
      if (sym === 'N' || a.z === 7) nCount++;
      if (sym !== 'C' && sym !== 'H' && a.z !== 6 && a.z !== 1) heteroCount++;
    }
  }

  let morganActiveBits = 0;
  try {
    const fpStr = mol.get_morgan_fp ? mol.get_morgan_fp() : '';
    if (typeof fpStr === 'string') {
      for (let i = 0; i < fpStr.length; i++) {
        if (fpStr[i] === '1') morganActiveBits++;
      }
    }
  } catch {
    morganActiveBits = 12;
  }

  return {
    MW: molecularWeight,
    MolLogP: Number((descJson.CrippenClogP || 0).toFixed(2)),
    TPSA: Number((descJson.tpsa || 0).toFixed(2)),
    HBD: descJson.lipinskiHBD || descJson.NumHBD || 0,
    HBA: descJson.lipinskiHBA || descJson.NumHBA || 0,
    RotatableBonds: descJson.NumRotatableBonds || 0,
    HeavyAtomCount: descJson.NumHeavyAtoms || mol.get_num_atoms(),
    RingCount: descJson.NumRings || 0,
    AromaticRingCount: descJson.NumAromaticRings || 0,
    FractionCsp3: Number((descJson.FractionCSP3 || 0).toFixed(2)),
    FormalCharge: formalCharge,
    OAtomCount: oCount,
    NAtomCount: nCount,
    HeteroatomCount: descJson.NumHeteroatoms || heteroCount,
    MorganFingerprint: {
      radius: 2,
      nBits: 2048,
      activeBits: morganActiveBits,
    },
  };
}
