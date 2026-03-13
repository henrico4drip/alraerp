# CRM Overhaul Plan

## Current State Analysis
- CRM has basic Inbox, Contacts, Funnel pages 
- Uses EvolutionContext for WhatsApp API, CrmContext for local state
- CrmContext uses mock agents/localStorage - not tied to actual ERP profiles
- No unread message tracking per conversation
- Dashboard has basic notification count from distinct_chats view
- Funnel is basic kanban, missing deal details and filtering
- No agent/responsible tracking per contact

## Implementation Tasks

### Phase 1: Unread Messages System (WhatsApp-like)
1. Add `unreadCounts` state to CrmContext (Record<chatId, number>)
2. Track read/unread per conversation (mark as read when chat opened)
3. Show unread badges on chat list items
4. Show total unread in Dashboard CRM icon
5. Show per-conversation unread in sidebar navigation

### Phase 2: User/Profile Integration  
1. Link CrmContext currentUser to actual ERP profile (useProfile)
2. Map ERP Staff profiles as CRM agents
3. Show current profile as responsible on conversations
4. Assignment system uses real profile IDs

### Phase 3: CRM Layout Redesign
1. Unified layout with Inbox + right panel for contact details/funnel
2. Better conversation header with assignment, stage, tags
3. Integrated contact panel with notes, deals, tags
4. Quick actions (assign, move in funnel, hide, tag)

### Phase 4: Enhanced Kanban/Funnel
1. Better card design with more info (last message, unread, agent)
2. Filtering by agent, tags, value range
3. Sort options per column
4. Quick deal creation from contacts
5. Deal value totals per column

### Phase 5: Dashboard Notifications
1. Real unread counts from CRM context 
2. Per-conversation notification dots
3. Sound notification for new messages
4. Badge clears when conversation is opened
