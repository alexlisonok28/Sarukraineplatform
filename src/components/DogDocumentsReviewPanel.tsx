import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, FileText } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { auth } from '../utils/auth';

type DogDocument = {
  id: string;
  dogId: string;
  documentType: 'pedigree' | 'attestation';
  category?: string | null;
  fileId: string;
  fileName: string;
  isChecked: boolean;
  checkedAt?: string | null;
  checkedByName?: string | null;
  checkedByEmail?: string | null;
};

type Props = {
  dogId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

const documentLabel = (document: DogDocument) =>
  document.documentType === 'pedigree' ? 'Родовід' : `Атестація ${document.category || ''}`;

export default function DogDocumentsReviewPanel({ dogId, showToast }: Props) {
  const [documents, setDocuments] = useState<DogDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setDocuments(await apiRequest(`/dogs/${dogId}/documents`));
    } catch (error) {
      console.error(error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [dogId]);

  const openDocument = async (document: DogDocument) => {
    if (openingId) return;

    // Open the tab synchronously from the user's click. If window.open happens
    // after await/fetch, browsers may treat it as a popup and block it randomly.
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      showToast('Браузер заблокував відкриття документа. Дозвольте спливаючі вікна для цього сайту.', 'error');
      return;
    }

    try {
      setOpeningId(document.id);
      previewWindow.document.title = document.fileName || 'Документ';
      previewWindow.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 24px;">Завантаження документа...</p>';

      const { data: { session } } = await auth.getSession();
      const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/files/${document.fileId}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!response.ok) throw new Error('Не вдалося відкрити документ');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      previewWindow.location.replace(url);

      // Keep the object URL alive long enough for the new tab to finish loading.
      window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } catch (error: any) {
      try { previewWindow.close(); } catch {}
      showToast(error?.message || 'Помилка відкриття документа', 'error');
    } finally {
      setOpeningId(null);
    }
  };

  const verifyDocument = async (document: DogDocument) => {
    if (document.isChecked || checkingId) return;
    setCheckingId(document.id);
    try {
      const checked = await apiRequest(`/dogs/${dogId}/documents/${document.id}/verify`, 'POST', {});
      setDocuments(current => current.map(item => item.id === document.id ? { ...item, ...checked } : item));
      showToast('Документ підтверджено', 'success');
    } catch (error: any) {
      if (String(error?.message || '').includes('already checked')) {
        await loadDocuments();
        showToast('Документ уже був підтверджений', 'info');
      } else {
        showToast(error?.message || 'Помилка підтвердження документа', 'error');
      }
    } finally {
      setCheckingId(null);
    }
  };

  if (loading) return <span className="text-sm text-gray-400">Завантаження документів...</span>;
  if (documents.length === 0) return <span className="text-sm text-gray-400">Документів собаки немає</span>;

  return (
    <div className="space-y-2 min-w-[260px]">
      {documents.map(document => (
        <div key={document.id} className="rounded-lg border border-gray-200 bg-white p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                <FileText className="w-3.5 h-3.5 text-[#007AFF] shrink-0" />
                <span className="break-words">{documentLabel(document)}</span>
              </div>
              <div className="text-xs text-gray-500 break-all mt-0.5">{document.fileName}</div>
            </div>
            {document.isChecked ? (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Підтверджено
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">Не перевірено</span>
            )}
          </div>

          {document.isChecked && (
            <div className="mt-1 text-xs text-gray-500">
              {document.checkedByName || document.checkedByEmail ? `Перевірив: ${document.checkedByName || document.checkedByEmail}` : 'Перевірено'}
              {document.checkedAt ? ` · ${new Date(document.checkedAt).toLocaleDateString('uk-UA')}` : ''}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              type="button"
              disabled={openingId !== null}
              onClick={() => openDocument(document)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#007AFF] hover:text-[#0066CC] disabled:cursor-wait disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              {openingId === document.id ? 'Відкриття...' : 'Переглянути'}
            </button>
            {!document.isChecked && (
              <button
                type="button"
                disabled={checkingId !== null}
                onClick={() => verifyDocument(document)}
                className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {checkingId === document.id ? 'Підтвердження...' : 'Підтвердити'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
