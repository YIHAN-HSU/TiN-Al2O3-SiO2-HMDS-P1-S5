import path from 'node:path';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
export const S4_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export function localPath(...parts:string[]){const result=path.resolve(S4_ROOT,...parts);if(!result.startsWith(S4_ROOT+path.sep))throw new Error('S4_PATH_ESCAPE');return result;}
export function assertIsolation(){
 if(path.resolve(process.cwd())!==S4_ROOT)throw new Error('S4_REQUIRES_OWN_PROJECT_WORKING_DIRECTORY');
 if(!fs.existsSync(localPath('validation/s4/isolation.json')))throw new Error('S4_COPY_VERIFICATION_MISSING');
 for(const name of ['data','advanced/data','dft/s4/jobs','cache']){const p=localPath(name);fs.mkdirSync(p,{recursive:true});if(!fs.realpathSync(p).startsWith(fs.realpathSync(S4_ROOT)+path.sep))throw new Error('S4_SHARED_WRITABLE_PATH');}
}
