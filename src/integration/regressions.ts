import {execFile} from 'node:child_process';
import fs from 'node:fs';
export async function runModelRegressions(){
 const commands:[string,string[]][]=[
  [process.execPath,['--import','tsx','validation/regression.ts']],
  [process.env.PYTHON_EXECUTABLE || (process.platform==='win32'?'python':'python3'),['validation/python_regression.py']]
 ];
 const execution:any[]=[];
 for(const [executable,args] of commands){
  const result=await new Promise<any>(resolve=>execFile(executable,args,{timeout:180000,maxBuffer:3*1024*1024,encoding:'utf8'},(error,stdout,stderr)=>resolve({error:error?.message||null,stdout,stderr})));
  execution.push(result);
 }
 const tests:any[]=[];
 for(const file of ['integration-results.json','python-results.json']){
  if(fs.existsSync('validation/'+file)){
   const report=JSON.parse(fs.readFileSync('validation/'+file,'utf8'));
   for(const test of report.tests)tests.push({id:`P0P1_${tests.length+1}`,name:test.name,pass:test.status==='PASS',details:test.detail});
  }
 }
 for(const failure of execution.filter(r=>r.error))tests.push({id:`EXEC_${tests.length}`,name:'Regression process completed',pass:false,error:failure.error});
 fs.writeFileSync('validation/latest-ui-regression-execution.json',JSON.stringify(execution,null,2));
 return {timestamp:new Date().toISOString(),all_passed:tests.length>0&&tests.every(t=>t.pass),tests,note:'Live model/Python checks. Browser acceptance evidence is documented separately.'};
}
