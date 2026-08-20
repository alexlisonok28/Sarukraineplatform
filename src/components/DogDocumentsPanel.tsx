import { useEffect, useState } from 'react';
import { Download, FileText, Plus, Trash2, Upload, X } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { auth } from '../utils/auth';
import { NativeSelect } from './ui/native-select';

type DogDocument = {
  id: string;
  dogId: string;
  documentType: 'pedigree' | 'attestation';
  category?: string | null;
  fileId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
};

type Props = {
  dogId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

const ATTestationCategories = [
  'RH-FL-V', 'RH-FL-A', 'RH-FL-B',
  'RH-T-V', 'RH-T-A', 'RH-T-B',
  'RH-F-V', 'RH-F-A', 'RH-F-B',
];

const documentLabel = (document: DogDocument) =>
  document.documentType === 'pedigree' ? 'Родовід' : `Атестація ${document.category || ''}`;

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export default function DogDocumentsPanel({ dogId, showToast }: Props) {
  const [documents, setDocuments] = useState<DogDocument[]>([]);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState<'pedigree' | 'attestation'>('pedigree');
  const [category, setCategory] = useState('RH-FL-V');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');

  const loadDocuments = async () => {
    try {
      setDocuments(await apiRequest(`/dogs/${dogId}/documents`));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [dogId]);

  const resetForm = () => {
    setAdding(false);
    setDocumentType('pedigree');
    setCategory('RH-FL-V');
    setFile(null);
    setFileError('');
  };

  const chooseFile = (selected: File | null) => {
    setFileError('');
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > 1024 * 1024) {
      setFile(null);
      setFileError('Максимальний розмір файлу — 1 МБ');
      return;
    }
    setFile(selected);
  };

  const uploadDocument = async () => {
    if (!file) {
      setFileError('Оберіть файл');
      return;
    }

    setUploading(true);
    try {
      const content = await fileToBase64(file);
      const created = await apiRequest(`/dogs/${dogId}/documents`, 'POST', {
        documentType,
        category: documentType === 'attestation' ? category : null,
        name: file.name,
        contentType: file.type || 'application/octet-stream',
        content,
      });
      setDocuments(current => [created, ...current]);
      showToast('Документ додано', 'success');
      resetForm();
    } catch (error: any) {
      showToast(error?.message || 'Помилка завантаження документа', 'error');
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (document: DogDocument) => {
    if (!confirm(`Видалити документ «${documentLabel(document)}»?`)) return;
    try {
      await apiRequest(`/dogs/${dogId}/documents/${document.id}`, 'DELETE');
      setDocuments(current => current.filter(item => item.id !== document.id));
      showToast('Документ видалено', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Помилка видалення документа', 'error');
    }
  };

  const downloadDocument = async (document: DogDocument) => {
    try {
      const { data: { session } } = await auth.getSession();
      const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/files/${document.fileId}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!response.ok) throw new Error('Не вдалося завантажити файл');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.fileName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      showToast(error?.message || 'Помилка завантаження файла', 'error');
    }
  };

  return (
    <div className="mt-5 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-gray-900 font-semibold text-base">
          <FileText className="w-4 h-4 text-[#007AFF]" />
          Документи
          {documents.length > 0 && <span className="text-sm font-normal text-gray-500">({documents.length})</span>}
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-sm text-[#007AFF] hover:text-[#0066CC] font-medium"
          >
            <Plus className="w-4 h-4" /> Додати
          </button>
        )}
      </div>

      {documents.length === 0 && !adding && (
        <p className="text-sm text-gray-500 mb-1">Документів ще немає</p>
      )}

      {documents.length > 0 && (
        <div className="space-y-2 mb-3">
          {documents.map(document => (
            <div key={document.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <div className="text-sm font-medium text-gray-900 break-words">{documentLabel(document)}</div>
              <div className="text-xs text-gray-500 break-all mt-0.5">{document.fileName}</div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => downloadDocument(document)}
                  className="inline-flex items-center gap-1 text-xs text-[#007AFF] hover:text-[#0066CC]"
                >
                  <Download className="w-3.5 h-3.5" /> Завантажити
                </button>
                <button
                  type="button"
                  onClick={() => deleteDocument(document)}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Видалити
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">Новий документ</span>
            <button type="button" onClick={resetForm} disabled={uploading} className="text-gray-500 hover:text-gray-800">
              <X className="w-4 h-4" />
            </button>
          </div>

          <NativeSelect value={documentType} onChange={(e) => setDocumentType(e.target.value as 'pedigree' | 'attestation')}>
            <option value="pedigree">Родовід</option>
            <option value="attestation">Атестація</option>
          </NativeSelect>

          {documentType === 'attestation' && (
            <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)}>
              {ATTestationCategories.map(item => <option key={item} value={item}>Атестація {item}</option>)}
            </NativeSelect>
          )}

          <div>
            <label className="flex items-center justify-center gap-2 w-full min-h-11 px-3 py-2 bg-white border border-dashed border-gray-300 rounded-lg cursor-pointer text-sm text-gray-600 hover:border-[#007AFF] hover:text-[#007AFF]">
              <Upload className="w-4 h-4" />
              <span className="truncate">{file ? file.name : 'Оберіть файл до 1 МБ'}</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  chooseFile(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
            </label>
            {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
          </div>

          <button
            type="button"
            onClick={uploadDocument}
            disabled={uploading || !file}
            className="w-full min-h-10 rounded-lg bg-[#007AFF] hover:bg-[#0066CC] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Завантаження...' : 'Додати документ'}
          </button>
        </div>
      )}
    </div>
  );
}
