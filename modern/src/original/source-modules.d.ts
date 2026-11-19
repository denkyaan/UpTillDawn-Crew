declare module 'main-source/*' {
 const Component:import('react').ComponentType<Record<string,unknown>>
 export default Component
}
declare module 'main-source/routes' {
 export const routes:Array<{path:string;load:()=>Promise<{default:import('react').ComponentType<Record<string,unknown>>}>}>
}

declare module 'main-source/lib/providers.tsx' {
export const AuthProvider:import('react').ComponentType<{children?:import('react').ReactNode}>
export function useAuth():{user:{id:string}|null;profile:object|null;loading:boolean;roleMode:string|null;isOwner:boolean}
}

declare module 'main-source/lib/admin-selection-context.tsx' {
export const AdminSelectionProvider:import('react').ComponentType<{children?:import('react').ReactNode}>
}

declare module 'main-source/components/auth/workspace-continuity.tsx' {
export const WorkspaceContinuity:import('react').ComponentType<{children?:import('react').ReactNode}>
}

declare module 'main-source/components/save-success-toaster.tsx' {
export const SaveSuccessToaster:import('react').ComponentType<{children?:import('react').ReactNode}>
}

declare module 'main-source/components/ui/sonner.tsx' {
export const Toaster:import('react').ComponentType<{richColors?:boolean;position?:string}>
}

declare module 'main-source/components/push-permission-prompt.tsx' {
export const PushPermissionPrompt:import('react').ComponentType<{children?:import('react').ReactNode}>
}

declare module 'main-source/components/first-use-install-prompt.tsx' {
export const FirstUseInstallPrompt:import('react').ComponentType<{children?:import('react').ReactNode}>
}

declare module 'main-source/components/lazy-client-bootstraps.tsx' {export const LazyPwaRegister:import('react').ComponentType}
