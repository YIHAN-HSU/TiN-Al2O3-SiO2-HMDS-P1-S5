import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Structure, Atom } from '../types/dft';
import { getElementInfo } from '../utils/molecules';
import { Camera, Eye, Maximize2, RotateCcw, Ruler, Sparkles, Box, Info } from 'lucide-react';

interface MolecularViewer3DProps {
  structure: Structure;
  onAtomSelect?: (atom: Atom | null) => void;
  selectedAtom?: Atom | null;
}

export const MolecularViewer3D: React.FC<MolecularViewer3DProps> = ({
  structure,
  onAtomSelect,
  selectedAtom: externalSelectedAtom,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // View settings
  const [showBonds, setShowBonds] = useState(true);
  const [showUnitCell, setShowUnitCell] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [showFixedAtoms, setShowFixedAtoms] = useState(true);
  const [representation, setRepresentation] = useState<'ball_and_stick' | 'space_filling'>('ball_and_stick');
  
  // Measurement state
  const [measurementMode, setMeasurementMode] = useState(false);
  const [pickedAtoms, setPickedAtoms] = useState<Atom[]>([]);
  const [measurementResult, setMeasurementResult] = useState<string | null>(null);

  // Internal atom hover/selection
  const [hoveredAtom, setHoveredAtom] = useState<Atom | null>(null);
  const [selectedAtom, setSelectedAtom] = useState<Atom | null>(null);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const atomsGroupRef = useRef<THREE.Group | null>(null);
  const bondsGroupRef = useRef<THREE.Group | null>(null);
  const cellGroupRef = useRef<THREE.Group | null>(null);
  const measureGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Camera Orbit control state
  const isDragging = useRef(false);
  const isPanning = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const cameraTarget = useRef(new THREE.Vector3(0, 0, 0));
  const cameraRadius = useRef(25);
  const cameraTheta = useRef(Math.PI / 4);
  const cameraPhi = useRef(Math.PI / 3);
  const fitRadiusRef = useRef(6);
  const lastFitDistanceRef = useRef(25);

  // Sync external selected atom
  useEffect(() => {
    if (externalSelectedAtom !== undefined) {
      setSelectedAtom(externalSelectedAtom);
    }
  }, [externalSelectedAtom]);

  // Center of the structure
  const structureCenter = useMemo(() => {
    if (structure.atoms.length === 0) return new THREE.Vector3(0, 0, 0);
    let sx = 0, sy = 0, sz = 0;
    structure.atoms.forEach(a => {
      sx += a.x;
      sy += a.y;
      sz += a.z;
    });
    return new THREE.Vector3(
      sx / structure.atoms.length,
      sy / structure.atoms.length,
      sz / structure.atoms.length
    );
  }, [structure]);

  // Presentation bounds include rendered atom radii; molecular coordinates stay
  // untouched. Refs keep resize callbacks current when a new material is loaded.
  fitRadiusRef.current = Math.max(6, ...structure.atoms.map(atom =>
    structureCenter.distanceTo(new THREE.Vector3(atom.x, atom.y, atom.z)) +
    (representation === 'space_filling' ? getElementInfo(atom.element).radius * 1.5 : Math.max(getElementInfo(atom.element).radius * .55, .28))
  ));

  const fittedRadius = (aspect: number) => {
    const camera = cameraRef.current, container = containerRef.current;
    if (!camera || !container) return Math.max(fitRadiusRef.current * 2.8, 14);
    const w = container.clientWidth, h = container.clientHeight;
    if (w > 800) {
      camera.clearViewOffset();
      return Math.max(fitRadiusRef.current * 2.8, 14);
    }
    const root = container.getBoundingClientRect();
    const labels = container.querySelector('.viewer-labels')?.getBoundingClientRect();
    const actions = container.querySelector('.viewer-actions')?.getBoundingClientRect();
    const bottom = container.querySelector('.viewer-bottom')?.getBoundingClientRect();
    const topInset = Math.max(labels?.bottom || root.top, actions?.bottom || root.top) - root.top + 16;
    const bottomInset = bottom ? root.bottom - bottom.top + 16 : 16;
    const availableHeight = Math.max(64, h - topInset - bottomInset);
    const verticalHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfAngle = Math.atan(Math.tan(verticalHalf) * Math.min(aspect * Math.max(0.1, (w - 32) / w), availableHeight / h));
    // Shift the optical center into the free region between the existing HUDs.
    camera.setViewOffset(w, h, 0, (bottomInset - topInset) / 2, w, h);
    return Math.max(fitRadiusRef.current / Math.sin(halfAngle) * 1.08, 14);
  };

  // 3D extents (bounding box spread)
  const extents = useMemo(() => {
    if (structure.atoms.length === 0) return { dx: 0, dy: 0, dz: 0 };
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const a of structure.atoms) {
      if (a.x < minX) minX = a.x;
      if (a.x > maxX) maxX = a.x;
      if (a.y < minY) minY = a.y;
      if (a.y > maxY) maxY = a.y;
      if (a.z < minZ) minZ = a.z;
      if (a.z > maxZ) maxZ = a.z;
    }
    return {
      dx: Math.max(0, maxX - minX),
      dy: Math.max(0, maxY - minY),
      dz: Math.max(0, maxZ - minZ)
    };
  }, [structure]);

  // Calculate bonds
  const bonds = useMemo(() => {
    if (!showBonds) return [];
    const detected: Array<{ atom1: Atom; atom2: Atom; distance: number }> = [];
    const n = structure.atoms.length;

    for (let i = 0; i < n; i++) {
      const a1 = structure.atoms[i];
      const r1 = getElementInfo(a1.element).radius;
      for (let j = i + 1; j < n; j++) {
        const a2 = structure.atoms[j];
        const r2 = getElementInfo(a2.element).radius;

        const dx = a1.x - a2.x;
        const dy = a1.y - a2.y;
        const dz = a1.z - a2.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Standard covalent bond threshold
        const maxDist = (r1 + r2) * 1.25;
        const minDist = 0.4;

        if (dist >= minDist && dist <= maxDist) {
          detected.push({ atom1: a1, atom2: a2, distance: dist });
        }
      }
    }
    return detected;
  }, [structure, showBonds]);

  // Setup Three.js Scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0f1d); // Deep space slate

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(20, 30, 40);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x60a5fa, 0.6); // subtle cyan rim
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    // Groups
    const atomsGroup = new THREE.Group();
    const bondsGroup = new THREE.Group();
    const cellGroup = new THREE.Group();
    const measureGroup = new THREE.Group();

    scene.add(atomsGroup);
    scene.add(bondsGroup);
    scene.add(cellGroup);
    scene.add(measureGroup);

    atomsGroupRef.current = atomsGroup;
    bondsGroupRef.current = bondsGroup;
    cellGroupRef.current = cellGroup;
    measureGroupRef.current = measureGroup;

    updateCamera();

    // Render loop
    const render = () => {
      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(render);
    };
    render();

    // Resize observer
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (!w || !h) return;
      const zoomRatio = cameraRadius.current / lastFitDistanceRef.current;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      lastFitDistanceRef.current = fittedRadius(w / h);
      cameraRadius.current = lastFitDistanceRef.current * zoomRatio;
      updateCamera();
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    for (const hud of container.querySelectorAll('.viewer-labels,.viewer-actions,.viewer-bottom')) resizeObserver.observe(hud);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Update target and initial camera view when structure changes
  useEffect(() => {
    cameraTarget.current.copy(structureCenter);
    cameraRadius.current = fittedRadius(cameraRef.current?.aspect || 1);
    lastFitDistanceRef.current = cameraRadius.current;
    updateCamera();
  }, [structure, structureCenter]);

  const updateCamera = () => {
    if (!cameraRef.current) return;
    const x = cameraTarget.current.x + cameraRadius.current * Math.sin(cameraPhi.current) * Math.cos(cameraTheta.current);
    const y = cameraTarget.current.y + cameraRadius.current * Math.sin(cameraPhi.current) * Math.sin(cameraTheta.current);
    const z = cameraTarget.current.z + cameraRadius.current * Math.cos(cameraPhi.current);
    cameraRef.current.position.set(x, y, z);

    // Prevent gimbal lock at poles by selecting appropriate up vector
    const lookDirZ = Math.cos(cameraPhi.current);
    if (Math.abs(lookDirZ) > 0.98) {
      cameraRef.current.up.set(0, 1, 0);
    } else {
      cameraRef.current.up.set(0, 0, 1);
    }

    cameraRef.current.lookAt(cameraTarget.current);
  };

  // Re-build 3D Meshes (Atoms, Bonds, Unit Cell)
  useEffect(() => {
    if (!atomsGroupRef.current || !bondsGroupRef.current || !cellGroupRef.current) return;

    // 1. Clear previous
    while (atomsGroupRef.current.children.length > 0) {
      const obj = atomsGroupRef.current.children[0];
      atomsGroupRef.current.remove(obj);
    }
    while (bondsGroupRef.current.children.length > 0) {
      const obj = bondsGroupRef.current.children[0];
      bondsGroupRef.current.remove(obj);
    }
    while (cellGroupRef.current.children.length > 0) {
      const obj = cellGroupRef.current.children[0];
      cellGroupRef.current.remove(obj);
    }

    // 2. Render Atoms
    const sphereGeo = new THREE.SphereGeometry(1, 32, 24);

    structure.atoms.forEach((atom) => {
      const info = getElementInfo(atom.element);
      const isSelected = selectedAtom?.id === atom.id;
      const isHovered = hoveredAtom?.id === atom.id;
      const isPickedForMeasure = pickedAtoms.some(a => a.id === atom.id);

      // Scale based on mode
      const baseRadius = representation === 'space_filling' ? info.radius * 1.5 : Math.max(info.radius * 0.55, 0.28);

      let atomColor = new THREE.Color(info.color);
      if (showFixedAtoms && atom.fixed) {
        atomColor = atomColor.clone().lerp(new THREE.Color('#f97316'), 0.35); // tint fixed atoms with warning amber
      }

      const mat = new THREE.MeshStandardMaterial({
        color: atomColor,
        roughness: 0.25,
        metalness: ['Pt', 'Cu', 'Au', 'Ti', 'Fe', 'Ni'].includes(atom.element) ? 0.6 : 0.1,
        emissive: isSelected ? new THREE.Color('#38bdf8') : (isPickedForMeasure ? new THREE.Color('#fbbf24') : (isHovered ? new THREE.Color('#64748b') : new THREE.Color('#000000'))),
        emissiveIntensity: isSelected ? 0.6 : (isPickedForMeasure ? 0.5 : (isHovered ? 0.3 : 0)),
      });

      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.scale.setScalar(baseRadius);
      mesh.position.set(atom.x, atom.y, atom.z);
      mesh.userData = { atom };

      // Selection halo if selected
      if (isSelected || isPickedForMeasure) {
        const ringGeo = new THREE.RingGeometry(baseRadius * 1.25, baseRadius * 1.45, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: isSelected ? 0x38bdf8 : 0xfbbf24,
          side: THREE.DoubleSide
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.lookAt(cameraRef.current?.position || new THREE.Vector3(0, 0, 10));
        mesh.add(ringMesh);
      }

      atomsGroupRef.current?.add(mesh);
    });

    // 3. Render Bonds
    if (showBonds && representation === 'ball_and_stick') {
      const cylGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 16);

      bonds.forEach(({ atom1, atom2, distance }) => {
        const p1 = new THREE.Vector3(atom1.x, atom1.y, atom1.z);
        const p2 = new THREE.Vector3(atom2.x, atom2.y, atom2.z);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

        const mat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.3,
          metalness: 0.1,
        });

        const cylinder = new THREE.Mesh(cylGeo, mat);
        cylinder.position.copy(mid);
        cylinder.scale.set(1, distance, 1);
        cylinder.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3().subVectors(p2, p1).normalize()
        );
        bondsGroupRef.current?.add(cylinder);
      });
    }

    // 4. Render Unit Cell Box
    if (showUnitCell && structure.cell) {
      const { a, b, c } = structure.cell;
      const vA = new THREE.Vector3(...a);
      const vB = new THREE.Vector3(...b);
      const vC = new THREE.Vector3(...c);
      const origin = new THREE.Vector3(0, 0, 0);

      const vertices = [
        origin, vA,
        origin, vB,
        origin, vC,
        vA, new THREE.Vector3().addVectors(vA, vB),
        vB, new THREE.Vector3().addVectors(vA, vB),
        vA, new THREE.Vector3().addVectors(vA, vC),
        vB, new THREE.Vector3().addVectors(vB, vC),
        vC, new THREE.Vector3().addVectors(vA, vC),
        vC, new THREE.Vector3().addVectors(vB, vC),
        new THREE.Vector3().addVectors(vA, vB), new THREE.Vector3().addVectors(vA, vB).add(vC),
        new THREE.Vector3().addVectors(vA, vC), new THREE.Vector3().addVectors(vA, vB).add(vC),
        new THREE.Vector3().addVectors(vB, vC), new THREE.Vector3().addVectors(vA, vB).add(vC),
      ];

      const lineGeo = new THREE.BufferGeometry().setFromPoints(vertices);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        linewidth: 1
      });
      const boxLines = new THREE.LineSegments(lineGeo, lineMat);
      cellGroupRef.current?.add(boxLines);

      // Coordinate axes at origin
      const axes = new THREE.AxesHelper(Math.min(structure.cell.lengths[0], 5));
      cellGroupRef.current?.add(axes);
    }
  }, [
    structure,
    bonds,
    showBonds,
    showUnitCell,
    showFixedAtoms,
    representation,
    selectedAtom,
    hoveredAtom,
    pickedAtoms
  ]);

  // Handle Measurement Lines
  useEffect(() => {
    if (!measureGroupRef.current) return;
    while (measureGroupRef.current.children.length > 0) {
      const obj = measureGroupRef.current.children[0];
      measureGroupRef.current.remove(obj);
    }

    if (pickedAtoms.length === 2) {
      const [a1, a2] = pickedAtoms;
      const p1 = new THREE.Vector3(a1.x, a1.y, a1.z);
      const p2 = new THREE.Vector3(a2.x, a2.y, a2.z);
      const dist = p1.distanceTo(p2);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0xf59e0b,
        dashSize: 0.2,
        gapSize: 0.1,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      measureGroupRef.current.add(line);
      setMeasurementResult(`Distance (${a1.element}${structure.atoms.indexOf(a1) + 1} - ${a2.element}${structure.atoms.indexOf(a2) + 1}): ${dist.toFixed(3)} Å`);
    } else if (pickedAtoms.length === 3) {
      const [a1, a2, a3] = pickedAtoms; // a2 is apex
      const v1 = new THREE.Vector3(a1.x - a2.x, a1.y - a2.y, a1.z - a2.z).normalize();
      const v2 = new THREE.Vector3(a3.x - a2.x, a3.y - a2.y, a3.z - a2.z).normalize();
      const angleRad = v1.angleTo(v2);
      const angleDeg = (angleRad * 180) / Math.PI;

      const p1 = new THREE.Vector3(a1.x, a1.y, a1.z);
      const p2 = new THREE.Vector3(a2.x, a2.y, a2.z);
      const p3 = new THREE.Vector3(a3.x, a3.y, a3.z);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2, p3]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x10b981 });
      const line = new THREE.Line(lineGeo, lineMat);
      measureGroupRef.current.add(line);
      setMeasurementResult(`Angle (${a1.element} - ${a2.element} - ${a3.element}): ${angleDeg.toFixed(2)}°`);
    } else if (pickedAtoms.length === 0) {
      setMeasurementResult(null);
    }
  }, [pickedAtoms, structure]);

  // Raycaster for atom picking & hover
  const getAtomUnderPointer = (clientX: number, clientY: number): Atom | null => {
    if (!canvasRef.current || !cameraRef.current || !atomsGroupRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(atomsGroupRef.current.children, false);
    if (intersects.length > 0) {
      return (intersects[0].object.userData.atom as Atom) || null;
    }
    return null;
  };

  // Mouse & Touch Controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // left click
      isDragging.current = true;
    } else if (e.button === 2) { // right click
      isPanning.current = true;
    }
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };

    if (isDragging.current) {
      cameraTheta.current -= deltaX * 0.008;
      cameraPhi.current = Math.max(0.05, Math.min(Math.PI - 0.05, cameraPhi.current - deltaY * 0.008));
      updateCamera();
    } else if (isPanning.current && cameraRef.current) {
      const panSpeed = cameraRadius.current * 0.0015;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      cameraRef.current.matrix.extractBasis(right, up, new THREE.Vector3());
      cameraTarget.current.addScaledVector(right, -deltaX * panSpeed);
      cameraTarget.current.addScaledVector(up, deltaY * panSpeed);
      updateCamera();
    } else {
      // Check hover
      const atom = getAtomUnderPointer(e.clientX, e.clientY);
      setHoveredAtom(atom);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDragging.current = false;
    isPanning.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    const atom = getAtomUnderPointer(e.clientX, e.clientY);
    if (atom) {
      if (measurementMode) {
        if (pickedAtoms.some(a => a.id === atom.id)) {
          // unpick
          setPickedAtoms(prev => prev.filter(a => a.id !== atom.id));
        } else {
          if (pickedAtoms.length >= 3) {
            setPickedAtoms([atom]);
          } else {
            setPickedAtoms(prev => [...prev, atom]);
          }
        }
      } else {
        setSelectedAtom(atom);
        onAtomSelect?.(atom);
      }
    } else if (!measurementMode) {
      setSelectedAtom(null);
      onAtomSelect?.(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.defaultPrevented) e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    cameraRadius.current = Math.max(3, Math.min(200, cameraRadius.current * zoomFactor));
    updateCamera();
  };

  // View Presets
  const setPresetView = (view: 'xy' | 'xz' | 'yz' | 'iso') => {
    cameraTarget.current.copy(structureCenter);
    if (view === 'xy') { // Top View: looking from +Z down onto XY plane
      cameraTheta.current = 0;
      cameraPhi.current = 0.001;
    } else if (view === 'xz') { // Side View: looking at XZ plane from -Y direction
      cameraTheta.current = -Math.PI / 2;
      cameraPhi.current = Math.PI / 2;
    } else if (view === 'yz') { // Front View: looking at YZ plane from +X direction
      cameraTheta.current = 0;
      cameraPhi.current = Math.PI / 2;
    } else { // Isometric (True 3D perspective with equal projection on X, Y, Z axes: phi = acos(1/sqrt(3)) ≈ 54.74°)
      cameraTheta.current = Math.PI / 4;
      cameraPhi.current = 0.9553;
    }
    updateCamera();
  };

  const resetView = () => {
    cameraTarget.current.copy(structureCenter);
    cameraTheta.current = Math.PI / 4;
    cameraPhi.current = 0.9553;
    cameraRadius.current = fittedRadius(cameraRef.current?.aspect || 1);
    lastFitDistanceRef.current = cameraRadius.current;
    updateCamera();
  };

  // Snapshot PNG export
  const takeSnapshot = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${structure.formula}_3D_structure.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div ref={containerRef} className="molecular-viewer relative w-full h-[520px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Top Left Title & Stats Badge */}
      <div className="viewer-labels absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none z-10 max-w-[85%] sm:max-w-md">
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg pointer-events-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0"></span>
          <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate max-w-[180px]">{structure.name}</span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 font-mono border border-cyan-800/40">
            {structure.formula}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {structure.atoms.length} 個原子
          </span>
        </div>

        {/* 3D Conformer & Force Field Energy Badge */}
        <div className="bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-md text-[11px] border border-slate-800 font-mono flex flex-wrap items-center gap-2 pointer-events-auto shadow-md">
          <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 text-[10px] font-bold">
            {structure.conformerEngine || 'RDKit ETKDGv3 3D'}
          </span>
          {structure.conformerEnergy !== undefined && structure.conformerEnergy !== null && (
            <span className="text-amber-300 font-semibold text-[11px]">
              構形能：{structure.conformerEnergy} {structure.energyUnit || 'kcal/mol'}
            </span>
          )}
          <span className="text-slate-400 text-[10px]">
            ΔX {extents.dx.toFixed(2)}Å · ΔY {extents.dy.toFixed(2)}Å · ΔZ {extents.dz.toFixed(2)}Å
          </span>
        </div>

        {/* Cell parameters */}
        <div className="bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] text-slate-400 border border-slate-800 font-mono flex items-center gap-2 pointer-events-auto">
          <span>顯示盒：</span>
          <span className="text-slate-300">{structure.cell.lengths[0].toFixed(1)} × {structure.cell.lengths[1].toFixed(1)} × {structure.cell.lengths[2].toFixed(1)} Å</span>
        </div>
      </div>

      {/* Top Right Actions Bar */}
      <div className="viewer-actions absolute top-3 right-3 flex items-center gap-1.5 z-10">
        {/* Measurement Tool Toggle */}
        <button
          onClick={() => {
            setMeasurementMode(!measurementMode);
            setPickedAtoms([]);
            setMeasurementResult(null);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all shadow-md ${
            measurementMode
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 ring-1 ring-amber-500/30'
              : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="量測原子間距離或鍵角"
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>{measurementMode ? '量測中…' : "量測"}</span>
        </button>

        {/* View Presets */}
        <div className="flex items-center bg-slate-900/80 backdrop-blur-md rounded-lg border border-slate-700/70 p-0.5">
          <button
            onClick={() => setPresetView('xy')}
            className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="俯視（XY）"
          >
            XY
          </button>
          <button
            onClick={() => setPresetView('xz')}
            className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="側視（XZ）"
          >
            XZ
          </button>
          <button
            onClick={() => setPresetView('yz')}
            className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="正視（YZ）"
          >
            YZ
          </button>
          <button
            onClick={() => setPresetView('iso')}
            className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="等角視圖（3D）"
          >
            ISO
          </button>
        </div>

        {/* Snapshot */}
        <button
          onClick={takeSnapshot}
          className="p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700/70 transition-colors shadow-md"
          title="儲存 3D 畫面 PNG"
        >
          <Camera className="w-4 h-4" />
        </button>

        {/* Reset Camera */}
        <button
          onClick={resetView}
          className="p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700/70 transition-colors shadow-md"
          title="重設視角"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Measurement Result Notification */}
      {measurementResult && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-amber-950/90 text-amber-200 border border-amber-500/50 backdrop-blur-md px-4 py-2 rounded-lg text-xs font-mono shadow-xl z-20 flex items-center gap-2">
          <Ruler className="w-4 h-4 text-amber-400" />
          <span>{measurementResult}</span>
          <button
            onClick={() => {
              setPickedAtoms([]);
              setMeasurementResult(null);
            }}
            className="ml-2 text-amber-400 hover:text-white underline text-[11px]"
          >
            清除
          </button>
        </div>
      )}

      {/* Bottom Floating Control Bar */}
      <div className="viewer-bottom absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        {/* Atom Inspector Box */}
        <div className="pointer-events-auto">
          {selectedAtom ? (
            <div className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-cyan-500/40 shadow-xl flex items-center gap-3 text-xs">
              <div
                className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                style={{ backgroundColor: getElementInfo(selectedAtom.element).color }}
              />
              <div>
                <span className="font-semibold text-white mr-1.5">
                  {({H:'氫',C:'碳',N:'氮',O:'氧',F:'氟',Si:'矽',Al:'鋁',Ti:'鈦'} as Record<string,string>)[selectedAtom.element]||selectedAtom.element} ({selectedAtom.element})
                </span>
                {selectedAtom.fixed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mr-1.5">
                    固定原子（F F F）
                  </span>
                )}
                <span className="font-mono text-slate-400 text-[11px]">
                  ({selectedAtom.x.toFixed(3)}, {selectedAtom.y.toFixed(3)}, {selectedAtom.z.toFixed(3)}) Å
                </span>
              </div>
            </div>
          ) : hoveredAtom ? (
            <div className="bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] text-slate-300 border border-slate-700 font-mono">
              游標指向： {hoveredAtom.element} ({hoveredAtom.x.toFixed(2)}, {hoveredAtom.y.toFixed(2)}, {hoveredAtom.z.toFixed(2)})
            </div>
          ) : (
            <div className="bg-slate-900/60 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] text-slate-400 border border-slate-800">
              {measurementMode ? '點選 2 個原子量測距離，3 個原子量測鍵角' : "左鍵拖曳旋轉；右鍵平移；點選原子檢視"}
            </div>
          )}
        </div>

        {/* Display Toggles */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-700/80 shadow-lg pointer-events-auto text-xs">
          <button
            onClick={() => setRepresentation(r => r === 'ball_and_stick' ? 'space_filling' : 'ball_and_stick')}
            className={`px-2 py-1 rounded transition-colors ${
              representation === 'space_filling' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:text-white'
            }`}
            title="切換空間填充／球棒模型"
          >
            {representation === 'ball_and_stick' ? "球棒模型" : '空間填充模型'}
          </button>
          
          <button
            onClick={() => setShowUnitCell(!showUnitCell)}
            className={`p-1.5 rounded transition-colors ${
              showUnitCell ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
            }`}
            title="切換晶胞線框"
          >
            <Box className="w-3.5 h-3.5" />
          </button>

          {structure.atoms.some(a => a.fixed) && (
            <button
              onClick={() => setShowFixedAtoms(!showFixedAtoms)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                showFixedAtoms ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400'
              }`}
              title="Highlight Fixed Atoms (Selective Dynamics)"
            >
              固定原子層
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
