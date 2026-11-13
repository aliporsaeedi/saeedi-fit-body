import {jsx as reactJsx,jsxs as reactJsxs,Fragment} from 'react/jsx-runtime';
export {Fragment};
export function latinDisplay(value:unknown):unknown{
  if(typeof value==='string')return value.replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c.charCodeAt(0)>=1776?1776:1632)));
  if(Array.isArray(value))return value.map(latinDisplay);
  return value;
}
function props(p:any){return p && 'children' in p?{...p,children:latinDisplay(p.children)}:p;}
export const jsx=(type:any,p:any,key?:any)=>reactJsx(type,props(p),key);
export const jsxs=(type:any,p:any,key?:any)=>reactJsxs(type,props(p),key);
