// Mutations execute on Main, which performs the original revalidation there.
export function revalidatePath(){window.dispatchEvent(new Event('upt-source-refresh'))}
export function revalidateTag(){window.dispatchEvent(new Event('upt-source-refresh'))}
