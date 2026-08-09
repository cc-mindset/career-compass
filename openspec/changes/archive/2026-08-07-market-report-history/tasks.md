## 1. Persistence API

- [x] 1.1 Add Mongo models for user Market Report latest + snapshots
- [x] 1.2 Add create/list/get-latest/get-snapshot routes
- [x] 1.3 On create-new: snapshot previous latest, then save new latest
- [x] 1.4 Vitest for immutability of prior snapshots

## 2. Client history UI

- [x] 2.1 Wire history view to list latest + previous
- [x] 2.2 Wire Review snapshot → read-only render via existing adapter
- [x] 2.3 Empty state → setup/create (no fake rows)
- [x] 2.4 After live generate (authenticated), persist latest via history API

## 3. Verification

- [x] 3.1 Manual: two generates → two history entries; first unchanged
- [x] 3.2 Manual: review old snapshot → return to current
- [x] 3.3 Confirm dependency: live generate/adapter already shipped
