/**
 * Immutable Molecular Feature Package
 *
 * Section 02 Contract:
 * Both TiN and Al2O3 models MUST receive and consume the exact same
 * Immutable Molecular Feature Package derived from a single verified RDKit Mol.
 */

import { MolecularIdentity } from './molecularIdentity';
import { MolecularDescriptors } from './molecularDescriptors';
import { FunctionalGroupDetectionMap } from './functionalGroupDetection';
import { Conformer3DData, IdentityGateResult } from './conformerGeneration';

export interface ImmutableMolecularFeaturePackage {
  material_id?: number;
  canonical_smiles: string;
  isomeric_smiles: string;
  inchi: string;
  inchikey: string;
  formula: string;
  molecular_weight: number;
  formal_charge: number;
  stereo_status: string;

  descriptor_schema_version: '1.0.0';
  descriptors: MolecularDescriptors;
  functional_groups: FunctionalGroupDetectionMap;

  identity_gate?: IdentityGateResult;
  conformer_3d?: Conformer3DData;
  svg_depiction?: string;
  created_at: string;
}

export function createFeaturePackage(
  identity: MolecularIdentity,
  descriptors: MolecularDescriptors,
  functionalGroups: FunctionalGroupDetectionMap,
  conformer3D?: Conformer3DData,
  identityGate?: IdentityGateResult,
  svgDepiction?: string,
  materialId?: number
): ImmutableMolecularFeaturePackage {
  return Object.freeze({
    material_id: materialId,
    canonical_smiles: identity.canonical_smiles,
    isomeric_smiles: identity.isomeric_smiles,
    inchi: identity.inchi,
    inchikey: identity.inchikey,
    formula: identity.formula,
    molecular_weight: identity.molecular_weight,
    formal_charge: identity.formal_charge,
    stereo_status: identity.stereo_status,

    descriptor_schema_version: '1.0.0',
    descriptors: Object.freeze({ ...descriptors }),
    functional_groups: Object.freeze({ ...functionalGroups }),

    identity_gate: identityGate,
    conformer_3d: conformer3D,
    svg_depiction: svgDepiction,
    created_at: new Date().toISOString(),
  });
}
