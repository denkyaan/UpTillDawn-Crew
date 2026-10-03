import { PwaRegister } from '@/components/pwa-register'
import { PushPermissionPrompt } from '@/components/push-permission-prompt'
import { FirstUseInstallPrompt } from '@/components/first-use-install-prompt'
import { LocaleSync } from '@/components/locale-sync'
import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/lib/providers'
import { AdminSelectionProvider } from '@/lib/admin-selection-context'
import { Toaster } from '@/components/ui/sonner'
import { SaveSuccessToaster } from '@/components/save-success-toaster'
import { PRODUCT_COPY, requestUiLocale } from '@/lib/server-locale'
import './globals.css'


export async function generateMetadata():Promise<Metadata>{
  const locale=await requestUiLocale()
  const copy=PRODUCT_COPY[locale]
  return {
    metadataBase:new URL('https://crew.uptilldawn.workers.dev'),
    title:{
      default:'UP TILL DAWN Crew',
      template:'%s | UP TILL DAWN Crew',
    },
    description:copy.description,
    applicationName:'UP TILL DAWN Crew',
    manifest:'/manifest.webmanifest',
    openGraph:{
      type:'website',
      siteName:'UP TILL DAWN Crew',
      title:'UP TILL DAWN Crew',
      description:copy.description,
      url:'https://crew.uptilldawn.workers.dev',
    },
    appleWebApp:{
      capable:true,
      statusBarStyle:'default',
      title:copy.staffTitle,
    },
    icons:{
      icon:'/up-till-dawn-mark.webp',
      apple:'/up-till-dawn-mark.webp',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#050505',
  userScalable: true,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const initialLocale=await requestUiLocale()

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <AdminSelectionProvider>
            <LocaleSync /><PwaRegister /><FirstUseInstallPrompt /><PushPermissionPrompt /><SaveSuccessToaster />{children}
            <Toaster richColors position="top-right" />
            </AdminSelectionProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
