import { useState, useEffect, useMemo } from 'react';
import { Breed, Dog } from '../types';
import { Check, ChevronDown, X } from 'lucide-react';
import { NativeSelect } from './ui/native-select';
import { NativeDateInput } from './ui/native-date-input';
import { apiRequest } from '../utils/api';

type DogModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dog: Omit<Dog, 'id'>) => void;
  editingDog?: Dog;
};

const inputClassName = "w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 focus:outline-none focus:border-[#007AFF] text-base";

export default function DogModal({ isOpen, onClose, onSave, editingDog }: DogModalProps) {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [breedSearch, setBreedSearch] = useState('');
  const [breedOpen, setBreedOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', birth: '', gender: '' as 'male' | 'female' | '', breed: '', breedId: undefined as number | undefined,
    pedigree: '', chip: '', workbook: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    apiRequest('/breeds', 'GET')
      .then((items: Breed[]) => setBreeds(Array.isArray(items) ? items : []))
      .catch(error => console.error('Breed list fetch failed:', error));
  }, [isOpen]);

  useEffect(() => {
    if (editingDog) {
      setFormData({ name: editingDog.name, birth: editingDog.birth, gender: editingDog.gender,
        breed: editingDog.breed || '', breedId: editingDog.breedId, pedigree: editingDog.pedigree,
        chip: editingDog.chip, workbook: editingDog.workbook || '' });
      setBreedSearch(editingDog.breed || '');
    } else {
      setFormData({ name: '', birth: '', gender: '', breed: '', breedId: undefined, pedigree: '', chip: '', workbook: '' });
      setBreedSearch('');
    }
    setBreedOpen(false);
  }, [editingDog, isOpen]);

  const filteredBreeds = useMemo(() => {
    const query = breedSearch.trim().toLocaleLowerCase('uk-UA');
    if (!query) return breeds;
    return breeds.filter(item => item.name.toLocaleLowerCase('uk-UA').includes(query));
  }, [breeds, breedSearch]);

  const selectBreed = (breed: Breed) => {
    setFormData({ ...formData, breedId: breed.id, breed: breed.name });
    setBreedSearch(breed.name);
    setBreedOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.gender === '' || !formData.breedId) return;
    onSave(formData as Omit<Dog, 'id'>);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5" onMouseDown={() => setBreedOpen(false)}>
      <div className="bg-white shadow-xl rounded-[20px] p-8 max-w-[600px] w-full max-h-[90vh] overflow-y-auto" onMouseDown={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-gray-900 font-semibold">{editingDog ? 'Редагувати собаку' : 'Додати собаку'}</h2>
          <button type="button" className="bg-none border-none text-gray-600 cursor-pointer p-0 w-8 h-8 flex items-center justify-center hover:text-gray-900" onClick={onClose}><X className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-5"><label className="block text-base text-gray-900 mb-2 font-medium">Кличка за родоводом</label><input type="text" className={inputClassName} value={formData.name} onChange={e => setFormData({...formData,name:e.target.value})} required /></div>
          <div className="mb-5"><label className="block text-base text-gray-900 mb-2 font-medium">Дата народження</label><NativeDateInput value={formData.birth} onChange={e => setFormData({...formData,birth:e.target.value})} required /></div>
          <div className="mb-5"><label className="block text-base text-gray-900 mb-2 font-medium">Стать собаки</label><NativeSelect value={formData.gender} onChange={e => setFormData({...formData,gender:e.target.value as 'male'|'female'})} required><option value="">Оберіть стать</option><option value="male">Кобель</option><option value="female">Сука</option></NativeSelect></div>

          <div className="mb-5 relative">
            <label className="block text-base text-gray-900 mb-2 font-medium">Порода</label>
            <div className="relative">
              <input type="text" className={`${inputClassName} pr-11`} value={breedSearch} placeholder="Оберіть або знайдіть породу"
                onFocus={() => setBreedOpen(true)}
                onChange={e => { setBreedSearch(e.target.value); setFormData({...formData,breed:'',breedId:undefined}); setBreedOpen(true); }}
                autoComplete="off" required />
              <button type="button" aria-label="Відкрити список порід" onClick={() => setBreedOpen(!breedOpen)} className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-gray-500 bg-transparent border-0 cursor-pointer"><ChevronDown className={`w-5 h-5 transition-transform ${breedOpen ? 'rotate-180' : ''}`} /></button>
            </div>
            {breedOpen && <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-[10px] shadow-lg">
              {filteredBreeds.length ? filteredBreeds.map(breed => <button key={breed.id} type="button" onClick={() => selectBreed(breed)} className="w-full px-4 py-3 flex items-center justify-between text-left bg-white border-0 hover:bg-gray-50 cursor-pointer text-gray-900">
                <span>{breed.name}</span>{formData.breedId === breed.id && <Check className="w-4 h-4 text-[#007AFF] shrink-0" />}
              </button>) : <div className="px-4 py-3 text-gray-500">Породу не знайдено</div>}
            </div>}
          </div>

          <div className="mb-5"><label className="block text-base text-gray-900 mb-2 font-medium">Номер родоводу</label><input type="text" className={inputClassName} value={formData.pedigree} onChange={e => setFormData({...formData,pedigree:e.target.value})} required /></div>
          <div className="mb-5"><label className="block text-base text-gray-900 mb-2 font-medium">Номер чіпу/клейма</label><input type="text" className={inputClassName} value={formData.chip} onChange={e => setFormData({...formData,chip:e.target.value})} required /></div>
          <div className="mb-5"><label className="block text-base text-gray-900 mb-2 font-medium">Номер робочої книжки</label><input type="text" className={inputClassName} value={formData.workbook} onChange={e => setFormData({...formData,workbook:e.target.value})} /></div>
          <button type="submit" className="w-full px-4 py-4 bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer text-base">Зберегти</button>
        </form>
      </div>
    </div>
  );
}
