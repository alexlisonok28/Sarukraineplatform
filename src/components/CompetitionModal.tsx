import { useState, useEffect } from 'react';
import { Competition } from '../types';
import { X } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { NativeSelect } from './ui/native-select';
import { NativeDateInput } from './ui/native-date-input';

type CompetitionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (comp: any) => void;
  editingComp?: Competition;
};

const inputClassName = "w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 focus:outline-none focus:border-[#007AFF] text-base";

export default function CompetitionModal({ isOpen, onClose, onSave, editingComp }: CompetitionModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    location: '',
    level: '',
    categories: '',
    description: '',
    maxParticipants: 20,
    organizerName: '',
    judges: [] as string[],
    status: 'planned' as string
  });

  const [availableJudges, setAvailableJudges] = useState<any[]>([]);

  useEffect(() => {
    fetchJudges();
  }, []);

  const fetchJudges = async () => {
      try {
          const judges = await apiRequest('/judges');
          setAvailableJudges(judges);
      } catch (e) {
          console.error("Failed to fetch judges", e);
      }
  }

  useEffect(() => {
    if (editingComp) {
      setFormData({
        name: editingComp.name,
        startDate: editingComp.startDate || editingComp.date || '',
        endDate: editingComp.endDate || '',
        location: editingComp.location,
        level: editingComp.level,
        categories: editingComp.categories?.join(', ') || '',
        description: editingComp.description,
        maxParticipants: editingComp.maxParticipants,
        organizerName: editingComp.organizerName || '',
        judges: editingComp.judges || [],
        status: editingComp.status || 'planned'
      });
    } else {
      setFormData({
        name: '',
        startDate: '',
        endDate: '',
        location: '',
        level: '',
        categories: '',
        description: '',
        maxParticipants: 20,
        organizerName: '',
        judges: [],
        status: 'planned'
      });
    }
  }, [editingComp, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Normalize categories: lowercase and replace V with B
    const categoriesArray = formData.categories
      .split(',')
      .map(s => s.trim().toLowerCase().replace(/v/g, 'b'))
      .filter(Boolean);
    onSave({
        ...formData,
        categories: categoriesArray,
        date: formData.startDate // Legacy support if needed
    });
  };

  const handleJudgeChange = (judgeName: string) => {
      const current = formData.judges;
      if (current.includes(judgeName)) {
          setFormData({...formData, judges: current.filter(j => j !== judgeName)});
      } else {
          setFormData({...formData, judges: [...current, judgeName]});
      }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5">
      <div className="bg-white shadow-xl rounded-[20px] max-w-[700px] w-full max-h-[90vh] overflow-y-auto p-[24px] p-[16px]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-gray-900 text-[32px] font-semibold">
            {editingComp ? 'Редагувати змагання' : 'Створити змагання'}
          </h2>
          <button
            className="bg-none border-none text-gray-600 cursor-pointer p-0 w-8 h-8 flex items-center justify-center transition-all duration-300 hover:text-gray-900"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div>
                <label className="block text-base text-gray-900 mb-2 font-medium">Назва змагань</label>
                <input
                type="text"
                className={inputClassName}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                />
            </div>
            <div>
                 <label className="block text-base text-gray-900 mb-2 font-medium">Організатор (Назва)</label>
                 <input
                  type="text"
                  className={inputClassName}
                  value={formData.organizerName}
                  onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
                  placeholder="Наприклад: КСУ, ГО 'SAR'"
                  required
                 />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
                <label className="block text-base text-gray-900 mb-2 font-medium">Дата початку</label>
                <NativeDateInput
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
            </div>
             <div>
                <label className="block text-base text-gray-900 mb-2 font-medium">Дата завершення</label>
                <NativeDateInput
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
            </div>
          </div>

           <div className="mb-5">
                <label className="block text-base text-gray-900 mb-2 font-medium">Місце проведення</label>
                <input
                type="text"
                className={inputClassName}
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                />
            </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
                <label className="block text-base text-gray-900 mb-2 font-medium">Рівень змагань</label>
                <NativeSelect
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  required
                >
                  <option value="" disabled>Оберіть рівень</option>
                  <option value="Національні змагання">Національні змагання</option>
                  <option value="Міжнародні змагання">Міжнародні змагання</option>
                  <option value="Випробування">Випробування</option>
                  <option value="Відбіркові">Відбіркові</option>
                  <option value="CACT">CACT</option>
                  <option value="Відбіркові CACT">Відбіркові CACT</option>
                </NativeSelect>
            </div>
             <div>
                <label className="block text-base text-gray-900 mb-2 font-medium">Категорії (через кому)</label>
                <input
                type="text"
                className={inputClassName}
                value={formData.categories}
                onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
                placeholder="rh-fl-b, rh-t-b, rh-f-b"
                required
                />
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Макс. учасників</label>
            <input
            type="number"
            className={inputClassName}
            value={formData.maxParticipants}
            onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
            required
            />
          </div>

          <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Статус змагань</label>
            <NativeSelect
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              required
            >
              <option value="planned">Реєстрація скоро відкриється</option>
              <option value="registration_open">Йде реєстрація</option>
              <option value="registration_closed">Реєстрація завершена</option>
              <option value="completed">Завершені</option>
            </NativeSelect>
          </div>

           <div className="mb-5">
             <label className="block text-base text-gray-900 mb-2 font-medium">Судді</label>
             <div className="flex flex-wrap gap-2 bg-gray-50 p-3 rounded-[10px] border border-gray-300">
                 {availableJudges.map(judge => (
                     <label key={judge.id} className="flex items-center gap-2 cursor-pointer text-gray-700 hover:text-gray-900 transition-colors text-base">
                         <input 
                            type="checkbox" 
                            checked={formData.judges.includes(judge.name)}
                            onChange={() => handleJudgeChange(judge.name)}
                            className="accent-[#007AFF] w-4 h-4"
                         />
                         {judge.name}
                     </label>
                 ))}
                 {availableJudges.length === 0 && <span className="text-gray-500 text-sm">Суддів не знайдено. Додайте їх у розділі "Судді".</span>}
             </div>
           </div>

           <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Опис</label>
            <textarea
              className={`${inputClassName} min-h-[100px]`}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-4 bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer transition-all duration-300 text-base"
          >
            Зберегти
          </button>
        </form>
      </div>
    </div>
  );
}