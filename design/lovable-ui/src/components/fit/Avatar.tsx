import {useEffect,useState} from 'react';
import {UserRound} from 'lucide-react';
import {cn} from '@/lib/utils';
export function Avatar({url,name,className}:{url?:string;name:string;className?:string}){const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[url]);return <span className={cn('sfx-avatar',className)}>{url&&!failed?<img src={url} alt={'تصویر پروفایل '+name} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<UserRound aria-label="پروفایل شخصی" className="size-6"/>}</span>;}
