import {useMemo} from 'react';
import {avatarSvg} from '@/lib/fit/avatar-renderer';
import {useEffect,useState} from 'react';
import {UserRound} from 'lucide-react';
import {cn} from '@/lib/utils';
export function Avatar({url,name,className,design}:{url?:string;name:string;className?:string;design?:Record<string,unknown>|null}){const [failed,setFailed]=useState(false);const markup=useMemo(()=>design?avatarSvg(design,{crop:'head'}):'', [design]);useEffect(()=>setFailed(false),[url]);return <span className={cn('sfx-avatar',className)}>{markup?<span className="sf-avatar-illustration" dangerouslySetInnerHTML={{__html:markup}}/>:url&&!failed?<img src={url} alt={'تصویر پروفایل '+name} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<UserRound aria-label="پروفایل شخصی" className="size-6"/>}</span>;}
