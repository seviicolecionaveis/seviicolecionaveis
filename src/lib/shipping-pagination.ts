/** Read all RLS-visible pages, including when the API returns less than requested. */
export async function loadShippingPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (;;) {
    const page = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (page.length === 0) return rows;
    rows.push(...page);
  }
}