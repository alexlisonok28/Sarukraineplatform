import { useEffect, useMemo, useState } from 'react';
import { FileCheck2, X } from 'lucide-react';
import ManageCompetitionPage from './ManageCompetitionPage';
import DogDocumentsReviewPanel from '../DogDocumentsReviewPanel';
import { apiRequest } from '../../utils/api';
import { UserProfile } from '../../types';
import { Button } from '../ui/button';

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
 * Keeps the existing competition-management screen intact and adds a dedicated
 * dog-document review surface for Admin/Organizer. All security decisions are
 * still enforced by the API; this component only exposes the permitted actions.
 */
export default function ManageCompetitionWithDocumentsPage(props: Props) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [dogs, setDogs] = useState<ParticipantDog[]>([]);
  const [loadingDogs, setLoadingDogs] = useState(false);

  const loadDogs = async () => {
    setLoadingDogs(true);
    try {
      const competition = await apiRequest(`/competitions/${props.competitionId}/details`);
      const unique = new Map<string, ParticipantDog>();
      (competition.participants || []).forEach((participant: any) => {
        const dogId = String(participant.dogId || '');
        if (!dogId || unique.has(dogId)) return;
        unique.set(dogId, {
          dogId,
          dogName: participant.dogName || 'Невідома собака',
          dogBreed: participant.dogBreed || '',
          userName: participant.userName || '',
          category: participant.category || participant.class || '',
        });
      });
      setDogs(Array.from(unique.values()));
    } catch (error: any) {
      console.error(error);
      props.showToast(error?.message || 'Не вдалося завантажити документи собак', 'error');
    } finally {
      setLoadingDogs(false);
    }
  };

  useEffect(() => {
    if (reviewOpen) loadDogs();
  }, [reviewOpen, props.competitionId]);

  const sortedDogs = useMemo(() => [...dogs].sort((a, b) => a.dogName.localeCompare(b.dogName, 'uk')), [dogs]);

  return (
    <div className="relative">
      <ManageCompetitionPage {...props} />

      <div className="fixed bottom-6 right-6 z-[120]">
        <Button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="h-12 rounded-xl bg-[#007AFF] px-5 text-white shadow-lg hover:bg-[#0066CC]"
        >
          <FileCheck2 className="w-5 h-5 mr-2" /> Документи собак
        </Button>
      </div>

      {reviewOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setReviewOpen(false);
        }}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 sm:p-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Документи собак</h2>
                <p className="mt-1 text-sm text-gray-600">Перегляд та одноразове підтвердження документів учасників цього змагання.</p>
              </div>
              <button
                type="button"
                aria-label="Закрити"
                onClick={() => setReviewOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-110px)] overflow-y-auto p-5 sm:p-6">
              {loadingDogs ? (
                <div className="py-12 text-center text-gray-500">Завантаження...</div>
              ) : sortedDogs.length === 0 ? (
                <div className="py-12 text-center text-gray-500">У змаганні ще немає собак.</div>
              ) : (
                <div className="space-y-5">
                  {sortedDogs.map(dog => (
                    <section key={dog.dogId} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{dog.dogName}</h3>
                          <div className="text-sm text-gray-600">
                            {[dog.dogBreed, dog.userName].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </div>
                        {dog.category && (
                          <span className="mt-1 w-fit rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 sm:mt-0">
                            {dog.category}
                          </span>
                        )}
                      </div>
                      <DogDocumentsReviewPanel dogId={dog.dogId} showToast={props.showToast} />
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
