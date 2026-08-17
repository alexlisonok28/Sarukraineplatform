import { useState, useEffect } from 'react';
import { Dog } from '../types';
import { X } from 'lucide-react';
import { NativeSelect } from './ui/native-select';

type DogModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dog: Omit<Dog, 'id'>) => void;
  editingDog?: Dog;
};

const inputClassName = "w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 focus:outline-none focus:border-[#007AFF] text-base";

export default function DogModal({ isOpen, onClose, onSave, editingDog }: DogModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    birth: '',
    gender: '' as 'male' | 'female' | '',
    breed: '',
    pedigree: '',
    chip: '',
    workbook: '',
  });

  useEffect(() => {
    if (editingDog) {
      setFormData({
        name: editingDog.name,
        birth: editingDog.birth,
        gender: editingDog.gender,
        breed: editingDog.breed || '',
        pedigree: editingDog.pedigree,
        chip: editingDog.chip,
        workbook: editingDog.workbook || '',
      });
    } else {
      setFormData({
        name: '',
        birth: '',
        gender: '',
        breed: '',
        pedigree: '',
        chip: '',
        workbook: '',
      });
    }
  }, [editingDog, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.gender === '') return;
    onSave(formData as Omit<Dog, 'id'>);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5">
      <div className="bg-white shadow-xl rounded-[20px] p-8 max-w-[600px] w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-gray-900 font-semibold">
            {editingDog ? 'Редагувати собаку' : 'Додати собаку'}
          </h2>
          <button
            className="bg-none border-none text-gray-600 cursor-pointer p-0 w-8 h-8 flex items-center justify-center transition-all duration-300 hover:text-gray-900"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Кличка за родоводом</label>
            <input
              type="text"
              className={inputClassName}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Дата народження</label>
            <input
              type="date"
              className={inputClassName}
              value={formData.birth}
              onChange={(e) => setFormData({ ...formData, birth: e.target.value })}
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Стать собаки</label>
            <NativeSelect
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' })}
              required
            >
              <option value="">Оберіть стать</option>
              <option value="male">Кобель</option>
              <option value="female">Сука</option>
            </NativeSelect>
          </div>

          <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Порода</label>
            <input
              type="text"
              className={inputClassName}
              value={formData.breed || ''}
              onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
            />
          </div>

          <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Номер родоводу</label>
            <input
              type="text"
              className={inputClassName}
              value={formData.pedigree}
              onChange={(e) => setFormData({ ...formData, pedigree: e.target.value })}
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Номер чіпу/клейма</label>
            <input
              type="text"
              className={inputClassName}
              value={formData.chip}
              onChange={(e) => setFormData({ ...formData, chip: e.target.value })}
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-base text-gray-900 mb-2 font-medium">Номер робочої книжки</label>
            <input
              type="text"
              className={inputClassName}
              value={formData.workbook}
              onChange={(e) => setFormData({ ...formData, workbook: e.target.value })}
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