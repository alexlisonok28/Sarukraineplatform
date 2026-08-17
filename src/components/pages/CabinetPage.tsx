import { useState, useEffect } from 'react';
import { Dog, UserProfile } from '../../types';
import { PageType } from '../../App';
import DogModal from '../DogModal';
import { ClipboardList, ArrowRight, Plus, Mail, MessageCircle, Calendar, MapPin, Trophy, Paperclip } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { auth } from '../../utils/auth';
import { NativeSelect } from '../ui/native-select';

type CabinetPageProps = {
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile) => void;
  onPageChange: (page: PageType) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

export default function CabinetPage({ userProfile, setUserProfile, onPageChange, showToast }: CabinetPageProps) {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<'registrations' | 'dogs' | 'profile'>('registrations');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDogId, setEditingDogId] = useState<string | null>(null);
  
  const [profileForm, setProfileForm] = useState({
      name: '', phone: '', city: '', club: '', team: ''
  });

  useEffect(() => {
    if (!userProfile) return;
    fetchDogs();
    fetchRegistrations();
    fetchTeams();
    setProfileForm({
        name: userProfile.name || '',
        phone: userProfile.phone || '',
        city: userProfile.city || '',
        club: userProfile.club || '',
        team: userProfile.team || ''
    });
  }, [userProfile]);

  const fetchDogs = async () => {
    try { setDogs(await apiRequest('/dogs')); } catch (e) { console.error(e); }
  };

  const fetchRegistrations = async () => {
    try { setRegistrations(await apiRequest('/profile/registrations')); } catch (e) { console.error(e); }
  };

  const fetchTeams = async () => {
    try { setTeams((await apiRequest('/teams')) || []); }
    catch (e) { console.error(e); setTeams([]); }
  };

  const openDogModal = (dogId?: string) => { setEditingDogId(dogId || null); setModalOpen(true); };
  const closeDogModal = () => { setModalOpen(false); setEditingDogId(null); };

  const saveDog = async (dogData: Omit<Dog, 'id'>) => {
    try {
        if (editingDogId) {
          const updated = await apiRequest(`/dogs/${editingDogId}`, 'PUT', dogData);
          setDogs(dogs.map(d => d.id === editingDogId ? updated : d));
          showToast('Собаку оновлено!', 'success');
        } else {
          const newDog = await apiRequest('/dogs', 'POST', dogData);
          setDogs([...dogs, newDog]);
          showToast('Собаку додано!', 'success');
        }
        closeDogModal();
    } catch (e) { showToast('Помилка збереження', 'error'); }
  };

  const deleteDog = async (dogId: string) => {
    if (confirm('Ви впевнені, що хочете видалити цю собаку?')) {
      try {
          await apiRequest(`/dogs/${dogId}`, 'DELETE');
          setDogs(dogs.filter(d => d.id !== dogId));
          showToast('Собаку видалено', 'success');
      } catch (e) { showToast('Помилка видалення', 'error'); }
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const updated = await apiRequest('/profile', 'POST', profileForm);
        setUserProfile(updated);
        showToast('Профіль успішно оновлено!', 'success');
    } catch (e) { showToast('Помилка оновлення профілю', 'error'); }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const password = (form.elements.namedItem('new_password') as HTMLInputElement).value;
    const confirm = (form.elements.namedItem('confirm_password') as HTMLInputElement).value;
    if (password !== confirm) { showToast('Паролі не співпадають', 'error'); return; }
    const { error } = await auth.updateUser({ password });
    if (error) showToast(error.message, 'error');
    else { showToast('Пароль успішно змінено!', 'success'); form.reset(); }
  };

  const tabs = [
    ...(userProfile?.role === 'user' ? [
        { id: 'registrations', label: 'Мої реєстрації' },
        { id: 'dogs', label: 'Мої собаки' }
    ] : []),
    { id: 'profile', label: 'Мій профіль' },
  ];

  useEffect(() => {
    if ((userProfile?.role === 'organizer' || userProfile?.role === 'admin') && (activeSection === 'registrations' || activeSection === 'dogs')) {
        setActiveSection('profile');
    }
  }, [userProfile, activeSection]);

  return (
    <>
      <div className="max-w-[1400px] mx-auto px-6 py-[60px]">
        <div className="mb-12 text-left">
          <h1 className="text-4xl md:text-[48px] mb-2 text-gray-900 font-semibold">Мій кабінет</h1>
          <p className="text-lg text-gray-600">Керування вашим профілем та даними</p>
        </div>

        {userProfile?.role === 'user' && (
          <div className="flex gap-3 mb-8 flex-wrap border-b-2 border-gray-200 pb-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`px-6 py-3 bg-transparent border-none border-b-[3px] cursor-pointer transition-all duration-300 mb-[-2px] text-base ${activeSection === tab.id ? 'text-gray-900 border-b-[#007AFF]' : 'text-gray-500 border-b-transparent hover:text-gray-900'}`}
                onClick={() => setActiveSection(tab.id as any)}
              >{tab.label}</button>
            ))}
          </div>
        )}

        {activeSection === 'registrations' && (
          registrations.length === 0 ? (
          <div className="bg-white shadow-sm rounded-[20px] p-[100px_40px] text-center">
            <ClipboardList className="w-16 h-16 mx-auto mb-5 opacity-50 text-gray-400" />
            <p className="text-lg text-gray-500 mb-6">Ви ще не реєструвалися на жодні змагання</p>
            <button className="mt-5 px-10 py-4 bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer transition-all duration-300 flex items-center gap-2 mx-auto text-base" onClick={() => onPageChange('competitions')}>
              Дивитись актуальні змагання <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          ) : (
            <div className="grid gap-4">
                {registrations.map((reg, idx) => (
                    <div key={idx} className="bg-white shadow-sm rounded-2xl p-6 flex flex-col md:flex-row gap-6 justify-between items-center transition-all hover:shadow-lg">
                        <div className="flex-1">
                            <h3 className="text-xl text-gray-900 font-semibold mb-2 text-[24px]">{reg.competitionName}</h3>
                            <div className="text-gray-600 text-base flex flex-wrap gap-4 mb-3">
                                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{new Date(reg.startDate).toLocaleDateString('uk-UA')}</span>
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{reg.location}</span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-base">
                                <span className="bg-gray-100 px-3 py-1 rounded-lg text-gray-700 flex items-center gap-1.5"><ClipboardList className="w-4 h-4" />{reg.dogName}</span>
                                {(reg.class || reg.className || reg.participationClass) && <span className="bg-purple-100 px-3 py-1 rounded-lg text-purple-700 flex items-center gap-1.5">Клас: {reg.class || reg.className || reg.participationClass}</span>}
                                {reg.category && <span className="bg-blue-100 px-3 py-1 rounded-lg text-blue-700 flex items-center gap-1.5"><Trophy className="w-4 h-4" />{reg.category}</span>}
                                {reg.documents && reg.documents.length > 0 && <span className="bg-green-100 px-3 py-1 rounded-lg text-green-700 flex items-center gap-1.5"><Paperclip className="w-4 h-4" />Документи: {reg.documents.length}</span>}
                            </div>
                            {reg.status === 'rejected' && reg.notes && <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-base text-red-700"><strong>Причина відмови:</strong> {reg.notes}</div>}
                        </div>
                        <div className="w-full md:w-auto text-center md:text-right">
                            <span className={`inline-block px-4 py-2 rounded-xl text-base font-medium ${reg.status === 'confirmed' ? 'bg-green-100 text-green-700' : reg.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {reg.status === 'confirmed' ? 'Підтверджено' : reg.status === 'rejected' ? 'Відхилено' : 'Очікує підтвердження'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
          )
        )}

        {activeSection === 'dogs' && (
          <>
            <button className="mb-6 px-7 py-[14px] bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-[10px] cursor-pointer transition-all duration-300 inline-flex items-center gap-2 text-base" onClick={() => openDogModal()}>
              <Plus className="w-4 h-4" /> Додати собаку
            </button>
            {dogs.length === 0 ? (
              <p className="text-gray-500 text-center py-10 text-base">Ви ще не додали жодної собаки</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dogs.map(dog => (
                  <div key={dog.id} className="bg-white shadow-sm rounded-2xl p-6 transition-all duration-300 hover:shadow-lg">
                    <h3 className="text-gray-900 mb-4 text-xl font-semibold">{dog.name}</h3>
                    <div className="text-base text-gray-600 leading-relaxed mb-4">
                      <p className="my-2"><strong>Дата народження:</strong> {new Date(dog.birth).toLocaleDateString('uk-UA')}</p>
                      <p className="my-2"><strong>Стать:</strong> {dog.gender === 'male' ? 'Кобель' : 'Сука'}</p>
                      <p className="my-2"><strong>Родовід:</strong> {dog.pedigree}</p>
                      <p className="my-2"><strong>Чіп/клеймо:</strong> {dog.chip}</p>
                      {dog.workbook && <p className="my-2"><strong>Робоча книжка:</strong> {dog.workbook}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 px-[10px] py-[10px] border-none rounded-lg cursor-pointer transition-all duration-300 bg-blue-100 text-blue-700 hover:bg-blue-200 text-base" onClick={() => openDogModal(dog.id)}>Редагувати</button>
                      <button className="flex-1 px-[10px] py-[10px] border-none rounded-lg cursor-pointer transition-all duration-300 bg-red-100 text-red-700 hover:bg-red-200 text-base" onClick={() => deleteDog(dog.id)}>Видалити</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeSection === 'profile' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white shadow-sm rounded-2xl p-8 p-[24px]">
                <h3 className="text-gray-900 mb-6 text-xl font-semibold">Особисті дані</h3>
                <form onSubmit={saveProfile}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="block text-base text-gray-900 mb-2 font-medium">Ім'я і прізвище</label>
                      <input type="text" className="w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 focus:outline-none focus:border-[#007AFF] text-base" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} required />
                    </div>
                    <div>
                      <label className="block text-base text-gray-900 mb-2 font-medium">Телефон</label>
                      <input type="tel" className="w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 focus:outline-none focus:border-[#007AFF] text-base" placeholder="+380" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                    <div>
                        <label className="block text-base text-gray-900 mb-2 font-medium">Місто</label>
                        <input type="text" className="w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 focus:outline-none focus:border-[#007AFF] text-base" placeholder="Київ" value={profileForm.city} onChange={e => setProfileForm({...profileForm, city: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-base text-gray-900 mb-2 font-medium">Команда</label>
                      <NativeSelect value={profileForm.team} onChange={e => setProfileForm({...profileForm, team: e.target.value})}>
                        <option value="">Оберіть команду</option>
                        {teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}
                        <option value="Команди немає в списку">Команди немає в списку</option>
                      </NativeSelect>
                    </div>
                  </div>
                  <div className="mb-5">
                     <label className="block text-base text-gray-900 mb-2 font-medium">Кінологічний клуб КСУ</label>
                      <input type="text" className="w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 focus:outline-none focus:border-[#007AFF] text-base" placeholder="Назва клубу" value={profileForm.club} onChange={e => setProfileForm({...profileForm, club: e.target.value})} />
                  </div>
                  <div className="mb-5">
                    <label className="block text-base text-gray-900 mb-2 font-medium">Email (не можна змінити)</label>
                    <input type="email" className="w-full px-4 py-[14px] bg-gray-100 border border-gray-300 rounded-[10px] text-gray-500 transition-all duration-300 opacity-60 cursor-not-allowed text-base" value={userProfile?.email || ''} disabled />
                  </div>
                  <button type="submit" className="w-full px-4 py-4 bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer transition-all duration-300 mt-6 text-base">Зберегти зміни</button>
                </form>
              </div>

              <div className="bg-white shadow-sm rounded-2xl p-8 p-[24px]">
                <h3 className="text-gray-900 mb-6 text-xl font-semibold">Зміна пароля</h3>
                <form onSubmit={changePassword}>
                  <div className="mb-5">
                    <label className="block text-base text-gray-900 mb-2 font-medium">Новий пароль</label>
                    <input name="new_password" type="password" className="w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 focus:outline-none focus:border-[#007AFF] text-base" required />
                  </div>
                  <div className="mb-5">
                    <label className="block text-base text-gray-900 mb-2 font-medium">Підтвердження нового пароля</label>
                    <input name="confirm_password" type="password" className="w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 focus:outline-none focus:border-[#007AFF] text-base" required />
                  </div>
                  <button type="submit" className="w-full px-4 py-4 bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer transition-all duration-300 mt-6 text-base">Змінити пароль</button>
                </form>
              </div>
            </div>

            <div className="mt-8">
              <div className="bg-white shadow-sm rounded-3xl p-12 text-center px-[24px] py-[48px]">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <MessageCircle className="w-6 h-6 text-gray-900" />
                  <h3 className="text-gray-900 text-xl font-semibold">Технічна підтримка</h3>
                </div>
                <p className="text-gray-600 mb-6 text-base">Маєте питання щодо роботи платформи? Зв'яжіться з нами:</p>
                <a href="mailto:support@sar-ukraine.com" className="inline-flex items-center gap-3 px-7 py-[14px] bg-gray-100 hover:bg-gray-200 rounded-xl text-[#007AFF] no-underline transition-all duration-300 text-base">
                  <Mail className="w-5 h-5" /> support@sar-ukraine.com
                </a>
              </div>
            </div>
          </>
        )}
      </div>

      <DogModal isOpen={modalOpen} onClose={closeDogModal} onSave={saveDog} editingDog={editingDogId ? dogs.find(d => d.id === editingDogId) : undefined} />
    </>
  );
}