import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/auth/AuthContext';

const ProfileContext = createContext();

export function ProfileProvider({ children }) {
    const { user } = useAuth();
    const [currentProfile, setCurrentProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initial load from session storage only if same user is logged in
    useEffect(() => {
        if (!user) {
            setCurrentProfile(null);
            setLoading(false);
            sessionStorage.removeItem('active_profile_id');
            return;
        }

        const storedProfileId = sessionStorage.getItem('active_profile_id');
        if (storedProfileId) {
            // Validate if this profile actually belongs to the user and fetch fresh permissions
            base44.entities.Staff.list().then(profiles => {
                const found = profiles.find(p => p.id === storedProfileId);
                if (found) {
                    setCurrentProfile(found);
                } else {
                    sessionStorage.removeItem('active_profile_id');
                }
                setLoading(false);
            }).catch(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [user]);

    const loginProfile = async (profileId, pin) => {
        const profiles = await base44.entities.Staff.list();
        const profile = profiles.find(p => p.id === profileId);

        if (!profile) throw new Error('Perfil não encontrado');
        if (profile.pin !== pin) throw new Error('PIN incorreto');

        setCurrentProfile(profile);
        sessionStorage.setItem('active_profile_id', profile.id);
        return profile;
    };

    const logoutProfile = () => {
        setCurrentProfile(null);
        sessionStorage.removeItem('active_profile_id');
    };

    const isAdmin = () => currentProfile?.role === 'admin';
    const hasPermission = (perm) => isAdmin() || currentProfile?.permissions?.[perm] === true;

    return (
        <ProfileContext.Provider value={{ currentProfile, loading, loginProfile, logoutProfile, isAdmin, hasPermission }}>
            {children}
        </ProfileContext.Provider>
    );
}

export const useProfile = () => {
    const context = useContext(ProfileContext);
    if (context === undefined) {
        throw new Error('useProfile must be used within a ProfileProvider');
    }
    return context;
};
