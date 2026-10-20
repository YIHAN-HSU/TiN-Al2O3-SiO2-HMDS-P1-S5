/**
 * RDKit Molecular Identity Module
 * Extracts canonical identity, stereochemical status, and identifiers from RDKit Mol.
 */

export interface MolecularIdentity {
  canonical_smiles: string;
  isomeric_smiles: string;
  inchi: string;
  inchikey: string;
  formula: string;
  molecular_weight: number;
  formal_charge: number;
  stereo_status: 'SPECIFIED_PRESERVED' | 'ASSIGNED_DURING_3D' | 'ACHIRAL_UNSPECIFIED';
}

export function extractMolecularIdentity(
  mol: any,
  rawSourceString: string,
  RDKit: any
): MolecularIdentity {
  const canonical_smiles = mol.get_smiles();
  const isomeric_smiles = mol.get_cxsmiles() || canonical_smiles;
  const inchi = mol.get_inchi();
  const inchikey = RDKit.get_inchikey_for_inchi(inchi);

  const descJson = JSON.parse(mol.get_descriptors() || '{}');
  const molecular_weight = Number((descJson.amw || descJson.exactmw || 0).toFixed(2));

  const molJson = JSON.parse(mol.get_json() || '{}');
  let formal_charge = 0;
  if (molJson.molecules && molJson.molecules[0] && molJson.molecules[0].atoms) {
    for (const a of molJson.molecules[0].atoms) {
      if (typeof a.charge === 'number') formal_charge += a.charge;
    }
  }

  let formula = '';
  const formulaMatch = inchi.match(/InChI=1S\/([A-Za-z0-9]+)/);
  if (formulaMatch && formulaMatch[1]) {
    formula = formulaMatch[1];
  } else {
    const atomCounts: Record<string, number> = {};
    if (molJson.molecules && molJson.molecules[0] && molJson.molecules[0].atoms) {
      for (const a of molJson.molecules[0].atoms) {
        const sym = a.element || (a.z === 6 ? 'C' : a.z === 8 ? 'O' : a.z === 7 ? 'N' : 'X');
        atomCounts[sym] = (atomCounts[sym] || 0) + 1;
      }
    }
    formula = Object.entries(atomCounts).map(([k, v]) => `${k}${v > 1 ? v : ''}`).join('');
  }

  const hasSpecifiedStereo =
    canonical_smiles.includes('@') ||
    canonical_smiles.includes('/') ||
    canonical_smiles.includes('\\') ||
    rawSourceString.includes('/b') ||
    rawSourceString.includes('/t');

  const stereo_status = hasSpecifiedStereo
    ? 'SPECIFIED_PRESERVED'
    : (descJson.NumAtomStereoCenters > 0 ? 'ASSIGNED_DURING_3D' : 'ACHIRAL_UNSPECIFIED');

  return {
    canonical_smiles,
    isomeric_smiles,
    inchi,
    inchikey,
    formula,
    molecular_weight,
    formal_charge,
    stereo_status,
  };
}
