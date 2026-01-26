import React, { createContext, useContext, useState, useEffect } from "react";

// --- Types ---

export type Agent = {
    id: string;
    name: string;
    avatar: string;
    role: "admin" | "agent";
    email: string;
};

// Represents a Deal/Opportunity in the Kanban board
export type Deal = {
    id: string;
    chatId: string; // Links to the whatsapp chat JID
    title: string;
    company: string;
    value: string;
    stageId: string;
    tags: string[];
    createdAt: number;
};

// Represents the Funnel Configuration
export type FunnelStage = {
    id: string;
    title: string;
    color: string;
};

export type WhisperMessage = {
    id: string;
    chatId: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
};

interface CrmContextType {
    // Agents
    agents: Agent[];
    currentUser: Agent;
    setCurrentUser: (agent: Agent) => void;
    addAgent: (agent: Agent) => void;
    updateAgent: (agentId: string, updates: Partial<Agent>) => void;
    removeAgent: (agentId: string) => void;

    // Assignments
    assignments: Record<string, string>; // chatId -> agentId
    assignChat: (chatId: string, agentId: string) => void;
    getChatAssignee: (chatId: string) => Agent | undefined;

    // Funnels / Deals
    stages: FunnelStage[];
    addStage: (stage: FunnelStage) => void;
    removeStage: (stageId: string) => void;
    deals: Deal[];
    addDeal: (deal: Deal) => void;
    updateDeal: (dealId: string, updates: Partial<Deal>) => void;
    updateDealStage: (dealId: string, stageId: string) => void;
    getDealByChatId: (chatId: string) => Deal | undefined;
    removeDeal: (dealId: string) => void;

    // Contact Info (Extended)
    contactNotes: Record<string, string>; // chatId -> notes
    saveContactNote: (chatId: string, note: string) => void;
    contactTags: Record<string, string[]>; // chatId -> tags
    saveContactTags: (chatId: string, tags: string[]) => void;
    hiddenContacts: string[];
    hideContact: (chatId: string) => void;
    unhideContact: (chatId: string) => void;
    hiddenChatPassword: string;
    setHiddenChatPassword: (password: string) => void;
    setDeals: React.Dispatch<React.SetStateAction<Deal[]>>;

    // Whispers (Spying/Internal notes)
    whispers: WhisperMessage[];
    addWhisper: (whisper: Omit<WhisperMessage, "id" | "timestamp">) => void;
}

// --- Mock Data ---

const MOCK_AGENTS: Agent[] = [
    { id: "1", name: "Israel", avatar: "https://github.com/shadcn.png", role: "admin", email: "israel@crm.com" },
    { id: "2", name: "Pedro", avatar: "https://i.pravatar.cc/150?u=pedro", role: "agent", email: "pedro@crm.com" },
    { id: "3", name: "Ana", avatar: "https://i.pravatar.cc/150?u=ana", role: "agent", email: "ana@crm.com" },
];

export const DEFAULT_STAGES: FunnelStage[] = [
    { id: "leads", title: "Novos Leads", color: "bg-blue-500" },
    { id: "contact", title: "Em Contato", color: "bg-yellow-500" },
    { id: "proposal", title: "Proposta Enviada", color: "bg-purple-500" },
    { id: "negotiation", title: "Em Negociação", color: "bg-orange-500" },
    { id: "won", title: "Fechado", color: "bg-emerald-500" },
];

const CrmContext = createContext<CrmContextType | undefined>(undefined);

export function CrmProvider({ children }: { children: React.ReactNode }) {
    // --- State ---
    const [agents, setAgents] = useState<Agent[]>(() => {
        const saved = localStorage.getItem("crm_agents");
        return saved ? JSON.parse(saved) : MOCK_AGENTS;
    });

    const [currentUser, setCurrentUser] = useState<Agent>(() => {
        const saved = localStorage.getItem("crm_current_user");
        if (saved) {
            const savedUser = JSON.parse(saved);
            return savedUser;
        }
        return MOCK_AGENTS[0];
    });

    // Persisted Assignments (chatId -> agentId)
    const [assignments, setAssignments] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem("crm_assignments");
        return saved ? JSON.parse(saved) : {};
    });

    // Persisted Deals
    const [deals, setDeals] = useState<Deal[]>(() => {
        const saved = localStorage.getItem("crm_deals");
        return saved ? JSON.parse(saved) : [];
    });

    const [contactNotes, setContactNotes] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem("crm_notes");
        return saved ? JSON.parse(saved) : {};
    });

    const [contactTags, setContactTags] = useState<Record<string, string[]>>(() => {
        const saved = localStorage.getItem("crm_tags");
        return saved ? JSON.parse(saved) : {};
    });

    const [stages, setStages] = useState<FunnelStage[]>(() => {
        const saved = localStorage.getItem("crm_stages");
        return saved ? JSON.parse(saved) : DEFAULT_STAGES;
    });

    const [hiddenContacts, setHiddenContacts] = useState<string[]>(() => {
        const saved = localStorage.getItem("crm_hidden_contacts");
        return saved ? JSON.parse(saved) : [];
    });

    const [hiddenChatPassword, setHiddenChatPassword] = useState<string>(() => {
        return localStorage.getItem("crm_hidden_password") || "123456";
    });

    const [whispers, setWhispers] = useState<WhisperMessage[]>(() => {
        const saved = localStorage.getItem("crm_whispers");
        return saved ? JSON.parse(saved) : [];
    });

    // --- Effects to Save State ---
    useEffect(() => {
        localStorage.setItem("crm_agents", JSON.stringify(agents));
    }, [agents]);

    useEffect(() => {
        localStorage.setItem("crm_current_user", JSON.stringify(currentUser));
    }, [currentUser]);

    useEffect(() => {
        localStorage.setItem("crm_assignments", JSON.stringify(assignments));
    }, [assignments]);

    useEffect(() => {
        localStorage.setItem("crm_deals", JSON.stringify(deals));
    }, [deals]);

    useEffect(() => {
        localStorage.setItem("crm_notes", JSON.stringify(contactNotes));
    }, [contactNotes]);

    useEffect(() => {
        localStorage.setItem("crm_tags", JSON.stringify(contactTags));
    }, [contactTags]);

    useEffect(() => {
        localStorage.setItem("crm_stages", JSON.stringify(stages));
    }, [stages]);

    useEffect(() => {
        localStorage.setItem("crm_hidden_contacts", JSON.stringify(hiddenContacts));
    }, [hiddenContacts]);

    useEffect(() => {
        localStorage.setItem("crm_hidden_password", hiddenChatPassword);
    }, [hiddenChatPassword]);

    useEffect(() => {
        localStorage.setItem("crm_whispers", JSON.stringify(whispers));
    }, [whispers]);

    // --- Actions ---

    const assignChat = (chatId: string, agentId: string) => {
        setAssignments((prev) => ({ ...prev, [chatId]: agentId }));
    };

    const getChatAssignee = (chatId: string) => {
        const agentId = assignments[chatId];
        return agents.find((a) => a.id === agentId);
    };

    const addDeal = (deal: Deal) => {
        setDeals((prev) => [...prev, deal]);
    };

    const updateDeal = (dealId: string, updates: Partial<Deal>) => {
        setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, ...updates } : d)));
    };

    const updateDealStage = (dealId: string, stageId: string) => {
        updateDeal(dealId, { stageId });
    };

    const getDealByChatId = (chatId: string) => {
        return deals.find((d) => d.chatId === chatId);
    };

    const saveContactNote = (chatId: string, note: string) => {
        setContactNotes((prev) => ({ ...prev, [chatId]: note }));
    };

    const saveContactTags = (chatId: string, tags: string[]) => {
        setContactTags((prev) => ({ ...prev, [chatId]: tags }));
    };

    const hideContact = (chatId: string) => {
        setHiddenContacts((prev) => [...new Set([...prev, chatId])]);
    };

    const unhideContact = (chatId: string) => {
        setHiddenContacts((prev) => prev.filter(id => id !== chatId));
    };

    const addAgent = (agent: Agent) => {
        setAgents((prev) => [...prev, agent]);
    };

    const updateAgent = (agentId: string, updates: Partial<Agent>) => {
        setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, ...updates } : a)));
        // If updating current user, update it too
        if (currentUser.id === agentId) {
            setCurrentUser((prev) => ({ ...prev, ...updates }));
        }
    };

    const removeAgent = (agentId: string) => {
        setAgents((prev) => prev.filter((a) => a.id !== agentId));
        // Clean up assignments for this agent
        setAssignments((prev) => {
            const newAssignments = { ...prev };
            Object.keys(newAssignments).forEach(chatId => {
                if (newAssignments[chatId] === agentId) {
                    delete newAssignments[chatId];
                }
            });
            return newAssignments;
        });
    };

    const addStage = (stage: FunnelStage) => {
        setStages((prev) => [...prev, stage]);
    };

    const removeStage = (stageId: string) => {
        setStages((prev) => prev.filter((s) => s.id !== stageId));
        // Move deals from deleted stage to first stage
        setDeals((prev) => prev.map(d =>
            d.stageId === stageId ? { ...d, stageId: stages[0]?.id || "leads" } : d
        ));
    };

    const removeDeal = (dealId: string) => {
        setDeals((prev) => prev.filter((d) => d.id !== dealId));
    };

    const addWhisper = (whisper: Omit<WhisperMessage, "id" | "timestamp">) => {
        const newWhisper: WhisperMessage = {
            ...whisper,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now() / 1000
        };
        setWhispers((prev) => [...prev, newWhisper]);
    };

    return (
        <CrmContext.Provider
            value={{
                agents,
                currentUser,
                setCurrentUser,
                addAgent,
                updateAgent,
                removeAgent,
                assignments,
                assignChat,
                getChatAssignee,
                stages,
                addStage,
                removeStage,
                deals,
                addDeal,
                updateDeal,
                updateDealStage,
                getDealByChatId,
                removeDeal,
                contactNotes,
                saveContactNote,
                contactTags,
                saveContactTags,
                hiddenContacts,
                hideContact,
                unhideContact,
                hiddenChatPassword,
                setHiddenChatPassword,
                setDeals,
                whispers,
                addWhisper
            }}
        >
            {children}
        </CrmContext.Provider>
    );
}

export function useCrm() {
    const context = useContext(CrmContext);
    if (context === undefined) {
        throw new Error("useCrm must be used within a CrmProvider");
    }
    return context;
}
