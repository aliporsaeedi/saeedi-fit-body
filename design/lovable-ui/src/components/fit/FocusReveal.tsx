import {createElement,Fragment,useEffect,useRef,type CSSProperties,type ElementType,type ReactNode} from 'react';

/**
 * Focus Reveal — lightweight blur-to-sharp reveal (CSS + one shared IntersectionObserver).
 * CSS lives in ../../focus-reveal.css. Nothing is hidden unless initFocusReveal() ran.
 */
const html=()=>document.documentElement;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||html().dataset.reduceMotion==='true';
let shared:IntersectionObserver|null=null;

function play(el:Element){
  if(el.classList.contains('fr-on'))return;
  el.classList.add('fr-on');
  const n=el.classList.contains('fr-stagger')||el.classList.contains('fr-words')?el.children.length:1;
  window.setTimeout(()=>el.classList.add('fr-done'),1500+n*90); // release will-change after the last item
}
function reset(el:Element){el.classList.remove('fr-on','fr-done');}
function observer(){
  if(shared)return shared;
  shared=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){play(e.target);shared?.unobserve(e.target);}}),{threshold:.12,rootMargin:'0px 0px -6% 0px'});
  return shared;
}

/** Call once at startup (entry.tsx). Does nothing for reduced-motion users or old browsers. */
export function initFocusReveal(){
  try{if(reduced()||typeof IntersectionObserver==='undefined')return;html().classList.add('fr-js');}catch{/* progressive enhancement */}
}

/** Attach to any element that already has class "fr", "fr-stagger" or "fr-words".
 *  immediate: play right after mount (splash / above the fold). when: replay each time it turns true (milestones). */
export function useFocusReveal<T extends HTMLElement>({immediate=false,when=true}:{immediate?:boolean;when?:boolean}={}){
  const ref=useRef<T>(null);
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    if(!when){reset(el);return;}
    if(!html().classList.contains('fr-js')||typeof IntersectionObserver==='undefined'){play(el);return;}
    if(immediate){let second=0;const id=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>play(el));});return()=>{cancelAnimationFrame(id);cancelAnimationFrame(second);};}
    const o=observer();o.observe(el);return()=>o.unobserve(el);
  },[immediate,when]);
  return ref;
}

type Variant='focus'|'depth'|'soft'|'lite'|'pull';
type RevealProps={as?:ElementType;variant?:Variant;delay?:number;index?:number;slow?:boolean;fast?:boolean;stagger?:boolean;immediate?:boolean;when?:boolean;milestone?:boolean;className?:string;style?:CSSProperties;children?:ReactNode}&Record<string,unknown>;

/** <Reveal> single item, or <Reveal stagger> group whose direct children reveal one after another. */
export function Reveal({as='div',variant='focus',delay,index,slow,fast,stagger,immediate,when,milestone,className,style,children,...rest}:RevealProps){
  const ref=useFocusReveal<HTMLElement>({immediate,when});
  const cls=[stagger?'fr-stagger':'fr','fr-'+variant,slow&&'fr-slow',fast&&'fr-fast',milestone&&'fr-milestone',className].filter(Boolean).join(' ');
  const st={...style,...(delay!=null?{'--fr-delay':delay+'ms'}:null),...(index!=null?{'--fr-i':index}:null)} as CSSProperties;
  return createElement(as,{...rest,ref,className:cls,style:st},children);
}

/** Headline revealed word by word. Splits by words only (never letters) so Persian stays joined. */
export function FocusText({as='h2',text,className,delay,immediate}:{as?:ElementType;text:string;className?:string;delay?:number;immediate?:boolean}){
  const ref=useFocusReveal<HTMLElement>({immediate});
  const words=text.split(/\s+/).filter(Boolean);
  return createElement(as,{ref,className:['fr-words',className].filter(Boolean).join(' '),'aria-label':text,style:delay!=null?({'--fr-delay':delay+'ms'} as CSSProperties):undefined},
    words.map((w,i)=><Fragment key={i}><span className="fr-w" aria-hidden style={{'--fr-i':i} as CSSProperties}>{w}</span>{i<words.length-1?' ':null}</Fragment>));
}
