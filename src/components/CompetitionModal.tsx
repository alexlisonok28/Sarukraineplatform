import { useState, useEffect, useRef } from 'react';
import { Competition } from '../types';
import { Check, ChevronDown, X } from 'lucide-react';
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

const categoryOptions = [
  'RH-FL-V', 'RH-FL-A', 'RH-FL-B',
  'RH-T-V', 'RH-T-A', 'RH-T-B',
  'RH-F-V', 'RH-F-A', 'RH-F-B',
];

export default function CompetitionModal({ isOpen, onClose, onSave, editingComp }: CompetitionModalProps) {
  const [formData, setFormData] = useState({
    name: '', startDate: '', endDate: '', location: '', level: '', categories: [] as string[], description: '', maxParticipants: 20,
    organizerName: '', judges: [] as string[], status: 'planned' as string
  });
  const [availableJudges, setAvailableJudges] = useState<any[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchJudges(); }, []);
  const fetchJudges = async () => {
    try { setAvailableJudges(await apiRequest('/judges')); } catch (e) { console.error("Failed to fetch judges", e); }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    setCategoryError(false);
    setCategoryOpen(false);
    if (editingComp) {
      setFormData({
        name: editingComp.name,
        startDate: editingComp.startDate || editingComp.date || '',
        endDate: editingComp.endDate || '',
        location: editingComp.location,
        level: editingComp.level,
        categories: (editingComp.categories || []).map(category => String(category).toUpperCase()),
        description: editingComp.description,
        maxParticipants: editingComp.maxParticipants,
        organizerName: editingComp.organizerName || '',
        judges: editingComp.judges || [],
        status: editingComp.status || 'planned'
      });
    } else {
      setFormData({ name: '', startDate: '', endDate: '', location: '', level: '', categories: [], description: '', maxParticipants: 20, organizerName: '', judges: [], status: 'planned' });
    }
  }, [editingComp, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.categories.length === 0) {
      setCategoryError(true);
      return;
    }
    onSave({ ...formData, categories: formData.categories, date: formData.startDate });
  };

  const handleJudgeChange = (judgeName: string) => {
    const current = formData.judges;
    setFormData({ ...formData, judges: current.includes(judgeName) ? current.filter(j => j !== judgeName) : [...current, judgeName] });
  };

  const toggleCategory = (category: string) => {
    const current = formData.categories;
    const categories = current.includes(category) ? current.filter(item => item !== category) : [...current, category];
    setFormData({ ...formData, categories });
    if (categories.length > 0) setCategoryError(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5">
      <div className="bg-white shadow-xl rounded-[20px] max-w-[700px] w-full max-h-[90vh] overflow-y-auto p-[24px] p-[16px]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-gray-900 text-[32px] font-semibold">{editingComp ? 'Редагувати змагання' : 'Створити змагання'}</h2>
          <button className="bg-none border-none text-gray-600 cursor-pointer p-0 w-8 h-8 flex items-center justify-center transition-all duration-300 hover:text-gray-900" onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div><label className="block text-base text-gray-900 mb-2 font-medium">Назва змагань</label><input type="text" className={inputClassName} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
            <div><label className="block text-base text-gray-900 mb-2 font-medium">Організатор (Назва)</label><input type="text" className={inputClassName} value={formData.organizerName} onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })} placeholder="Наприклад: КСУ, ГО 'SAR'" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div><label className="block text-base text-gray-900 mb-2 font-medium">Дата початку</label><NativeDateInput value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} required /></div>
            <div><label className="block text-base text-gray-900 mb-2 font-medium">Дата завершення</label><NativeDateInput value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} /></div>
          </div>
          <div className="mb-5"><label className="block text-base text-gray-900 mb-2 font-medium">Місце проведення</label><input type="text" className={inputClassName} value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-base text-gray-900 mb-2 font-medium">Рівень змагань</label>
              <NativeSelect value={formData.level} onChange={(e) => setFormData({ ...formData, level: e.target.value })} required>
                <option value="" disabled>Оберіть рівень</option>
                <option value="Національні змагання">Національні змагання</option>
                <option value="Міжнародні змагання">Міжнародні змагання</option>
                <option value="Випробування">Випробування</option>
                <option value="Відбіркові">Відбіркові</option>
                <option value="CACT">CACT</option>
                <option value="Відбіркові CACT">Відбіркові CACT</option>
                <option value="CACIT">CACIT</option>
                <option value="Відбіркові CACIT">Відбіркові CACIT</option>
              </NativeSelect>
            </div>
            <div>
              <label className="block text-base text-gray-900 mb-2 font-medium">Категорії</label>
              <div ref={categoryRef} className="relative">
                <button
                  type="button"
                  aria-expanded={categoryOpen}
                  aria-haspopup="listbox"
                  aria-invalid={categoryError}
                  onClick={() => setCategoryOpen(open => !open)}
                  className={`w-full h-11 px-4 bg-white border rounded-[10px] text-base text-left flex items-center justify-between gap-3 transition-all duration-300 focus:outline-none focus:border-[#007AFF] ${categoryError ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <span className={formData.categories.length ? 'text-gray-900 truncate' : 'text-gray-500 truncate'}>
                    {formData.categories.length ? formData.categories.join(', ') : 'Оберіть категорії'}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>

                {categoryOpen && (
                  <div
                    role="listbox"
                    aria-multiselectable="true"
                    className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-[10px] shadow-lg z-[400] p-1 max-h-[310px] overflow-y-auto"
                  >
                    {categoryOptions.map(category => {
                      const selected = formData.categories.includes(category);
                      return (
                        <button
                          key={category}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => toggleCategory(category)}
                          className="w-full min-h-10 px-3 py-2 flex items-center gap-3 rounded-md text-left text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                          <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-[#007AFF] border-[#007AFF] text-white' : 'border-gray-300 bg-white'}`}>
                            {selected && <Check className="w-4 h-4" aria-hidden="true" />}
                          </span>
                          <span>{category}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {categoryError && <p className="mt-1.5 text-sm text-red-600">Оберіть щонайменше одну категорію</p>}
            </div>
          </div>
          <div className="mb-5"><label className="block text-base text-gray-900 mb-2 font-medium">Макс. учасників</label><input type="number" className={inputClassName} value={formData.maxParticipants} onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })} required /></div>
          <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Статус змагань</label>
            <NativeSelect value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} required>
              <option value="planned">Реєстрація скоро відкриється</option>
              <option value="registration_open">Йде реєстрація</option>
              <option value="registration_closed">Реєстрація завершена</option>
              <option value="completed">Завершені</option>
              <option value="cancelled">Скасовані</option>
            </NativeSelect>
          </div>
          <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Судді</label>
            <div className="flex flex-wrap gap-2 bg-gray-50 p-3 rounded-[10px] border border-gray-300">
              {availableJudges.map(judge => <label key={judge.id} className="flex items-center gap-2 cursor-pointer text-gray-700 hover:text-gray-900 transition-colors text-base"><input type="checkbox" checked={formData.judges.includes(judge.name)} onChange={() => handleJudgeChange(judge.name)} className="accent-[#007AFF] w-4 h-4" />{judge.name}</label>)}
              {availableJudges.length === 0 && <span className="text-gray-500 text-sm">Суддів не знайдено. Додайте їх у розділі "Судді".</span>}
            </div>
          </div>
          <div className="mb-5"><label className="block text-base text-gray-900 mb-2 font-medium">Опис</label><textarea className={`${inputClassName} min-h-[100px]`} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
          <button type="submit" className="w-full px-4 py-4 bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer transition-all duration-300 text-base">Зберегти</button>
        </form>
      </div>
    </div>
  );
}