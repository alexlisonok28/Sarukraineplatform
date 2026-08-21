import { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import ManageCompetitionPage from './ManageCompetitionPage';
import DogDocumentsReviewPanel from '../DogDocumentsReviewPanel';
import { apiRequest } from '../../utils/api';
import { UserProfile } from '../../types';

type Props = {
  competitionId: string;
  onBack: () => void;
  showToast: (msg: string, type?: any) => void;
  userProfile: UserProfile;
};

type ParticipantDog = {
  dogId: string;
  dogName: string;
  dogBreed?: string;
  userName?: string;
  category?: string;
};

export default function ManageCompetitionWithDocumentsPage(props: Props) {
  const [pendingDogs, setPendingDogs] = useState<ParticipantDog[]>([]);
  const [selectedDog, setSelectedDog] = useState<ParticipantDog | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPendingDogs = async () => {
      try {
        const competition = await apiRequest(`/competitions/${props.competitionId}/details`);
        if (cancelled) return;
        setPendingDogs((competition.participants || [])
          .filter((participant: any) => participant.status === 'registered')
          .map((participant: any) => ({
            dogId: String(participant.dogId || ''), dogName: participant.dogName || 'Невідома собака',
            dogBreed: participant.dogBreed || '', userName: participant.userName || '',
            category: participant.category || participant.class || '',
          }))
          .filter((dog: ParticipantDog) => Boolean(dog.dogId)));
      } catch (error) {
        console.error('Failed to load dogs for document review:', error);
        setPendingDogs([]);
      }
    };
    loadPendingDogs();
    return () => { cancelled = true; };
  }, [props.competitionId]);

  useEffect(() => {
    if (pendingDogs.length === 0) return;
    let frame = 0;
    const removeInjectedButtons = () => document.querySelectorAll('[data-dog-documents-trigger="true"]').forEach(node => node.remove());
    const attachButtons = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const headings = Array.from(document.querySelectorAll('div, h1, h2, h3'));
        const heading = headings.find(node => node.textContent?.trim().startsWith('Нові заявки на участь'));
        const card = heading?.closest('.mb-8');
        if (!card) return;
        Array.from(card.querySelectorAll('table tbody tr')).forEach((row, index) => {
          const dog = pendingDogs[index];
          const documentsCell = row.querySelectorAll('td')[3] as HTMLElement | undefined;
          if (!dog || !documentsCell || documentsCell.querySelector('[data-dog-documents-trigger="true"]')) return;
          const button = document.createElement('button');
          button.type = 'button'; button.dataset.dogDocumentsTrigger = 'true';
          button.className = 'mt-2 flex items-center gap-1.5 text-sm text-[#007AFF] hover:text-[#0066CC] transition-colors';
          button.innerHTML = '<span aria-hidden="true">▣</span><span>Документи собаки</span>';
          button.addEventListener('click', () => setSelectedDog(dog));
          documentsCell.appendChild(button);
        });
        const mobileContainer = card.querySelector('.md\\:hidden');
        if (mobileContainer) Array.from(mobileContainer.children).forEach((applicationCard, index) => {
          const dog = pendingDogs[index];
          const labels = Array.from(applicationCard.querySelectorAll('div'));
          const documentsBlock = labels.find(node => node.textContent?.trim() === 'Документи')?.parentElement;
          if (!dog || !documentsBlock || documentsBlock.querySelector('[data-dog-documents-trigger="true"]')) return;
          const button = document.createElement('button');
          button.type = 'button'; button.dataset.dogDocumentsTrigger = 'true';
          button.className = 'mt-2 flex items-center gap-1.5 text-sm text-[#007AFF] hover:text-[#0066CC] transition-colors';
          button.textContent = 'Документи собаки';
          button.addEventListener('click', () => setSelectedDog(dog));
          documentsBlock.appendChild(button);
        });
      });
    };
    attachButtons();
    const observer = new MutationObserver(attachButtons);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); removeInjectedButtons(); };
  }, [pendingDogs]);

  return <div className="relative">
    <ManageCompetitionPage {...props} />
    {selectedDog && <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedDog(null); }}>
      <div className="bg-white shadow-xl rounded-[20px] p-8 max-w-[700px] w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#007AFF]" />
              <h2 className="text-gray-900 font-semibold">Документи собаки — {selectedDog.dogName}</h2>
            </div>
            <p className="mt-2 text-sm text-gray-500">{[selectedDog.dogBreed, selectedDog.userName, selectedDog.category].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" aria-label="Закрити" onClick={() => setSelectedDog(null)} className="bg-none border-none text-gray-600 cursor-pointer p-0 w-8 h-8 flex items-center justify-center transition-all duration-300 hover:text-gray-900">
            <X className="w-6 h-6" />
          </button>
        </div>
        <DogDocumentsReviewPanel dogId={selectedDog.dogId} showToast={props.showToast} />
      </div>
    </div>}
  </div>;
}
