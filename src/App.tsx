import adsorviaLogo from './assets/branding/adsorvia-logo.png';
const IS_PUBLIC=import.meta.env.VITE_PUBLIC_MODE==='true';
import {reasonZh,statusZh,featureZh,uiText} from './i18n/zhTW';
import {SubstrateSelection,loadSelection} from './s4/SubstrateSelection';
import {EnergyResults} from './s5/EnergyResults';
import type {SubstrateID} from './s4/registry';
import {IntegratedResults} from './integration/IntegratedResults';
/**
 * TiN Adsorption Screening Workbench P1-S5
 * UI Optimized Layout:
 * 01. Material Input
 * 02. Molecular Identity / Basic Information
 * 03. 3D Energy Minimized Conformer (Enlarged Full-Width Viewer)
 * 04. 2D Chemical Depiction
 * 05. Molecular Descriptors / Functional Groups
 * 06. TiN Surface Adsorption Screening Result
 * 07. Literature / History
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  FlaskConical,
  Layers,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Database,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Search,
  Check,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Download,
} from 'lucide-react';
import { MoleculeViewer3D } from './components/MoleculeViewer3D';
import {
  TIN_LITERATURE_REFERENCES,
  TIN_GROUP_LITERATURE_SUPPORT,
} from './models/literatureReferences';

type InputMode = 'SMILES' | 'InChI' | 'MDL' | 'IMAGE';
type TabSection = 'screening' | 'groups' | 'literature' | 'history' | 'tests';

export default function App() {
  const [integratedResult,setIntegratedResult]=useState<any>(null);
  const [modelMode,setModelMode]=useState('DUAL');
  const [initialSelection]=useState(loadSelection);
  const [substrates,setSubstrates]=useState<SubstrateID[]>(initialSelection.selected);
  const [surfaceConditions,setSurfaceConditions]=useState<Record<string,string>>(initialSelection.conditions);
  const [activeTab, setActiveTab] = useState<TabSection>('screening');
  const [inputMode, setInputMode] = useState<InputMode>('SMILES');
  const [inputText, setInputText] = useState<string>('CCO');

  // Image input states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isRecognizingImage, setIsRecognizingImage] = useState<boolean>(false);
  const [imageCandidate, setImageCandidate] = useState<{
    candidate_smiles: string;
    formula: string;
    molecular_weight: number;
    inchikey: string;
    svg_depiction: string;
  } | null>(null);
  const [isCandidateConfirmed, setIsCandidateConfirmed] = useState<boolean>(false);

  // Multi-molecule SDF selector states
  const [sdfOptions, setSdfOptions] = useState<any[]>([]);
  const [selectedSdfIndex, setSelectedSdfIndex] = useState<number>(0);

  // Submission lock & loading states (Section 01)
  const isSubmittingRef = useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Results & History states
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [al2o3Result, setAl2o3Result] = useState<any>(null);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>({
    materials: [],
    analysis: [],
    conformers: [],
    predictions: [],
    comparisons: [],
  });

  // Literature records state
  const [literatureRecords, setLiteratureRecords] = useState<any[]>([]);
  const [litSearchTerm, setLitSearchTerm] = useState<string>('');

  // Regression Test states
  const [testResults, setTestResults] = useState<any>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Initial load: ONLY fetch history and literature. DO NOT AUTO-SCREEN! (Section 01 & 18)
  useEffect(() => {
    if(!IS_PUBLIC){fetchHistory();fetchLiterature();}
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch {
      // ignore
    }
  };

  const fetchLiterature = async (search = '') => {
    try {
      const url = search ? `/api/literature-records?q=${encodeURIComponent(search)}` : '/api/literature-records';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLiteratureRecords(data);
      }
    } catch {
      // ignore
    }
  };

  // Image Upload & OCR flow (Section 01 & 02)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImageCandidate(null);
    setIsCandidateConfirmed(false);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const b64 = event.target?.result as string;
      setImageBase64(b64);
      setImagePreview(b64);

      // Trigger automatic OCSR structure recognition to display candidate structure
      setIsRecognizingImage(true);
      try {
        const res = await fetch('/api/recognize-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: b64,
            mime_type: file.type,
          }),
        });
        const data = await res.json();
        if (data.success && data.candidate_smiles) {
          setImageCandidate(data);
        } else {
          setErrorMessage(data.error || 'STRUCTURE_RECOGNITION_FAILED: Could not recognize clear chemical graph.');
        }
      } catch (err: any) {
        setErrorMessage(`STRUCTURE_RECOGNITION_FAILED: ${err.message}`);
      } finally {
        setIsRecognizingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Check for multi-SDF when text changes
  const handleTextChange = async (val: string) => {
    setInputText(val);
    if (inputMode === 'MDL' && val.includes('$$$$')) {
      try {
        const res = await fetch('/api/parse-sdf-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sdf_text: val }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.options && data.options.length > 1) {
            setSdfOptions(data.options);
            setSelectedSdfIndex(0);
          } else {
            setSdfOptions([]);
          }
        }
      } catch {
        setSdfOptions([]);
      }
    } else {
      setSdfOptions([]);
    }
  };

  // Authoritative Single Submission Entry Point (Section 01)
  const submitAnalysis = async (overridePayload?: any) => {
    // 1. Synchronous Ref Lock + Loading state
    if (isSubmittingRef.current || isLoading || !substrates.length) {
      return;
    }

    setErrorMessage(null);

    // 2. Prepare payload and validate non-empty
    let payload: any = overridePayload || {};

    if (!overridePayload) {
      payload.input_type = inputMode;

      if (inputMode === 'IMAGE') {
        if (!imageBase64) {
          setErrorMessage('Please upload a chemical structure image first.');
          return;
        }
        if (!imageCandidate) {
          setErrorMessage('Please wait for structure recognition to complete.');
          return;
        }
        if (!isCandidateConfirmed) {
          setErrorMessage('Please verify and confirm the recognized structure before running screening.');
          return;
        }
        payload.candidate_confirmed = true;
        payload.candidate_smiles = imageCandidate.candidate_smiles;
      } else {
        const trimmed = (inputText || '').trim();
        if (!trimmed) {
          setErrorMessage(`Cannot submit empty ${inputMode} input.`);
          return;
        }

        if (inputMode === 'MDL' && sdfOptions.length > 1) {
          payload.selected_mol_block = sdfOptions[selectedSdfIndex].mol_block;
        } else {
          // Molfile has three position-sensitive header lines, which may be empty.
          payload.raw_text = inputMode==='MDL'?inputText:trimmed;
        }
      }
    }

    // Acquire lock
    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...payload,mode:modelMode,substrates,model_selection:'AUTOMATIC'}),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Server error processing chemical structure.');
        return;
      }

      if (!data.geometry && data.analysis?.status !== 'SUCCESS') {
        setErrorMessage(data.analysis?.error_message || `Analysis failed: ${data.analysis?.status}`);
      }

      setIntegratedResult(data);
      setAnalysisResult(data.analysis);
      setPredictionResult(data.prediction);
      setAl2o3Result(data.al2o3 || null);
      setComparisonResult(data.comparison || null);
      if (data.history) {
        setHistoryData(data.history);
      }
    } catch (err: any) {
      setErrorMessage(`Request error: ${err.message || 'Network error'}`);
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  // Keyboard handler adhering to Section 01 & 07 rules:
  // - SMILES: Enter -> submit; Shift+Enter -> newline
  // - InChI: Enter -> submit; Shift+Enter -> newline
  // - MDL: Enter -> newline; Ctrl+Enter / Cmd+Enter -> submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }

    if (inputMode === 'SMILES' || inputMode === 'InChI') {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitAnalysis();
      }
    } else if (inputMode === 'MDL') {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitAnalysis();
      }
    }
  };

  // Quick Presets: ONLY fill structure text, DO NOT auto-execute or create history!
  const loadPreset = (mode: InputMode, text: string) => {
    setInputMode(mode);
    setInputText(text);
    setErrorMessage(null);
    setSdfOptions([]);
    setImageCandidate(null);
    setIsCandidateConfirmed(false);
  };

  // Run Regression Tests (Section 10)
  const runRegressionTests = async () => {
    setIsTesting(true);
    setTestResults(null);
    try {
      const res = await fetch('/api/run-regression-tests', { method: 'POST' });
      const data = await res.json();
      setTestResults(data);
    } catch (err: any) {
      setTestResults({ all_passed: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="screening-app min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3.5 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <img src={adsorviaLogo} alt="Adsorvia" width="64" height="64" className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex flex-wrap items-center gap-2">
              Adsorvia
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan-100 text-cyan-800 font-medium">
                P1-S5
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">Molecular Surface Adsorption Platform</p>
            <p className="text-[11px] text-slate-500">
              探索性篩選；原始 TiN 模型識別碼：TIN_OXOH_LIT_V0.2
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        {!IS_PUBLIC&&<nav className="flex flex-wrap max-w-full items-center gap-1 bg-slate-100 p-1 border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('screening')}
            className={`px-3 py-1 font-medium transition-colors cursor-pointer ${
              activeTab === 'screening' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            吸附分析
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`px-3 py-1 font-medium transition-colors cursor-pointer ${
              activeTab === 'groups' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            官能基對照表
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('literature')}
            className={`px-3 py-1 font-medium transition-colors cursor-pointer ${
              activeTab === 'literature' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            文獻吸附資料
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              fetchHistory();
            }}
            className={`px-3 py-1 font-medium transition-colors cursor-pointer ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            資料庫歷史紀錄
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`px-3 py-1 font-medium transition-colors cursor-pointer ${
              activeTab === 'tests' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            驗收測試
          </button>
        </nav>}

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {!IS_PUBLIC&&<a
            href="/api/download-zip"
            download="Dual-Surface-Adsorption-Screening-Integrated.zip"
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-900 text-white hover:bg-indigo-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="下載完整整合專案（含 Python 引擎、依賴設定與測試）"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">下載完整專案 ZIP</span>
          </a>}
          <button
            type="button"
            onClick={() => submitAnalysis()}
            disabled={isLoading || !substrates.length}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isLoading ? "分析中…" : "開始分析（Enter）"}</span>
          </button>
        </div>
      </header>

      {/* Surface & Model Metadata Ribbon */}
      <div className="bg-slate-900 text-slate-200 border-b border-slate-800 px-6 py-2.5">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <span className="font-mono text-cyan-400 font-semibold">原始 TiN 表面假設：</span>
            <span className="font-semibold text-white">原始 TiN 表面假設（TIN_OXOH_V01）</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-slate-300">模型：TIN_OXOH_LIT_V0.2</span>
            <span className="text-slate-500">·</span>
            <span className="text-amber-300 font-medium">未校正的啟發式參數</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] min-w-0">
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 不截斷 Eads 數值
            </span>
            <span className="text-amber-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> DFT：尚未計算
            </span>
            <span className="text-slate-400">{IS_PUBLIC?'訪客模式：不儲存伺服器歷史紀錄':'SQLite: data/materials.db'}</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 min-w-0 max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-6 space-y-6">
        <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-4 items-center">
          <span className="font-semibold">P1-S5：四底材吸附預測</span>
          {!IS_PUBLIC&&<a href="http://localhost:3201" target="_blank" rel="noreferrer" className="text-blue-700 underline">Al₂O₃ 進階工作台 ↗</a>}
          <span className="text-xs text-amber-700">探索性結果；未執行表面 DFT；影像辨識尚未驗證，已停用。</span>
        </section>

        {activeTab === 'screening' && (
          <div className="space-y-6">
            {/* ======================================================== */}
            {/* 01. MATERIAL STRUCTURE INPUT (Top Full-Width Section) */}
            {/* ======================================================== */}
            <section data-testid="material-input" className="bg-white border border-slate-200 p-5 space-y-4 shadow-2xs">
              <SubstrateSelection selected={substrates} conditions={surfaceConditions} onChange={setSubstrates} onConditions={setSurfaceConditions}/>
              <p className="text-xs text-slate-600">吸附模型由系統依底材及適用範圍自動選擇；不需手動切換。SU 僅為假設性分數。</p>
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold font-mono">
                    01
                  </span>
                  <h2 className="text-sm font-semibold text-slate-900">分子結構輸入</h2>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {inputMode === 'MDL' ? "按 Ctrl+Enter 開始分析" : "按 Enter 開始分析"}
                </span>
              </div>

              {/* Input Format Tabs (IMAGE / SMILES / InChI / MDL) */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 border border-slate-200 max-w-md">
                {(['SMILES', 'InChI', 'MDL', 'IMAGE'] as InputMode[]).map((mode) => (
                  <button
                    key={mode==='IMAGE'?'影像（未啟用）':mode}
                    type="button"
                    disabled={mode==='IMAGE'} title={mode==='IMAGE'?'影像結構辨識未驗證，已停用':mode}
                    onClick={() => {
                      setInputMode(mode);
                      setErrorMessage(null);
                    }}
                    className={`py-1.5 text-xs font-medium transition-colors text-center cursor-pointer ${
                      inputMode === mode ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode==='IMAGE'?'影像（未啟用）':mode}
                  </button>
                ))}
              </div>

              {/* Input Body */}
              {inputMode === 'IMAGE' ? (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-300 p-5 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                      <Upload className="w-6 h-6 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-700">上傳分子結構影像</span>
                      <span className="text-[11px] text-slate-500">PNG, JPG, JPEG</span>
                    </label>
                  </div>

                  {isRecognizingImage && (
                    <div className="p-3 bg-cyan-50 border border-cyan-200 text-xs text-cyan-800 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 animate-spin text-cyan-600" />
                      <span>正在辨識分子結構影像…</span>
                    </div>
                  )}

                  {imageCandidate && (
                    <div className="border border-cyan-200 bg-cyan-50/50 p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-cyan-950">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                          Recognized Candidate Structure:
                        </span>
                        <span className="font-mono text-[11px] text-cyan-800">{imageCandidate.formula}</span>
                      </div>

                      {imageCandidate.svg_depiction && (
                        <div
                          className="bg-white p-3 border border-slate-200 flex justify-center [&_svg]:max-h-36"
                          dangerouslySetInnerHTML={{ __html: imageCandidate.svg_depiction }}
                        />
                      )}

                      <div className="text-xs font-mono bg-white p-2.5 border border-slate-200 break-all text-slate-800">
                        {imageCandidate.candidate_smiles}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isCandidateConfirmed}
                            onChange={(e) => setIsCandidateConfirmed(e.target.checked)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span>我已核對此結構與上傳影像一致</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setIsCandidateConfirmed(true);
                            submitAnalysis({
                              input_type: 'IMAGE',
                              candidate_confirmed: true,
                              candidate_smiles: imageCandidate.candidate_smiles,
                            });
                          }}
                          disabled={!imageCandidate || isLoading}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-cyan-800 text-white hover:bg-cyan-900 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>確認結構並分析</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-700">
                      {inputMode === 'SMILES' && "標準或異構 SMILES 字串："}
                      {inputMode === 'InChI' && "完整 InChI 字串（保留 /b、/t、+）："}
                      {inputMode === 'MDL' && 'MDL Molfile／多分子 SDF（V2000／V3000）：'}
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      {inputMode === 'MDL' ? 'Ctrl+Enter' : "Enter"} 執行
                    </span>
                  </div>

                  <textarea
                    aria-label="分子結構輸入"
                    rows={inputMode === 'MDL' ? 5 : 2}
                    value={inputText}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      inputMode === 'SMILES'
                        ? '例如：CCO'
                        : inputMode === 'InChI'
                        ? 'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3'
                        : '貼上 V2000 或 V3000 Molfile 結構內容'
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-cyan-600 leading-relaxed"
                  />

                  {/* Multi-Molecule SDF Selector (Section 02) */}
                  {sdfOptions.length > 1 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 space-y-2">
                      <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-700" />
                        偵測到多筆 SDF 結構（{sdfOptions.length} 筆）：
                      </div>
                      <select
                        value={selectedSdfIndex}
                        onChange={(e) => setSelectedSdfIndex(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-amber-300 text-slate-800 focus:outline-none"
                      >
                        {sdfOptions.map((opt) => (
                          <option key={opt.index} value={opt.index}>
                            #{opt.index + 1}: {opt.title} ({opt.formula}, MW {opt.molecular_weight})
                          </option>
                        ))}
                      </select>
                      <div className="text-[11px] text-amber-800">
                        選取的分子會送入共用 RDKit 描述符流程。
                      </div>
                    </div>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">分析失敗</div>
                    <div>{reasonZh(errorMessage)}</div>
                  </div>
                </div>
              )}

              {/* Quick Presets & Submission Action Bar */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">快速測試範例：</span>
                  <button
                    type="button"
                    onClick={() => loadPreset('SMILES', 'CCO')}
                    className="px-2.5 py-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                  >
                    乙醇範例
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      loadPreset(
                        'InChI',
                        'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3'
                      )
                    }
                    className="px-2.5 py-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                  >
                    乙醇 InChI 範例
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('SMILES', 'CC(=O)O')}
                    className="px-2.5 py-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                  >
                    醋酸（COOH）
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('SMILES', 'CN')}
                    className="px-2.5 py-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                  >
                    甲胺（胺基）
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    按 <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 font-mono text-[10px]">Enter</kbd> 開始分析
                  </span>
                  <button
                    type="button"
                    onClick={() => submitAnalysis()}
                    disabled={isLoading || !substrates.length}
                    className="px-5 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isLoading ? "分析中…" : "開始分析"}</span>
                  </button>
                </div>
              </div>
            </section>

            {integratedResult && <><EnergyResults result={integratedResult} busy={isLoading} error={errorMessage} onLoad={data=>{setIntegratedResult(data);setAnalysisResult(data.analysis);setPredictionResult(data.prediction);setAl2o3Result(data.al2o3||null);setComparisonResult(data.comparison||null);setSubstrates(data.substrate_ids);setSurfaceConditions(data.input_surface_conditions||Object.fromEntries(data.four_substrate_results.map((r:any)=>[r.substrate_id,r.surface_state])));setInputMode('SMILES');setInputText(data.geometry.isomeric_smiles);setErrorMessage(null);}}/>{!isLoading&&!errorMessage&&<IntegratedResults result={integratedResult}/>}</>}

            {!IS_PUBLIC&&analysisResult?.molecular_identity&&!isLoading&&!errorMessage ? (
              <>
                {/* ======================================================== */}
                {/* 02. MOLECULAR IDENTITY / BASIC INFORMATION */}
                {/* ======================================================== */}
                <section className="bg-white border border-slate-200 p-5 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold font-mono">
                        02
                      </span>
                      <h2 className="text-sm font-semibold text-slate-900">分子身分與基本資訊</h2>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 border border-emerald-200 font-semibold">
                      RDKit 分子圖已核對
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500 font-medium">分子式</div>
                      <div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                        {analysisResult.molecular_identity.formula}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500 font-medium">分子量</div>
                      <div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                        {analysisResult.molecular_identity.molecular_weight} <span className="text-xs font-normal text-slate-500">g/mol</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500 font-medium">形式電荷</div>
                      <div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                        {analysisResult.molecular_identity.formal_charge}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500 font-medium">立體化學狀態</div>
                      <div className="font-mono text-xs font-semibold text-cyan-800 mt-0.5">
                        {statusZh(analysisResult.molecular_identity.stereo_status)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-slate-500 font-sans">標準 SMILES：</div>
                      <div className="bg-slate-50 p-2.5 border border-slate-200 break-all text-slate-800 text-[11px]">
                        {analysisResult.molecular_identity.canonical_smiles}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-slate-500 font-sans">InChIKey:</div>
                      <div className="bg-slate-50 p-2.5 border border-slate-200 break-all text-slate-800 text-[11px]">
                        {analysisResult.molecular_identity.inchikey}
                      </div>
                    </div>
                  </div>
                </section>

                {/* ======================================================== */}
                {/* 03. 3D ENERGY MINIMIZED CONFORMER (Major Enlarged View) */}
                {/* ======================================================== */}
                <section className="bg-white border border-slate-200 p-5 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-cyan-800 text-white rounded-full flex items-center justify-center text-[10px] font-bold font-mono">
                        03
                      </span>
                      <h2 className="text-sm font-semibold text-slate-900">
                        3D 能量最佳化構形
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                        ETKDGv3 構形與 MMFF94s 力場最佳化
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-cyan-900 text-white">
                        舊版示意能量：不是物理構形能
                      </span>
                    </div>
                  </div>

                  {/* Full-Width Responsive 3D Viewer (Desktop 560px, Tablet 480px, Mobile 360px) */}
                  <div className="w-full">
                    {analysisResult.conformer_3d ? (
                      <MoleculeViewer3D
                        conformer={analysisResult.conformer_3d}
                        formula={analysisResult.molecular_identity.formula}
                        smiles={analysisResult.molecular_identity.canonical_smiles}
                      />
                    ) : (
                      <div className="h-64 flex items-center justify-center text-xs text-slate-400 bg-slate-950 font-mono">
                        沒有可用的 3D 構形座標
                      </div>
                    )}
                  </div>
                </section>

                {/* ======================================================== */}
                {/* 04. 2D CHEMICAL DEPICTION (Directly Below 3D) */}
                {/* ======================================================== */}
                <section className="bg-white border border-slate-200 p-5 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold font-mono">
                        04
                      </span>
                      <h2 className="text-sm font-semibold text-slate-900">2D 分子結構圖</h2>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">RDKit 二維排版</span>
                  </div>

                  <div data-testid="legacy-chemical-layout" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="chemical-frame min-w-0 lg:col-span-5 flex justify-center p-4 bg-slate-50 border border-slate-100">
                      {analysisResult.svg_depiction ? (
                        <div
                          className="chemical-depiction"
                          dangerouslySetInnerHTML={{ __html: analysisResult.svg_depiction }}
                        />
                      ) : (
                        <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                          沒有可用的 2D 結構圖
                        </div>
                      )}
                    </div>

                    <div className="chemical-metadata min-w-0 lg:col-span-7 space-y-3 text-xs">
                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-slate-500">分子式與身分：</div>
                        <div className="font-bold text-slate-900 text-base font-mono">
                          {analysisResult.molecular_identity.formula} · MW {analysisResult.molecular_identity.molecular_weight} g/mol
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-slate-500">標準 SMILES：</div>
                        <div className="font-mono text-[11px] bg-slate-50 p-2.5 border border-slate-200 text-slate-800 break-all">
                          {analysisResult.molecular_identity.canonical_smiles}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-slate-500">立體化學保留狀態：</div>
                        <div className="text-slate-600 text-[11px] leading-relaxed">
                          {uiText(analysisResult.identity_gate?.details||'RDKit connectivity graph verified. Heavy atom and bond topology match molecular authority.')}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* ======================================================== */}
                {/* 05. MOLECULAR DESCRIPTORS & FUNCTIONAL GROUPS */}
                {/* ======================================================== */}
                {analysisResult.descriptors && (
                  <section className="bg-white border border-slate-200 p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold font-mono">
                          05
                        </span>
                        <h2 className="text-sm font-semibold text-slate-900">分子描述符與官能基</h2>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">RDKit 確定性描述符</span>
                    </div>

                    {/* Descriptors Matrix */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs font-mono">
                      <div className="p-2.5 bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-sans">MW</div>
                        <div className="font-bold text-slate-900">{analysisResult.descriptors.MW}</div>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-sans">MolLogP</div>
                        <div className="font-bold text-slate-900">{analysisResult.descriptors.MolLogP}</div>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-sans">TPSA</div>
                        <div className="font-bold text-slate-900">{analysisResult.descriptors.TPSA} Å²</div>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-sans">HBD / HBA</div>
                        <div className="font-bold text-slate-900">
                          {analysisResult.descriptors.HBD} / {analysisResult.descriptors.HBA}
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-sans">可旋轉鍵</div>
                        <div className="font-bold text-slate-900">{analysisResult.descriptors.RotatableBonds}</div>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-sans">環數（芳香環）</div>
                        <div className="font-bold text-slate-900">
                          {analysisResult.descriptors.RingCount} ({analysisResult.descriptors.AromaticRingCount})
                        </div>
                      </div>
                    </div>

                    {/* Detected Functional Groups Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                      <div className="p-3 bg-emerald-50/50 border border-emerald-200 space-y-2">
                        <div className="font-semibold text-emerald-900 flex items-center justify-between">
                          <span>文獻中的定性作用機制：</span>
                          <span className="text-[11px] font-mono text-emerald-700">參考文獻 A／B／C／D／E</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {predictionResult?.supported_groups?.length > 0 ? (
                            predictionResult.supported_groups.map((g: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-mono text-[11px] font-medium">
                                {featureZh(g)}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">未偵測到</span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-amber-50/50 border border-amber-200 space-y-2">
                        <div className="font-semibold text-amber-900 flex items-center justify-between">
                          <span>外推官能基（無已驗證 Eads）：</span>
                          <span className="text-[11px] font-mono text-amber-700">模型估計</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {predictionResult?.extrapolated_groups?.length > 0 ? (
                            predictionResult.extrapolated_groups.map((g: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-800 font-mono text-[11px] font-medium">
                                {featureZh(g)}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">未偵測到</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* ======================================================== */}
                {/* 06. TiN SURFACE ADSORPTION SCREENING RESULT */}
                {/* ======================================================== */}
                {predictionResult && (
                  <section className="bg-white border border-slate-200 p-5 space-y-5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold font-mono">
                          06
                        </span>
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900">原始 TiN 吸附篩選結果</h2>
                          <div className="text-[11px] text-slate-500">
                            原始 TiN 表面假設（TIN_OXOH_V01）；模型：TIN_OXOH_LIT_V0.2
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 text-xs font-mono font-semibold bg-slate-900 text-white">
                        {predictionResult.model_version}
                      </span>
                    </div>

                    {/* Uncalibrated Heuristic Parameters Warning */}
                    <div className="p-3.5 bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">未校正的啟發式篩選： </span>
                        <span>{uiText(predictionResult.warning)}</span>
                      </div>
                    </div>

                    {/* Main Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* 1. Estimated Screening Eads */}
                      <div className="p-4 bg-slate-900 text-white border border-slate-900 space-y-1">
                        <div className="text-[11px] text-cyan-300 font-medium">估計吸附篩選值 Eads</div>
                        <div className="text-2xl font-bold font-mono tracking-tight text-white">
                          {predictionResult.predicted_eads_display}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">未設定數值上下限</div>
                      </div>

                      {/* 2. Raw Predicted Eads */}
                      <div className="p-4 bg-slate-50 border border-slate-200 space-y-1">
                        <div className="text-[11px] text-slate-500 font-medium">原始 Eads 預測值</div>
                        <div className="text-xl font-bold font-mono text-slate-900">
                          {predictionResult.raw_predicted_eads_ev.toFixed(4)} eV
                        </div>
                        <div className="text-[10px] text-slate-500">保留原始計算精度</div>
                      </div>

                      {/* 3. Relative Surface Affinity */}
                      <div className="p-4 bg-slate-50 border border-slate-200 space-y-1">
                        <div className="text-[11px] text-slate-500 font-medium">模型內部相對親和指標</div>
                        <div className="text-xl font-bold font-mono text-slate-900 flex items-baseline gap-1">
                          <span>{predictionResult.relative_affinity_score}</span>
                          <span className="text-xs text-slate-500 font-normal">/ 100</span>
                        </div>
                        <div className="text-[10px] font-semibold text-cyan-700">{statusZh(predictionResult.affinity_class)}</div>
                      </div>

                      {/* 4. Confidence & Uncertainty */}
                      <div className="p-4 bg-slate-50 border border-slate-200 space-y-1">
                        <div className="text-[11px] text-slate-500 font-medium">不確定度／適用範圍</div>
                        <div className="text-sm font-bold font-mono text-slate-900">
                          {predictionResult.uncertainty_ev === null ? '尚未校正' : `±${predictionResult.uncertainty_ev} eV`}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {statusZh(predictionResult.applicability_domain)}
                        </div>
                      </div>
                    </div>

                    {/* Scientific Governance Matrix Table */}
                    <div className="border border-slate-200 text-xs overflow-hidden">
                      <div className="bg-slate-100 px-3 py-2 font-semibold text-slate-800 border-b border-slate-200">
                        模型限制與參數來源
                      </div>
                      <div className="divide-y divide-slate-100">
                        <div className="grid grid-cols-3 px-3 py-2">
                          <span className="text-slate-500 font-medium">參數值</span>
                          <span className="col-span-2 text-slate-900 font-mono text-[11px]">
                            截距 −0.14 eV、斜率 −0.01667 eV/分數（未校正的啟發式參數）
                          </span>
                        </div>
                        <div className="grid grid-cols-3 px-3 py-2">
                          <span className="text-slate-500 font-medium">DFT 擬合狀態</span>
                          <span className="col-span-2 text-rose-700 font-semibold">
                            無；未以 TiN DFT 文獻進行擬合
                          </span>
                        </div>
                        <div className="grid grid-cols-3 px-3 py-2">
                          <span className="text-slate-500 font-medium">機器學習驗證狀態</span>
                          <span className="col-span-2 text-slate-700">
                            僅為啟發式篩選，非已驗證的機器學習模型
                          </span>
                        </div>
                        <div className="grid grid-cols-3 px-3 py-2">
                          <span className="text-slate-500 font-medium">DFT Eads 計算狀態</span>
                          <span className="col-span-2 font-mono text-amber-700 font-semibold">
                            {statusZh(predictionResult.dft_eads)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 px-3 py-2">
                          <span className="text-slate-500 font-medium">文獻涵蓋範圍</span>
                          <span className="col-span-2 font-semibold text-slate-800">
                            {statusZh(predictionResult.literature_coverage)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Energy Contribution Score Breakdown */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-700">模型作用指標分解：</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                        {predictionResult.transparency_explanation?.score_breakdown?.map((item: any, i: number) => (
                          <div key={i} className="p-2.5 bg-slate-50 border border-slate-200">
                            <div className="text-[10px] text-slate-500 font-sans truncate">{uiText(item.component)}</div>
                            <div className="font-bold text-slate-900 text-sm mt-0.5">{item.value}</div>
                            <div className="text-[10px] text-slate-400 font-sans truncate mt-0.5">{uiText(item.description)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* ======================================================== */}
                {/* 07. 雙底材原始數值追溯 ADSORPTION SCREENING & COMPARISON */}
                {/* ======================================================== */}
                {predictionResult && (
                  <section className="bg-white border border-slate-200 p-5 space-y-5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-indigo-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold font-mono">
                          07
                        </span>
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900">
                            原始 TiN／Al₂O₃ 吸附篩選追溯
                          </h2>
                          <div className="text-[11px] text-slate-500">
                            共用不可變的分子特徵；各底材引擎獨立，不借用權重
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 text-xs font-mono font-semibold bg-indigo-900 text-white">
                        雙底材原始數值追溯
                      </span>
                    </div>

                    {/* Comparative Cards: TiN vs Al2O3 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* TiN Card */}
                      <div className="p-4 bg-slate-900 text-white border border-slate-900 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-300">底材一：TiN</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-cyan-400">
                            TIN_OXOH_V01
                          </span>
                        </div>
                        <div className="text-xs text-slate-300">原始模型的氧化／羥基化 TiN 假設（樣品狀態未確認）</div>
                        <div className="pt-2 border-t border-slate-800">
                          <div className="text-[11px] text-slate-400">TiN 預測 Eads：</div>
                          <div className="text-2xl font-bold font-mono text-white mt-0.5">
                            {predictionResult.predicted_eads_display}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-300 flex items-center justify-between">
                          <span>模型內部親和分類：</span>
                          <span className="font-semibold text-cyan-300">{statusZh(predictionResult.affinity_class)}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          模型：{predictionResult.model_id}
                        </div>
                      </div>

                      {/* Al2O3 Card (Authentic Python RDKit Engine) */}
                      <div className="p-4 bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">底材二：Al₂O₃（羥基化）</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-200 text-slate-700">
                            AL2O3_ALPHA_OH_V01
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">羥基化 α-Al₂O₃(0001)</div>

                        {al2o3Result?.installed ? (
                          <div className="pt-2 border-t border-slate-200 space-y-2">
                            <div>
                              <div className="text-[11px] text-slate-500">Al₂O₃ 預測 Eads：</div>
                              <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                                {al2o3Result.predicted_eads_display || `${al2o3Result.predicted_eads_ev} eV`}
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center justify-between">
                              <span>模型內部親和分類：</span>
                              <span className="font-semibold text-slate-900">{statusZh(al2o3Result.affinity_class||'NOT_ESTABLISHED')}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              原始值：{typeof al2o3Result.raw_predicted_eads_ev === 'number' ? `${al2o3Result.raw_predicted_eads_ev.toFixed(4)} eV` : '—'}
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-200 space-y-2">
                            <div className="text-[11px] text-slate-500">Al₂O₃ 預測 Eads：</div>
                            <div className="inline-block px-2.5 py-1 text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              {al2o3Result?.error || 'AL2O3_MODEL_未安裝或未執行'}
                            </div>
                            <div className="text-[10px] text-amber-800 leading-tight">
                              Independent Al2O3 prediction model engine is not installed or encountered an error. TiN weights are NOT reused or borrowed.
                            </div>
                          </div>
                        )}

                        <div className="text-[10px] font-mono text-slate-500">
                          模型識別碼：{al2o3Result?.model_id || 'AL2O3_ZIP12_GC_V1.2'} {al2o3Result?.model_version ? `(${al2o3Result.model_version})` : ''}
                        </div>
                      </div>

                      {/* ΔEads & Selectivity Comparison Card */}
                      <div className="p-4 bg-indigo-50/70 border border-indigo-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-900">Eads 差值比較</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-100 text-indigo-800 font-semibold">
                            ΔEads = Eads(TiN) - Eads(Al2O3)
                          </span>
                        </div>

                        <div className="pt-2 border-t border-indigo-100 space-y-1">
                          <div className="text-[11px] text-indigo-700 font-medium">Eads 差值：</div>
                          <div className="text-2xl font-bold font-mono text-indigo-950 mt-0.5">
                            {comparisonResult?.delta_eads_ev==null?'無可用結果':comparisonResult.delta_eads_label}
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="text-[11px] text-indigo-700 font-medium">選擇性判定：</div>
                          <div className="font-mono text-xs font-bold text-indigo-900">
                            {comparisonResult?.selectivity_preference === 'TiN_MORE_NEGATIVE'
                              ? 'TiN 模型數值較負（ΔEads < 0）'
                              : comparisonResult?.selectivity_preference === 'Al2O3_MORE_NEGATIVE'
                              ? 'Al₂O₃ 模型數值較負（ΔEads > 0）'
                              : comparisonResult?.selectivity_preference === 'EQUAL_AFFINITY'
                              ? '模型值接近（ΔEads ≈ 0）'
                              : statusZh(comparisonResult?.selectivity_preference||'INCONCLUSIVE')}
                          </div>
                        </div>

                        <div className="p-2 bg-indigo-100/70 border border-indigo-200 text-[10px] text-indigo-950 leading-relaxed font-sans">
                          <span className="font-semibold block text-[10px] text-indigo-900 uppercase tracking-wider mb-0.5">
                            探索性跨底材比較
                          </span>
                          尚未完成跨底材定量校正；實際吸附選擇性未經收斂 DFT 驗證。
                        </div>
                      </div>
                    </div>

                    {/* Comparison Integrity Checks */}
                    <div className="border border-slate-200 text-xs overflow-hidden">
                      <div className="bg-slate-100 px-3 py-2 font-semibold text-slate-800 border-b border-slate-200 flex items-center justify-between">
                        <span>雙底材模型隔離與完整性</span>
                        <span className="text-[11px] font-mono text-slate-500">檢查項目</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        <div className="grid grid-cols-3 px-3 py-2">
                          <span className="text-slate-500 font-medium">單一分子身分</span>
                          <span className="col-span-2 text-emerald-800 font-mono text-[11px] font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            已核對，共用 InChIKey： {analysisResult.molecular_identity?.inchikey}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 px-3 py-2">
                          <span className="text-slate-500 font-medium">底材識別碼隔離</span>
                          <span className="col-span-2 text-slate-900 font-mono text-[11px]">
                            TiN: TIN_OXOH_V01 | Al2O3: AL2O3_ALPHA_OH_V01 （引擎保持隔離）
                          </span>
                        </div>
                        <div className="grid grid-cols-3 px-3 py-2">
                          <span className="text-slate-500 font-medium">官能基權重</span>
                          <span className="col-span-2 text-slate-900 text-[11px]">
                            TiN 與 Al₂O₃ 參數保持獨立，未新增虛構係數。
                          </span>
                        </div>
                        <div className="grid grid-cols-3 px-3 py-2">
                          <span className="text-slate-500 font-medium">比較狀態</span>
                          <span className="col-span-2 font-mono text-[11px] text-amber-800 font-semibold">
                            {comparisonResult?.comparison_status || 'AL2O3_無可用結果'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* ======================================================== */}
                {/* 08. LITERATURE DATASET & DATABASE HISTORY QUICK ACCESS */}
                {/* ======================================================== */}
                <section className="bg-white border border-slate-200 p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold font-mono">
                        08
                      </span>
                      <h2 className="text-sm font-semibold text-slate-900">文獻吸附資料與歷史紀錄</h2>
                    </div>
                    <span className="text-xs font-mono text-slate-500">
                      {historyData.predictions?.length || 0} 筆已儲存預測；18 筆候選文獻
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('groups')}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors cursor-pointer group"
                    >
                      <div className="font-semibold text-slate-900 flex items-center justify-between">
                        <span>官能基對照表</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        10 類官能基，明確標示尚無已驗證 Eads 的項目。
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('literature')}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors cursor-pointer group"
                    >
                      <div className="font-semibold text-slate-900 flex items-center justify-between">
                        <span>文獻吸附資料</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        18 筆文獻候選紀錄，仍待原文核對。
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('history');
                        fetchHistory();
                      }}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors cursor-pointer group"
                    >
                      <div className="font-semibold text-slate-900 flex items-center justify-between">
                        <span>SQLite 歷史資料庫</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        materials.db 保存完整預測追溯紀錄。
                      </div>
                    </button>
                  </div>
                </section>
              </>
            ) : (
              !integratedResult && <div className="p-12 bg-white border border-slate-200 text-center space-y-3 shadow-2xs">
                <FlaskConical className="w-10 h-10 text-slate-400 mx-auto" />
                <div className="text-sm font-semibold text-slate-800">準備開始分子結構分析</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  請在上方輸入 SMILES、InChI 或 MDL，按下 <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 font-mono text-[10px]">Enter</kbd> 或點擊 <strong>開始分析</strong> 以顯示分子構形，並自動執行已勾選底材的吸附篩選。
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Functional Group Coverage Matrix (Section 07) */}
        {activeTab === 'groups' && (
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 p-5 space-y-3 shadow-2xs">
              <h2 className="text-sm font-semibold text-slate-900">
                官能基文獻涵蓋對照表
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                目前尚無涵蓋各官能基且 TiN 表面條件一致的定量 DFT 資料集；各項明示驗證狀態，不補造數值。
              </p>
            </div>

            <div className="bg-white border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">官能基</th>
                    <th className="px-4 py-3">定量驗證狀態</th>
                    <th className="px-4 py-3">定性文獻支持</th>
                    <th className="px-4 py-3">文獻依據</th>
                    <th className="px-4 py-3">科學依據與資料缺口</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {Object.entries(TIN_GROUP_LITERATURE_SUPPORT).map(([k, meta]) => (
                    <tr key={k} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900 font-sans">{featureZh(k)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-semibold">
                          {statusZh(meta.quantitativeStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 font-medium ${
                            meta.qualitativeSupport === 'QUALITATIVE LITERATURE SUPPORT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {uiText(meta.qualitativeSupport)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-sans">
                        {meta.anchorRefs.length > 0 ? meta.anchorRefs.map(x=>x.replace('Reference ','文獻 ')).join('、') : '無（模型外推）'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-sans max-w-md">{uiText(meta.notes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Literature Eads Dataset (Section 06) */}
        {activeTab === 'literature' && (
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    TiN 文獻吸附候選紀錄
                  </h2>
                  <p className="text-xs text-slate-500">
                    表格： <code className="font-mono text-cyan-800">literature_adsorption_records</code> 共 22 個標準欄位
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="搜尋底材、分子或 DOI…"
                      value={litSearchTerm}
                      onChange={(e) => {
                        setLitSearchTerm(e.target.value);
                        fetchLiterature(e.target.value);
                      }}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <span className="font-semibold">待核對提醒： </span>
                以下吸附能皆為候選紀錄，需核對原文與補充資料後才能標為已核實，不能直接當成訓練標籤。
              </div>
            </div>

            <div className="bg-white border border-slate-200 overflow-x-auto shadow-2xs">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Ref ID</th>
                    <th className="px-3 py-2.5">表面定義</th>
                    <th className="px-3 py-2.5">晶面／表面狀態</th>
                    <th className="px-3 py-2.5">吸附分子</th>
                    <th className="px-3 py-2.5">模式</th>
                    <th className="px-3 py-2.5">涵蓋狀態</th>
                    <th className="px-3 py-2.5">文獻 Eads（eV）</th>
                    <th className="px-3 py-2.5">DFT 泛函</th>
                    <th className="px-3 py-2.5">狀態</th>
                    <th className="px-3 py-2.5">DOI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {literatureRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-cyan-800 font-semibold">{r.reference_id}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900 font-sans">{r.surface_formula}</td>
                      <td className="px-3 py-2 text-slate-600 font-sans">{r.oxide_state}</td>
                      <td className="px-3 py-2 text-slate-800 font-semibold">{r.adsorbate}</td>
                      <td className="px-3 py-2 text-slate-700 font-sans">{r.adsorption_mode}</td>
                      <td className="px-3 py-2 text-slate-600">{r.coverage_ML}</td>
                      <td className="px-3 py-2 font-bold text-slate-900">{r.reported_energy_ev.toFixed(2)} eV</td>
                      <td className="px-3 py-2 text-slate-600">{r.DFT_functional}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold">
                          {statusZh(r.verification_status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{r.DOI}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: SQLite History (Section 09) */}
        {activeTab === 'history' && (
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 p-5 space-y-2 shadow-2xs flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  SQLite 資料庫歷史紀錄（<code className="font-mono text-cyan-800">data/materials.db</code>)
                </h2>
                <p className="text-xs text-slate-500">
                  保存材料、分析輸入、構形與篩選預測。
                </p>
              </div>
              <button
                type="button"
                onClick={fetchHistory}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重新載入紀錄</span>
              </button>
            </div>

            {/* Prediction History Table */}
            <div className="bg-white border border-slate-200 overflow-hidden shadow-2xs space-y-2">
              <div className="bg-slate-100 px-4 py-2.5 font-semibold text-xs text-slate-800 border-b border-slate-200 flex items-center justify-between">
                <span>吸附預測歷史紀錄（{historyData.predictions?.length || 0})</span>
                <span className="text-[11px] font-mono text-slate-500">prediction_history</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="px-3 py-2">識別碼</th>
                      <th className="px-3 py-2">分子式</th>
                      <th className="px-3 py-2">SMILES</th>
                      <th className="px-3 py-2">預測 Eads</th>
                      <th className="px-3 py-2">原始 Eads</th>
                      <th className="px-3 py-2">模型內部親和分數</th>
                      <th className="px-3 py-2">模型識別碼</th>
                      <th className="px-3 py-2">不確定度</th>
                      <th className="px-3 py-2">時間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {historyData.predictions?.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400">#{p.id}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900 font-sans">{p.formula || '—'}</td>
                        <td className="px-3 py-2 text-slate-700 max-w-xs truncate">{p.canonical_smiles}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">{p.predicted_eads_ev.toFixed(2)} eV</td>
                        <td className="px-3 py-2 text-slate-600">{p.raw_predicted_eads_ev.toFixed(4)} eV</td>
                        <td className="px-3 py-2 text-cyan-800 font-semibold">{p.relative_affinity_score} ({statusZh(p.affinity_class)})</td>
                        <td className="px-3 py-2 text-slate-600">{p.model_id}</td>
                        <td className="px-3 py-2 text-slate-500">{p.uncertainty_ev === null ? '尚未校正' : p.uncertainty_ev}</td>
                        <td className="px-3 py-2 text-slate-400">{p.created_at?.slice(0, 19).replace('T', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dual-Surface Comparison History Table */}
            <div className="bg-white border border-slate-200 overflow-hidden shadow-2xs space-y-2">
              <div className="bg-slate-100 px-4 py-2.5 font-semibold text-xs text-slate-800 border-b border-slate-200 flex items-center justify-between">
                <span>雙底材比較歷史紀錄（{historyData.comparisons?.length || 0})</span>
                <span className="text-[11px] font-mono text-slate-500">comparison_history (TiN vs Al2O3)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="px-3 py-2">識別碼</th>
                      <th className="px-3 py-2">分子式</th>
                      <th className="px-3 py-2">SMILES</th>
                      <th className="px-3 py-2">Eads(TiN)</th>
                      <th className="px-3 py-2">Eads(Al2O3)</th>
                      <th className="px-3 py-2">ΔEads</th>
                      <th className="px-3 py-2">Al₂O₃ 狀態</th>
                      <th className="px-3 py-2">選擇性</th>
                      <th className="px-3 py-2">時間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {historyData.comparisons?.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400">#{c.id}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900 font-sans">{c.formula || '—'}</td>
                        <td className="px-3 py-2 text-slate-700 max-w-xs truncate">{c.canonical_smiles}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">
                          {typeof c.eads_tin_ev === 'number' ? `${c.eads_tin_ev.toFixed(2)} eV` : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {typeof c.eads_al2o3_ev === 'number' ? `${c.eads_al2o3_ev.toFixed(2)} eV` : '未安裝或未執行'}
                        </td>
                        <td className="px-3 py-2 font-semibold text-indigo-900">
                          {typeof c.delta_eads_ev === 'number' ? `${c.delta_eads_ev.toFixed(3)} eV` : '無可用結果'}
                        </td>
                        <td className="px-3 py-2 text-amber-700">{statusZh(c.al2o3_status)}</td>
                        <td className="px-3 py-2 text-slate-800">{statusZh(c.selectivity_preference)}</td>
                        <td className="px-3 py-2 text-slate-400">{c.created_at?.slice(0, 19).replace('T', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Materials Table */}
            <div className="bg-white border border-slate-200 overflow-hidden shadow-2xs space-y-2">
              <div className="bg-slate-100 px-4 py-2.5 font-semibold text-xs text-slate-800 border-b border-slate-200 flex items-center justify-between">
                <span>不重複材料紀錄（{historyData.materials?.length || 0})</span>
                <span className="text-[11px] font-mono text-slate-500">材料紀錄（依 InChIKey 去除重複）</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="px-3 py-2">識別碼</th>
                      <th className="px-3 py-2">分子式</th>
                      <th className="px-3 py-2">MW (g/mol)</th>
                      <th className="px-3 py-2">InChIKey</th>
                      <th className="px-3 py-2">標準 SMILES</th>
                      <th className="px-3 py-2">建立時間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {historyData.materials?.map((m: any) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400">#{m.id}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900 font-sans">{m.formula}</td>
                        <td className="px-3 py-2 text-slate-700">{m.molecular_weight}</td>
                        <td className="px-3 py-2 text-slate-600">{m.inchikey}</td>
                        <td className="px-3 py-2 text-slate-700 max-w-sm truncate">{m.canonical_smiles}</td>
                        <td className="px-3 py-2 text-slate-400">{m.created_at?.slice(0, 19).replace('T', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Regression & Acceptance Tests (Section 10) */}
        {activeTab === 'tests' && (
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 p-5 space-y-3 shadow-2xs flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  原始模型回歸與驗收測試
                </h2>
                <p className="text-xs text-slate-500">
                  執行原始與整合模型、分子身分、3D 及 Python 回歸；瀏覽器驗收證據另存於報告。
                </p>
              </div>

              <button
                type="button"
                onClick={runRegressionTests}
                disabled={isTesting}
                className="px-4 py-2 text-xs font-semibold bg-cyan-700 text-white hover:bg-cyan-800 disabled:opacity-40 flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isTesting ? '測試執行中…' : '執行原始模型回歸測試'}</span>
              </button>
            </div>

            {testResults && (
              <div className="space-y-4">
                <div
                  className={`p-4 border font-semibold text-xs flex items-center justify-between ${
                    testResults.all_passed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResults.all_passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                    )}
                    <span>
                      {testResults.all_passed
                        ? '所有列出的模型檢查均通過'
                        : '部分測試未通過'}
                    </span>
                  </div>
                  <span className="font-mono text-[11px]">{testResults.timestamp}</span>
                </div>

                <div className="bg-white border border-slate-200 divide-y divide-slate-100 shadow-2xs">
                  {testResults.tests?.map((t: any) => (
                    <div key={t.id} className="p-3.5 flex items-start justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              t.pass ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <span>{uiText(t.name)}</span>
                        </div>
                        {t.details && (
                          <pre className="text-[11px] font-mono bg-slate-50 p-2 border border-slate-200 text-slate-700 max-w-3xl overflow-x-auto">
                            {JSON.stringify(t.details, null, 2)}
                          </pre>
                        )}
                        {t.error && (
                          <div className="text-rose-700 text-[11px] font-semibold">{reasonZh(t.error)}</div>
                        )}
                      </div>

                      <span
                        className={`px-2.5 py-1 text-[11px] font-bold font-mono ${
                          t.pass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {t.pass ? '通過' : '未通過'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}




