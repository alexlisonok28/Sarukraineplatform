import { useState, useEffect } from 'react';
import { Trophy, Plus, Calendar, MapPin, Users, Edit, Trash2, Settings, AlertTriangle, Upload, X } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { Competition, UserProfile, Dog } from '../../types';
import CompetitionModal from '../CompetitionModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

type CompetitionsPageProps = {
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
  showToast: (msg: string, type: any) => void;
};

// Helper function to get status label and color
const getStatusConfig = (status: string) => {
  const configs: Record<string, { label: string; color: string }> = {
    'planned': { label: 'Реєстрація скоро відкриється', color: 'bg-gray-100 text-gray-700' },
    'registration_open': { label: 'Йде реєстрація', color: 'bg-green-100 text-green-700' },
    'registration_closed': { label: 'Реєстрація завершена', color: 'bg-yellow-100 text-yellow-700' },
    'completed': { label: 'Завершені', color: 'bg-purple-100 text-purple-700' },
  };
  return configs[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
};

export default function CompetitionsPage({ isLoggedIn, userProfile, showToast, onPageChange }: CompetitionsPageProps & { onPageChange: (page: any, param?: string) => void }) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [selectedCompForEdit, setSelectedCompForEdit] = useState<Competition | undefined>(undefined);
  const [userDogs, setUserDogs] = useState<Dog[]>([]);
  const [selectedDogId, setSelectedDogId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [handlerName, setHandlerName] = useState('');
  const [registerFiles, setRegisterFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [compToDelete, setCompToDelete] = useState<string | null>(null);

  const isOrganizer = userProfile?.role === 'organizer' || userProfile?.role === 'admin';

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async () => {
    try {
      const data = await apiRequest('/competitions');
      setCompetitions(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      if (selectedCompForEdit) {
         const updatedComp = await apiRequest(`/competitions/${selectedCompForEdit.id}`, 'PUT', data);
         setCompetitions(competitions.map(c => c.id === updatedComp.id ? updatedComp : c));
         showToast('Змагання оновлено!', 'success');
      } else {
         const newComp = await apiRequest('/competitions', 'POST', data);
         setCompetitions([...competitions, newComp]);
         showToast('Змагання створено!', 'success');
      }
      setIsModalOpen(false);
      setSelectedCompForEdit(undefined);
    } catch (e) {
      showToast('Помилка збереження', 'error');
    }
  };

  const handleDeleteClick = (id: string) => {
      setCompToDelete(id);
      setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
      if (!compToDelete) return;
      try {
          await apiRequest(`/competitions/${compToDelete}`, 'DELETE');
          setCompetitions(competitions.filter(c => c.id !== compToDelete));
          showToast('Змагання видалено', 'success');
      } catch (e) {
          showToast('Помиа видалення', 'error');
      } finally {
          setDeleteConfirmOpen(false);
          setCompToDelete(null);
      }
  };

  const handleStatusChange = async (compId: string, newStatus: string) => {
      try {
          await apiRequest(`/competitions/${compId}`, 'PUT', { status: newStatus });
          setCompetitions(competitions.map(c => c.id === compId ? { ...c, status: newStatus } : c));
          showToast('Статус оновлено', 'success');
      } catch (e) {
          showToast('Помилка зміни статусу', 'error');
      }
  };

  const openRegister = async (compId: string) => {
      if (!isLoggedIn) {
          showToast('Спочатку увійдіть', 'info');
          return;
      }
      if (userProfile?.role === 'organizer') return;

      setSelectedCompId(compId);
      try {
          const dogs = await apiRequest('/dogs');
          setUserDogs(dogs);
          if (dogs.length === 0) {
              showToast('Додайте собаку в кабінеті перед реєстрацією', 'info');
          } else {
              setRegisterModalOpen(true);
              setSelectedDogId(dogs[0].id);
              setSelectedCategory('');
              setHandlerName('');
              setRegisterFiles([]);
          }
      } catch (e) {
          showToast('Помилка отримання даних', 'error');
      }
  };

  const handleRegister = async () => {
      if (!selectedCategory) {
          showToast('Оберіть клас участі', 'error');
          return;
      }

      setUploading(true);
      try {
          const uploadedDocs: string[] = [];
          
          if (registerFiles.length > 0) {
              for (const file of registerFiles) {
                  const content = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(String(reader.result).split(',')[1]);
                      reader.onerror = () => reject(reader.error);
                      reader.readAsDataURL(file);
                  });
                  const data = await apiRequest('/files', 'POST', {
                      name: file.name,
                      contentType: file.type || 'application/octet-stream',
                      content,
                  });
                  uploadedDocs.push(data.id);
              }
          }

          await apiRequest(`/competitions/${selectedCompId}/register`, 'POST', { 
              dogId: selectedDogId,
              category: selectedCategory,
              handlerName: handlerName.trim() || undefined,
              documents: uploadedDocs
          });
          
          showToast('Ви успішно зареєструвалися!', 'success');
          setRegisterModalOpen(false);
          fetchCompetitions();
      } catch (e: any) {
          showToast(e.message || 'Помилка реєстрації', 'error');
      } finally {
          setUploading(false);
      }
  };
  
  const formatDate = (dateString?: string, endDateString?: string) => {
      if (!dateString) return 'Дата не визначена';
      const start = new Date(dateString).toLocaleDateString('uk-UA');
      if (endDateString) {
          const end = new Date(endDateString).toLocaleDateString('uk-UA');
          return `${start} - ${end}`;
      }
      return start;
  };

  const openEdit = (comp: Competition) => {
      setSelectedCompForEdit(comp);
      setIsModalOpen(true);
  };

  const openManage = (comp: Competition) => {
      onPageChange('manage-competition', comp.id);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-[60px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 sm:mb-12 gap-4">
        <div>
            <h1 className="text-4xl md:text-[48px] mb-2 text-gray-900 font-semibold">
            Змагання
            </h1>
            <p className="text-base sm:text-lg text-gray-600">Майбутні змагання з пошуково-рятувальної кінології</p>
        </div>
        {isOrganizer && (
            <button 
                onClick={() => {
                    setSelectedCompForEdit(undefined);
                    setIsModalOpen(true);
                }}
                className="w-full sm:w-auto px-6 py-3 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl cursor-pointer transition-all duration-300 flex items-center justify-center gap-2"
            >
                <Plus size={20} /> Створити змагання
            </button>
        )}
      </div>

      {competitions.length === 0 ? (
        <div className="bg-white shadow-sm rounded-[20px] p-10 sm:p-16 md:p-[100px_40px] text-center">
            <Trophy className="w-16 h-16 mx-auto mb-5 opacity-50 text-gray-400" />
            <p className="text-lg text-gray-500">Немає запланованих змагань</p>
        </div>
      ) : (
        <div className="grid gap-6">
            {competitions.map(comp => (
                <div key={comp.id} className="bg-white shadow-sm rounded-2xl p-4 sm:p-6 transition-all duration-300 hover:shadow-lg flex flex-col md:flex-row gap-6 overflow-hidden">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-2">
                             <h3 className="text-xl md:text-2xl text-gray-900 font-semibold break-words">{comp.name}</h3>
                             {comp.organizerName && <Badge variant="outline" className="text-gray-600 border-gray-300 text-[16px] shrink-0">{comp.organizerName}</Badge>}
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-gray-700 text-base mb-4">
                            <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 text-sm sm:text-base">
                                <Calendar size={18} className="text-[#007AFF] shrink-0" /> 
                                <span className="truncate text-[16px]">{formatDate(comp.startDate || comp.date, comp.endDate)}</span>
                            </span>
                            <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 text-sm sm:text-base">
                                <MapPin size={18} className="text-[#007AFF] shrink-0" /> 
                                <span className="truncate text-[16px] min-w-0">{comp.location}</span>
                            </span>
                            <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 text-sm sm:text-base shrink-0 text-[16px]">
                                <Users size={18} className="text-[#007AFF]" /> {comp.participants?.length || 0} / {comp.maxParticipants}
                            </span>
                        </div>

                        {comp.judges && comp.judges.length > 0 && (
                            <div className="text-base text-gray-600 mb-4 break-words">
                                <span className="font-semibold text-gray-700">Судді:</span> {comp.judges.join(', ')}
                            </div>
                        )}
                        
                        <div className="mb-4">
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base break-words">{comp.description}</p>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-2">
                             <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none px-3 py-1 text-sm font-normal text-[16px]">
                                 Рівень: {comp.level}
                             </Badge>
                             {comp.categories && comp.categories.map((cat, idx) => (
                                 <Badge key={idx} variant="outline" className="border-blue-300 text-blue-700 text-sm font-normal text-[16px]">
                                     {cat}
                                 </Badge>
                             ))}
                        </div>

                        {/* Status Badge */}
                        <div className="mb-3">
                            {isOrganizer && (comp.organizerId === userProfile?.id || userProfile?.role === 'admin') ? (
                                <select
                                    value={comp.status || 'planned'}
                                    onChange={(e) => handleStatusChange(comp.id, e.target.value)}
                                    className={`px-3 py-1.5 rounded-lg border-none text-sm font-medium ${getStatusConfig(comp.status || 'planned').color} cursor-pointer hover:opacity-80 transition-opacity text-[16px] max-w-full`}
                                >
                                    <option value="planned" className="bg-white">Реєстрація скоро відкриється</option>
                                    <option value="registration_open" className="bg-white">Йде реєстрація</option>
                                    <option value="registration_closed" className="bg-white">Реєстрація завершена</option>
                                    <option value="completed" className="bg-white">Завершені</option>
                                </select>
                            ) : (
                                <Badge className={`${getStatusConfig(comp.status || 'planned').color} border-none px-3 py-1.5 text-sm font-medium text-[16px]`}>
                                    {getStatusConfig(comp.status || 'planned').label}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 justify-end md:w-[220px] border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-6 shrink-0">
                         {isOrganizer && (comp.organizerId === userProfile?.id || userProfile?.role === 'admin') ? (
                             <>
                                <Button 
                                    className="w-full bg-[#007AFF] hover:bg-[#0066CC] text-white gap-2 h-11 text-base"
                                    onClick={() => openManage(comp)}
                                >
                                    <Settings size={18} /> Керувати
                                </Button>
                                <Button 
                                    variant="outline"
                                    className="w-full bg-transparent border-[#007AFF] text-[#007AFF] hover:bg-blue-50 gap-2 h-11 text-base"
                                    onClick={() => openEdit(comp)}
                                >
                                    <Edit size={18} /> Редагувати
                                </Button>
                                <Button 
                                    variant="destructive"
                                    className="w-full gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-300 h-11 text-base"
                                    onClick={() => handleDeleteClick(comp.id)}
                                >
                                    <Trash2 size={18} /> Видалити
                                </Button>
                             </>
                         ) : (
                             <>
                                {comp.status === 'registration_open' ? (
                                    userProfile?.role !== 'organizer' ? (
                                     <button 
                                        onClick={() => openRegister(comp.id)}
                                        className="w-full py-3 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl font-medium cursor-pointer transition-all duration-300 text-base"
                                     >
                                        Зареєструватися
                                     </button>
                                    ) : null
                                 ) : (
                                     <div className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl text-center border border-gray-300 font-medium text-base">
                                         Реєстрація закрита
                                     </div>
                                 )}
                             </>
                         )}
                    </div>
                </div>
            ))}
        </div>
      )}

      <CompetitionModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedCompForEdit(undefined); }}
        onSave={handleCreate}
        editingComp={selectedCompForEdit}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white border-gray-200 text-gray-900">
            <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 text-xl">
                <AlertTriangle className="w-6 h-6" />
                Видалити змагання?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-base">
                Ця дія незворотна. Це змагання та всі реєстрації будуть видалені назавжди.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel className="bg-white border-gray-300 text-gray-700 hover:bg-gray-100">Скасувати</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 text-white hover:bg-red-700 border-none">Видалити</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>

      {/* Registration Modal */}
      {registerModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
            <div className="bg-white p-5 sm:p-8 rounded-2xl max-w-md w-full border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl text-gray-900 font-semibold text-[24px]">Реєстрація на змагання</h3>
                    <button 
                        onClick={() => setRegisterModalOpen(false)}
                        className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>
                
                <div className="mb-5">
                    <label className="block text-base text-gray-900 mb-2 font-medium">Собака</label>
                    <select 
                        className="w-full p-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-[#007AFF] text-base"
                        value={selectedDogId}
                        onChange={(e) => setSelectedDogId(e.target.value)}
                    >
                        {userDogs.map(d => (
                            <option key={d.id} value={d.id}>{d.name} ({d.breed || d.pedigree})</option>
                        ))}
                    </select>
                </div>

                <div className="mb-5">
                    <label className="block text-base text-gray-900 mb-2 font-medium">Клас / Категорія</label>
                    <select 
                        className="w-full p-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-[#007AFF] text-base"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        <option value="">Оберіть клас</option>
                        {competitions.find(c => c.id === selectedCompId)?.categories?.map((cat, idx) => (
                            <option key={idx} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                <div className="mb-5">
                    <label className="block text-base text-gray-900 mb-2 font-medium">Провідник собаки (якщо інший)</label>
                    <input 
                        type="text"
                        className="w-full p-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-[#007AFF] text-base placeholder:text-gray-400"
                        value={handlerName}
                        onChange={(e) => setHandlerName(e.target.value)}
                        placeholder="Залиште порожнім, якщо ви провідник"
                    />
                </div>

                <div className="mb-6 sm:mb-8">
                    <label className="block text-base text-gray-900 mb-2 font-medium">Документи (квитанція, робоча книжка)</label>
                    <div className="relative">
                        <input 
                            type="file" 
                            multiple
                            onChange={(e) => e.target.files && setRegisterFiles(Array.from(e.target.files))}
                            className="hidden"
                            id="file-upload"
                        />
                        <label 
                            htmlFor="file-upload"
                            className={`flex items-center justify-center gap-2 w-full p-4 bg-white border-2 border-dashed rounded-xl cursor-pointer transition-all ${registerFiles.length > 0 ? 'border-[#007AFF] text-[#007AFF]' : 'border-gray-300 text-gray-600 hover:border-[#007AFF] hover:text-gray-900'} text-base`}
                        >
                            <Upload size={20} />
                            {registerFiles.length > 0 ? `${registerFiles.length} файлів обрано` : 'Завантажити файли'}
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                        onClick={handleRegister}
                        disabled={uploading}
                        className="flex-1 py-3 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-base"
                    >
                        {uploading ? 'Обробка...' : 'Підтвердити'}
                    </button>
                    <button 
                        onClick={() => setRegisterModalOpen(false)}
                        disabled={uploading}
                        className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors text-base"
                    >
                        Скасувати
                    </button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
}