import { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import { UserProfile, UserRole } from '../../types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Loader2, User, Users, Trash2 } from 'lucide-react';

interface AdminPageProps {
  userProfile: UserProfile | null;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function AdminPage({ userProfile, showToast }: AdminPageProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<UserProfile | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/admin/users');
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users', error);
      showToast('Не вдалося завантажити список користувачів', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setUpdating(userId);
      await apiRequest(`/admin/users/${userId}/role`, 'PUT', { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      showToast('Роль користувача оновлено', 'success');
    } catch (error) {
      console.error('Failed to update role', error);
      showToast('Не вдалося оновити роль', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const openDeleteDialog = (target: UserProfile) => {
    if (target.id === userProfile?.id) {
      showToast('Не можна видалити власний обліковий запис', 'error');
      return;
    }
    setDeleteCandidate(target);
    setDeleteStep(1);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteCandidate(null);
    setDeleteStep(1);
  };

  const confirmFirstDeleteStep = () => {
    setDeleteStep(2);
  };

  const confirmDeleteUser = async () => {
    if (!deleteCandidate) return;

    try {
      setDeleting(deleteCandidate.id);
      await apiRequest(`/admin/users/${deleteCandidate.id}`, 'DELETE');
      setUsers(current => current.filter(u => u.id !== deleteCandidate.id));
      showToast('Користувача видалено', 'success');
      setDeleteCandidate(null);
      setDeleteStep(1);
    } catch (error) {
      console.error('Failed to delete user', error);
      showToast('Не вдалося видалити користувача', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700 hover:bg-red-200';
      case 'organizer': return 'bg-purple-100 text-purple-700 hover:bg-purple-200';
      default: return 'bg-blue-100 text-blue-700 hover:bg-blue-200';
    }
  };

  const translateRole = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Адміністратор';
      case 'organizer': return 'Організатор';
      case 'user': return 'Користувач';
      default: return role;
    }
  };

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="min-h-screen pt-24 px-6 flex justify-center">
        <div className="text-center">
          <h1 className="text-gray-900 mb-4">Доступ заборонено</h1>
          <p className="text-gray-600">У вас немає прав для перегляду цієї сторінки.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-[60px] px-[24px] pb-[48px] max-w-[1400px] mx-auto pr-[24px] pl-[24px] py-[60px]">
      <div className="flex items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl md:text-[48px] mb-2 text-gray-900 font-semibold">Адміністрування</h1>
          <p className="text-base sm:text-lg text-gray-600">Керування користувачами та ролями</p>
        </div>
      </div>

      <Card className="bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Users className="w-5 h-5 text-[#007AFF]" />
            Список користувачів
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#007AFF] animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 hover:bg-transparent">
                  <TableHead className="text-gray-700">Користувач</TableHead>
                  <TableHead className="text-gray-700">Email</TableHead>
                  <TableHead className="text-gray-700">Поточна роль</TableHead>
                  <TableHead className="text-gray-700">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <TableCell className="text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[#007AFF]">
                          <User className="w-4 h-4" />
                        </div>
                        {user.name || 'Без імені'}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={`${getRoleBadgeColor(user.role)} border-none`}>
                        {translateRole(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Select
                          disabled={updating === user.id || deleting === user.id || user.id === userProfile.id}
                          value={user.role}
                          onValueChange={(value: UserRole) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-[140px] bg-white border-gray-200 text-gray-900">
                            <SelectValue placeholder="Оберіть роль" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-gray-200 text-gray-900">
                            <SelectItem value="user">Користувач</SelectItem>
                            <SelectItem value="organizer">Організатор</SelectItem>
                            <SelectItem value="admin">Адміністратор</SelectItem>
                          </SelectContent>
                        </Select>

                        <button
                          type="button"
                          onClick={() => openDeleteDialog(user)}
                          disabled={user.id === userProfile.id || deleting === user.id}
                          className="action-icon-button bg-red-100 text-red-700 hover:bg-red-200 border-none cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Видалити користувача ${user.name || user.email}`}
                          title={user.id === userProfile.id ? 'Не можна видалити власний обліковий запис' : 'Видалити користувача'}
                        >
                          {deleting === user.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteCandidate} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <AlertDialogContent className="bg-white text-gray-900 border-gray-200">
          {deleteStep === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Видалити користувача?</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-600">
                  Ви збираєтеся видалити <strong>{deleteCandidate?.name || 'користувача'}</strong> ({deleteCandidate?.email}).
                  Це небезпечна дія і потребує повторного підтвердження.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDeleteDialog}>Скасувати</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); confirmFirstDeleteStep(); }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Продовжити видалення
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Підтвердіть видалення ще раз</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-600">
                  Обліковий запис <strong>{deleteCandidate?.name || deleteCandidate?.email}</strong> буде видалено без можливості відновлення. Ви точно хочете продовжити?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={!!deleting} onClick={closeDeleteDialog}>Скасувати</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!!deleting}
                  onClick={(e) => { e.preventDefault(); confirmDeleteUser(); }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? 'Видалення...' : 'Так, видалити користувача'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
