import {spawnSync} from 'node:child_process';
const r=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir',process.env.PUBLIC_DIST_DIR||'dist-public'],{stdio:'inherit',env:{...process.env,VITE_PUBLIC_MODE:'true'}});process.exit(r.status??1);
