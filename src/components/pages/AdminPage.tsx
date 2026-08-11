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
import { Loader2, Shield, User, Users } from 'lucide-react';
import { toast } from "sonner";

interface AdminPageProps {
  userProfile: UserProfile | null;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function AdminPage({ userProfile, showToast }: AdminPageProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

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
      
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));
      
      showToast('Роль користувача оновлено', 'success');
    } catch (error) {
      console.error('Failed to update role', error);
      showToast('Не вдалося оновити роль', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700 hover:bg-red-200';
      case 'organizer':
        return 'bg-purple-100 text-purple-700 hover:bg-purple-200';
      default:
        return 'bg-blue-100 text-blue-700 hover:bg-blue-200';
    }
  };

  const translateRole = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Адміністратор';
      case 'organizer':
        return 'Організатор';
      case 'user':
        return 'Користувач';
      default:
        return role;
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
                      <Select
                        disabled={updating === user.id || user.id === userProfile.id}
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}