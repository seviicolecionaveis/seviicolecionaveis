export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cardSlug(name: string, collection: string, number: string): string {
  return slugify(`${collection}-${number}-${name}`);
}

export function collectionSlug(collection: string): string {
  return slugify(collection);
}
