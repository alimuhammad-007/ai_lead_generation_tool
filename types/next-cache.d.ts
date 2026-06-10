declare module "next/cache" {
  export function revalidatePath(originalPath: string, type?: "page" | "layout"): void;
  export function revalidateTag(tag: string): void;
  export function unstable_cache<T, P extends unknown[]>(
    cb: (...args: P) => Promise<T>,
    keyParts?: string[],
    options?: { revalidate?: number | false; tags?: string[] }
  ): (...args: P) => Promise<T>;
  export function unstable_noStore(): void;
}
