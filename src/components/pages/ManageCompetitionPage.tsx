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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { PageType } from '../../App';

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
    category?: string; // Assigned category
    class?: string; // Assigned class (level)
    documents?: string[];
};

const DocumentLink = ({ path }: { path: string }) => {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        setUrl(`/api/files/${encodeURIComponent(path)}`);
    }, [path]);

    if (!url) return <span className="text-gray-400">Завантаження...</span>;
    
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#007AFF] hover:text-[#0066CC] underline text-base">
            <FileText size={16} /> Переглянути
        </a>
    );
};

export default function ManageCompetitionPage({ competitionId, onBack, showToast, userProfile }: ManageCompetitionPageProps) {
    const [competition, setCompetition] = useState<Competition | null>(null);
    const [participants, setParticipants] = useState<ExtendedParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rejectDialog, setRejectDialog] = useState<{open: boolean, userId: string, dogId: string, category?: string, participantId?: string}>({open: false, userId: '', dogId: ''});
    const [rejectReason, setRejectReason] = useState('');
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        loadData();
    }, [competitionId]);

    // Reload data when returning to this page (e.g., after editing competition details)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                loadData();
            }
        };
        
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
            
            // Initialize participants with categories if not present
            // Now 'category' comes from server (mapped from 'class' field)
            // and 'class' is also present from server
            // We keep both for compatibility, but 'category' is the primary field for grouping
            
            const processedParticipants: ExtendedParticipant[] = [];

            data.participants.forEach((p: ExtendedParticipant) => {
                // Server now returns 'category' (mapped from 'class')
                // Keep both fields for compatibility
                let category = p.category;
                let assignedClass = p.class;
                
                // Fallback: if category is missing, try to assign from competition categories
                if (!category && data.categories && data.categories.length === 1) {
                    category = data.categories[0];
                }
                
                // Fallback: if class is missing, use category or competition level
                if (!assignedClass) {
                    assignedClass = category || data.level;
                }

                // Recalculate qualification for existing results to apply new rules
                let updatedResults = p.results;
                if (updatedResults && (updatedResults.search !== undefined || updatedResults.obedience !== undefined)) {
                    const search = updatedResults.search || 0;
                    const obedience = updatedResults.obedience || 0;
                    const total = search + obedience;
                    
                    // Auto-calculate qualification with minimum thresholds
                    let qualification = 'Не класифіковано';
                    
                    // Check minimum requirements: search >= 140 AND obedience >= 70
                    if (search < 140 || obedience < 70) {
                        qualification = 'Недостатньо';
                    } else if (total >= 0 && total <= 209.5) {
                        qualification = 'Недостатньо';
                    } else if (total >= 210 && total <= 239.5) {
                        qualification = 'Задовільно';
                    } else if (total >= 240 && total <= 269.5) {
                        qualification = 'Добре';
                    } else if (total >= 270 && total <= 285.5) {
                        qualification = 'Дуже добре';
                    } else if (total >= 286 && total <= 300) {
                        qualification = 'Відмінно';
                    }
                    
                    updatedResults = {
                        ...updatedResults,
                        total,
                        qualification
                    };
                }

                processedParticipants.push({ ...p, category, class: assignedClass, results: updatedResults });
            });

            setParticipants(processedParticipants);
        } catch (e: any) {
            console.error(e);
            if (e.message && (e.message.includes('403') || e.message.includes('Forbidden'))) {
                setAccessDenied(true);
            } else {
                showToast('Не вдалося завантажити дані змагання', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (userId: string, dogId: string, newStatus: string, reason?: string, category?: string, participantId?: string) => {
        // Update local state first
        setParticipants(prev => prev.map(p => {
            // Identify participant: prefers ID, falls back to composite key
            const isMatch = participantId 
                ? p.id === participantId 
                : (p.userId === userId && p.dogId === dogId && (category ? p.category === category : true));
            
            if (isMatch) {
                const updated = { ...p, status: newStatus };
                if (reason) {
                    updated.results = { ...updated.results, notes: reason };
                }
                return updated;
            }
            return p;
        }));

        // Persist immediately
        try {
            await apiRequest(`/competitions/${competitionId}/participants`, 'PUT', {
                userId,
                dogId,
                category,
                participantId,
                status: newStatus,
                results: reason ? { notes: reason } : undefined
            });
            showToast(`Статус змінено на "${newStatus === 'confirmed' ? 'Підтверджено' : 'Відхилено'}"`, 'success');
        } catch (e) {
            showToast('Помилка збереження статусу', 'error');
            // Revert? (Not implementing revert for simplicity, but in prod we should)
        }
    };

    const confirmReject = () => {
        if (!rejectReason.trim()) {
            showToast('Вкажіть причину відмови', 'error');
            return;
        }
        handleStatusChange(rejectDialog.userId, rejectDialog.dogId, 'rejected', rejectReason, rejectDialog.category, rejectDialog.participantId);
        setRejectDialog({open: false, userId: '', dogId: ''});
        setRejectReason('');
    };

    const handleResultChange = (userId: string, dogId: string, field: 'search' | 'obedience', value: string, category?: string, participantId?: string) => {
        const numValue = value === '' ? undefined : parseFloat(value);
        
        setParticipants(prev => prev.map(p => {
            const isMatch = participantId 
                ? p.id === participantId 
                : (p.userId === userId && p.dogId === dogId && (category ? p.category === category : true));

            if (isMatch) {
                const currentResults = p.results || {};
                const newResults = { ...currentResults, [field]: numValue };
                
                // Auto-calculate total
                const search = newResults.search || 0;
                const obedience = newResults.obedience || 0;
                const total = search + obedience;
                
                // Auto-calculate qualification with minimum thresholds
                let qualification = 'Не класифіковано';
                
                // Check minimum requirements: search >= 140 AND obedience >= 70
                if (search < 140 || obedience < 70) {
                    qualification = 'Недостатньо';
                } else if (total >= 0 && total <= 209.5) {
                    qualification = 'Недостатньо';
                } else if (total >= 210 && total <= 239.5) {
                    qualification = 'Задовільно';
                } else if (total >= 240 && total <= 269.5) {
                    qualification = 'Добре';
                } else if (total >= 270 && total <= 285.5) {
                    qualification = 'Дуже добре';
                } else if (total >= 286 && total <= 300) {
                    qualification = 'Відмінно';
                }

                // If any field is undefined (cleared), clear total/qual
                if (newResults.search === undefined && newResults.obedience === undefined) {
                    return { ...p, results: { ...newResults, total: undefined, qualification: undefined, place: undefined } };
                }

                return { 
                    ...p, 
                    results: { 
                        ...newResults, 
                        total, 
                        qualification 
                    } 
                };
            }
            return p;
        }));
    };

    const handleCategoryChange = (userId: string, dogId: string, category: string) => {
         setParticipants(prev => prev.map(p => 
            (p.userId === userId && p.dogId === dogId) ? { ...p, category } : p
        ));
    };

    const calculatePlaces = () => {
        // Group participants by Category + Class
        const groups: Record<string, ExtendedParticipant[]> = {};
        
        participants.forEach(p => {
            if (!p.category || !p.class) return;
            // Avoid duplication: if category and class are the same, use only category
            const key = p.category === p.class ? p.category : `${p.category} - ${p.class}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });

        const newParticipants = [...participants];

        // Sort and assign places within each group
        Object.keys(groups).forEach(key => {
            const group = groups[key];
            
            // Sort Logic:
            // 1. Total Score (Desc)
            // 2. Search Score (Desc)
            // 3. Dog Age (Younger/Later Birth Date -> Desc)
            group.sort((a, b) => {
                const totalA = a.results?.total || 0;
                const totalB = b.results?.total || 0;
                if (totalB !== totalA) return totalB - totalA;

                const searchA = a.results?.search || 0;
                const searchB = b.results?.search || 0;
                if (searchB !== searchA) return searchB - searchA;

                const dateA = a.dogBirth ? new Date(a.dogBirth).getTime() : 0;
                const dateB = b.dogBirth ? new Date(b.dogBirth).getTime() : 0;
                return dateB - dateA;
            });

            // Assign places
            let rank = 1;
            group.forEach(sortedP => {
                const originalIndex = newParticipants.indexOf(sortedP);
                if (originalIndex !== -1) {
                    if (newParticipants[originalIndex].results) {
                        newParticipants[originalIndex].results!.place = rank++;
                    } else {
                         // Initialize if missing
                         newParticipants[originalIndex].results = { place: rank++ };
                    }
                }
            });
        });

        setParticipants(newParticipants);
        showToast('Місця перераховано!', 'info');
    };

    const saveAll = async () => {
        setSaving(true);
        try {
            const promises = participants.map(p => {
                return apiRequest(`/competitions/${competitionId}/participants`, 'PUT', {
                    userId: p.userId,
                    dogId: p.dogId,
                    category: p.category,
                    participantId: p.id,
                    status: p.status, 
                    results: p.results,
                });
            });

            await Promise.all(promises);
            showToast('Зміни збережено успішно!', 'success');
        } catch (e) {
            console.error(e);
            showToast('Помилка збереження', 'error');
        } finally {
            setSaving(false);
        }
    };

    const downloadProtocolDOCX = async () => {
        try {
            const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType } = await import('docx');
            const groups: Record<string, ExtendedParticipant[]> = {};
            participants.forEach(p => {
                if (p.status !== 'confirmed') return;
                if (p.category && p.class) {
                    // Avoid duplication: if category and class are the same, use only category
                    const key = p.category === p.class ? p.category : `${p.category} - ${p.class}`;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(p);
                }
            });
            const sections: any[] = [];
            sections.push(new Paragraph({ text: 'ПРОТОКОЛ ЗМАГАНЬ', alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
            sections.push(new Paragraph({ text: competition?.name || '', alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
            sections.push(new Paragraph({ text: `Дата: ${competition?.date ? new Date(competition.date).toLocaleDateString('uk-UA') : ''}`, spacing: { after: 100 } }));
            sections.push(new Paragraph({ text: `Місце: ${competition?.location || ''}`, spacing: { after: 400 } }));
            Object.keys(groups).forEach(groupName => {
                const groupParticipants = groups[groupName];
                groupParticipants.sort((a, b) => (a.results?.place || 999) - (b.results?.place || 999));
                sections.push(new Paragraph({ text: groupName, spacing: { before: 300, after: 200 } }));
                const tableRows = [
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph('#')] }),
                            new TableCell({ children: [new Paragraph('Власник/Провідник')] }),
                            new TableCell({ children: [new Paragraph('Кличка собаки')] }),
                            new TableCell({ children: [new Paragraph('Дата народж.')] }),
                            new TableCell({ children: [new Paragraph('Порода')] }),
                            new TableCell({ children: [new Paragraph('Родовід')] }),
                            new TableCell({ children: [new Paragraph('Чіп/Клеймо')] }),
                            new TableCell({ children: [new Paragraph('Пошук')] }),
                            new TableCell({ children: [new Paragraph('Послух')] }),
                            new TableCell({ children: [new Paragraph('Бали')] }),
                            new TableCell({ children: [new Paragraph('Оцінка')] }),
                        ],
                    }),
                ];
                groupParticipants.forEach(p => {
                    const place = p.results?.place ? String(p.results.place) : '-';
                    const ownerHandler = p.handlerName && p.handlerName !== p.userName 
                        ? `${p.userName} / ${p.handlerName}` 
                        : p.userName;
                    const dogName = p.dogName || '-';
                    const dogBirth = p.dogBirth ? new Date(p.dogBirth).toLocaleDateString('uk-UA') : '-';
                    const breed = p.dogBreed || '-';
                    const pedigree = p.dogPedigree || '-';
                    const chip = p.dogChip || '-';
                    const search = p.results?.search ? p.results.search.toFixed(1) : '-';
                    const obedience = p.results?.obedience ? p.results.obedience.toFixed(1) : '-';
                    const total = p.results?.total ? p.results.total.toFixed(1) : '-';
                    const qual = p.results?.qualification || '-';
                    tableRows.push(
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph(place)] }),
                                new TableCell({ children: [new Paragraph(ownerHandler)] }),
                                new TableCell({ children: [new Paragraph(dogName)] }),
                                new TableCell({ children: [new Paragraph(dogBirth)] }),
                                new TableCell({ children: [new Paragraph(breed)] }),
                                new TableCell({ children: [new Paragraph(pedigree)] }),
                                new TableCell({ children: [new Paragraph(chip)] }),
                                new TableCell({ children: [new Paragraph(search)] }),
                                new TableCell({ children: [new Paragraph(obedience)] }),
                                new TableCell({ children: [new Paragraph(total)] }),
                                new TableCell({ children: [new Paragraph(qual)] }),
                            ],
                        })
                    );
                });
                sections.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
            });
            sections.push(new Paragraph({ text: '', spacing: { before: 600 } }));
            sections.push(new Paragraph({ text: 'Головний суддя: _____________________', spacing: { after: 300 } }));
            sections.push(new Paragraph({ text: 'Секретар: _____________________' }));
            const doc = new Document({ sections: [{ children: sections }] });
            const blob = await Packer.toBlob(doc);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `protocol_${competition?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast('Протокол DOCX завантажено!', 'success');
        } catch (error) {
            console.error('Error generating DOCX:', error);
            showToast('Помилка генерації DOCX', 'error');
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen bg-[#F5F5F7] text-gray-600">Завантаження...</div>;
    }

    if (!competition) {
        return <div className="text-center bg-[#F5F5F7] text-gray-900 pt-20">Змагання не знайдено</div>;
    }

    if (accessDenied) {
        return <div className="text-center bg-[#F5F5F7] text-gray-900 pt-20">Доступ заборонений</div>;
    }

    // Grouping for Render
    const groups: Record<string, ExtendedParticipant[]> = {};
    const pendingParticipants = participants.filter(p => p.status === 'registered');

    participants.forEach(p => {
        if (p.status === 'registered' || p.status === 'rejected') return; // Don't show in results tables if pending or rejected
        
        if (p.category && p.class) {
            // Avoid duplication: if category and class are the same, use only category
            const key = p.category === p.class ? p.category : `${p.category} - ${p.class}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        }
    });

    return (
        <div className="min-h-screen bg-[#F5F5F7]">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-[60px] pb-20">
                {/* Header */}
                <div className="flex flex-col gap-4 mb-8 sm:mb-12">
                    {/* Back Button */}
                    <Button 
                        variant="ghost" 
                        className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 pl-2 pr-4 py-2 h-auto rounded-xl transition-all duration-300 -ml-2 w-fit text-base" 
                        onClick={onBack}
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" /> Назад
                    </Button>
                    
                    {/* Title and Actions */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <h1 className="text-4xl md:text-[48px] mb-2 text-gray-900 font-semibold text-[36px]">{competition.name}</h1>
                            <p className="text-base sm:text-lg text-gray-600">Керування учасниками та результатами</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <Button 
                                variant="secondary" 
                                className="bg-white text-gray-700 hover:bg-gray-50 w-full sm:w-auto shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-none text-base"
                                onClick={calculatePlaces}
                            >
                                <Award className="w-4 h-4 mr-2" /> Розрахувати місця
                            </Button>
                            <Button 
                                variant="secondary" 
                                className="bg-white text-gray-700 hover:bg-gray-50 w-full sm:w-auto shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-none text-base"
                                onClick={downloadProtocolDOCX}
                            >
                                <Download className="w-4 h-4 mr-2" /> Завантажити протокол
                            </Button>
                            <Button 
                                className="bg-[#007AFF] text-white hover:bg-[#0066CC] w-full sm:w-auto shadow-[0_4px_12px_rgba(0,122,255,0.3)] text-base"
                                onClick={saveAll}
                                disabled={saving}
                            >
                                <Save className="w-4 h-4 mr-2" /> {saving ? 'Збереження...' : 'Зберегти зміни'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Pending Applications */}
                {pendingParticipants.length > 0 && (
                    <Card className="mb-8 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-none">
                        <CardHeader>
                            <CardTitle className="text-gray-900 flex items-center gap-2 text-lg sm:text-xl">
                                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#007AFF]" /> Нові заявки на участь ({pendingParticipants.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Mobile: Cards */}
                            <div className="md:hidden space-y-4">
                                {pendingParticipants.map((p, idx) => (
                                    <div key={p.id || `${p.userId}-${p.dogId}-${idx}`} className="bg-gray-50 rounded-xl p-4 space-y-3">
                                        <div>
                                            <div className="text-gray-500 text-sm mb-1">Учасник</div>
                                            <div className="text-gray-900 font-medium text-base">{p.userName}</div>
                                        </div>
                                        
                                        <div>
                                            <div className="text-gray-500 text-sm mb-1">Собака</div>
                                            <div className="text-gray-700 text-base">{p.dogName}</div>
                                            <div className="text-sm text-gray-500">{p.dogBreed}</div>
                                        </div>
                                        
                                        <div>
                                            <div className="text-gray-500 text-sm mb-1">Категорія</div>
                                            <Badge variant="outline" className="border-[#007AFF]/40 text-[#007AFF] text-sm py-1">
                                                {p.category || 'Не вказано'}
                                            </Badge>
                                        </div>
                                        
                                        <div>
                                            <div className="text-gray-500 text-sm mb-1">Документи</div>
                                            <div className="flex flex-col gap-1">
                                                {(p as any).documents && (p as any).documents.length > 0 ? (
                                                    (p as any).documents.map((doc: string, idx: number) => (
                                                        <DocumentLink key={idx} path={doc} />
                                                    ))
                                                ) : (
                                                    <span className="text-gray-400 text-sm">Немає документів</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 pt-2">
                                            <Button 
                                                size="sm" 
                                                className="flex-1 bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
                                                onClick={() => handleStatusChange(p.userId, p.dogId, 'confirmed', undefined, p.category, p.id)}
                                            >
                                                <CheckCircle className="w-4 h-4 mr-1" /> Прийняти
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                                                onClick={() => setRejectDialog({open: true, userId: p.userId, dogId: p.dogId, category: p.category, participantId: p.id})}
                                            >
                                                <XCircle className="w-4 h-4 mr-1" /> Відхилити
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop: Table */}
                            <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
                                <div className="min-w-[800px] px-4 sm:px-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-gray-200 hover:bg-transparent">
                                                <TableHead className="text-gray-600 text-base">Учасник</TableHead>
                                                <TableHead className="text-gray-600 text-base">Собака</TableHead>
                                                <TableHead className="text-gray-600 text-base">Категорія</TableHead>
                                                <TableHead className="text-gray-600 text-base">Документи</TableHead>
                                                <TableHead className="text-gray-600 text-right text-base">Дії</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pendingParticipants.map((p, idx) => (
                                                <TableRow key={p.id || `${p.userId}-${p.dogId}-${idx}`} className="border-gray-200 hover:bg-gray-50">
                                                    <TableCell className="text-gray-900 font-medium text-base">
                                                        {p.userName}
                                                    </TableCell>
                                                    <TableCell className="text-gray-700 text-base">
                                                        {p.dogName}
                                                        <div className="text-sm text-gray-500">{p.dogBreed}</div>
                                                    </TableCell>
                                                    <TableCell className="text-gray-900 text-base">
                                                        <Badge variant="outline" className="border-[#007AFF]/40 text-[#007AFF] text-sm py-1">
                                                            {p.category || 'Не вказано'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            {(p as any).documents && (p as any).documents.length > 0 ? (
                                                                (p as any).documents.map((doc: string, idx: number) => (
                                                                    <DocumentLink key={idx} path={doc} />
                                                                ))
                                                            ) : (
                                                                <span className="text-gray-400 text-sm">Немає документів</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button 
                                                                size="sm" 
                                                                className="bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 px-3"
                                                                onClick={() => handleStatusChange(p.userId, p.dogId, 'confirmed', undefined, p.category, p.id)}
                                                            >
                                                                <CheckCircle className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Прийняти</span>
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3"
                                                                onClick={() => setRejectDialog({open: true, userId: p.userId, dogId: p.dogId, category: p.category, participantId: p.id})}
                                                            >
                                                                <XCircle className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Відхилити</span>
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Dialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog({open: false, userId: '', dogId: ''})}>
                    <DialogContent className="bg-white text-gray-900 border-gray-200">
                        <DialogHeader>
                            <DialogTitle className="text-xl">Вкажіть причину відмови</DialogTitle>
                            <DialogDescription className="text-gray-600 text-base">
                                Ця інформація буде доступна учаснику в особистому кабінеті.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label className="mb-2 block text-gray-700 text-base">Причина</Label>
                            <Textarea 
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Наприклад: Невідповідність віку собаки класу змагань..."
                                className="bg-white border-gray-300 text-gray-900 min-h-[100px] text-base focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRejectDialog({open: false, userId: '', dogId: ''})} className="border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900 bg-white">Скасувати</Button>
                            <Button variant="destructive" onClick={confirmReject} className="bg-red-600 hover:bg-red-700 text-white border-none">Відхилити заявку</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Grouped Tables */}
                <div className="flex overflow-x-auto gap-2 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap pb-2">
                    {Object.keys(groups).map(groupName => (
                         <button
                            key={groupName}
                            onClick={() => setActiveTab(groupName)}
                            className={`px-6 py-3 rounded-xl cursor-pointer transition-all duration-300 whitespace-nowrap flex-shrink-0 text-base ${
                                (activeTab || Object.keys(groups)[0]) === groupName
                                    ? 'bg-[#007AFF] text-white shadow-[0_4px_12px_rgba(0,122,255,0.3)]'
                                    : 'bg-white text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]'
                            }`}
                        >
                            {groupName}
                        </button>
                    ))}
                </div>

                {Object.keys(groups).length > 0 ? (
                    (() => {
                        const currentTab = activeTab || Object.keys(groups)[0];
                        const groupParticipants = groups[currentTab] || [];
                        
                        return (
                            <Card key={currentTab} className="mb-8 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-none">
                                <CardContent className="pt-6">
                                    {/* Mobile: Cards */}
                                    <div className="md:hidden space-y-4">
                                        {groupParticipants.map((p, idx) => (
                                            <div key={p.id || `${p.userId}-${p.dogId}-${idx}`} className="bg-gray-50 rounded-xl p-4 space-y-3">
                                                {/* Place Badge */}
                                                {p.results?.place && (
                                                    <div className="flex justify-center mb-2">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-semibold ${
                                                            p.results.place === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                            p.results.place === 2 ? 'bg-gray-200 text-gray-700' :
                                                            p.results.place === 3 ? 'bg-orange-100 text-orange-700' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            {p.results.place}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <div>
                                                    <div className="text-gray-500 text-sm mb-1">Учасник</div>
                                                    <div className="font-medium text-gray-900 text-base">{p.userName}</div>
                                                </div>
                                                
                                                <div>
                                                    <div className="text-gray-500 text-sm mb-1">Собака</div>
                                                    <div className="text-gray-900 text-base">{p.dogName}</div>
                                                    <div className="text-sm text-gray-500">{p.dogBreed}</div>
                                                    {p.dogBirth && <div className="text-sm text-gray-400">{new Date(p.dogBirth).getFullYear()}</div>}
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-gray-500 text-sm mb-1 block">Пошук</label>
                                                        <Input 
                                                            type="number" 
                                                            className="bg-white border-gray-300 text-center text-gray-900 h-10 text-base focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                                                            value={p.results?.search ?? ''}
                                                            onChange={(e) => handleResultChange(p.userId, p.dogId, 'search', e.target.value, p.category, p.id)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-gray-500 text-sm mb-1 block">Послух</label>
                                                        <Input 
                                                            type="number" 
                                                            className="bg-white border-gray-300 text-center text-gray-900 h-10 text-base focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                                                            value={p.results?.obedience ?? ''}
                                                            onChange={(e) => handleResultChange(p.userId, p.dogId, 'obedience', e.target.value, p.category, p.id)}
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div className="pt-2 border-t border-gray-200">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-gray-600 text-base">Загальний бал:</span>
                                                        <span className="font-semibold text-[#007AFF] text-xl">{p.results?.total ?? '-'}</span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-gray-600 text-base">Оцінка:</span>
                                                        <Badge variant="outline" className={`text-sm py-1 font-normal
                                                            ${p.results?.qualification === 'Відмінно' ? 'border-green-500 text-green-600' :
                                                              p.results?.qualification === 'Дуже добре' ? 'border-blue-500 text-blue-600' :
                                                              p.results?.qualification === 'Добре' ? 'border-cyan-500 text-cyan-600' :
                                                              p.results?.qualification === 'Задовільно' ? 'border-yellow-500 text-yellow-600' :
                                                              p.results?.qualification === 'Недостатньо' ? 'border-red-500 text-red-600' :
                                                              'border-gray-400 text-gray-500'}
                                                        `}>
                                                            {p.results?.qualification || '—'}
                                                        </Badge>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-600 text-base">Статус:</span>
                                                        <span className={`inline-block px-2 py-1 rounded text-sm ${
                                                            p.status === 'confirmed' ? 'text-green-600 bg-green-50' : 'text-gray-500'
                                                        }`}>
                                                            {p.status === 'confirmed' ? 'ОК' : '...'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop: Table */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50">
                                                    <th className="p-4 text-left text-gray-900 text-base font-semibold">#</th>
                                                    <th className="p-4 text-left text-gray-900 text-base font-semibold">Учасник</th>
                                                    <th className="p-4 text-left text-gray-900 text-base font-semibold">Собака</th>
                                                    <th className="p-4 text-left text-gray-900 text-base font-semibold">Пошук</th>
                                                    <th className="p-4 text-left text-gray-900 text-base font-semibold">Послух</th>
                                                    <th className="p-4 text-left text-gray-900 text-base font-semibold">Заг. бал</th>
                                                    <th className="p-4 text-left text-gray-900 text-base font-semibold">Оцінка</th>
                                                    <th className="p-4 text-left text-gray-900 text-base font-semibold">Статус</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupParticipants.map((p, idx) => (
                                                    <tr key={p.id || `${p.userId}-${p.dogId}-${idx}`} className="border-t border-gray-200 hover:bg-gray-50">
                                                        <td className="p-4 text-gray-700">
                                                            {p.results?.place ? (
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                                                                    p.results.place === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                                    p.results.place === 2 ? 'bg-gray-200 text-gray-700' :
                                                                    p.results.place === 3 ? 'bg-orange-100 text-orange-700' :
                                                                    'text-gray-600'
                                                                }`}>
                                                                    {p.results.place}
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="p-4 text-gray-700 text-base">
                                                            {p.userName}
                                                        </td>
                                                        <td className="p-4 text-gray-700 text-base">
                                                            <div>{p.dogName}</div>
                                                            <div className="text-sm text-gray-500">{p.dogBreed}</div>
                                                            {p.dogBirth && <div className="text-sm text-gray-400">{new Date(p.dogBirth).getFullYear()}</div>}
                                                        </td>
                                                        <td className="p-4 text-gray-700">
                                                            <Input 
                                                                type="number" 
                                                                className="bg-white border-gray-300 text-center text-gray-900 h-10 text-base focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] w-24"
                                                                value={p.results?.search ?? ''}
                                                                onChange={(e) => handleResultChange(p.userId, p.dogId, 'search', e.target.value, p.category, p.id)}
                                                            />
                                                        </td>
                                                        <td className="p-4 text-gray-700">
                                                            <Input 
                                                                type="number" 
                                                                className="bg-white border-gray-300 text-center text-gray-900 h-10 text-base focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] w-24"
                                                                value={p.results?.obedience ?? ''}
                                                                onChange={(e) => handleResultChange(p.userId, p.dogId, 'obedience', e.target.value, p.category, p.id)}
                                                            />
                                                        </td>
                                                        <td className="p-4 text-gray-900 text-base font-semibold">
                                                            {p.results?.total ?? '-'}
                                                        </td>
                                                        <td className="p-4 text-gray-700">
                                                            <Badge variant="outline" className={`text-sm py-1 font-normal
                                                                ${p.results?.qualification === 'Відмінно' ? 'border-green-500 text-green-600' :
                                                                  p.results?.qualification === 'Дуже добре' ? 'border-blue-500 text-blue-600' :
                                                                  p.results?.qualification === 'Добре' ? 'border-cyan-500 text-cyan-600' :
                                                                  p.results?.qualification === 'Задовільно' ? 'border-yellow-500 text-yellow-600' :
                                                                  p.results?.qualification === 'Недостатньо' ? 'border-red-500 text-red-600' :
                                                                  'border-gray-400 text-gray-500'}
                                                            `}>
                                                                {p.results?.qualification || '—'}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-4 text-gray-700">
                                                            <span className={`inline-block px-2 py-1 rounded text-sm ${
                                                                p.status === 'confirmed' ? 'text-green-600 bg-green-50' : 'text-gray-500'
                                                            }`}>
                                                                {p.status === 'confirmed' ? 'ОК' : '...'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })()
                ) : (
                    <div className="bg-white shadow-sm rounded-[20px] p-10 sm:p-16 md:p-[100px_40px] text-center">
                        <Users className="w-16 h-16 mx-auto mb-5 opacity-50 text-gray-400" />
                        <p className="text-lg text-gray-500">
                            {pendingParticipants.length > 0 
                                ? 'Прийміть заявки учасників, щоб почати вводити результати'
                                : 'Немає підтверджених учасників'
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}