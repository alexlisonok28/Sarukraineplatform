import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
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

/**
 * Adds access to the dog's persistent documents directly from the participant
 * application row without modifying the large competition-management page.
 * The API still performs all authorization checks.
 */
export default function ManageCompetitionWithDocumentsPage(props: Props) {
  const [pendingDogs, setPendingDogs] = useState<ParticipantDog[]>([]);
  const [selectedDog, setSelectedDog] = useState<ParticipantDog | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPendingDogs = async () => {
      try {
        const competition = await apiRequest(`/competitions/${props.competitionId}/details`);
        if (cancelled) return;

        const dogs = (competition.participants || [])
          .filter((participant: any) => participant.status === 'registered')
          .map((participant: any) => ({
            dogId: String(participant.dogId || ''),
            dogName: participant.dogName || 'Невідома собака',
            dogBreed: participant.dogBreed || '',
            userName: participant.userName || '',
            category: participant.category || participant.class || '',
          }))
          .filter((dog: ParticipantDog) => Boolean(dog.dogId));

        setPendingDogs(dogs);
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

    const removeInjectedButtons = () => {
      document.querySelectorAll('[data-dog-documents-trigger="true"]').forEach(node => node.remove());
    };

    const attachButtons = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const headings = Array.from(document.querySelectorAll('div, h1, h2, h3'));
        const heading = headings.find(node => node.textContent?.trim().startsWith('Нові заявки на участь'));
        if (!heading) return;

        const card = heading.closest('.mb-8');
        if (!card) return;

        // Desktop table: participant order matches pendingParticipants in ManageCompetitionPage.
        const rows = Array.from(card.querySelectorAll('table tbody tr'));
        rows.forEach((row, index) => {
          const dog = pendingDogs[index];
          if (!dog) return;
          const cells = row.querySelectorAll('td');
          const documentsCell = cells[3] as HTMLElement | undefined;
          if (!documentsCell || documentsCell.querySelector('[data-dog-documents-trigger="true"]')) return;

          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.dogDocumentsTrigger = 'true';
          button.className = 'mt-1 inline-flex items-center text-sm text-[#007AFF] hover:text-[#0066CC] underline';
          button.textContent = 'Документи собаки';
          button.addEventListener('click', () => setSelectedDog(dog));
          documentsCell.appendChild(button);
        });

        // Mobile cards: find the "Документи" label inside each application card.
        const mobileContainer = card.querySelector('.md\\:hidden');
        if (mobileContainer) {
          const cards = Array.from(mobileContainer.children);
          cards.forEach((applicationCard, index) => {
            const dog = pendingDogs[index];
            if (!dog) return;
            const labels = Array.from(applicationCard.querySelectorAll('div'));
            const documentsLabel = labels.find(node => node.textContent?.trim() === 'Документи');
            const documentsBlock = documentsLabel?.parentElement;
            if (!documentsBlock || documentsBlock.querySelector('[data-dog-documents-trigger="true"]')) return;

            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.dogDocumentsTrigger = 'true';
            button.className = 'mt-2 block text-sm text-[#007AFF] hover:text-[#0066CC] underline';
            button.textContent = 'Документи собаки';
            button.addEventListener('click', () => setSelectedDog(dog));
            documentsBlock.appendChild(button);
          });
        }
      });
    };

    attachButtons();
    const observer = new MutationObserver(() => attachButtons());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      removeInjectedButtons();
    };
  }, [pendingDogs]);

  return (
    <div className="relative">
      <ManageCompetitionPage {...props} />

      {selectedDog && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedDog(null);
          }}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 sm:p-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Документи собаки — {selectedDog.dogName}</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {[selectedDog.dogBreed, selectedDog.userName, selectedDog.category].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                type="button"
                aria-label="Закрити"
                onClick={() => setSelectedDog(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-110px)] overflow-y-auto p-5 sm:p-6">
              <DogDocumentsReviewPanel dogId={selectedDog.dogId} showToast={props.showToast} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
