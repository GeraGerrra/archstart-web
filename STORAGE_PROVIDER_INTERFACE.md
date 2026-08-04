
# STORAGE PROVIDER INTERFACE

The content engine depends on `StorageProvider`, not on Supabase, Vercel Blob, or a live bucket.

Asset categories distinguish version-controlled text, optimized web images, large downloads, private certificates, YouTube media, and ignored internal evidence. Large Office/PDF originals must remain outside the production application bundle.

The included `LocalWorkbenchStorageProvider` is deliberately non-operational until an explicit local root is configured. It has no credentials and cannot be mistaken for production storage. Supabase Storage remains the recommended later default, subject to Phase-specific implementation and access control.
