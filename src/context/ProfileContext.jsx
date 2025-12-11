import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/auth/AuthContext';

const ProfileContext = createContext();

export function ProfileProvider({ children }) {
    const { user } = useAuth();
    const [currentProfile, setCurrentProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initial load from storage
    useEffect(() => {
        console.log('ProfileContext Effect:', { user })
        if (!user) {
            setCurrentProfile(null);
            setLoading(false);
            localStorage.removeItem('persisted_profile_id');
            return;
        }

        const storedProfileId = localStorage.getItem('persisted_profile_id');
        console.log('Stored Profile:', storedProfileId)

        // Load profiles to check if any exist
        setLoading(true);
        base44.entities.Staff.list().then(async profiles => {
            console.log('Fetched Profiles:', profiles)

            // First-time setup: no profiles exist, create admin automatically
            if (profiles.length === 0) {
                try {
                    console.log('No profiles found, creating admin automatically...');
                    const newAdmin = await base44.entities.Staff.create({
                        name: 'Administrador',
                        pin: '0000',
                        role: 'admin',
                        permissions: { all: true }
                    });
                    console.log('Admin created automatically:', newAdmin);
                    setCurrentProfile(newAdmin);
                    localStorage.setItem('persisted_profile_id', newAdmin.id);
                } catch (err) {
                    console.error('Error creating admin automatically:', err);
                }
                setLoading(false);
                return;
            }

            // If there's a stored profile, validate it
            if (storedProfileId) {
                const found = profiles.find(p => p.id === storedProfileId);
                if (found) {
                    setCurrentProfile(found);
                } else {
                    localStorage.removeItem('persisted_profile_id');
                }
            }
            setLoading(false);
        }).catch(err => {
            console.error('Profile Load Error:', err)
            setLoading(false)
        });
    }, [user]);

    const loginProfile = async (profileId, pin) => {
        const profiles = await base44.entities.Staff.list();
        const profile = profiles.find(p => p.id === profileId);

        if (!profile) throw new Error('Perfil não encontrado');
        if (profile.pin !== pin) throw new Error('PIN incorreto');

        setCurrentProfile(profile);
        localStorage.setItem('persisted_profile_id', profile.id);
        return profile;
    };

    const logoutProfile = () => {
        setCurrentProfile(null);
        localStorage.removeItem('persisted_profile_id');
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
