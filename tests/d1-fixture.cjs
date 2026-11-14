const {DatabaseSync}=require('node:sqlite');
function database(){
  const sql=new DatabaseSync(':memory:');
  const db={sql,prepare(query){let values=[];const stmt=sql.prepare(query);const runSync=()=>{const r=stmt.run(...values);return{success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};};const api={bind(...args){values=args;return api;},async first(){return stmt.get(...values)||null;},async all(){return{results:stmt.all(...values)};},async run(){return runSync();},runSync};return api;},async batch(statements){sql.exec('BEGIN');try{const output=[];for(const stmt of statements)output.push(stmt.runSync());sql.exec('COMMIT');return output;}catch(e){sql.exec('ROLLBACK');throw e;}}};
  return db;
}
module.exports={database};
