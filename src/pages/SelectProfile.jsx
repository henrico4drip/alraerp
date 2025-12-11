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
    const [showHint, setShowHint] = useState(false);


    useEffect(() => {
        console.log('[SelectProfile] useEffect:', { user, currentProfile });
        if (!user) {
            navigate('/login');
            return;
        }

        // If already has profile selected, go to dashboard
        if (currentProfile) {
            console.log('[SelectProfile] Already has profile, going to dashboard');
            navigate('/dashboard');
            return;
        }

        loadProfiles();
    }, [user, currentProfile, navigate]);

    const loadProfiles = async () => {
        try {
            console.log('[SelectProfile] Loading profiles...');
            const list = await base44.entities.Staff.list();
            console.log('[SelectProfile] Profiles loaded:', list);
            setProfiles(list);

            // Show hint only once
            const hasAdmin = list.some(p => p.name === 'Administrador');
            const seen = localStorage.getItem('pin_hint_seen') === 'true';
            if (hasAdmin && !seen) {
                setShowHint(true);
                localStorage.setItem('pin_hint_seen', 'true');
            }
        } catch (err) {
            console.error('[SelectProfile] Error loading profiles:', err);
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

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-4xl">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-900">Quem está acessando?</h1>
                    <p className="text-gray-500 mt-2">Selecione seu perfil para continuar</p>
                    {showHint && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-700">
                            <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-4 py-1.5 rounded-full inline-flex items-center gap-2">
                                <span className="text-lg">💡</span> Dica: O PIN inicial do Administrador é <b>0000</b>
                            </p>
                        </div>
                    )}
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
