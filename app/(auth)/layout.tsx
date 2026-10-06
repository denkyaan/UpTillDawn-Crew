import type { Metadata } from "next"
import { Footer } from "@/components/shared/footer"
import { PRODUCT_COPY, requestUiLocale } from "@/lib/server-locale"

export async function generateMetadata():Promise<Metadata>{
  const locale=await requestUiLocale()
  const copy=PRODUCT_COPY[locale]
  return {
    title:copy.loginTitle,
    description:copy.loginDescription,
    robots:{index:true,follow:true},
    alternates:{canonical:'/login'},
  }
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </div>
      <Footer />
    </div>
  )
}
