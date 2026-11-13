const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');for(const file of fs.readdirSync(__dirname).filter(n=>/^test-.*\.cjs$/.test(n)).sort())execFileSync(process.execPath,[path.join(__dirname,file)],{cwd:root,stdio:'inherit'});
