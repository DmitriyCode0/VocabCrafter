export function getCurrentPage(pageParam?: string | string[]) {
  const rawPage = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const parsedPage = Number(rawPage);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    return 1;
  }

  return parsedPage;
}

export function getPaginationRange(currentPage: number, pageSize: number) {
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  return { from, to };
}

export function getTotalPages(totalItems: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}
