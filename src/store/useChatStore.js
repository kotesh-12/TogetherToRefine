import { create } from 'zustand';
import { WELCOME_MSG } from '../constants/chatData';
import { NativeBridge } from '../services/nativeBridge';


const useChatStore = create((set, get) => ({
    // Core State
    messages: [],
    input: '',
    loading: false,
    isAgentMode: localStorage.getItem('isAgentMode') === 'true',
    zenMode: localStorage.getItem('ttr_zen_mode') === 'true',
    isFocusMode: false,
    currentSessionId: null,
    sessions: [],
    
    // --- SIDDH SENTINEL (Security) ---
    isLocked: localStorage.getItem('ttr_locked') === 'true',
    biometricEnabled: localStorage.getItem('ttr_biometric') === 'true',
    setIsLocked: (locked) => {
        localStorage.setItem('ttr_locked', locked);
        set({ isLocked: locked });
    },
    setBiometricEnabled: (enabled) => {
        localStorage.setItem('ttr_biometric', enabled);
        set({ biometricEnabled: enabled });
    },
    
    // UI State
    showSidebar: false,
    showSidebarExtra: false,
    showPathModal: false,
    showThemeGallery: false,
    showLangMenu: false,
    showSlashMenu: false,
    showHeaderActions: false,
    isRoadmapMode: false,
    isDevCanvasOpen: false,
    devCanvasData: null,
    isKnowledgeHubOpen: false,
    setKnowledgeHubOpen: (open) => set({ isKnowledgeHubOpen: open }),
    setDevCanvas: (data) => set({ 
        devCanvasData: data,
        isDevCanvasOpen: true 
    }),
    updateDevCanvasData: (data) => set({ devCanvasData: data }),
    closeDevCanvas: () => set({ 
        isDevCanvasOpen: false, 
        devCanvasData: null 
    }),
    incognitoMode: false,
    motherTongue: 'English',
    theme: localStorage.getItem('ttr_theme') || 'dark',
    knowledgeBase: JSON.parse(localStorage.getItem('ttr_knowledge_base') || '[]'),
    suiAddress: localStorage.getItem('ttr_sui_address') || '',
    autoCruise: localStorage.getItem('ttr_auto_cruise') === 'true',
    isWarRoom: false,
    
    // --- MAYA-ROOP (Liquid UI) ---
    uiHeatmap: JSON.parse(localStorage.getItem('ttr_ui_heatmap') || '{}'),
    visibleTools: JSON.parse(localStorage.getItem('ttr_visible_tools') || '["explain", "roadmap", "devcanvas", "knowledge"]'),


    // Actions
    setWarRoom: (active) => set({ isWarRoom: active }),
    setAutoCruise: (active) => {
        localStorage.setItem('ttr_auto_cruise', active);
        set({ autoCruise: active });
    },
    setSuiAddress: (addr) => {
        localStorage.setItem('ttr_sui_address', addr);
        set({ suiAddress: addr });
    },
    setMessages: (messages) => set({ messages }),
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    setInput: (input) => set({ input }),
    setLoading: (loading) => set({ loading }),
    
    setKnowledgeBase: (kb) => {
        localStorage.setItem('ttr_knowledge_base', JSON.stringify(kb));
        set({ knowledgeBase: kb });
    },
    addKnowledgeNode: (node) => set((state) => {
        const next = [...state.knowledgeBase, node].slice(-50); // Keep last 50 nodes
        localStorage.setItem('ttr_knowledge_base', JSON.stringify(next));
        return { knowledgeBase: next };
    }),
    
    setIsAgentMode: (isAgentMode) => {
        localStorage.setItem('isAgentMode', isAgentMode);
        set({ isAgentMode });
    },
    
    setZenMode: (zenMode) => {
        localStorage.setItem('ttr_zen_mode', zenMode);
        set({ zenMode });
    },
    
    setIsFocusMode: (isFocusMode) => set({ isFocusMode }),
    setShowSidebar: (showSidebar) => set({ showSidebar }),
    setShowSidebarExtra: (showSidebarExtra) => set({ showSidebarExtra }),
    setShowPathModal: (showPathModal) => set({ showPathModal }),
    setShowThemeGallery: (showThemeGallery) => set({ showThemeGallery }),
    setShowLangMenu: (showLangMenu) => set({ showLangMenu }),
    setShowSlashMenu: (showSlashMenu) => set({ showSlashMenu }),
    setShowHeaderActions: (showHeaderActions) => set({ showHeaderActions }),
    
    setTheme: (theme) => {
        localStorage.setItem('ttr_theme', theme);
        set({ theme });
    },
    
    setCurrentSessionId: (id) => set({ currentSessionId: id }),
    setSessions: (sessions) => set({ sessions }),
    
    roadmapData: null,
    setRoadmapMode: (active) => set({ isRoadmapMode: active }),
    setRoadmapData: (data) => set({ roadmapData: data }),
    setDevCanvasOpen: (open) => set({ isDevCanvasOpen: open }),
    setIncognitoMode: (active) => set({ incognitoMode: active }),
    setMotherTongue: (lang) => set({ motherTongue: lang }),
    
    // --- Liquid UI Actions ---
    trackToolUsage: (toolId) => set((state) => {
        const heatmap = { ...state.uiHeatmap };
        heatmap[toolId] = (heatmap[toolId] || 0) + 1;
        localStorage.setItem('ttr_ui_heatmap', JSON.stringify(heatmap));
        
        // Auto-Optimization Logic: If a tool is used > 5 times, ensure it's in visibleTools
        let visible = [...state.visibleTools];
        if (heatmap[toolId] > 5 && !visible.includes(toolId)) {
            visible.push(toolId);
            localStorage.setItem('ttr_visible_tools', JSON.stringify(visible));
        }
        return { uiHeatmap: heatmap, visibleTools: visible };
    }),

    setLiquidTheme: async (themeId) => {
        // Device-Specific Native Mutation
        await NativeBridge.setLocalPreference('ttr_device_theme', themeId);
        set({ theme: themeId });
    },

    // Complex Actions
    startNewChat: () => set({
        messages: [], 
        currentSessionId: null,
        isRoadmapMode: false,
        isDevCanvasOpen: false
    })
}));

export default useChatStore;
