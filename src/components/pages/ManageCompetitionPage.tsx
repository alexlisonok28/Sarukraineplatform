import { useState, useEffect } from 'react';
import { ArrowLeft, Users, FileText, Save, Award, UserCheck, UserX, CheckCircle, XCircle, Eye, Download, Trash2, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { UserProfile, Competition } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';

type ManageCompetitionPageProps = {
    competitionId: string;
    onBack: () => void;
    showToast: (msg: string, type?: any) => void;
    userProfile: UserProfile;
};

type ExtendedParticipant = {
    id?: string;
    userId: string;
    dogId: string;
    userName: string;
    dogName: string;
    dogBirth: string;
    dogBreed: string;
    dogPedigree: string;
    dogChip: string;
    dogWorkbook?: string;
    handlerName?: string;
    handlerId?: string;
    status: string;
    results?: {
        search?: number;
        obedience?: number;
        total?: number;
        place?: number;
        qualification?: string;
        notes?: string;
    };
    category?: string;
    class?: string;
    documents?: string[];
};

const calculateQualification = (searchValue?: number, obedienceValue?: number) => {
    if (searchValue === undefined && obedienceValue === undefined) {
        return { total: undefined, qualification: undefined };
    }

    const search = searchValue || 0;
    const obedience = obedienceValue || 0;
    const total = search + obedience;
    let qualification = 'Не класифіковано';

    if (search < 140 || obedience < 70 || total <= 209.5) qualification = 'Недостатньо';
    else if (total <= 239.5) qualification = 'Задовільно';
    else if (total <= 269.5) qualification = 'Добре';
    else if (total <= 285.5) qualification = 'Дуже добре';
    else if (total <= 300) qualification = 'Відмінно';

    return { total, qualification };
};

const isEligibleForPlace = (participant: ExtendedParticipant) =>
    participant.status === 'confirmed' &&
    participant.results?.qualification &&
    participant.results.qualification !== 'Недостатньо' &&
    participant.results.qualification !== 'Не класифіковано';

const DocumentLink = ({ path }: { path: string }) => {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => setUrl(`/api/files/${encodeURIComponent(path)}`), [path]);
    if (!url) return <span className="text-gray-400">Завантаження...</span>;
    return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#007AFF] hover:text-[#0066CC] underline text-base"><FileText size={16} /> Переглянути</a>;
};

export default function ManageCompetitionPage({ competitionId, onBack, showToast }: ManageCompetitionPageProps) {
    const [competition, setCompetition] = useState<Competition | null>(null);
    const [participants, setParticipants] = useState<ExtendedParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rejectDialog, setRejectDialog] = useState<{open: boolean, userId: string, dogId: string, category?: string, participantId?: string}>({open: false, userId: '', dogId: ''});
    const [rejectReason, setRejectReason] = useState('');
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => { loadData(); }, [competitionId]);
    useEffect(() => {
        const handleVisibilityChange = () => { if (document.visibilityState === 'visible') loadData(); };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', loadData);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', loadData);
        };
    }, [competitionId]);

    const loadData = async () => {
        setLoading(true);
        setAccessDenied(false);
        try {
            const data = await apiRequest(`/competitions/${competitionId}/details`);
            setCompetition(data);
            const processedParticipants: ExtendedParticipant[] = data.participants.map((p: ExtendedParticipant) => {
                let category = p.category;
                let assignedClass = p.class;
                if (!category && data.categories?.length === 1) category = data.categories[0];
                if (!assignedClass) assignedClass = category || data.level;

                let updatedResults = p.results;
                if (updatedResults) {
                    const { total, qualification } = calculateQualification(updatedResults.search, updatedResults.obedience);
                    updatedResults = { ...updatedResults, total, qualification };
                    if (qualification === 'Недостатньо' || qualification === 'Не класифіковано' || !qualification) {
                        updatedResults.place = undefined;
                    }
                }
                return { ...p, category, class: assignedClass, results: updatedResults };
            });
            setParticipants(processedParticipants);
        } catch (e: any) {
            console.error(e);
            if (e.message?.includes('403') || e.message?.includes('Forbidden')) setAccessDenied(true);
            else showToast('Не вдалося завантажити дані змагання', 'error');
        } finally { setLoading(false); }
    };

    const handleStatusChange = async (userId: string, dogId: string, newStatus: string, reason?: string, category?: string, participantId?: string) => {
        setParticipants(prev => prev.map(p => {
            const isMatch = participantId ? p.id === participantId : p.userId === userId && p.dogId === dogId && (category ? p.category === category : true);
            if (!isMatch) return p;
            const updated = { ...p, status: newStatus };
            if (reason) updated.results = { ...updated.results, notes: reason };
            return updated;
        }));
        try {
            await apiRequest(`/competitions/${competitionId}/participants`, 'PUT', { userId, dogId, category, participantId, status: newStatus, results: reason ? { notes: reason } : undefined });
            showToast(`Статус змінено на "${newStatus === 'confirmed' ? 'Підтверджено' : 'Відхилено'}"`, 'success');
        } catch { showToast('Помилка збереження статусу', 'error'); }
    };

    const confirmReject = () => {
        if (!rejectReason.trim()) { showToast('Вкажіть причину відмови', 'error'); return; }
        handleStatusChange(rejectDialog.userId, rejectDialog.dogId, 'rejected', rejectReason, rejectDialog.category, rejectDialog.participantId);
        setRejectDialog({open: false, userId: '', dogId: ''});
        setRejectReason('');
    };

    const handleResultChange = (userId: string, dogId: string, field: 'search' | 'obedience', value: string, category?: string, participantId?: string) => {
        const numValue = value === '' ? undefined : parseFloat(value);
        setParticipants(prev => prev.map(p => {
            const isMatch = participantId ? p.id === participantId : p.userId === userId && p.dogId === dogId && (category ? p.category === category : true);
            if (!isMatch) return p;
            const newResults = { ...(p.results || {}), [field]: numValue };
            const { total, qualification } = calculateQualification(newResults.search, newResults.obedience);
            return {
                ...p,
                results: {
                    ...newResults,
                    total,
                    qualification,
                    place: qualification === 'Недостатньо' || qualification === 'Не класифіковано' || !qualification ? undefined : newResults.place,
                }
            };
        }));
    };

    const calculatePlaces = () => {
        const grouped: Record<string, ExtendedParticipant[]> = {};
        const newParticipants = participants.map(p => ({
            ...p,
            results: p.results ? { ...p.results, place: undefined } : p.results,
        }));

        newParticipants.forEach(p => {
            if (!p.category || !p.class || !isEligibleForPlace(p)) return;
            const key = p.category === p.class ? p.category : `${p.category} - ${p.class}`;
            (grouped[key] ||= []).push(p);
        });

        Object.values(grouped).forEach(group => {
            group.sort((a, b) => {
                const totalDiff = (b.results?.total || 0) - (a.results?.total || 0);
                if (totalDiff !== 0) return totalDiff;
                const searchDiff = (b.results?.search || 0) - (a.results?.search || 0);
                if (searchDiff !== 0) return searchDiff;
                return (b.dogBirth ? new Date(b.dogBirth).getTime() : 0) - (a.dogBirth ? new Date(a.dogBirth).getTime() : 0);
            });
            group.forEach((p, index) => {
                if (p.results) p.results.place = index + 1;
            });
        });

        setParticipants(newParticipants);
        showToast('Місця перераховано!', 'info');
    };

    const saveAll = async () => {
        setSaving(true);
        try {
            await Promise.all(participants.map(p => apiRequest(`/competitions/${competitionId}/participants`, 'PUT', {
                userId: p.userId, dogId: p.dogId, category: p.category, participantId: p.id, status: p.status, results: p.results,
            })));
            showToast('Зміни збережено успішно!', 'success');
        } catch { showToast('Помилка збереження', 'error'); }
        finally { setSaving(false); }
    };

    const downloadProtocolDOCX = async () => {
        try {
            const { Document, Packer, Paragraph, Table: DocxTable, TableCell, TableRow, WidthType, AlignmentType, PageOrientation } = await import('docx');
            const grouped: Record<string, ExtendedParticipant[]> = {};
            participants.forEach(p => {
                if (p.status !== 'confirmed' || !p.category || !p.class) return;
                const key = p.category === p.class ? p.category : `${p.category} - ${p.class}`;
                (grouped[key] ||= []).push(p);
            });

            const startDateValue = competition?.startDate || competition?.date;
            const startDate = startDateValue ? new Date(startDateValue).toLocaleDateString('uk-UA') : '';
            const endDate = competition?.endDate ? new Date(competition.endDate).toLocaleDateString('uk-UA') : '';
            const protocolDate = startDate && endDate && startDate !== endDate ? `${startDate} - ${endDate}` : startDate || endDate;
            const judges = (competition as any)?.judges;
            const headJudge = Array.isArray(judges) && judges.length ? String(judges[0]) : '';

            const sections: any[] = [
                new Paragraph({ text: 'ПРОТОКОЛ ЗМАГАНЬ', alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
                new Paragraph({ text: competition?.name || '', alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
                new Paragraph({ text: `Дата: ${protocolDate}`, spacing: { after: 100 } }),
                new Paragraph({ text: `Місце: ${competition?.location || ''}`, spacing: { after: 400 } }),
            ];

            Object.keys(grouped).forEach(groupName => {
                const groupParticipants = grouped[groupName].sort((a, b) => (a.results?.place || 999) - (b.results?.place || 999));
                sections.push(new Paragraph({ text: groupName, spacing: { before: 300, after: 200 } }));
                const rows = [new TableRow({ children: ['#','Власник/Провідник','Кличка собаки','Дата народж.','Порода','Родовід','Чіп/Клеймо','Пошук','Послух','Бали','Оцінка'].map(text => new TableCell({ children: [new Paragraph(text)] })) })];
                groupParticipants.forEach(p => {
                    const eligible = isEligibleForPlace(p);
                    const place = eligible && p.results?.place ? String(p.results.place) : '-';
                    const ownerHandler = p.handlerName && p.handlerName !== p.userName ? `${p.userName} / ${p.handlerName}` : p.userName;
                    const values = [
                        place,
                        ownerHandler,
                        p.dogName || '-',
                        p.dogBirth ? new Date(p.dogBirth).toLocaleDateString('uk-UA') : '-',
                        p.dogBreed || '-',
                        p.dogPedigree || '-',
                        p.dogChip || '-',
                        p.results?.search !== undefined ? p.results.search.toFixed(1) : '-',
                        p.results?.obedience !== undefined ? p.results.obedience.toFixed(1) : '-',
                        p.results?.total !== undefined ? p.results.total.toFixed(1) : '-',
                        p.results?.qualification || '-',
                    ];
                    rows.push(new TableRow({ children: values.map(text => new TableCell({ children: [new Paragraph(text)] })) }));
                });
                sections.push(new DocxTable({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
            });

            sections.push(new Paragraph({ text: '', spacing: { before: 600 } }));
            sections.push(new Paragraph({ text: `Головний суддя: ${headJudge || '_____________________'}`, spacing: { after: 300 } }));
            sections.push(new Paragraph({ text: 'Секретар: _____________________' }));

            const doc = new Document({ sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } }, children: sections }] });
            const blob = await Packer.toBlob(doc);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `protocol_${competition?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`;
            document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
            showToast('Протокол DOCX завантажено!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Помилка генерації DOCX', 'error');
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#F5F5F7] text-gray-600">Завантаження...</div>;
    if (!competition) return <div className="text-center bg-[#F5F5F7] text-gray-900 pt-20">Змагання не знайдено</div>;
    if (accessDenied) return <div className="text-center bg-[#F5F5F7] text-gray-900 pt-20">Доступ заборонений</div>;

    const groups: Record<string, ExtendedParticipant[]> = {};
    const pendingParticipants = participants.filter(p => p.status === 'registered');
    participants.forEach(p => {
        if (p.status === 'registered' || p.status === 'rejected' || !p.category || !p.class) return;
        const key = p.category === p.class ? p.category : `${p.category} - ${p.class}`;
        (groups[key] ||= []).push(p);
    });

    return (
        <div className="min-h-screen bg-[#F5F5F7]">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-[60px] pb-20">
                <div className="flex flex-col gap-4 mb-8 sm:mb-12">
                    <Button variant="ghost" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 pl-2 pr-4 py-2 h-auto rounded-xl -ml-2 w-fit text-base" onClick={onBack}><ArrowLeft className="w-5 h-5 mr-2" /> Назад</Button>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div><h1 className="text-4xl md:text-[48px] mb-2 text-gray-900 font-semibold text-[36px]">{competition.name}</h1><p className="text-base sm:text-lg text-gray-600">Керування учасниками та результатами</p></div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <Button variant="secondary" className="bg-white text-gray-700 hover:bg-gray-50 w-full sm:w-auto shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-none text-base" onClick={calculatePlaces}><Award className="w-4 h-4 mr-2" /> Розрахувати місця</Button>
                            <Button variant="secondary" className="bg-white text-gray-700 hover:bg-gray-50 w-full sm:w-auto shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-none text-base" onClick={downloadProtocolDOCX}><Download className="w-4 h-4 mr-2" /> Завантажити протокол</Button>
                            <Button className="bg-[#007AFF] text-white hover:bg-[#0066CC] w-full sm:w-auto text-base" onClick={saveAll} disabled={saving}><Save className="w-4 h-4 mr-2" /> {saving ? 'Збереження...' : 'Зберегти зміни'}</Button>
                        </div>
                    </div>
                </div>

                {pendingParticipants.length > 0 && <Card className="mb-8 bg-white border-none"><CardHeader><CardTitle className="text-gray-900 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-[#007AFF]" /> Нові заявки на участь ({pendingParticipants.length})</CardTitle></CardHeader><CardContent>
                    <div className="space-y-4">{pendingParticipants.map((p, idx) => <div key={p.id || idx} className="bg-gray-50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="font-medium">{p.userName}</div><div className="text-gray-600">{p.dogName} · {p.category}</div>{p.documents?.map(doc => <DocumentLink key={doc} path={doc} />)}</div><div className="flex gap-2"><Button size="sm" className="bg-green-50 text-green-600" onClick={() => handleStatusChange(p.userId,p.dogId,'confirmed',undefined,p.category,p.id)}><CheckCircle className="w-4 h-4 mr-1" /> Прийняти</Button><Button size="sm" className="bg-red-50 text-red-600" onClick={() => setRejectDialog({open:true,userId:p.userId,dogId:p.dogId,category:p.category,participantId:p.id})}><XCircle className="w-4 h-4 mr-1" /> Відхилити</Button></div></div>)}</div>
                </CardContent></Card>}

                <Dialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog({open:false,userId:'',dogId:''})}><DialogContent className="bg-white"><DialogHeader><DialogTitle>Вкажіть причину відмови</DialogTitle><DialogDescription>Ця інформація буде доступна учаснику.</DialogDescription></DialogHeader><Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} /><DialogFooter><Button variant="outline" onClick={() => setRejectDialog({open:false,userId:'',dogId:''})}>Скасувати</Button><Button variant="destructive" onClick={confirmReject}>Відхилити заявку</Button></DialogFooter></DialogContent></Dialog>

                <div className="flex overflow-x-auto gap-2 mb-6">{Object.keys(groups).map(groupName => <button key={groupName} onClick={() => setActiveTab(groupName)} className={`px-6 py-3 rounded-xl whitespace-nowrap ${((activeTab || Object.keys(groups)[0]) === groupName) ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-700'}`}>{groupName}</button>)}</div>

                {Object.keys(groups).length > 0 ? (() => {
                    const currentTab = activeTab || Object.keys(groups)[0];
                    const groupParticipants = groups[currentTab] || [];
                    return <Card className="bg-white border-none"><CardContent className="pt-6">
                        <div className="hidden md:block overflow-x-auto"><table className="w-full border-collapse"><thead><tr className="bg-gray-50"><th className="p-4 text-left">#</th><th className="p-4 text-left">Учасник</th><th className="p-4 text-left">Собака</th><th className="p-4 text-left">Пошук</th><th className="p-4 text-left">Послух</th><th className="p-4 text-left">Заг. бал</th><th className="p-4 text-left">Оцінка</th></tr></thead><tbody>{groupParticipants.map((p, idx) => <tr key={p.id || idx} className="border-t"><td className="p-4">{isEligibleForPlace(p) && p.results?.place ? p.results.place : '-'}</td><td className="p-4">{p.userName}</td><td className="p-4">{p.dogName}</td><td className="p-4"><Input type="number" className="w-24" value={p.results?.search ?? ''} onChange={e => handleResultChange(p.userId,p.dogId,'search',e.target.value,p.category,p.id)} /></td><td className="p-4"><Input type="number" className="w-24" value={p.results?.obedience ?? ''} onChange={e => handleResultChange(p.userId,p.dogId,'obedience',e.target.value,p.category,p.id)} /></td><td className="p-4 font-semibold">{p.results?.total ?? '-'}</td><td className="p-4"><Badge variant="outline" className={p.results?.qualification === 'Недостатньо' ? 'border-red-500 text-red-600' : ''}>{p.results?.qualification || '—'}</Badge></td></tr>)}</tbody></table></div>
                        <div className="md:hidden space-y-4">{groupParticipants.map((p, idx) => <div key={p.id || idx} className="bg-gray-50 rounded-xl p-4"><div className="flex justify-between"><strong>{p.userName}</strong><span>{isEligibleForPlace(p) && p.results?.place ? `#${p.results.place}` : '—'}</span></div><div className="text-gray-600 mb-3">{p.dogName}</div><div className="grid grid-cols-2 gap-3"><Input type="number" value={p.results?.search ?? ''} onChange={e => handleResultChange(p.userId,p.dogId,'search',e.target.value,p.category,p.id)} /><Input type="number" value={p.results?.obedience ?? ''} onChange={e => handleResultChange(p.userId,p.dogId,'obedience',e.target.value,p.category,p.id)} /></div><div className="mt-3">Бал: {p.results?.total ?? '-'} · {p.results?.qualification || '—'}</div></div>)}</div>
                    </CardContent></Card>;
                })() : <div className="bg-white rounded-[20px] p-16 text-center"><Users className="w-16 h-16 mx-auto mb-5 text-gray-400" /><p className="text-gray-500">{pendingParticipants.length ? 'Прийміть заявки учасників, щоб почати вводити результати' : 'Немає підтверджених учасників'}</p></div>}
            </div>
        </div>
    );
}
