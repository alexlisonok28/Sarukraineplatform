import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, FileText } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { auth } from '../utils/auth';

type DogDocument = { id:string; dogId:string; documentType:'pedigree'|'attestation'; category?:string|null; fileId:string; fileName:string; isChecked:boolean; checkedAt?:string|null; checkedByName?:string|null; checkedByEmail?:string|null; };
type Props = { dogId:string; showToast:(message:string,type?:'success'|'error'|'info')=>void; };
const documentLabel=(document:DogDocument)=>document.documentType==='pedigree'?'Родовід':`Атестація ${document.category||''}`;

export default function DogDocumentsReviewPanel({dogId,showToast}:Props){
 const [documents,setDocuments]=useState<DogDocument[]>([]); const [loading,setLoading]=useState(true); const [checkingId,setCheckingId]=useState<string|null>(null); const [openingId,setOpeningId]=useState<string|null>(null);
 const loadDocuments=async()=>{try{setLoading(true);setDocuments(await apiRequest(`/dogs/${dogId}/documents`));}catch(e){console.error(e);setDocuments([]);}finally{setLoading(false);}};
 useEffect(()=>{loadDocuments();},[dogId]);
 const openDocument=async(document:DogDocument)=>{if(openingId)return;const previewWindow=window.open('','_blank');if(!previewWindow){showToast('Браузер заблокував відкриття документа. Дозвольте спливаючі вікна для цього сайту.','error');return;}try{setOpeningId(document.id);previewWindow.document.title=document.fileName||'Документ';previewWindow.document.body.innerHTML='<p style="font-family:sans-serif;padding:24px">Завантаження документа...</p>';const{data:{session}}=await auth.getSession();const baseUrl=(import.meta.env.VITE_API_URL||'/api').replace(/\/$/,'');const response=await fetch(`${baseUrl}/files/${document.fileId}`,{headers:{Authorization:`Bearer ${session?.access_token||''}`}});if(!response.ok)throw new Error('Не вдалося відкрити документ');const blob=await response.blob();const url=URL.createObjectURL(blob);previewWindow.location.replace(url);window.setTimeout(()=>URL.revokeObjectURL(url),5*60_000);}catch(error:any){try{previewWindow.close();}catch{}showToast(error?.message||'Помилка відкриття документа','error');}finally{setOpeningId(null);}};
 const verifyDocument=async(document:DogDocument)=>{if(document.isChecked||checkingId)return;setCheckingId(document.id);try{const checked=await apiRequest(`/dogs/${dogId}/documents/${document.id}/verify`,'POST',{});setDocuments(current=>current.map(item=>item.id===document.id?{...item,...checked}:item));showToast('Документ підтверджено','success');}catch(error:any){if(String(error?.message||'').includes('already checked')){await loadDocuments();showToast('Документ уже був підтверджений','info');}else showToast(error?.message||'Помилка підтвердження документа','error');}finally{setCheckingId(null);}};
 if(loading)return <p className="text-base text-gray-500 py-4">Завантаження документів...</p>;
 if(documents.length===0)return <p className="text-base text-gray-500 py-4">Документів собаки немає</p>;
 return <div className="divide-y divide-gray-200 border-t border-gray-200">
  {documents.map(document=><div key={document.id} className="py-4">
   <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
    <div className="min-w-0"><div className="flex items-center gap-2 text-base font-medium text-gray-900"><FileText className="w-4 h-4 text-[#007AFF] shrink-0"/><span>{documentLabel(document)}</span></div><p className="text-sm text-gray-500 mt-1 break-all">{document.fileName}</p>{document.isChecked&&<p className="text-sm text-gray-500 mt-1">{document.checkedByName||document.checkedByEmail?`Перевірив: ${document.checkedByName||document.checkedByEmail}`:'Перевірено'}{document.checkedAt?` · ${new Date(document.checkedAt).toLocaleDateString('uk-UA')}`:''}</p>}</div>
    <span className={`shrink-0 inline-flex self-start items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${document.isChecked?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{document.isChecked&&<CheckCircle2 className="w-4 h-4"/>}{document.isChecked?'Підтверджено':'Не перевірено'}</span>
   </div>
   <div className="flex flex-wrap items-center gap-2 mt-3">
    <button type="button" disabled={openingId!==null} onClick={()=>openDocument(document)} className="inline-flex items-center gap-2 px-4 py-2 border border-[#007AFF] rounded-lg text-sm text-[#007AFF] hover:bg-blue-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-wait"><Eye className="w-4 h-4"/>{openingId===document.id?'Відкриття...':'Переглянути'}</button>
    {!document.isChecked&&<button type="button" disabled={checkingId!==null} onClick={()=>verifyDocument(document)} className="inline-flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-lg text-sm transition-all duration-300 disabled:opacity-50"><CheckCircle2 className="w-4 h-4"/>{checkingId===document.id?'Підтвердження...':'Підтвердити'}</button>}
   </div>
  </div>)}
 </div>;
}
