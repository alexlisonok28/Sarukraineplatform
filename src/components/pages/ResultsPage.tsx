import { useState, useEffect } from 'react';
import { Medal, Trophy, Calendar, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { Competition } from '../../types';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

type ExtendedParticipant = {
    id?: string;
    userId: string;
    dogId: string;
    userName: string;
    dogName: string;
    dogBreed?: string;
    dogBirth: string;
    status: string;
    results?: {
        search?: number;
        obedience?: number;
        total?: number;
        place?: number;
        qualification?: string;
        notes?: string;
        title?: string;
    };
    category?: string;
    class?: string;
};

type CompetitionWithResults = Competition & {
    participants?: ExtendedParticipant[];
};

type ResultsPageProps = {
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
};

type ResultStructure = 'search-obedience' | 'basic';

const TITLE_COMPETITION_LEVELS = new Set([
    'Відбіркові CACT',
    'CACT',
    'Відбіркові CACIT',
    'CACIT',
]);

/**
 * Структура таблиці визначається нормативом, а не наявністю внесених балів.
 * Поточні RH-FL / RH-T / RH-F категорії використовують однакову модель:
 * пошук + послух + загальний бал + оцінка.
 */
const getResultStructure = (category: string): ResultStructure => {
    return /^RH-(FL|T|F)-/i.test(category) ? 'search-obedience' : 'basic';
};

const qualificationBadgeClass = (qualification?: string) => {
    if (qualification === 'Відмінно') return 'border-green-600 text-green-700 bg-green-50';
    if (qualification === 'Дуже добре') return 'border-blue-600 text-blue-700 bg-blue-50';
    if (qualification === 'Добре') return 'border-cyan-600 text-cyan-700 bg-cyan-50';
    if (qualification === 'Задовільно') return 'border-yellow-600 text-yellow-700 bg-yellow-50';
    if (qualification === 'Недостатньо') return 'border-red-600 text-red-700 bg-red-50';
    return 'border-gray-300 text-gray-600 bg-gray-50';
};

const displayNumber = (value?: number) => value === undefined || value === null ? '—' : value.toFixed(1);

function ResultsGroup({
    groupName,
    participants,
    showTitle,
}: {
    groupName: string;
    participants: ExtendedParticipant[];
    showTitle: boolean;
}) {
    const structure = getResultStructure(groupName);
    const showScores = structure === 'search-obedience';

    return (
        <div>
            <h3 className="text-lg sm:text-xl text-gray-900 mb-4 pb-2 border-b border-gray-200">
                {groupName}
            </h3>

            <div className="md:hidden space-y-3">
                {participants.map((p, idx) => (
                    <div
                        key={p.id || `${p.userId}-${p.dogId}-${idx}`}
                        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                    >
                        <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-700 font-medium">
                                {p.results?.place ?? '—'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-gray-900 font-medium text-base truncate">{p.userName}</div>
                                <div className="text-gray-600 text-sm truncate">{p.dogName}</div>
                                {p.dogBreed && <div className="text-gray-500 text-xs">{p.dogBreed}</div>}
                            </div>
                        </div>

                        {showScores && (
                            <>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                                        <div className="text-gray-600 text-xs mb-1">Пошук</div>
                                        <div className="text-gray-900 font-medium">{displayNumber(p.results?.search)}</div>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                                        <div className="text-gray-600 text-xs mb-1">Послух</div>
                                        <div className="text-gray-900 font-medium">{displayNumber(p.results?.obedience)}</div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-gray-200 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 text-sm">Загальний бал:</span>
                                        <span className="text-[#007AFF] font-bold text-lg">{displayNumber(p.results?.total)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 text-sm">Оцінка:</span>
                                        <Badge variant="outline" className={`text-xs py-0.5 font-normal ${qualificationBadgeClass(p.results?.qualification)}`}>
                                            {p.results?.qualification || '—'}
                                        </Badge>
                                    </div>
                                    {showTitle && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600 text-sm">Титул:</span>
                                            <span className="text-gray-900 text-sm font-medium">{p.results?.title?.trim() || '—'}</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {!showScores && showTitle && (
                            <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                                <span className="text-gray-600 text-sm">Титул:</span>
                                <span className="text-gray-900 text-sm font-medium">{p.results?.title?.trim() || '—'}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse table-fixed">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="p-3 text-left text-gray-900 w-[72px]">#</th>
                            <th className="p-3 text-left text-gray-900">Учасник</th>
                            <th className="p-3 text-left text-gray-900">Собака</th>
                            {showScores && <th className="p-3 text-center text-gray-900 w-[110px]">Пошук</th>}
                            {showScores && <th className="p-3 text-center text-gray-900 w-[110px]">Послух</th>}
                            {showScores && <th className="p-3 text-center text-gray-900 w-[120px]">Заг. бал</th>}
                            {showScores && <th className="p-3 text-left text-gray-900 w-[150px]">Оцінка</th>}
                            {showTitle && <th className="p-3 text-left text-gray-900 w-[140px]">Титул</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {participants.map((p, idx) => (
                            <tr
                                key={p.id || `${p.userId}-${p.dogId}-${idx}`}
                                className="border-t border-gray-200 hover:bg-gray-50"
                            >
                                <td className="p-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-700 font-medium">
                                        {p.results?.place ?? '—'}
                                    </div>
                                </td>
                                <td className="p-3 text-gray-900 break-words">{p.userName}</td>
                                <td className="p-3 break-words">
                                    <div className="text-gray-900">{p.dogName}</div>
                                    {p.dogBreed && <div className="text-sm text-gray-600">{p.dogBreed}</div>}
                                </td>
                                {showScores && <td className="p-3 text-center text-gray-700">{displayNumber(p.results?.search)}</td>}
                                {showScores && <td className="p-3 text-center text-gray-700">{displayNumber(p.results?.obedience)}</td>}
                                {showScores && <td className="p-3 text-center text-[#007AFF] font-bold">{displayNumber(p.results?.total)}</td>}
                                {showScores && (
                                    <td className="p-3">
                                        <Badge variant="outline" className={`text-sm py-1 font-normal ${qualificationBadgeClass(p.results?.qualification)}`}>
                                            {p.results?.qualification || '—'}
                                        </Badge>
                                    </td>
                                )}
                                {showTitle && <td className="p-3 text-gray-900 break-words">{p.results?.title?.trim() || '—'}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function ResultsPage({ showToast }: ResultsPageProps) {
    const [competitions, setCompetitions] = useState<CompetitionWithResults[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCompetition, setExpandedCompetition] = useState<string | null>(null);

    useEffect(() => {
        loadCompletedCompetitions();
    }, []);

    const loadCompletedCompetitions = async () => {
        try {
            const data = await apiRequest('/competitions');
            const completedCompetitions = data.filter((comp: Competition) => comp.status === 'completed');

            const competitionsWithParticipants = await Promise.all(
                completedCompetitions.map(async (comp: Competition) => {
                    try {
                        const details = await apiRequest(`/competitions/${comp.id}/results`);
                        return { ...comp, participants: details.participants || [] };
                    } catch (e) {
                        console.error(`Failed to load participants for ${comp.id}:`, e);
                        return { ...comp, participants: [] };
                    }
                })
            );

            setCompetitions(competitionsWithParticipants);
        } catch (e) {
            console.error('Failed to load competitions:', e);
            showToast('Помилка завантаження результатів', 'error');
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (competitionId: string) => {
        setExpandedCompetition(expandedCompetition === competitionId ? null : competitionId);
    };

    if (loading) {
        return (
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-[60px]">
                <div className="text-center text-gray-500">Завантаження...</div>
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-[60px]">
            <div className="mb-8 sm:mb-12 text-left">
                <h1 className="text-4xl md:text-[48px] mb-2 text-gray-900 font-semibold">Результати</h1>
                <p className="text-base sm:text-lg text-gray-600">Результати минулих змагань</p>
            </div>

            {competitions.length === 0 ? (
                <div className="bg-white shadow-sm rounded-[20px] p-[60px_20px] sm:p-[100px_40px] text-center">
                    <Medal className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-5 opacity-50 text-gray-400" />
                    <p className="text-base sm:text-lg text-gray-500">Немає доступних результатів</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {competitions.map((competition) => {
                        const isExpanded = expandedCompetition === competition.id;
                        const confirmedParticipants = competition.participants?.filter(p => p.status === 'confirmed') || [];
                        const groups: Record<string, ExtendedParticipant[]> = {};

                        confirmedParticipants.forEach(p => {
                            const key = p.class || p.category || 'Без класу';
                            if (!groups[key]) groups[key] = [];
                            groups[key].push(p);
                        });

                        Object.values(groups).forEach(groupParticipants => {
                            groupParticipants.sort((a, b) => (a.results?.place ?? 999) - (b.results?.place ?? 999));
                        });

                        const hasParticipants = Object.keys(groups).length > 0;
                        const competitionDate = competition.startDate || competition.date;
                        const showTitle = TITLE_COMPETITION_LEVELS.has(competition.level);

                        return (
                            <Card
                                key={competition.id}
                                className="bg-white shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
                            >
                                <CardHeader
                                    className={`${hasParticipants ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
                                    onClick={() => hasParticipants && toggleExpand(competition.id)}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="flex-1">
                                            <CardTitle className="text-xl sm:text-2xl text-gray-900 mb-2 flex items-start gap-2">
                                                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-[#007AFF] flex-shrink-0 mt-1" />
                                                <span className="pb-1 font-semibold">{competition.name}</span>
                                            </CardTitle>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm sm:text-base text-gray-600 ml-7 sm:ml-8 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4" />
                                                    {competitionDate ? new Date(competitionDate).toLocaleDateString('uk-UA') : 'Дата не визначена'}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4" />
                                                    {competition.location}
                                                </div>
                                            </div>
                                        </div>

                                        {hasParticipants ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-[#007AFF] hover:text-[#0066CC] hover:bg-blue-50 self-start sm:self-center"
                                            >
                                                {isExpanded ? (
                                                    <>
                                                        <ChevronUp className="w-4 h-4 mr-2" />
                                                        Згорнути
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="w-4 h-4 mr-2" />
                                                        Переглянути результати
                                                    </>
                                                )}
                                            </Button>
                                        ) : (
                                            <Badge variant="outline" className="border-gray-300 text-gray-600 self-start sm:self-center">
                                                Немає учасників
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>

                                {isExpanded && hasParticipants && (
                                    <CardContent className="pt-0">
                                        <div className="space-y-8">
                                            {Object.entries(groups).map(([groupName, groupParticipants]) => (
                                                <ResultsGroup
                                                    key={groupName}
                                                    groupName={groupName}
                                                    participants={groupParticipants}
                                                    showTitle={showTitle}
                                                />
                                            ))}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
