# Alwaha-Pro 3.0.4 private test build branch

- Source recovery branch: `alwaha-pro-recovery-20261118`
- Recovery commit used: `c04400c49549ac66b8745245f5fc058313a8bce6`
- Build purpose: private APK/AAB validation and two-device testing only.
- Public website and public Android release remain guarded by `github.ref == 'refs/heads/main'`.
- This branch must not be merged into `main` until the test matrix has been executed and reviewed.
- Native nearby-device implementation currently reaches discovery only. Encrypted pairing, local message/file transport and local call media are not to be reported as complete until implemented and tested.
