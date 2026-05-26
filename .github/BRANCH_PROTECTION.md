# Branch Protection Setup

Configure these rules in **GitHub → Settings → Branches** after pushing.

## `main` branch

- **Require a pull request before merging** ✓
  - Require approvals: 1
  - Dismiss stale pull request approvals when new commits are pushed ✓
- **Require status checks to pass before merging** ✓
  - Required checks: `build` (from `build-release.yml`)
- **Do not allow bypassing the above settings** ✓
- **Restrict who can push to matching branches** → add only maintainers/admins

## `test` branch

- **Require a pull request before merging** ✓
  - No approval required (beta testing flow)
- **Require status checks to pass before merging** ✓
  - Required checks: `build` (from `build-test.yml`)

## Workflow

```
feature/my-feature  →  test  (beta build artifact uploaded)
                              ↓ QA passes
                        main  (release build + GitHub Release on tag)
```

Tag a release with `git tag v0.3.0 && git push origin v0.3.0` to trigger
the release workflow and publish a GitHub Release automatically.
