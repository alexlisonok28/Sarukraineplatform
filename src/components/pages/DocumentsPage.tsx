import { useState, useEffect } from 'react';
import { FileText, Upload, Trash2, Download, Eye, EyeOff, X, Plus, Edit2, Calendar } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { UserProfile } from '../../types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

type DocumentsPageProps = {
  userProfile?: UserProfile | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

type Document = {
  id: string;
  name: string;
  url?: string;
  filePath?: string;
  fileName?: string;
  date: string;
  description?: string;
  title?: string;
  category?: string;
  uploadedAt?: string;
};

export default function DocumentsPage({ userProfile, showToast }: DocumentsPageProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    title: ''
  });

  useEffect(() => {
    // Only fetch documents if component is mounted
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const data = await apiRequest('/documents');
      setDocuments(data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  useEffect(() => {
    if (editingDocument) {
      setFormData({
        name: editingDocument.name || '',
        description: editingDocument.description || '',
        category: editingDocument.category || '',
        title: editingDocument.title || ''
      });
      setSelectedFile(null);
    } else {
      setFormData({
        name: '',
        description: '',
        category: '',
        title: ''
      });
      setSelectedFile(null);
    }
  }, [editingDocument, isModalOpen]);

  const handleDelete = async (id: string) => {
      if(!confirm('Видалити документ?')) return;
      try {
          await apiRequest(`/documents/${id}`, 'DELETE');
          setDocuments(documents.filter(d => d.id !== id));
          showToast('Документ видалено', 'success');
      } catch(e) {
          showToast('Помилка видалення', 'error');
      }
  };

  const openAddModal = () => {
      setEditingDocument(null);
      setIsModalOpen(true);
  };

  const openEditModal = (doc: Document) => {
      setEditingDocument(doc);
      setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!formData.title.trim()) {
          showToast('Заповніть обов\'язкові поля: Назва', 'error');
          return;
      }

      if (!editingDocument && !selectedFile) {
          showToast('Оберіть файл для завантаження', 'error');
          return;
      }

      setIsUploading(true);

      try {
          let filePath = '';
          let fileName = '';

          // Upload file first if new document
          if (!editingDocument && selectedFile) {
              const content = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result).split(',')[1]);
                  reader.onerror = () => reject(reader.error);
                  reader.readAsDataURL(selectedFile);
              });
              const uploadData = await apiRequest('/files', 'POST', {
                  name: selectedFile.name,
                  contentType: selectedFile.type || 'application/octet-stream',
                  content,
              });
              filePath = uploadData.id;
              fileName = uploadData.fileName;
              console.log('File uploaded successfully:', { filePath, fileName });
          }

          if (editingDocument) {
              // Update existing document metadata only
              const updatedDoc = await apiRequest(`/documents/${editingDocument.id}`, 'PUT', formData);
              setDocuments(documents.map(d => d.id === editingDocument.id ? updatedDoc : d));
              showToast('Документ оновлено', 'success');
          } else {
              // Create new document with file path
              const documentData = { 
                  ...formData,
                  filePath,
                  fileName,
                  date: new Date().toLocaleDateString('uk-UA') 
              };
              console.log('Creating document with data:', documentData);
              const newDoc = await apiRequest('/documents', 'POST', documentData);
              console.log('Document created:', newDoc);
              setDocuments([...documents, newDoc]);
              showToast('Документ додано', 'success');
          }
          
          setIsModalOpen(false);
          setSelectedFile(null);
      } catch(e: any) {
           console.error('Upload error:', e);
           showToast(e.message || 'Помилка збереження', 'error');
      } finally {
          setIsUploading(false);
      }
  };

  const handleDownload = async (docId: string) => {
      try {
          const response = await apiRequest(`/documents/${docId}/download`);
          if (response.url) {
              window.open(response.url, '_blank');
          } else {
              showToast('Не вдалося отримати посилання', 'error');
          }
      } catch (e) {
          console.error('Download error:', e);
          showToast('Помилка завантаження', 'error');
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setSelectedFile(e.target.files[0]);

          // The File object is already stored in React state, so the native input can be cleared.
          // This is important because it lets the user delete a file and then choose that same file again.
          e.target.value = '';
      }
  };

  const isAdmin = userProfile?.role === 'admin';

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-[60px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 sm:mb-12 gap-4">
        <div>
          <h1 className="text-4xl md:text-[48px] mb-2 text-gray-900 font-semibold">
            Документи
          </h1>
          <p className="text-base sm:text-lg text-gray-600">Регламенти, положення та інші офіційні документи</p>
        </div>
        {userProfile?.role === 'admin' && (
          <Button onClick={openAddModal} className="w-full sm:w-auto px-6 py-3 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl gap-2 h-auto text-[16px] font-bold font-normal">
            <Plus size={20} /> Завантажити документ
          </Button>
        )}
      </div>
      
      {documents.length === 0 ? (
        <div className="bg-white shadow-sm rounded-[20px] p-[100px_40px] text-center">
            <FileText className="w-16 h-16 mx-auto mb-5 opacity-50 text-gray-400" />
            <p className="text-lg text-gray-500">Немає доданих документів</p>
        </div>
      ) : (
        <div className="grid gap-4">
            {documents.map(doc => (
              <div
                key={doc.id}
                className="bg-white shadow-sm rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all duration-300 hover:shadow-lg"
              >
                  <div className="flex items-start gap-4 flex-1">
                      <div className="flex-1">
                          <h3 className="text-[18px] md:text-[20px] text-gray-900 mb-2 font-semibold">{doc.title}</h3>
                          {doc.description && (
                              <p className="text-base text-gray-600 mb-3 leading-relaxed">{doc.description}</p>
                          )}
                          <div className="flex flex-wrap gap-3 text-base">
                              <span className="bg-blue-100 px-3 py-1 rounded-lg text-blue-700">
                                  {doc.category}
                              </span>
                              <span className="flex items-center gap-1.5 text-gray-500">
                                  <Calendar size={16} />
                                  {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('uk-UA') : doc.date}
                              </span>
                          </div>
                      </div>
                  </div>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                      <button
                          onClick={() => handleDownload(doc.id)}
                          className="flex-1 md:flex-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 border-none rounded-xl cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 text-base"
                      >
                          <Download size={18} /> Завантажити
                      </button>
                      {userProfile?.role === 'admin' && (
                          <>
                              <button
                                  onClick={() => openEditModal(doc)}
                                  className="px-4 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 border-none rounded-xl cursor-pointer transition-all duration-300 flex items-center justify-center"
                              >
                                  <Edit2 size={18} />
                              </button>
                              <button
                                  onClick={() => handleDelete(doc.id)}
                                  className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 border-none rounded-xl cursor-pointer transition-all duration-300 flex items-center justify-center"
                              >
                                  <Trash2 size={18} />
                              </button>
                          </>
                      )}
                  </div>
              </div>
            ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white shadow-xl text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editingDocument ? 'Редагувати документ' : 'Завантажити новий документ'}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {editingDocument ? 'Оновіть дані про документ' : 'Заповніть дані про документ та завантажте файл'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-gray-900 font-medium">Назва документа</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="bg-white border-gray-300 text-gray-900 focus:border-[#007AFF]"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category" className="text-gray-900 font-medium">Категорія</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 focus:outline-none focus:border-[#007AFF] text-base cursor-pointer"
                required
              >
                <option value="">Оберіть категорію</option>
                <option value="Положення">Положення</option>
                <option value="Регламент">Регламент</option>
                <option value="Інструкція">Інструкція</option>
                <option value="Форма">Форма</option>
                <option value="Інше">Інше</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-gray-900 font-medium">Опис (опціонально)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Короткий опис документа"
                className="bg-white border-gray-300 text-gray-900 focus:border-[#007AFF]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="file" className="text-gray-900 font-medium">
                Файл {editingDocument && '(залиште порожнім, щоб не змінювати)'}
              </Label>
              <div className="relative">
                <input 
                  type="file" 
                  id="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                />

                {selectedFile ? (
                  // After selection we replace the upload prompt with a compact file row.
                  // Trash2 clears only the not-yet-uploaded file and returns the control to its initial state.
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate text-base text-gray-700" title={selectedFile.name}>
                      {selectedFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      disabled={isUploading}
                      className="shrink-0 rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Видалити файл ${selectedFile.name}`}
                      title="Видалити файл"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ) : (
                  <label 
                    htmlFor="file"
                    className="flex items-center justify-center gap-2 w-full p-4 bg-white border-2 border-dashed border-gray-300 hover:border-[#007AFF] rounded-xl cursor-pointer transition-all text-gray-700 hover:text-gray-900 text-base"
                  >
                    <Upload size={20} />
                    {editingDocument ? 'Оберіть новий файл (опціонально)' : 'Оберіть файл'}
                  </label>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsModalOpen(false)} 
              disabled={isUploading}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Скасувати
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isUploading || (!editingDocument && !selectedFile)}
              className="bg-[#007AFF] hover:bg-[#0066CC] text-white"
            >
              {isUploading ? 'Завантаження...' : editingDocument ? 'Оновити' : 'Завантажити'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}