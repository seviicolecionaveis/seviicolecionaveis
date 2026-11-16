# Product presentation

- Accessories and sealed products share ProductCatalog, ProductDetail, ProductGallery and CommonProductFields; category-specific adapters preserve existing order identifiers and editors so product behavior does not fork.
- Public product loaders use listStoreProducts with the server publishable client and active-only RLS; administrative inventory calls recheck the live admin role before caller-scoped reads or updates.
- Accessory slugs and redirects are persisted by the database trigger; stock reservations, movements and order claims use service-only transactional RPCs to prevent last-unit races and duplicate movements.
