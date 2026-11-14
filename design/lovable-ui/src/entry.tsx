import {locale} from './lib/fit/locale';
import {isDemo} from './lib/fit/demo';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { FitApp } from './components/fit/FitApp';
import {applyStoredTheme} from './components/fit/Themes';
import {ErrorBoundary,reportError} from './ErrorBoundary';
applyStoredTheme();document.documentElement.lang=locale();document.documentElement.dir=locale()==='en'?'ltr':'rtl';
if(!isDemo()&&'serviceWorker' in navigator && window.isSecureContext && !window.google?.script?.run){window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sfb-worker.js',{scope:'/'}).catch(()=>{/* Offline download UI reports whether the worker is ready. */});});}
window.addEventListener('error',e=>reportError(e.error||e.message));
window.addEventListener('unhandledrejection',e=>reportError(e.reason,'promise'));
const client=new QueryClient({defaultOptions:{queries:{refetchOnWindowFocus:true,retry:1}}});
createRoot(document.getElementById('lovable-root')!).render(<ErrorBoundary><QueryClientProvider client={client}><FitApp/><Toaster position="top-center" dir="rtl" theme="dark" richColors closeButton={false}/></QueryClientProvider></ErrorBoundary>);
