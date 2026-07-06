# ManyHats Pro - Flutter Future-Ready Backend Strategy

**Version:** 1.0  
**Last Updated:** July 6, 2026  
**Status:** Authoritative Architecture Document  
**Audience:** Backend Architects, Mobile Engineers, DevOps Team

---

## Executive Overview

The **Flutter Future-Ready Backend** is designed so that Supabase built for Lovable web MVP **requires ZERO changes** when Flutter mobile apps arrive in Phase 2.

### Core Principle

```
┌──────────────────────────────┐
│   SUPABASE BACKEND (NOW)     │
│                              │
│   Built for:                 │
│   • Lovable web app (Phase 1)│
│   • Flutter mobile (Phase 2) │
│   • Future integrations      │
│                              │
│   Strategy:                  │
│   Design once                │
│   Add clients later          │
└──────────────────────────────┘
```

**NOT a second backend.**  
**NOT different database.**  
**NOT separate API.**

Same Supabase instance serves all clients.

---

## Architecture for Mobile

### API Design Principles

1. **Stateless** - No client state stored on backend
2. **Pagination** - Handle large datasets efficiently
3. **Filtering** - Rich query capabilities
4. **Subscriptions** - Real-time updates for all clients
5. **Error Handling** - Consistent error responses
6. **Rate Limiting** - Prevent abuse, handle offline reconnect bursts

---

## Mobile-First Tables (Phase 1 Creation, Phase 2+ Usage)

### 1. Mobile Device Registration

```sql
CREATE TABLE mobile_devices (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    device_type TEXT, -- 'ios', 'android'
    device_model TEXT,
    os_version TEXT,
    app_version TEXT,
    
    push_notification_token TEXT,
    last_active_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP
);
```

### 2. Offline Sync Queue

```sql
CREATE TABLE offline_sync_queue (
    id UUID PRIMARY KEY,
    device_id UUID,
    
    table_name TEXT,
    record_id UUID,
    operation TEXT, -- 'INSERT', 'UPDATE', 'DELETE'
    change_data JSONB,
    
    sync_status TEXT, -- 'pending', 'synced', 'error'
    synced_at TIMESTAMP,
    
    created_at TIMESTAMP
);
```

### 3. Project Photos (with GPS)

```sql
CREATE TABLE project_photos (
    id UUID PRIMARY KEY,
    project_id UUID,
    
    photo_url TEXT,
    gps_latitude NUMERIC,
    gps_longitude NUMERIC,
    
    created_at TIMESTAMP
);
```

### 4. Voice Notes & Transcriptions

```sql
CREATE TABLE voice_notes (
    id UUID PRIMARY KEY,
    project_id UUID,
    
    audio_url TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMP
);

CREATE TABLE ai_transcriptions (
    id UUID PRIMARY KEY,
    voice_note_id UUID,
    transcription_text TEXT,
    confidence_score NUMERIC
);
```

---

## Offline-First Architecture

### Offline Mode Strategy

```
┌─────────────────────────────────────────┐
│  FLUTTER APP STATE                      │
│                                         │
│  Online Mode:                           │
│  ├─ Read/write from Supabase directly   │
│  ├─ Real-time subscriptions active      │
│  └─ Data always current                 │
│                                         │
│  Offline Mode:                          │
│  ├─ Read/write to local SQLite          │
│  ├─ Real-time subscriptions paused      │
│  ├─ Changes queued for sync             │
│  └─ App fully functional                │
└─────────────────────────────────────────┘
        ↓ (Connection restored)
┌─────────────────────────────────────────┐
│  SYNC PROCESS                           │
│                                         │
│  1. Upload offline_sync_queue entries   │
│  2. Detect conflicts                    │
│  3. Merge with server version           │
│  4. Download latest data                │
│  5. Update local SQLite                 │
│  6. Resume subscriptions                │
└─────────────────────────────────────────┘
```

---

## Real-time Sync

### Supabase Real-time Subscriptions

```typescript
// Subscribe to project changes
supabase
  .channel(`project:${projectId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'projects',
      filter: `id=eq.${projectId}`,
    },
    (payload) => {
      // Update local database and UI
      updateProjectDisplay(payload.new);
    }
  )
  .subscribe();
```

---

## Push Notifications

### Push Notification Flow

```
Supabase Edge Function triggers:
├─ New project assigned to technician
├─ Customer viewed proposal
├─ Material delivery notification
├─ Payment received
└─ Schedule reminder
        ↓
   Firebase Cloud Messaging / APNs
        ↓
   Mobile Device
        ↓
   Push Notification displayed
```

---

## GPS & Location Services

### GPS Capture on Mobile

```typescript
// Flutter captures GPS location
final position = await Geolocator.getCurrentPosition();

// Store with project context
await supabase
  .from('project_locations')
  .insert({
    project_id: projectId,
    latitude: position.latitude,
    longitude: position.longitude,
    arrived_at: DateTime.now(),
  });
```

---

## Future Mobile Features (Same Backend)

### Phase 2 Mobile Features

```
Offline Mode ✅
├─ Complete app works without internet
├─ All data cached locally
├─ Changes queued for sync
└─ Seamless reconnect

Push Notifications ✅
├─ Job assignments
├─ Customer messages
├─ Schedule reminders
└─ Payment notifications

GPS & Mapping ✅
├─ Navigate to job site
├─ Route optimization
├─ Arrival/departure timestamps
└─ Drive time analytics

Camera Integration ✅
├─ Photo capture with metadata
├─ GPS coordinates embedded
├─ Automatic upload when online
└─ Before/after photos

Time Tracking ✅
├─ Clock in/out
├─ Break logging
├─ Project-specific time
└─ Labor efficiency tracking

Signature Capture ✅
├─ Customer approval signatures
├─ Work completion sign-off
├─ Safety documentation
└─ Warranty acknowledgment
```

### Phase 3+ Advanced Features (Still same backend)

```
AR Measurements
├─ Tape measure via AR
├─ Point cloud capture
├─ Dimension extraction
└─ Accuracy validation

LiDAR Scanning
├─ Drone/mobile LiDAR capture
├─ Point cloud processing
├─ 3D model generation
└─ Site mapping

Septic-Specific Tools
├─ Septic system diagrams
├─ Regulatory compliance
├─ Inspection checklists
└─ Design calculations

AI Assistant
├─ Voice commands
├─ Job context awareness
├─ Automated data entry
└─ Smart recommendations
```

**No Backend Changes Needed** - All connect to same Supabase

---

## Testing Strategy

### Before Flutter Launch

```typescript
// 1. Test Supabase with mobile client library
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

// 2. Simulate offline scenarios
// - Disconnect network
// - Make changes
// - Reconnect
// - Verify sync queue processes

// 3. Load test real-time subscriptions
// - 100 concurrent subscriptions
// - High event frequency
// - Mobile network conditions

// 4. GPS accuracy testing
// - Verify coordinates stored correctly
// - Test location privacy
// - Validate distance calculations

// 5. Push notification testing
// - Send 1000 test notifications
// - Verify delivery rate >98%
// - Test token refresh
```

---

## Document References

- [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md) - Overall product strategy
- [PROJECT_INTELLIGENCE_LAYER.md](./PROJECT_INTELLIGENCE_LAYER.md) - Core data model
- [CONTRACTOR_FINANCIAL_ENGINE.md](./CONTRACTOR_FINANCIAL_ENGINE.md) - Financial system
- [LOVABLE_BUILD_GUIDE.md](./LOVABLE_BUILD_GUIDE.md) - Web app development

---

**Last Updated:** July 6, 2026  
**Status:** ✅ Authoritative - Mobile Backend Architecture  
**Next Review:** Before Flutter Phase 2 begins (Q1 2027)