import React, { useState, useEffect } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { User, ShieldCheck, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

export default function SelectProfile() {
    const { user, logout } = useAuth();
    const { loginProfile, currentProfile } = useProfile();
    const navigate = useNavigate();

    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isFirstRun, setIsFirstRun] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        // If already has profile selected, go to dashboard
        if (currentProfile) {
            navigate('/dashboard');
            return;
        }

        loadProfiles();
    }, [user, currentProfile, navigate]);

    const loadProfiles = async () => {
        try {
            const list = await base44.entities.Staff.list();
            if (list.length === 0) {
                setIsFirstRun(true);
                // Auto create admin logic could be here, or we force them to "Setup"
                // Let's offer a "Setup Admin" button if empty
            } else {
                setProfiles(list);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAdmin = async () => {
        try {
            setLoading(true);
            await base44.entities.Staff.create({
                name: 'Administrador',
                pin: '0000', // Default PIN, ask to change later
                role: 'admin',
                permissions: { all: true }
            });
            await loadProfiles();
        } catch (err) {
            setError('Erro ao criar admin inicial.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        if (!selectedUser) return;

        try {
            setLoading(true);
            await loginProfile(selectedUser.id, pin);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Erro ao entrar');
            setLoading(false);
        }
    };

    const openPinDialog = (profile) => {
        setSelectedUser(profile);
        setPin('');
        setError('');
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
    }

    if (isFirstRun) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500 p-4">
                <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
                        <ShieldCheck className="w-10 h-10" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Configuração Inicial</h1>
                        <p className="text-gray-500 mt-2">Parece que é sua primeira vez usando o novo sistema de usuários. Vamos criar um perfil de Administrador para você.</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl text-left border border-blue-100">
                        <p className="text-sm font-semibold text-blue-900">Credenciais Padrão:</p>
                        <p className="text-sm text-blue-700 mt-1">Nome: <strong>Administrador</strong></p>
                        <p className="text-sm text-blue-700">PIN: <strong>0000</strong></p>
                    </div>
                    <Button onClick={handleCreateAdmin} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-lg">
                        Criar Perfil Admin
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-4xl">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-900">Quem está acessando?</h1>
                    <p className="text-gray-500 mt-2">Selecione seu perfil para continuar</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-center">
                    {profiles.map(profile => (
                        <button
                            key={profile.id}
                            onClick={() => openPinDialog(profile)}
                            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 hover:-translate-y-1 transition-all flex flex-col items-center gap-4 group"
                        >
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold transition-colors
                                ${profile.role === 'admin' ? 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-600 group-hover:text-white'}
                            `}>
                                {profile.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-gray-900 text-lg">{profile.name}</h3>
                                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">{profile.role}</p>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="mt-12 text-center">
                    <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">
                        Sair da conta (Tenant)
                    </button>
                </div>
            </div>

            <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
                <DialogContent className="max-w-xs rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-center">Olá, {selectedUser?.name}</DialogTitle>
                        <DialogDescription className="text-center">Digite seu PIN para entrar</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleLogin} className="space-y-4 mt-2">
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                autoFocus
                                type="password"
                                inputMode="numeric"
                                maxLength={6}
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full text-center text-2xl tracking-widest font-bold py-3 border rounded-xl bg-gray-50 focus:bg-white border-gray-200 outline-none focus:border-blue-500 transition-all"
                                placeholder="••••"
                            />
                        </div>
                        {error && <p className="text-xs text-red-500 text-center font-medium bg-red-50 p-2 rounded-lg">{error}</p>}
                        <Button type="submit" className="w-full rounded-xl h-10" disabled={pin.length < 3 || loading}>
                            {loading ? 'Verificando...' : 'Entrar'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
