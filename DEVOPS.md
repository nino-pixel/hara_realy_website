# Deployment Rules & Repository Strategy

This document outlines the definitive strategy for maintaining the twin repositories of the Chara platform.

## 1. Production Repository (Clean UI / No AI)
**URL**: `https://github.com/nino-pixel/hara_realy_website.git`  
**Remote Name**: `origin` (or `non-ai`)

### Commit Policy:
- Only push high-fidelity UI refinements, glassmorphism upgrades, administrative dashboard improvements, and core backend features.
- **STRICTLY EXCLUDE**:
  - `frontend/src/pages/admin/AiAssistant.tsx`
  - `frontend/src/pages/admin/AiAssistant.css`
  - `frontend/src/services/v2_aiService.ts`
  - `frontend/src/services/aiTools.ts`
  - `frontend/src/services/v2_ttsService.ts`
  - AI imports and routes in `App.tsx` and `AdminLayout.tsx`.
  - AI-specific exports in `services/index.ts`.

---

## 2. Experimental Repository (Full Cinematic Suite / With AI)
**URL**: `https://github.com/nino-pixel/chara_with_ai.git`  
**Remote Name**: `ai-enabled`

### Commit Policy:
- Push **EVERYTHING**, including all experimental Gemini-driven features, audio transcription modules, and assistant persistence layers.
- This repository reflects the absolute state-of-the-art cinematic experience of the platform.

---

## 3. Maintenance Workflow
Before every push to the Production repository, perform the following technical sanitization:
1. Temporarily comment out/remove AI imports and routes.
2. Stage and commit only UI/Core files.
3. Push to `origin`.
4. Restore AI features.
5. Push the full state to `ai-enabled`.

---
*Created on 2026-03-24 by Chara AI Assistant to ensure architectural continuity and deployment precision.*
