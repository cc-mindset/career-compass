## 1. Persistence API

- [ ] 1.1 Add `PivotExploration` and Action Plan Mongo models
- [ ] 1.2 List/get/create exploration routes; new never overwrites prior
- [ ] 1.3 Authenticated Action Plan create linked to exploration + selected path
- [ ] 1.4 Vitest for immutability and plan auth gate

## 2. Client workspace

- [ ] 2.1 Build authenticated pivot workspace screens (empty / history / detail)
- [ ] 2.2 Wire list/open/continue/new to persistence APIs
- [ ] 2.3 Gate Build a plan behind account with continuation context
- [ ] 2.4 Point dashboard Career Pivot nav to workspace routes

## 3. Guest conversion handoff

- [ ] 3.1 On guest→account, claim last pivot preview into a new exploration record
- [ ] 3.2 Resume selected path for Action Plan when that was the pending action

## 4. Verification

- [ ] 4.1 Manual: two explorations; first unchanged
- [ ] 4.2 Manual: open saved exploration restores paths
- [ ] 4.3 Manual: plan requires auth; nav opens workspace
- [ ] 4.4 Confirm dependency on `career-pivot-generate`
