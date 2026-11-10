/// <reference types="vite-plugin-pwa/client" />
import {useEffect,useRef,useState} from 'react';
import {useRegisterSW} from 'virtual:pwa-register/react';
export const APP_VERSION='0.3.1';
export function PwaUpdate({blocked}:{blocked:boolean}){
 const registration=useRef<ServiceWorkerRegistration | undefined>(undefined);const blockedRef=useRef(blocked);blockedRef.current=blocked;
 const [error,setError]=useState('');const [applying,setApplying]=useState(false);
 const {needRefresh:[needed],updateServiceWorker}=useRegisterSW({immediate:true,onRegisteredSW(_url,r){registration.current=r;void r?.update().catch(()=>{});},onRegisterError(){setError('Update-Prüfung derzeit nicht verfügbar.');}});
 useEffect(()=>{const check=()=>{if(!document.hidden&&navigator.onLine)void registration.current?.update().catch(()=>{});};window.addEventListener('focus',check);window.addEventListener('online',check);document.addEventListener('visibilitychange',check);return()=>{window.removeEventListener('focus',check);window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check);};},[]);
 if(!needed)return null;
 return <aside className="update-banner" role="status"><strong>Neues Update verfügbar</strong><span>{blocked?'Beende zuerst deine laufende Runde. Dein Fortschritt bleibt erhalten.':'Bereit für die neueste Version?'}</span><button className="button" disabled={blocked||applying} onClick={async()=>{if(blockedRef.current)return;setApplying(true);try{await updateServiceWorker(true);}catch{setError('Aktualisierung fehlgeschlagen. Bitte später erneut versuchen.');setApplying(false);}}}>Jetzt aktualisieren</button>{error&&<small>{error}</small>}</aside>;
}
